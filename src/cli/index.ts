import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { type Metric } from '../domain/metric.js';
import { resolveClaudeProjectDirs } from '../infrastructure/claude/claude-paths.js';
import { loadConfigOrDefault } from '../infrastructure/config/config-loader.js';
import { resolveConfigPath } from '../infrastructure/config/config-paths.js';
import { CONFIG_TEMPLATE } from '../infrastructure/config/config-template.js';
import { type Config } from '../infrastructure/config/schema.js';
import { locateGameSenseAddress } from '../infrastructure/gamesense/core-props-locator.js';
import { ConsoleLogger, type LogLevel } from '../infrastructure/logging/console-logger.js';
import { type Logger } from '../domain/ports.js';
import { buildDisplayPlan } from '../composition/build-display-plan.js';
import { buildRuntime, buildUsagePipeline } from '../composition/container.js';
import { VERSION } from '../version.js';
import { parseArgs } from './args.js';
import { previewKeys, previewScreens } from './preview.js';

const HELP = `steelseries-claude-code-usage (sscu) v${VERSION}
Show live Claude Code usage on your SteelSeries Apex Pro OLED + per-key RGB.

USAGE
  sscu <command> [options]

COMMANDS
  run                 Start the daemon (default)
  once                Push a single frame and exit
  preview             Show the OLED screens + key colors in the terminal
  stats [--json]      Print computed usage metrics (no device needed)
  doctor              Diagnose environment (Engine, Claude data, config)
  test-display        Blink a self-test pattern on the keyboard
  config init [--force]  Write an annotated config file
  config path         Print the resolved config file path
  help, version

OPTIONS
  -c, --config <path>  Config file (default: platform config dir / $SSCU_CONFIG)
      --offline        Never fetch live pricing (use bundled table)
  -v, --verbose        Debug logging
  -q, --quiet          Silence logging
  -h, --help           Show this help
  -V, --version        Show version
`;

async function main(argv: string[]): Promise<number> {
  const { command, positionals, flags } = parseArgs(argv);

  if (flags.version === true || command === 'version') {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (flags.help === true || command === 'help') {
    process.stdout.write(HELP);
    return 0;
  }

  const logger = new ConsoleLogger(logLevelFromFlags(flags));
  const { path: configPath } = resolveConfigPath(stringFlag(flags.config));
  const { config: loaded, loaded: didLoad } = await loadConfigOrDefault(configPath);
  const config: Config = flags.offline === true ? { ...loaded, offlinePricing: true } : loaded;

  switch (command) {
    case 'run':
      return cmdRun(config, logger);
    case 'once':
      return cmdOnce(config, logger);
    case 'preview':
      return cmdPreview(config, logger);
    case 'stats':
      return cmdStats(config, logger, flags.json === true);
    case 'doctor':
      return cmdDoctor(config, logger, configPath, didLoad);
    case 'test-display':
    case 'test':
      return cmdTestDisplay(config, logger);
    case 'config':
      return cmdConfig(positionals[0], configPath, flags.force === true);
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
      return 1;
  }
}

async function cmdRun(config: Config, logger: Logger): Promise<number> {
  const address = await locateGameSenseAddress();
  if (!address) return engineMissing(logger);

  const { pluginService } = buildRuntime({ config, address, logger });
  await pluginService.start();
  logger.info(`running — game "${config.game}" on ${address}. Press Ctrl+C to stop.`);

  await new Promise<void>((resolve) => {
    const shutdown = (): void => {
      logger.info('stopping…');
      void pluginService.stop().finally(resolve);
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
  return 0;
}

async function cmdOnce(config: Config, logger: Logger): Promise<number> {
  const address = await locateGameSenseAddress();
  if (!address) return engineMissing(logger);

  const { pluginService } = buildRuntime({ config, address, logger });
  await pluginService.runOnce();
  const screen = pluginService.buildFrame().screen;
  process.stdout.write(`Pushed one frame to ${address}.\n`);
  if (screen) {
    process.stdout.write(`OLED:\n${screen.lines.map((l) => `  | ${l}`).join('\n')}\n`);
  }
  return 0;
}

async function cmdPreview(config: Config, logger: Logger): Promise<number> {
  const { renderPlan } = buildDisplayPlan(config);

  const pipeline = buildUsagePipeline(config, logger);
  const planLimits = pipeline.planUsageSource ? await pipeline.planUsageSource.fetch() : [];
  const metrics = pipeline.metricResolver.resolve(
    await pipeline.snapshotProvider.snapshot(planLimits),
  );

  process.stdout.write(`${previewScreens(renderPlan.screens, metrics)}\n`);
  process.stdout.write(`${previewKeys(config)}\n`);
  return 0;
}

async function cmdStats(config: Config, logger: Logger, json: boolean): Promise<number> {
  const pipeline = buildUsagePipeline(config, logger);
  const planLimits = pipeline.planUsageSource ? await pipeline.planUsageSource.fetch() : [];
  const snapshot = await pipeline.snapshotProvider.snapshot(planLimits);
  const metrics = pipeline.metricResolver.resolve(snapshot);

  if (json) {
    const asObject = Object.fromEntries([...metrics.values()].map((m) => [m.id, m]));
    process.stdout.write(`${JSON.stringify(asObject, null, 2)}\n`);
    return 0;
  }

  const rows = [...metrics.values()].map((m) => formatStatRow(m));
  process.stdout.write(`${rows.join('\n')}\n`);
  return 0;
}

async function cmdDoctor(
  config: Config,
  logger: Logger,
  configPath: string,
  didLoad: boolean,
): Promise<number> {
  const lines: string[] = [`sscu doctor — v${VERSION}`, ''];

  const address = await locateGameSenseAddress();
  lines.push(
    check(
      Boolean(address),
      `SteelSeries Engine: ${address ?? 'not running / coreProps not found'}`,
    ),
  );

  const dirs = resolveClaudeProjectDirs();
  const existing: string[] = [];
  for (const dir of dirs) {
    if (await pathExists(dir)) existing.push(dir);
  }
  lines.push(
    check(
      existing.length > 0,
      `Claude data dirs: ${existing.length ? existing.join(', ') : 'none found'}`,
    ),
  );

  lines.push(
    didLoad
      ? check(true, `Config: ${configPath}`)
      : info(`Config: using defaults (no file at ${configPath})`),
  );

  try {
    const pipeline = buildUsagePipeline(config, logger);
    const snapshot = await pipeline.snapshotProvider.snapshot();
    const metrics = pipeline.metricResolver.resolve(snapshot);
    lines.push(
      info(
        `Today: ${metrics.get('today.cost')?.value ?? '—'} · Month: ${metrics.get('month.cost')?.value ?? '—'}`,
      ),
    );
    lines.push(
      info(
        `Active block: ${metrics.get('block.cost')?.value ?? '—'} (${metrics.get('block.usagePct')?.value ?? '—'} of peak)`,
      ),
    );
  } catch (error) {
    lines.push(check(false, `Usage pipeline failed: ${String(error)}`));
  }

  const ok = Boolean(address) && existing.length > 0;
  lines.push('', ok ? 'Ready ✔' : 'Not ready — see ✖ above.');
  process.stdout.write(`${lines.join('\n')}\n`);
  return ok ? 0 : 1;
}

async function cmdTestDisplay(config: Config, logger: Logger): Promise<number> {
  const address = await locateGameSenseAddress();
  if (!address) return engineMissing(logger);

  const { display } = buildRuntime({ config, address, logger });
  const { renderPlan } = buildDisplayPlan(config);
  await display.connect();
  process.stdout.write('Blinking a self-test pattern on your keyboard…\n');

  for (let step = 0; step < 6; step++) {
    const high = step % 2 === 0;
    const keyValues = Object.fromEntries(
      renderPlan.keyMetrics.map((binding) => [binding.id, high ? 90 : 15]),
    );
    await display.render({
      screen: { lines: ['sscu self-test', `frame ${step + 1}/6`] },
      keyValues,
    });
    await delay(700);
  }
  await display.dispose();
  process.stdout.write('Self-test done.\n');
  return 0;
}

async function cmdConfig(
  sub: string | undefined,
  configPath: string,
  force: boolean,
): Promise<number> {
  if (sub === 'path') {
    const exists = await pathExists(configPath);
    process.stdout.write(`${configPath}${exists ? '' : ' (does not exist yet)'}\n`);
    return 0;
  }
  if (sub === 'init') {
    if ((await pathExists(configPath)) && !force) {
      process.stderr.write(`Config already exists at ${configPath}. Use --force to overwrite.\n`);
      return 1;
    }
    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, CONFIG_TEMPLATE, 'utf8');
    process.stdout.write(`Wrote config to ${configPath}\n`);
    return 0;
  }
  process.stderr.write('Usage: sscu config <init|path>\n');
  return 1;
}

// --- helpers ----------------------------------------------------------------

function engineMissing(logger: Logger): number {
  logger.error(
    'SteelSeries Engine is not running (coreProps.json not found). Start SteelSeries GG and try again.',
  );
  return 1;
}

function logLevelFromFlags(flags: Record<string, string | boolean>): LogLevel {
  if (flags.quiet === true) return 'silent';
  if (flags.verbose === true) return 'debug';
  return 'info';
}

function stringFlag(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function formatStatRow(metric: Metric): string {
  const pct = metric.percent !== undefined ? `  [${Math.round(metric.percent)}%]` : '';
  return `${metric.id.padEnd(18)} ${metric.value.padStart(8)}${pct}`;
}

function check(ok: boolean, text: string): string {
  return `${ok ? '✔' : '✖'} ${text}`;
}

function info(text: string): string {
  return `· ${text}`;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main(process.argv.slice(2))
  .then((code) => {
    if (code !== 0) process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });

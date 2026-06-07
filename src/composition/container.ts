import { type Clock, type Logger, type PlanUsageSource } from '../domain/ports.js';
import { computeIntervals } from '../application/intervals.js';
import { MetricResolver } from '../application/metric-resolver.js';
import { PluginService } from '../application/plugin-service.js';
import {
  DefaultSnapshotProvider,
  type SnapshotProvider,
} from '../application/snapshot-provider.js';
import { AnthropicPlanUsageSource } from '../infrastructure/anthropic/plan-usage-source.js';
import { JsonlUsageSource } from '../infrastructure/claude/jsonl-usage-source.js';
import { type Config } from '../infrastructure/config/schema.js';
import { GameSenseClient } from '../infrastructure/gamesense/gamesense-client.js';
import { GameSenseDisplay } from '../infrastructure/gamesense/gamesense-display.js';
import { FetchHttpTransport } from '../infrastructure/gamesense/http-transport.js';
import { isBuiltInImage, resolveImage } from '../infrastructure/gamesense/image-loader.js';
import { LiteLlmPricingProvider } from '../infrastructure/pricing/litellm-pricing-provider.js';
import { systemClock } from '../infrastructure/system-clock.js';
import { buildDisplayPlan } from './build-display-plan.js';

export interface BuildRuntimeOptions {
  readonly config: Config;
  /** GameSense server address ("host:port") from the coreProps locator. */
  readonly address: string;
  readonly logger: Logger;
  readonly clock?: Clock;
  /** Injected fetch (testing / custom agents). */
  readonly fetchImpl?: typeof fetch;
  /** Pre-loaded image-screen bytes (file images); built-ins resolve themselves. */
  readonly images?: Record<string, number[]>;
}

/**
 * Pre-load any file-based image screens (PBM) referenced in config so the
 * (synchronous) plan builder has their bytes. Built-in images are skipped here.
 * Failures are logged and the screen is simply omitted.
 */
export async function loadScreenImages(
  config: Config,
  logger: Logger,
): Promise<Record<string, number[]>> {
  const sources = new Set<string>();
  for (const screen of config.oled.screens) {
    if ('image' in screen && !isBuiltInImage(screen.image)) sources.add(screen.image);
  }
  const images: Record<string, number[]> = {};
  for (const source of sources) {
    try {
      images[source] = await resolveImage(source);
    } catch (error) {
      logger.warn(`oled image "${source}" could not be loaded: ${String(error)}`);
    }
  }
  return images;
}

export interface Runtime {
  readonly pluginService: PluginService;
  readonly display: GameSenseDisplay;
  readonly snapshotProvider: SnapshotProvider;
  readonly metricResolver: MetricResolver;
  readonly planUsageSource: PlanUsageSource | undefined;
}

export interface UsagePipeline {
  readonly snapshotProvider: SnapshotProvider;
  readonly metricResolver: MetricResolver;
  readonly planUsageSource: PlanUsageSource | undefined;
}

/**
 * Build just the usage → metrics pipeline (no GameSense). Used by commands that
 * compute numbers without touching the keyboard, e.g. `stats`.
 */
export function buildUsagePipeline(
  config: Config,
  logger: Logger,
  clock: Clock = systemClock,
  fetchImpl?: typeof fetch,
): UsagePipeline {
  const usageSource = new JsonlUsageSource({ lookbackDays: config.lookbackDays, clock, logger });

  const pricingProvider = new LiteLlmPricingProvider({
    offline: config.offlinePricing,
    clock,
    logger,
    fetchImpl,
  });

  const snapshotProvider = new DefaultSnapshotProvider({
    usageSource,
    pricingProvider,
    clock,
    costMode: config.costMode,
    sessionLengthMs: config.sessionLengthHours * 60 * 60 * 1000,
    recentWindowMinutes: config.recentWindowMinutes,
  });

  const metricResolver = new MetricResolver({
    currencySymbol: config.currencySymbol,
    burnScaleTokensPerMin: config.burnScaleTokensPerMin,
    usageWarnPct: config.usageWarnPct,
    usageCriticalPct: config.usageCriticalPct,
  });

  const planUsageSource = config.planLimits.enabled
    ? new AnthropicPlanUsageSource({
        credentialsPath: config.planLimits.credentialsPath,
        fetchImpl,
        logger,
      })
    : undefined;

  return { snapshotProvider, metricResolver, planUsageSource };
}

/**
 * Composition root: assemble the entire object graph from validated config and
 * a known server address. The only place that knows how the concrete adapters
 * fit together — everything else depends on ports.
 */
export function buildRuntime(options: BuildRuntimeOptions): Runtime {
  const { config, address, logger } = options;
  const clock = options.clock ?? systemClock;

  const { snapshotProvider, metricResolver, planUsageSource } = buildUsagePipeline(
    config,
    logger,
    clock,
    options.fetchImpl,
  );

  const { plan, renderPlan } = buildDisplayPlan(config, options.images ?? {});
  const transport = new FetchHttpTransport(4000, options.fetchImpl);
  const client = new GameSenseClient(address, transport, config.game);
  const display = new GameSenseDisplay(client, plan, logger);

  const intervals = computeIntervals({
    pollIntervalSeconds: config.pollIntervalSeconds,
    rotateSeconds: config.oled.rotateSeconds,
  });

  const pluginService = new PluginService({
    snapshotProvider,
    metricResolver,
    display,
    clock,
    logger,
    renderPlan,
    pollIntervalMs: intervals.pollIntervalMs,
    renderIntervalMs: intervals.renderIntervalMs,
    planUsageSource,
  });

  return { pluginService, display, snapshotProvider, metricResolver, planUsageSource };
}

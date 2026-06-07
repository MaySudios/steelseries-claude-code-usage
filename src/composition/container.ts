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

  const { plan, renderPlan } = buildDisplayPlan(config);
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

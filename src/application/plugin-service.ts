import {
  type Clock,
  type Display,
  type DisplayFrame,
  type Logger,
  type PlanUsageSource,
} from '../domain/ports.js';
import { type Metric } from '../domain/metric.js';
import { type PlanLimit } from '../domain/plan-usage.js';
import { type MetricResolver, renderTemplate } from './metric-resolver.js';
import { type SnapshotProvider } from './snapshot-provider.js';

export interface RenderScreen {
  readonly lines: readonly string[];
}

/** Tells the service how to turn resolved metrics into a {@link DisplayFrame}. */
export interface RenderPlan {
  readonly oledEnabled: boolean;
  readonly screens: readonly RenderScreen[];
  readonly rotateSeconds: number;
  readonly keysEnabled: boolean;
  readonly keyMetrics: readonly { readonly id: string; readonly metric: string }[];
}

export interface PluginServiceDeps {
  readonly snapshotProvider: SnapshotProvider;
  readonly metricResolver: MetricResolver;
  readonly display: Display;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly renderPlan: RenderPlan;
  readonly pollIntervalMs: number;
  readonly renderIntervalMs: number;
  readonly planUsageSource?: PlanUsageSource;
}

/**
 * The orchestrator. Two cadences: usage data is recomputed every
 * `pollIntervalMs`, while the device is re-rendered every `renderIntervalMs`
 * from cached metrics (so OLED screens rotate smoothly and GameSense is kept
 * alive). Every step is wrapped so a transient failure never kills the loop.
 */
export class PluginService {
  private timer: ReturnType<typeof setInterval> | undefined;
  private ticking = false;
  private running = false;
  private metrics: Map<string, Metric> = new Map();
  private lastDataAtMs = 0;
  private startedAtMs = 0;

  constructor(private readonly deps: PluginServiceDeps) {}

  /** Connect, render once, then start the render/poll loop. */
  async start(): Promise<void> {
    await this.deps.display.connect();
    await this.refreshData();
    this.startedAtMs = this.deps.clock.now().getTime(); // anchor rotation at first render
    await this.renderOnce();
    this.running = true;
    this.timer = setInterval(() => void this.safeTick(), this.deps.renderIntervalMs);
  }

  /** Stop the loop and deregister the game. */
  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.deps.display.dispose();
  }

  /** Connect, compute and render a single frame; leaves the game registered. */
  async runOnce(): Promise<void> {
    await this.deps.display.connect();
    await this.refreshData();
    this.startedAtMs = this.deps.clock.now().getTime(); // one-shot → screen 0
    await this.renderOnce();
  }

  /** Recompute metrics from the latest usage data (+ optional plan limits). */
  async refreshData(): Promise<void> {
    try {
      const snapshot = await this.deps.snapshotProvider.snapshot(await this.loadPlanLimits());
      this.metrics = this.deps.metricResolver.resolve(snapshot);
      this.lastDataAtMs = this.deps.clock.now().getTime();
    } catch (error) {
      this.deps.logger.error(`data refresh failed: ${String(error)}`);
    }
  }

  /** The frame that would currently be pushed (used by the loop and `test-display`). */
  buildFrame(): DisplayFrame {
    const plan = this.deps.renderPlan;
    const screen = plan.oledEnabled ? this.currentScreen() : undefined;
    const screenLines = screen
      ? screen.lines.map((line) => renderTemplate(line, this.metrics))
      : [];

    const keyValues: Record<string, number> = {};
    if (plan.keysEnabled) {
      for (const binding of plan.keyMetrics) {
        keyValues[binding.id] = this.metrics.get(binding.metric)?.percent ?? 0;
      }
    }
    return { screenLines, keyValues };
  }

  get currentMetrics(): ReadonlyMap<string, Metric> {
    return this.metrics;
  }

  private async safeTick(): Promise<void> {
    if (this.ticking || !this.running) return;
    this.ticking = true;
    try {
      const now = this.deps.clock.now().getTime();
      if (now - this.lastDataAtMs >= this.deps.pollIntervalMs) await this.refreshData();
      await this.renderOnce();
      try {
        await this.deps.display.heartbeat();
      } catch (error) {
        this.deps.logger.debug(`heartbeat failed: ${String(error)}`);
      }
    } catch (error) {
      this.deps.logger.error(`tick failed: ${String(error)}`);
    } finally {
      this.ticking = false;
    }
  }

  private async loadPlanLimits(): Promise<PlanLimit[]> {
    if (!this.deps.planUsageSource) return [];
    try {
      return [...(await this.deps.planUsageSource.fetch())];
    } catch (error) {
      this.deps.logger.warn(`plan limits fetch failed: ${String(error)}`);
      return [];
    }
  }

  private currentScreen(): RenderScreen | undefined {
    const { screens, rotateSeconds } = this.deps.renderPlan;
    const first = screens[0];
    if (first === undefined) return undefined;
    if (screens.length <= 1 || rotateSeconds <= 0) return first;
    const elapsed = this.deps.clock.now().getTime() - this.startedAtMs;
    const index = Math.floor(elapsed / (rotateSeconds * 1000)) % screens.length;
    return screens[index] ?? first;
  }

  private async renderOnce(): Promise<void> {
    try {
      await this.deps.display.render(this.buildFrame());
    } catch (error) {
      this.deps.logger.error(`render failed: ${String(error)}`);
    }
  }
}

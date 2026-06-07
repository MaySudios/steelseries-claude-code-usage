import { type ModelPricing } from './cost.js';
import { type PlanLimit } from './plan-usage.js';
import { type UsageEntry } from './usage-entry.js';

/** Time source. Injected everywhere instead of `new Date()` so tests are deterministic. */
export interface Clock {
  now(): Date;
}

/** Minimal structured logger. */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/** Reads and deduplicates raw usage entries from Claude Code transcripts. */
export interface UsageSource {
  load(): Promise<UsageEntry[]>;
}

/** Resolves per-token pricing for a model name. Returns `undefined` if unknown. */
export interface PricingProvider {
  getPricing(model: string): Promise<ModelPricing | undefined>;
}

/** Optional source of subscription/plan utilization figures. */
export interface PlanUsageSource {
  fetch(): Promise<PlanLimit[]>;
}

/**
 * Everything the orchestrator needs to push to the hardware in one tick.
 * Intentionally value-driven (no device JSON) so it stays decoupled from
 * GameSense and is trivial to fake in tests.
 */
export interface DisplayFrame {
  /** OLED rows, top to bottom. Implementations pad/truncate to the device. */
  readonly screenLines: readonly string[];
  /** Configured key-binding id → control value (0–100) that drives its handler. */
  readonly keyValues: Readonly<Record<string, number>>;
}

/** Output port for the keyboard (OLED + per-key RGB). */
export interface Display {
  /** Register the app and bind all events/handlers. Must be safe to call once. */
  connect(): Promise<void>;
  /** Push the current frame to the device(s). */
  render(frame: DisplayFrame): Promise<void>;
  /** Reset the GameSense deactivation timer between renders. */
  heartbeat(): Promise<void>;
  /** Best-effort teardown (deregister the game). */
  dispose(): Promise<void>;
}

import { type CostBreakdown } from './cost.js';
import { type TokenCounts } from './tokens.js';

/**
 * A "5-hour billing block" — the rolling window Claude Code subscriptions are
 * metered against. A block opens at the first activity (floored to the hour)
 * and closes once `sessionLength` elapses or after a gap of `sessionLength`
 * with no activity.
 */
export interface UsageBlock {
  /** Window start (first activity floored to the top of the hour). */
  readonly startTime: Date;
  /** Window end (`startTime` + session length). */
  readonly endTime: Date;
  /** Timestamp of the most recent entry inside the block. */
  readonly lastActivity: Date;
  readonly tokens: TokenCounts;
  readonly cost: CostBreakdown;
  readonly entryCount: number;
  readonly models: readonly string[];
  /** True when "now" is still inside the window and activity is recent. */
  readonly isActive: boolean;
}

/** Derived, forward-looking statistics for the currently active block. */
export interface ActiveBlockStats {
  readonly block: UsageBlock;
  readonly minutesElapsed: number;
  readonly minutesRemaining: number;
  /** Tokens consumed per minute since the block opened. */
  readonly burnRateTokensPerMin: number;
  /** Estimated total tokens if the current burn rate holds until the window closes. */
  readonly projectedTokens: number;
  /** Estimated total USD if the current burn rate holds until the window closes. */
  readonly projectedCostUSD: number;
  /**
   * Block token usage as a fraction (0–1+) of `limitTokens`. Values above 1
   * mean the historical ceiling has been exceeded. `undefined` when no limit
   * could be derived (e.g. no prior blocks).
   */
  readonly usageRatio: number | undefined;
  /** The token ceiling this ratio is measured against, if any. */
  readonly limitTokens: number | undefined;
}

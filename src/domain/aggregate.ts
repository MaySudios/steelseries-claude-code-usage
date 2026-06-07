import { type CostBreakdown } from './cost.js';
import { type TokenCounts } from './tokens.js';

/** A rolled-up view of usage over some span (a day, a month, a session, …). */
export interface UsageAggregate {
  readonly tokens: TokenCounts;
  readonly cost: CostBreakdown;
  readonly entryCount: number;
  readonly models: readonly string[];
  readonly firstTimestamp: Date | undefined;
  readonly lastTimestamp: Date | undefined;
}

/** Cache efficiency: cache-read tokens as a fraction of non-cache input tokens. */
export function cacheHitRatio(tokens: TokenCounts): number {
  const denominator = tokens.inputTokens + tokens.cacheReadInputTokens;
  if (denominator <= 0) return 0;
  return tokens.cacheReadInputTokens / denominator;
}

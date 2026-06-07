import { type UsageAggregate } from '../domain/aggregate.js';
import { addCost } from '../domain/cost.js';
import { ZERO_COST } from '../domain/cost.js';
import { ZERO_TOKENS, addTokens } from '../domain/tokens.js';
import { type UsageEntry } from '../domain/usage-entry.js';
import { type CostCalculator } from './cost-calculator.js';

/** Rolls usage entries up into {@link UsageAggregate}s and slices them by time. */
export class UsageAggregator {
  constructor(private readonly coster: CostCalculator) {}

  /** Total tokens + cost across the given entries. */
  aggregate(entries: readonly UsageEntry[]): UsageAggregate {
    let tokens = ZERO_TOKENS;
    let cost = ZERO_COST;
    const models = new Set<string>();
    let first: Date | undefined;
    let last: Date | undefined;

    for (const entry of entries) {
      tokens = addTokens(tokens, entry.tokens);
      cost = addCost(cost, this.coster.cost(entry));
      models.add(entry.model);
      if (first === undefined || entry.timestamp < first) first = entry.timestamp;
      if (last === undefined || entry.timestamp > last) last = entry.timestamp;
    }

    return {
      tokens,
      cost,
      entryCount: entries.length,
      models: [...models],
      firstTimestamp: first,
      lastTimestamp: last,
    };
  }

  /** Aggregate only entries at or after `from`. */
  aggregateSince(entries: readonly UsageEntry[], from: Date): UsageAggregate {
    return this.aggregate(entriesSince(entries, from));
  }
}

/** Filter entries with `timestamp >= from`. */
export function entriesSince(entries: readonly UsageEntry[], from: Date): UsageEntry[] {
  const threshold = from.getTime();
  return entries.filter((entry) => entry.timestamp.getTime() >= threshold);
}

import { type UsageAggregate } from '../domain/aggregate.js';
import { type ActiveBlockStats } from '../domain/block.js';
import { type Clock } from '../domain/ports.js';
import { type PlanLimit } from '../domain/plan-usage.js';
import { totalTokens } from '../domain/tokens.js';
import { type UsageEntry } from '../domain/usage-entry.js';
import { type BlockCalculator } from './block-calculator.js';
import { startOfLocalDay, startOfLocalMonth } from './time.js';
import { type UsageAggregator } from './usage-aggregator.js';

const DEFAULT_RECENT_WINDOW_MIN = 5;

/** A single computed picture of "where things stand right now". */
export interface UsageSnapshot {
  readonly now: Date;
  readonly activeBlock: ActiveBlockStats | undefined;
  readonly today: UsageAggregate;
  readonly month: UsageAggregate;
  readonly recentModel: string | undefined;
  /** Tokens/min over the last `recentWindowMinutes` — "is Claude cranking right now". */
  readonly recentRateTokensPerMin: number;
  readonly planLimits: readonly PlanLimit[];
}

export interface SnapshotServiceDeps {
  readonly aggregator: UsageAggregator;
  readonly blockCalculator: BlockCalculator;
  readonly clock: Clock;
  /** Window for the live burn rate. Default 5 minutes. */
  readonly recentWindowMinutes?: number;
}

/** Assembles a {@link UsageSnapshot} from raw entries (+ optional plan limits). */
export class SnapshotService {
  constructor(private readonly deps: SnapshotServiceDeps) {}

  build(entries: readonly UsageEntry[], planLimits: readonly PlanLimit[] = []): UsageSnapshot {
    const now = this.deps.clock.now();
    const today = this.deps.aggregator.aggregateSince(entries, startOfLocalDay(now));
    const month = this.deps.aggregator.aggregateSince(entries, startOfLocalMonth(now));
    const blocks = this.deps.blockCalculator.computeBlocks(entries);
    const activeBlock = this.deps.blockCalculator.activeStats(blocks);

    return {
      now,
      activeBlock,
      today,
      month,
      recentModel: entries.at(-1)?.model,
      recentRateTokensPerMin: this.recentRate(entries, now),
      planLimits,
    };
  }

  private recentRate(entries: readonly UsageEntry[], now: Date): number {
    const windowMin = this.deps.recentWindowMinutes ?? DEFAULT_RECENT_WINDOW_MIN;
    if (windowMin <= 0) return 0;
    const from = now.getTime() - windowMin * 60_000;
    let tokens = 0;
    for (const entry of entries) {
      if (entry.timestamp.getTime() >= from) tokens += totalTokens(entry.tokens);
    }
    return tokens / windowMin;
  }
}

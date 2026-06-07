import { type UsageAggregate } from '../domain/aggregate.js';
import { type ActiveBlockStats } from '../domain/block.js';
import { type Clock } from '../domain/ports.js';
import { type PlanLimit } from '../domain/plan-usage.js';
import { type UsageEntry } from '../domain/usage-entry.js';
import { type BlockCalculator } from './block-calculator.js';
import { startOfLocalDay, startOfLocalMonth } from './time.js';
import { type UsageAggregator } from './usage-aggregator.js';

/** A single computed picture of "where things stand right now". */
export interface UsageSnapshot {
  readonly now: Date;
  readonly activeBlock: ActiveBlockStats | undefined;
  readonly today: UsageAggregate;
  readonly month: UsageAggregate;
  readonly recentModel: string | undefined;
  readonly planLimits: readonly PlanLimit[];
}

export interface SnapshotServiceDeps {
  readonly aggregator: UsageAggregator;
  readonly blockCalculator: BlockCalculator;
  readonly clock: Clock;
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
      planLimits,
    };
  }
}

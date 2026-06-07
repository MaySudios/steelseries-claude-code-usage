import { type Clock } from '../domain/ports.js';
import { type PricingProvider } from '../domain/ports.js';
import { type UsageSource } from '../domain/ports.js';
import { type PlanLimit } from '../domain/plan-usage.js';
import { BlockCalculator } from './block-calculator.js';
import { type CostMode, CostCalculator } from './cost-calculator.js';
import { SnapshotService, type UsageSnapshot } from './usage-snapshot.js';
import { UsageAggregator } from './usage-aggregator.js';

export interface SnapshotProvider {
  snapshot(planLimits?: readonly PlanLimit[]): Promise<UsageSnapshot>;
}

export interface DefaultSnapshotProviderDeps {
  readonly usageSource: UsageSource;
  readonly pricingProvider: PricingProvider;
  readonly clock: Clock;
  readonly costMode: CostMode;
  readonly sessionLengthMs: number;
  readonly recentWindowMinutes: number;
}

/**
 * The per-refresh wiring: loads entries, resolves pricing for exactly the
 * models present (so brand-new models get priced), and assembles a snapshot.
 * Recreating the calculators each refresh keeps pricing current and keeps the
 * stateless services (aggregator/block calculator) trivially testable.
 */
export class DefaultSnapshotProvider implements SnapshotProvider {
  constructor(private readonly deps: DefaultSnapshotProviderDeps) {}

  async snapshot(planLimits: readonly PlanLimit[] = []): Promise<UsageSnapshot> {
    const entries = await this.deps.usageSource.load();
    const coster = await CostCalculator.create(
      entries.map((entry) => entry.model),
      this.deps.pricingProvider,
      this.deps.costMode,
    );
    const service = new SnapshotService({
      aggregator: new UsageAggregator(coster),
      blockCalculator: new BlockCalculator(coster, this.deps.clock, {
        sessionLengthMs: this.deps.sessionLengthMs,
      }),
      clock: this.deps.clock,
      recentWindowMinutes: this.deps.recentWindowMinutes,
    });
    return service.build(entries, planLimits);
  }
}

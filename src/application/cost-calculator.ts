import {
  type CostBreakdown,
  type ModelPricing,
  ZERO_COST,
  computeCost,
  flatCost,
} from '../domain/cost.js';
import { type PricingProvider } from '../domain/ports.js';
import { type UsageEntry } from '../domain/usage-entry.js';

/**
 * How a cost figure is derived, mirroring ccusage's `--mode`:
 *  - `auto`      — use Claude Code's pre-computed `costUSD` when present, else compute.
 *  - `calculate` — always compute from tokens × pricing (ignore `costUSD`).
 *  - `display`   — only show pre-computed `costUSD` (others count as $0).
 */
export type CostMode = 'auto' | 'calculate' | 'display';

export const COST_MODES: readonly CostMode[] = ['auto', 'calculate', 'display'];

/**
 * Prices a set of usage entries. Pricing is resolved once up-front (async),
 * after which {@link CostCalculator.cost} is a pure, synchronous function — so
 * the aggregator and block calculator stay synchronous and trivially testable.
 */
export class CostCalculator {
  private constructor(
    private readonly pricings: ReadonlyMap<string, ModelPricing>,
    private readonly mode: CostMode,
  ) {}

  /** Pre-resolve pricing for every distinct model, then build the calculator. */
  static async create(
    models: Iterable<string>,
    provider: PricingProvider,
    mode: CostMode = 'auto',
  ): Promise<CostCalculator> {
    const pricings = new Map<string, ModelPricing>();
    const distinct = [...new Set(models)];
    await Promise.all(
      distinct.map(async (model) => {
        const pricing = await provider.getPricing(model);
        if (pricing) pricings.set(model, pricing);
      }),
    );
    return new CostCalculator(pricings, mode);
  }

  /** Build directly from a known pricing map (used in tests and the CLI). */
  static fromMap(
    pricings: ReadonlyMap<string, ModelPricing>,
    mode: CostMode = 'auto',
  ): CostCalculator {
    return new CostCalculator(pricings, mode);
  }

  cost(entry: UsageEntry): CostBreakdown {
    if (this.mode === 'display') {
      return entry.costUSD !== undefined ? flatCost(entry.costUSD) : ZERO_COST;
    }
    if (this.mode === 'auto' && entry.costUSD !== undefined) {
      return flatCost(entry.costUSD);
    }
    const pricing = this.pricings.get(entry.model);
    if (pricing) return computeCost(entry.tokens, pricing);
    // `calculate` mode (or `auto` with no `costUSD`) but pricing is unknown:
    // fall back to a pre-computed figure if we have one, otherwise zero.
    return entry.costUSD !== undefined ? flatCost(entry.costUSD) : ZERO_COST;
  }
}

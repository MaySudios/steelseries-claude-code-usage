import { type TokenCounts } from './tokens.js';

/**
 * Per-token USD prices for a single model. Field names mirror the LiteLLM
 * `model_prices_and_context_window.json` dataset that ccusage also consumes.
 */
export interface ModelPricing {
  readonly inputCostPerToken: number;
  readonly outputCostPerToken: number;
  readonly cacheCreationInputTokenCost: number;
  readonly cacheReadInputTokenCost: number;
}

/** USD cost split by token class. */
export interface CostBreakdown {
  readonly inputCost: number;
  readonly outputCost: number;
  readonly cacheCreationCost: number;
  readonly cacheReadCost: number;
}

export const ZERO_COST: CostBreakdown = Object.freeze({
  inputCost: 0,
  outputCost: 0,
  cacheCreationCost: 0,
  cacheReadCost: 0,
});

/**
 * The canonical cost formula shared with ccusage:
 *
 *   cost = inputTokens        * inputPrice
 *        + outputTokens       * outputPrice
 *        + cacheCreateTokens  * cacheCreatePrice
 *        + cacheReadTokens    * cacheReadPrice
 */
export function computeCost(tokens: TokenCounts, pricing: ModelPricing): CostBreakdown {
  return {
    inputCost: tokens.inputTokens * pricing.inputCostPerToken,
    outputCost: tokens.outputTokens * pricing.outputCostPerToken,
    cacheCreationCost: tokens.cacheCreationInputTokens * pricing.cacheCreationInputTokenCost,
    cacheReadCost: tokens.cacheReadInputTokens * pricing.cacheReadInputTokenCost,
  };
}

/** Total USD across all token classes. */
export function totalCost(c: CostBreakdown): number {
  return c.inputCost + c.outputCost + c.cacheCreationCost + c.cacheReadCost;
}

export function addCost(a: CostBreakdown, b: CostBreakdown): CostBreakdown {
  return {
    inputCost: a.inputCost + b.inputCost,
    outputCost: a.outputCost + b.outputCost,
    cacheCreationCost: a.cacheCreationCost + b.cacheCreationCost,
    cacheReadCost: a.cacheReadCost + b.cacheReadCost,
  };
}

/** A flat USD amount expressed as a {@link CostBreakdown} (booked as input cost). */
export function flatCost(usd: number): CostBreakdown {
  return { inputCost: usd, outputCost: 0, cacheCreationCost: 0, cacheReadCost: 0 };
}

export function sumCost(costs: Iterable<CostBreakdown>): CostBreakdown {
  let acc = ZERO_COST;
  for (const c of costs) acc = addCost(acc, c);
  return acc;
}

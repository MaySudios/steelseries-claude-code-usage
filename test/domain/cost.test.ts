import { describe, expect, it } from 'vitest';
import {
  type ModelPricing,
  ZERO_COST,
  addCost,
  computeCost,
  flatCost,
  sumCost,
  totalCost,
} from '../../src/domain/cost.js';
import { tokenCounts } from '../../src/domain/tokens.js';

// Claude Opus 4.1 figures from the LiteLLM dataset (per-token USD).
const opusPricing: ModelPricing = {
  inputCostPerToken: 1.5e-5,
  outputCostPerToken: 7.5e-5,
  cacheCreationInputTokenCost: 1.875e-5,
  cacheReadInputTokenCost: 1.5e-6,
};

describe('computeCost', () => {
  it('applies each per-token price to its token class', () => {
    const tokens = tokenCounts({
      inputTokens: 1000,
      outputTokens: 1000,
      cacheCreationInputTokens: 1000,
      cacheReadInputTokens: 1000,
    });
    const cost = computeCost(tokens, opusPricing);
    expect(cost.inputCost).toBeCloseTo(0.015, 10);
    expect(cost.outputCost).toBeCloseTo(0.075, 10);
    expect(cost.cacheCreationCost).toBeCloseTo(0.01875, 10);
    expect(cost.cacheReadCost).toBeCloseTo(0.0015, 10);
    expect(totalCost(cost)).toBeCloseTo(0.11025, 10);
  });

  it('is zero for zero tokens', () => {
    expect(computeCost(tokenCounts({}), opusPricing)).toEqual(ZERO_COST);
  });
});

describe('addCost / sumCost', () => {
  it('adds element-wise', () => {
    const a = { inputCost: 1, outputCost: 2, cacheCreationCost: 3, cacheReadCost: 4 };
    const b = { inputCost: 5, outputCost: 6, cacheCreationCost: 7, cacheReadCost: 8 };
    expect(addCost(a, b)).toEqual({
      inputCost: 6,
      outputCost: 8,
      cacheCreationCost: 10,
      cacheReadCost: 12,
    });
  });

  it('sums an empty iterable to ZERO_COST', () => {
    expect(sumCost([])).toEqual(ZERO_COST);
  });
});

describe('flatCost', () => {
  it('books a pre-computed amount as input cost with the right total', () => {
    const c = flatCost(0.42);
    expect(totalCost(c)).toBeCloseTo(0.42, 10);
  });
});

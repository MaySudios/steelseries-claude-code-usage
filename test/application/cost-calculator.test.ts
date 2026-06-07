import { describe, expect, it } from 'vitest';
import { type ModelPricing } from '../../src/domain/cost.js';
import { totalCost } from '../../src/domain/cost.js';
import { type PricingProvider } from '../../src/domain/ports.js';
import { CostCalculator } from '../../src/application/cost-calculator.js';
import { entry } from '../helpers.js';

const sonnet: ModelPricing = {
  inputCostPerToken: 3e-6,
  outputCostPerToken: 1.5e-5,
  cacheCreationInputTokenCost: 3.75e-6,
  cacheReadInputTokenCost: 3e-7,
};

const provider: PricingProvider = {
  async getPricing(model) {
    return model.includes('sonnet') ? sonnet : undefined;
  },
};

describe('CostCalculator', () => {
  it('calculate mode computes from tokens and ignores costUSD', async () => {
    const calc = await CostCalculator.create(['claude-sonnet-4-6'], provider, 'calculate');
    const cost = calc.cost(entry({ model: 'claude-sonnet-4-6', inputTokens: 1000, costUSD: 999 }));
    expect(cost.inputCost).toBeCloseTo(0.003, 10);
    expect(totalCost(cost)).toBeCloseTo(0.003, 10);
  });

  it('display mode shows only the pre-computed costUSD', async () => {
    const calc = await CostCalculator.create(['claude-sonnet-4-6'], provider, 'display');
    expect(totalCost(calc.cost(entry({ inputTokens: 1000, costUSD: 0.42 })))).toBeCloseTo(0.42, 10);
    expect(totalCost(calc.cost(entry({ inputTokens: 1000 })))).toBe(0); // no costUSD → $0
  });

  it('auto mode prefers costUSD, else computes', async () => {
    const calc = await CostCalculator.create(['claude-sonnet-4-6'], provider, 'auto');
    expect(
      totalCost(calc.cost(entry({ model: 'claude-sonnet-4-6', inputTokens: 1000, costUSD: 0.5 }))),
    ).toBe(0.5);
    expect(
      totalCost(calc.cost(entry({ model: 'claude-sonnet-4-6', inputTokens: 1000 }))),
    ).toBeCloseTo(0.003, 10);
  });

  it('falls back to costUSD (then zero) when pricing is unknown in calculate mode', async () => {
    const calc = await CostCalculator.create(['mystery'], provider, 'calculate');
    expect(totalCost(calc.cost(entry({ model: 'mystery', inputTokens: 1000, costUSD: 0.9 })))).toBe(
      0.9,
    );
    expect(totalCost(calc.cost(entry({ model: 'mystery', inputTokens: 1000 })))).toBe(0);
  });
});

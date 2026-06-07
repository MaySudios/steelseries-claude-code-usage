import { describe, expect, it } from 'vitest';
import { totalCost } from '../../src/domain/cost.js';
import { CostCalculator } from '../../src/application/cost-calculator.js';
import { UsageAggregator, entriesSince } from '../../src/application/usage-aggregator.js';
import { entry } from '../helpers.js';

const calc = CostCalculator.fromMap(new Map(), 'display');
const aggregator = new UsageAggregator(calc);

describe('UsageAggregator.aggregate', () => {
  it('sums tokens, cost, models and timestamp bounds', () => {
    const result = aggregator.aggregate([
      entry({ timestamp: '2026-06-07T10:00:00Z', model: 'a', inputTokens: 100, costUSD: 1 }),
      entry({ timestamp: '2026-06-07T12:00:00Z', model: 'b', outputTokens: 50, costUSD: 2 }),
      entry({ timestamp: '2026-06-07T11:00:00Z', model: 'a', inputTokens: 25, costUSD: 0.5 }),
    ]);
    expect(result.tokens.inputTokens).toBe(125);
    expect(result.tokens.outputTokens).toBe(50);
    expect(totalCost(result.cost)).toBeCloseTo(3.5, 10);
    expect(result.entryCount).toBe(3);
    expect([...result.models].sort()).toEqual(['a', 'b']);
    expect(result.firstTimestamp?.toISOString()).toBe('2026-06-07T10:00:00.000Z');
    expect(result.lastTimestamp?.toISOString()).toBe('2026-06-07T12:00:00.000Z');
  });

  it('returns an empty aggregate for no entries', () => {
    const result = aggregator.aggregate([]);
    expect(result.entryCount).toBe(0);
    expect(result.firstTimestamp).toBeUndefined();
    expect(totalCost(result.cost)).toBe(0);
  });
});

describe('entriesSince', () => {
  it('keeps entries at or after the threshold', () => {
    const entries = [
      entry({ timestamp: '2026-06-07T09:00:00Z' }),
      entry({ timestamp: '2026-06-07T10:00:00Z' }),
      entry({ timestamp: '2026-06-07T11:00:00Z' }),
    ];
    const filtered = entriesSince(entries, new Date('2026-06-07T10:00:00Z'));
    expect(filtered).toHaveLength(2);
  });
});

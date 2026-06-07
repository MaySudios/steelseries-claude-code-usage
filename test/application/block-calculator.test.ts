import { describe, expect, it } from 'vitest';
import { totalTokens } from '../../src/domain/tokens.js';
import { BlockCalculator } from '../../src/application/block-calculator.js';
import { CostCalculator } from '../../src/application/cost-calculator.js';
import { entry, fixedClock } from '../helpers.js';

const FIVE_HOURS_MIN = 300;
// `display` mode → each entry's cost is its pre-computed costUSD.
const coster = CostCalculator.fromMap(new Map(), 'display');

describe('BlockCalculator.computeBlocks', () => {
  it('splits blocks on a gap larger than the session length', () => {
    const clock = fixedClock('2026-06-07T18:00:00Z');
    const calc = new BlockCalculator(coster, clock);
    const blocks = calc.computeBlocks([
      entry({ timestamp: '2026-06-07T10:00:00Z', inputTokens: 1000 }),
      entry({ timestamp: '2026-06-07T10:30:00Z', inputTokens: 1000 }),
      entry({ timestamp: '2026-06-07T11:00:00Z', inputTokens: 1000 }),
      // 6h gap → new block
      entry({ timestamp: '2026-06-07T17:00:00Z', inputTokens: 600 }),
    ]);

    expect(blocks).toHaveLength(2);
    expect(totalTokens(blocks[0]!.tokens)).toBe(3000);
    expect(totalTokens(blocks[1]!.tokens)).toBe(600);
    // Every block window is exactly the session length.
    for (const block of blocks) {
      expect(block.endTime.getTime() - block.startTime.getTime()).toBe(FIVE_HOURS_MIN * 60_000);
    }
  });

  it('splits a long continuous run once the session length elapses', () => {
    const clock = fixedClock('2026-06-07T20:00:00Z');
    const calc = new BlockCalculator(coster, clock);
    const blocks = calc.computeBlocks(
      Array.from({ length: 7 }, (_, i) =>
        entry({ timestamp: `2026-06-07T${10 + i}:00:00Z`, inputTokens: 100 }),
      ),
    );
    expect(blocks.length).toBe(2);
  });

  it('returns no blocks for no entries', () => {
    const calc = new BlockCalculator(coster, fixedClock('2026-06-07T18:00:00Z'));
    expect(calc.computeBlocks([])).toEqual([]);
  });
});

describe('BlockCalculator.activeStats', () => {
  it('derives burn rate, projection, and headroom for the active block', () => {
    const clock = fixedClock('2026-06-07T18:00:00Z');
    const calc = new BlockCalculator(coster, clock);
    const blocks = calc.computeBlocks([
      entry({ timestamp: '2026-06-07T10:00:00Z', inputTokens: 1000, costUSD: 1 }),
      entry({ timestamp: '2026-06-07T10:30:00Z', inputTokens: 1000, costUSD: 1 }),
      entry({ timestamp: '2026-06-07T11:00:00Z', inputTokens: 1000, costUSD: 1 }),
      entry({ timestamp: '2026-06-07T17:00:00Z', inputTokens: 600, costUSD: 2 }),
    ]);
    const stats = calc.activeStats(blocks)!;

    expect(stats).toBeDefined();
    expect(stats.block.isActive).toBe(true);
    // tz-independent facts:
    expect(totalTokens(stats.block.tokens)).toBe(600);
    expect(stats.limitTokens).toBe(3000); // peak of the other (completed) block
    expect(stats.usageRatio).toBeCloseTo(0.2, 10);
    // window invariant + formula wiring (tz-robust by deriving from the block):
    expect(stats.minutesElapsed + stats.minutesRemaining).toBeCloseTo(FIVE_HOURS_MIN, 6);
    expect(stats.burnRateTokensPerMin).toBeCloseTo(600 / stats.minutesElapsed, 6);
    expect(stats.projectedTokens).toBeCloseTo(
      600 + stats.burnRateTokensPerMin * stats.minutesRemaining,
      6,
    );
    expect(stats.projectedCostUSD).toBeGreaterThan(2); // projects above the $2 already spent
  });

  it('returns undefined when no block is active', () => {
    const clock = fixedClock('2026-06-09T00:00:00Z'); // long after any activity
    const calc = new BlockCalculator(coster, clock);
    const blocks = calc.computeBlocks([
      entry({ timestamp: '2026-06-07T10:00:00Z', inputTokens: 100 }),
    ]);
    expect(calc.activeStats(blocks)).toBeUndefined();
  });
});

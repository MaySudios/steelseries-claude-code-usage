import { describe, expect, it } from 'vitest';
import { BlockCalculator } from '../../src/application/block-calculator.js';
import { CostCalculator } from '../../src/application/cost-calculator.js';
import { SnapshotService } from '../../src/application/usage-snapshot.js';
import { UsageAggregator } from '../../src/application/usage-aggregator.js';
import { entry, fixedClock } from '../helpers.js';

const coster = CostCalculator.fromMap(new Map(), 'display');

function service(nowIso: string, recentWindowMinutes: number): SnapshotService {
  const clock = fixedClock(nowIso);
  return new SnapshotService({
    aggregator: new UsageAggregator(coster),
    blockCalculator: new BlockCalculator(coster, clock),
    clock,
    recentWindowMinutes,
  });
}

describe('SnapshotService recent burn rate', () => {
  it('counts only tokens within the recent window, per minute', () => {
    const snapshot = service('2026-06-07T18:00:00Z', 5).build([
      entry({ timestamp: '2026-06-07T17:58:00Z', inputTokens: 600, outputTokens: 400 }), // in window
      entry({ timestamp: '2026-06-07T17:50:00Z', inputTokens: 5000 }), // outside window
    ]);
    expect(snapshot.recentRateTokensPerMin).toBeCloseTo(1000 / 5, 6); // 200 tok/min
  });

  it('is 0 when nothing happened recently (LED idles off)', () => {
    const snapshot = service('2026-06-07T18:00:00Z', 5).build([
      entry({ timestamp: '2026-06-07T16:00:00Z', inputTokens: 9999 }),
    ]);
    expect(snapshot.recentRateTokensPerMin).toBe(0);
  });

  it('disables the window when recentWindowMinutes is 0', () => {
    const snapshot = service('2026-06-07T18:00:00Z', 0).build([
      entry({ timestamp: '2026-06-07T17:59:00Z', inputTokens: 1000 }),
    ]);
    expect(snapshot.recentRateTokensPerMin).toBe(0);
  });
});

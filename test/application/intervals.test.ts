import { describe, expect, it } from 'vitest';
import { computeIntervals } from '../../src/application/intervals.js';

describe('computeIntervals', () => {
  it('renders at the rotate cadence, bounded to keep GameSense alive', () => {
    const intervals = computeIntervals({ pollIntervalSeconds: 10, rotateSeconds: 4 });
    expect(intervals.pollIntervalMs).toBe(10_000);
    expect(intervals.renderIntervalMs).toBe(4_000);
    expect(intervals.deinitMs).toBeGreaterThanOrEqual(15_000);
  });

  it('falls back to the poll cadence when rotation is disabled', () => {
    const intervals = computeIntervals({ pollIntervalSeconds: 6, rotateSeconds: 0 });
    expect(intervals.renderIntervalMs).toBe(6_000);
  });

  it('clamps the render interval into [1s, 10s]', () => {
    expect(computeIntervals({ pollIntervalSeconds: 600, rotateSeconds: 0 }).renderIntervalMs).toBe(
      10_000,
    );
    expect(computeIntervals({ pollIntervalSeconds: 1, rotateSeconds: 0 }).renderIntervalMs).toBe(
      1_000,
    );
  });
});

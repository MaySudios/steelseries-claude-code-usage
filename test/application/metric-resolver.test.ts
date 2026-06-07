import { describe, expect, it } from 'vitest';
import { BlockCalculator } from '../../src/application/block-calculator.js';
import { CostCalculator } from '../../src/application/cost-calculator.js';
import { MetricResolver, renderTemplate } from '../../src/application/metric-resolver.js';
import { SnapshotService } from '../../src/application/usage-snapshot.js';
import { UsageAggregator } from '../../src/application/usage-aggregator.js';
import { entry, fixedClock } from '../helpers.js';

const coster = CostCalculator.fromMap(new Map(), 'display');

function snapshotService(nowIso: string): SnapshotService {
  const clock = fixedClock(nowIso);
  return new SnapshotService({
    aggregator: new UsageAggregator(coster),
    blockCalculator: new BlockCalculator(coster, clock),
    clock,
  });
}

const ACTIVE_ENTRIES = [
  entry({ timestamp: '2026-06-07T10:00:00Z', inputTokens: 1000, costUSD: 1 }),
  entry({ timestamp: '2026-06-07T10:30:00Z', inputTokens: 1000, costUSD: 1 }),
  entry({ timestamp: '2026-06-07T11:00:00Z', inputTokens: 1000, costUSD: 1 }),
  entry({
    timestamp: '2026-06-07T17:00:00Z',
    inputTokens: 600,
    costUSD: 2,
    model: 'claude-opus-4-8',
  }),
];

describe('MetricResolver with an active block', () => {
  const snapshot = snapshotService('2026-06-07T18:00:00Z').build(ACTIVE_ENTRIES);
  const metrics = new MetricResolver().resolve(snapshot);

  it('resolves block cost, headroom and tokens', () => {
    expect(metrics.get('block.cost')?.value).toBe('$2.00');
    expect(metrics.get('block.usagePct')?.value).toBe('20%');
    expect(metrics.get('block.usagePct')?.percent).toBeCloseTo(20, 6);
    expect(metrics.get('block.tokens')?.value).toBe('600');
  });

  it('resolves monthly cost and current model', () => {
    expect(metrics.get('month.cost')?.value).toBe('$5.00');
    expect(metrics.get('model.current')?.value).toBe('Opus');
    expect(metrics.get('model.level')?.percent).toBe(90);
  });

  it('renders templates by substituting metric values', () => {
    expect(renderTemplate('5h ${block.cost}  use ${block.usagePct}', metrics)).toBe(
      '5h $2.00  use 20%',
    );
    expect(renderTemplate('${unknown.id}!', metrics)).toBe('!');
  });
});

describe('MetricResolver with no active block', () => {
  // Long after any activity → no active block.
  const snapshot = snapshotService('2026-06-20T00:00:00Z').build(ACTIVE_ENTRIES);
  const metrics = new MetricResolver().resolve(snapshot);

  it('falls back to idle placeholders and zeroed values', () => {
    expect(metrics.get('block.cost')?.value).toBe('$0.00');
    expect(metrics.get('block.usagePct')?.value).toBe('—');
    expect(metrics.get('block.usagePct')?.percent).toBeUndefined();
    expect(metrics.get('block.timeLeft')?.value).toBe('—');
    expect(metrics.get('block.cost')?.severity).toBe('idle');
    expect(metrics.get('model.current')?.value).toBe('Opus'); // last-seen model still reported
  });

  it('reports an empty snapshot as fully idle', () => {
    const empty = new MetricResolver().resolve(snapshotService('2026-06-20T00:00:00Z').build([]));
    expect(empty.get('model.current')?.value).toBe('—');
    expect(empty.get('model.level')?.percent).toBe(0);
    expect(empty.get('month.cost')?.value).toBe('$0.00');
  });
});

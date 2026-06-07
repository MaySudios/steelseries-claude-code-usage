import { describe, expect, it } from 'vitest';
import { type Display, type DisplayFrame, type ScreenContent } from '../../src/domain/ports.js';
import { type PlanLimit } from '../../src/domain/plan-usage.js';
import { BlockCalculator } from '../../src/application/block-calculator.js';
import { CostCalculator } from '../../src/application/cost-calculator.js';
import { MetricResolver } from '../../src/application/metric-resolver.js';
import { PluginService, type RenderPlan } from '../../src/application/plugin-service.js';
import { type SnapshotProvider } from '../../src/application/snapshot-provider.js';
import { SnapshotService, type UsageSnapshot } from '../../src/application/usage-snapshot.js';
import { UsageAggregator } from '../../src/application/usage-aggregator.js';
import { entry, nullLogger } from '../helpers.js';

class FakeDisplay implements Display {
  connects = 0;
  heartbeats = 0;
  disposes = 0;
  readonly frames: DisplayFrame[] = [];
  async connect(): Promise<void> {
    this.connects++;
  }
  async render(frame: DisplayFrame): Promise<void> {
    this.frames.push(frame);
  }
  async heartbeat(): Promise<void> {
    this.heartbeats++;
  }
  async dispose(): Promise<void> {
    this.disposes++;
  }
}

function mutableClock(startIso: string) {
  let t = new Date(startIso).getTime();
  return {
    clock: { now: () => new Date(t) },
    advance: (ms: number) => {
      t += ms;
    },
  };
}

const coster = CostCalculator.fromMap(new Map(), 'display');
const ACTIVE_ENTRIES = [
  entry({ timestamp: '2026-06-07T10:00:00Z', inputTokens: 1000, costUSD: 1 }),
  entry({ timestamp: '2026-06-07T10:30:00Z', inputTokens: 1000, costUSD: 1 }),
  entry({ timestamp: '2026-06-07T11:00:00Z', inputTokens: 1000, costUSD: 1 }),
  entry({ timestamp: '2026-06-07T17:00:00Z', inputTokens: 600, costUSD: 2 }),
];

function buildSnapshot(nowIso: string, planLimits: PlanLimit[] = []): UsageSnapshot {
  const clock = { now: () => new Date(nowIso) };
  const service = new SnapshotService({
    aggregator: new UsageAggregator(coster),
    blockCalculator: new BlockCalculator(coster, clock),
    clock,
  });
  return service.build(ACTIVE_ENTRIES, planLimits);
}

const RENDER_PLAN: RenderPlan = {
  oledEnabled: true,
  screens: [
    { lines: ['5h ${block.cost}'], seconds: 4 },
    { lines: ['use ${block.usagePct}'], seconds: 4 },
    { lines: ['m ${month.cost}'], seconds: 4 },
  ],
  keysEnabled: true,
  keyMetrics: [
    { id: 'headroom', metric: 'block.usagePct' },
    { id: 'burn', metric: 'block.burnPct' },
  ],
};

function textLines(frame: { screen: ScreenContent | undefined }): readonly string[] | undefined {
  return frame.screen ? frame.screen.lines : undefined;
}

function service(deps: {
  snapshotProvider: SnapshotProvider;
  display: Display;
  clock: { now: () => Date };
  planUsageSource?: { fetch: () => Promise<PlanLimit[]> };
}): PluginService {
  return new PluginService({
    snapshotProvider: deps.snapshotProvider,
    metricResolver: new MetricResolver(),
    display: deps.display,
    clock: deps.clock,
    logger: nullLogger,
    renderPlan: RENDER_PLAN,
    pollIntervalMs: 100_000,
    renderIntervalMs: 100_000,
    planUsageSource: deps.planUsageSource,
  });
}

describe('PluginService.runOnce', () => {
  it('connects and renders a frame with substituted text and key values', async () => {
    const display = new FakeDisplay();
    const clock = { now: () => new Date('2026-06-07T18:00:00Z') };
    const snapshotProvider: SnapshotProvider = {
      async snapshot() {
        return buildSnapshot('2026-06-07T18:00:00Z');
      },
    };
    const svc = service({ snapshotProvider, display, clock });
    await svc.runOnce();

    expect(display.connects).toBe(1);
    expect(display.frames).toHaveLength(1);
    const frame = display.frames[0]!;
    expect(textLines(frame)).toEqual(['5h $2.00']); // screen 0 at t=0
    expect(frame.keyValues.headroom).toBeCloseTo(20, 6);
    expect(typeof frame.keyValues.burn).toBe('number');
  });
});

describe('PluginService OLED rotation', () => {
  it('advances the screen by elapsed time', async () => {
    const display = new FakeDisplay();
    const time = mutableClock('2026-06-07T18:00:00Z');
    const snapshotProvider: SnapshotProvider = {
      async snapshot() {
        return buildSnapshot('2026-06-07T18:00:00Z');
      },
    };
    const svc = service({ snapshotProvider, display, clock: time.clock });
    await svc.runOnce(); // anchors rotation, screen 0

    time.advance(5_000); // 5s into a 12s cycle → screen 1 (4–8s)
    expect(textLines(svc.buildFrame())).toEqual(['use 20%']);

    time.advance(4_000); // 9s → screen 2 (8–12s)
    expect(textLines(svc.buildFrame())).toEqual(['m $5.00']);

    time.advance(4_000); // 13s → 1s → screen 0 (0–4s)
    expect(textLines(svc.buildFrame())).toEqual(['5h $2.00']);
  });
});

describe('PluginService resilience and lifecycle', () => {
  it('forwards plan limits from the source into the snapshot', async () => {
    const display = new FakeDisplay();
    const clock = { now: () => new Date('2026-06-07T18:00:00Z') };
    let received: readonly PlanLimit[] = [];
    const snapshotProvider: SnapshotProvider = {
      async snapshot(planLimits = []) {
        received = planLimits;
        return buildSnapshot('2026-06-07T18:00:00Z', [...planLimits]);
      },
    };
    const limit: PlanLimit = {
      id: 'weekly',
      label: 'Weekly',
      utilization: 42,
      resetsAt: undefined,
    };
    const svc = service({
      snapshotProvider,
      display,
      clock,
      planUsageSource: { fetch: async () => [limit] },
    });
    await svc.refreshData();
    expect(received).toEqual([limit]);
    expect(svc.currentMetrics.get('plan.weekly')?.value).toBe('42%');
  });

  it('survives a failing snapshot provider without throwing', async () => {
    const display = new FakeDisplay();
    const clock = { now: () => new Date('2026-06-07T18:00:00Z') };
    const snapshotProvider: SnapshotProvider = {
      async snapshot() {
        throw new Error('boom');
      },
    };
    const svc = service({ snapshotProvider, display, clock });
    await expect(svc.refreshData()).resolves.toBeUndefined();
    // No metrics → templates resolve to empty, key values default to 0.
    expect(svc.buildFrame().keyValues.headroom).toBe(0);
  });

  it('stop() disposes the display', async () => {
    const display = new FakeDisplay();
    const clock = { now: () => new Date('2026-06-07T18:00:00Z') };
    const snapshotProvider: SnapshotProvider = {
      async snapshot() {
        return buildSnapshot('2026-06-07T18:00:00Z');
      },
    };
    const svc = service({ snapshotProvider, display, clock });
    await svc.stop();
    expect(display.disposes).toBe(1);
  });
});

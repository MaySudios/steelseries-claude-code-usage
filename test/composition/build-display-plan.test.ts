import { describe, expect, it } from 'vitest';
import { buildDisplayPlan, eventName } from '../../src/composition/build-display-plan.js';
import { defaultConfig, parseConfig } from '../../src/infrastructure/config/config-loader.js';

describe('buildDisplayPlan (defaults)', () => {
  const { plan, renderPlan } = buildDisplayPlan(defaultConfig());

  it('binds an OLED text event with one frame key per max line', () => {
    expect(plan.screen?.event).toBe('OLED');
    expect(plan.screen?.lineKeys).toEqual(['line0', 'line1']); // default text screens are 2 lines
  });

  it('collects the distinct icon set (none + money/lightning/clock)', () => {
    expect(plan.screen?.iconIds).toEqual([4, 16, 15]);
  });

  it('binds the built-in claude logo as an image event', () => {
    expect(plan.images).toHaveLength(1);
    expect(plan.images?.[0]?.id).toBe('claude');
    expect(plan.images?.[0]?.bytes).toHaveLength(640);
  });

  it('produces a 4-screen rotation (logo + 3 text)', () => {
    expect(renderPlan.screens.map((s) => s.kind)).toEqual(['image', 'text', 'text', 'text']);
    expect(renderPlan.screens[0]).toMatchObject({ kind: 'image', imageId: 'claude', seconds: 3 });
  });

  it('builds one key event per binding with uppercase event names', () => {
    expect(plan.keys.map((k) => k.event)).toEqual(['KEY_HEADROOM', 'KEY_BURN', 'KEY_ALERT']);
    expect(plan.keys[0]?.handler['device-type']).toBe('rgb-per-key-zones');
    expect(plan.keys[0]?.handler.mode).toBe('percent'); // gauge
    expect(plan.keys[1]?.handler.mode).toBe('color'); // pulse
    expect(plan.keys[2]?.handler.mode).toBe('color'); // threshold
  });

  it('maps render-plan key metrics', () => {
    expect(renderPlan.keyMetrics).toEqual([
      { id: 'headroom', metric: 'block.usagePct' },
      { id: 'burn', metric: 'block.burnPct' },
      { id: 'alert', metric: 'block.usagePct' },
    ]);
  });
});

describe('buildDisplayPlan (toggles)', () => {
  it('omits the screen when the OLED is disabled', () => {
    const config = parseConfig({ oled: { enabled: false } });
    expect(buildDisplayPlan(config).plan.screen).toBeUndefined();
  });

  it('omits key bindings when keys are disabled', () => {
    const config = parseConfig({ keys: { enabled: false } });
    const { plan, renderPlan } = buildDisplayPlan(config);
    expect(plan.keys).toHaveLength(0);
    expect(renderPlan.keyMetrics).toHaveLength(0);
  });

  it('resolves key names to HID codes in handlers', () => {
    const config = parseConfig({
      keys: {
        bindings: [
          { id: 'x', type: 'gauge', metric: 'block.usagePct', keys: ['w', 'a', 's', 'd'] },
        ],
      },
    });
    const handler = buildDisplayPlan(config).plan.keys[0]?.handler;
    expect(handler?.['custom-zone-keys']).toEqual([26, 4, 22, 7]);
  });
});

describe('eventName', () => {
  it('uppercases the binding id', () => {
    expect(eventName('headroom')).toBe('KEY_HEADROOM');
  });
});

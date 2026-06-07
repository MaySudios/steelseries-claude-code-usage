import { describe, expect, it } from 'vitest';
import { buildDisplayPlan, eventName } from '../../src/composition/build-display-plan.js';
import { defaultConfig, parseConfig } from '../../src/infrastructure/config/config-loader.js';

describe('buildDisplayPlan (defaults)', () => {
  const { plan, renderPlan } = buildDisplayPlan(defaultConfig());

  it('binds an OLED text event with one frame key per max line', () => {
    expect(plan.screen?.event).toBe('OLED');
    expect(plan.screen?.lineKeys).toEqual(['line0', 'line1']); // default text screens are 2 lines
  });

  it('produces a 3-screen text rotation (2 lines each)', () => {
    expect(renderPlan.screens).toHaveLength(3);
    expect(renderPlan.screens.every((s) => s.lines.length === 2)).toBe(true);
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

  it('honours per-screen durations', () => {
    const config = parseConfig({
      oled: { rotateSeconds: 4, screens: [{ lines: ['a'], seconds: 9 }, { lines: ['b'] }] },
    });
    const { renderPlan } = buildDisplayPlan(config);
    expect(renderPlan.screens.map((s) => s.seconds)).toEqual([9, 4]); // 2nd falls back to rotateSeconds
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

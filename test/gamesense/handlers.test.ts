import { describe, expect, it } from 'vitest';
import { rgb } from '../../src/domain/color.js';
import {
  activeIndicatorHandler,
  gaugeHandler,
  pulseHandler,
  staticColorHandler,
  thresholdHandler,
} from '../../src/infrastructure/gamesense/handlers/color-handlers.js';
import {
  resolveIcon,
  screenImageHandler,
  screenTextHandler,
} from '../../src/infrastructure/gamesense/handlers/screen-handlers.js';

const GREEN = rgb(0, 255, 0);
const AMBER = rgb(255, 191, 0);
const RED = rgb(255, 0, 0);

describe('gaugeHandler', () => {
  it('builds a per-key percent gradient handler', () => {
    const handler = gaugeHandler([30, 31, 32], GREEN, RED);
    expect(handler).toMatchObject({
      'device-type': 'rgb-per-key-zones',
      'custom-zone-keys': [30, 31, 32],
      mode: 'percent',
      color: {
        gradient: {
          zero: { red: 0, green: 255, blue: 0 },
          hundred: { red: 255, green: 0, blue: 0 },
        },
      },
    });
  });
});

describe('thresholdHandler', () => {
  it('converts bands into contiguous inclusive ranges, last stretched to 100', () => {
    const handler = thresholdHandler(
      [41],
      [
        { upTo: 49, color: GREEN },
        { upTo: 79, color: AMBER },
        { upTo: 100, color: RED },
      ],
    );
    expect(handler.color).toEqual([
      { low: 0, high: 49, color: { red: 0, green: 255, blue: 0 } },
      { low: 50, high: 79, color: { red: 255, green: 191, blue: 0 } },
      { low: 80, high: 100, color: { red: 255, green: 0, blue: 0 } },
    ]);
    expect(handler.rate).toBeUndefined();
  });

  it('adds a ranged flash above the threshold', () => {
    const handler = thresholdHandler([41], [{ upTo: 100, color: RED }], { atOrAbove: 90, hz: 4 });
    expect(handler.rate).toEqual({
      frequency: [
        { low: 0, high: 89, frequency: 0 },
        { low: 90, high: 100, frequency: 4 },
      ],
    });
  });

  it('throws without bands', () => {
    expect(() => thresholdHandler([41], [])).toThrow(/at least one/);
  });
});

describe('pulseHandler', () => {
  it('stays dark below the idle cutoff then ramps gently', () => {
    const handler = pulseHandler([44], rgb(128, 0, 255), { minHz: 1, maxHz: 8 });
    expect(handler).toMatchObject({ mode: 'color', 'custom-zone-keys': [44] });
    expect(handler.rate).toEqual({
      frequency: [
        { low: 0, high: 4, frequency: 0 }, // idleBelow default 5
        { low: 5, high: 53, frequency: 1 },
        { low: 54, high: 100, frequency: 8 },
      ],
    });
  });

  it('uses calm defaults (1–2 Hz)', () => {
    const rate = pulseHandler([44], rgb(0, 0, 0)).rate as { frequency: { frequency: number }[] };
    expect(rate.frequency.map((f) => f.frequency)).toEqual([0, 1, 2]);
  });
});

describe('activeIndicatorHandler', () => {
  it('is dark below idle then a steady solid colour', () => {
    const handler = activeIndicatorHandler([44], rgb(0, 200, 0), 10);
    expect(handler).toMatchObject({ mode: 'color', 'custom-zone-keys': [44] });
    expect(handler.color).toEqual([
      { low: 0, high: 9, color: { red: 0, green: 0, blue: 0 } },
      { low: 10, high: 100, color: { red: 0, green: 200, blue: 0 } },
    ]);
    expect(handler.rate).toBeUndefined();
  });
});

describe('staticColorHandler', () => {
  it('builds a solid color handler', () => {
    expect(staticColorHandler([4], GREEN)).toEqual({
      'device-type': 'rgb-per-key-zones',
      'custom-zone-keys': [4],
      mode: 'color',
      color: { red: 0, green: 255, blue: 0 },
    });
  });
});

describe('screenTextHandler', () => {
  it('builds a multi-line OLED handler bound to per-line frame keys', () => {
    const handler = screenTextHandler(['line0', 'line1']);
    expect(handler).toEqual({
      'device-type': 'screened',
      mode: 'screen',
      zone: 'one',
      datas: [
        {
          lines: [
            { 'has-text': true, 'context-frame-key': 'line0' },
            { 'has-text': true, 'context-frame-key': 'line1' },
          ],
        },
      ],
    });
  });

  it('honours an explicit device type', () => {
    expect(screenTextHandler(['l0'], { deviceType: 'screened-128x40' })['device-type']).toBe(
      'screened-128x40',
    );
  });

  it('builds a range per icon when multiple icons are used', () => {
    const handler = screenTextHandler(['l0'], { iconIds: [0, 4, 15] });
    expect(handler.datas).toEqual([
      {
        low: 0,
        high: 0,
        datas: [{ 'icon-id': 0, lines: [{ 'has-text': true, 'context-frame-key': 'l0' }] }],
      },
      {
        low: 1,
        high: 1,
        datas: [{ 'icon-id': 4, lines: [{ 'has-text': true, 'context-frame-key': 'l0' }] }],
      },
      {
        low: 2,
        high: 2,
        datas: [{ 'icon-id': 15, lines: [{ 'has-text': true, 'context-frame-key': 'l0' }] }],
      },
    ]);
  });

  it('throws without lines', () => {
    expect(() => screenTextHandler([])).toThrow(/at least one/);
  });
});

describe('screenImageHandler', () => {
  it('builds a 128x40 image handler', () => {
    const handler = screenImageHandler([1, 2, 3]);
    expect(handler['device-type']).toBe('screened-128x40');
    expect(handler.datas).toEqual([{ 'has-text': false, 'image-data': [1, 2, 3] }]);
  });
});

describe('resolveIcon', () => {
  it('maps names and clamps numbers', () => {
    expect(resolveIcon('money')).toBe(4);
    expect(resolveIcon('LIGHTNING')).toBe(16);
    expect(resolveIcon(99)).toBe(43);
    expect(resolveIcon('nope')).toBe(0);
    expect(resolveIcon(undefined)).toBe(0);
  });
});

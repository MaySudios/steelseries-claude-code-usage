import { describe, expect, it } from 'vitest';
import { rgb } from '../../src/domain/color.js';
import {
  gaugeHandler,
  pulseHandler,
  staticColorHandler,
  thresholdHandler,
} from '../../src/infrastructure/gamesense/handlers/color-handlers.js';
import { screenTextHandler } from '../../src/infrastructure/gamesense/handlers/screen-handlers.js';

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
  it('maps value bands to escalating flash frequencies', () => {
    const handler = pulseHandler([44], rgb(128, 0, 255), 1, 8);
    expect(handler).toMatchObject({ mode: 'color', 'custom-zone-keys': [44] });
    expect(handler.rate).toEqual({
      frequency: [
        { low: 0, high: 5, frequency: 0 },
        { low: 6, high: 33, frequency: 1 },
        { low: 34, high: 66, frequency: 5 },
        { low: 67, high: 100, frequency: 8 },
      ],
    });
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
    expect(screenTextHandler(['l0'], 'screened-128x40')['device-type']).toBe('screened-128x40');
  });

  it('throws without lines', () => {
    expect(() => screenTextHandler([])).toThrow(/at least one/);
  });
});

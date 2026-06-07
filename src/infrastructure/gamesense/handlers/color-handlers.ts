import { type Rgb } from '../../../domain/color.js';

/** A GameSense handler object (JSON with hyphenated keys). */
export type GameSenseHandler = Record<string, unknown>;

const PER_KEY_DEVICE = 'rgb-per-key-zones';

function rgbObject(color: Rgb): Record<string, number> {
  return { red: color.red, green: color.green, blue: color.blue };
}

/**
 * A proportional bar across `keys` (HID codes): mode `percent` fills more keys
 * as the 0–100 value rises, coloured along a `from`→`to` gradient. Keys light
 * in array order, so order them how you want the bar to grow.
 */
export function gaugeHandler(keys: readonly number[], from: Rgb, to: Rgb): GameSenseHandler {
  return {
    'device-type': PER_KEY_DEVICE,
    'custom-zone-keys': [...keys],
    mode: 'percent',
    color: { gradient: { zero: rgbObject(from), hundred: rgbObject(to) } },
  };
}

export interface ColorBand {
  /** Inclusive upper bound (0–100) of this band. */
  readonly upTo: number;
  readonly color: Rgb;
}

export interface FlashSpec {
  /** Begin flashing once the value reaches this (0–100). */
  readonly atOrAbove: number;
  /** Flashes per second. */
  readonly hz: number;
}

/**
 * Solid colour chosen by value bands (a severity indicator), with an optional
 * flash once the value crosses a threshold. Bands are inclusive upper bounds;
 * the last band is stretched to cover 100.
 */
export function thresholdHandler(
  keys: readonly number[],
  bands: readonly ColorBand[],
  flash?: FlashSpec,
): GameSenseHandler {
  if (bands.length === 0) throw new Error('thresholdHandler requires at least one colour band');
  const sorted = [...bands].sort((a, b) => a.upTo - b.upTo);

  let low = 0;
  const ranges = sorted.map((band, index) => {
    const high = index === sorted.length - 1 ? Math.max(band.upTo, 100) : band.upTo;
    const range = { low, high, color: rgbObject(band.color) };
    low = high + 1;
    return range;
  });

  const handler: GameSenseHandler = {
    'device-type': PER_KEY_DEVICE,
    'custom-zone-keys': [...keys],
    mode: 'color',
    color: ranges,
  };

  if (flash && flash.hz > 0) {
    const threshold = Math.min(100, Math.max(1, Math.round(flash.atOrAbove)));
    handler.rate = {
      frequency: [
        { low: 0, high: threshold - 1, frequency: 0 },
        { low: threshold, high: 100, frequency: flash.hz },
      ],
    };
  }
  return handler;
}

/**
 * A single (or grouped) key holding a static colour whose flash *speed* scales
 * with the value — idle when quiet, fast pulse when busy. Ideal for a live
 * "burn rate" indicator.
 */
export function pulseHandler(
  keys: readonly number[],
  color: Rgb,
  minHz: number,
  maxHz: number,
): GameSenseHandler {
  const mid = Math.round((minHz + maxHz) / 2);
  return {
    'device-type': PER_KEY_DEVICE,
    'custom-zone-keys': [...keys],
    mode: 'color',
    color: rgbObject(color),
    rate: {
      frequency: [
        { low: 0, high: 5, frequency: 0 }, // effectively off when idle
        { low: 6, high: 33, frequency: minHz },
        { low: 34, high: 66, frequency: mid },
        { low: 67, high: 100, frequency: maxHz },
      ],
    },
  };
}

/** A plain static colour across `keys`. */
export function staticColorHandler(keys: readonly number[], color: Rgb): GameSenseHandler {
  return {
    'device-type': PER_KEY_DEVICE,
    'custom-zone-keys': [...keys],
    mode: 'color',
    color: rgbObject(color),
  };
}

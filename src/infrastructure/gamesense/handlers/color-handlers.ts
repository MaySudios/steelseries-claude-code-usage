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

export interface PulseOptions {
  /** Flash frequency just above the idle cutoff. Default 1 Hz. */
  readonly minHz?: number;
  /** Flash frequency at full value. Default 2 Hz (deliberately calm). */
  readonly maxHz?: number;
  /** Value (0–100) below which the key stays dark. Default 5. */
  readonly idleBelow?: number;
}

/**
 * A single (or grouped) key holding a static colour that is dark while idle and
 * pulses — gently by default — once the value rises. Ideal for a live
 * "burn rate" indicator that only reacts when Claude is actually generating.
 */
export function pulseHandler(
  keys: readonly number[],
  color: Rgb,
  options: PulseOptions = {},
): GameSenseHandler {
  const minHz = options.minHz ?? 1;
  const maxHz = options.maxHz ?? 2;
  const idle = Math.min(99, Math.max(1, Math.round(options.idleBelow ?? 5)));
  const mid = Math.round((idle + 100) / 2);
  return {
    'device-type': PER_KEY_DEVICE,
    'custom-zone-keys': [...keys],
    mode: 'color',
    color: rgbObject(color),
    rate: {
      frequency: [
        { low: 0, high: idle - 1, frequency: 0 }, // dark while idle
        { low: idle, high: mid, frequency: minHz },
        { low: mid + 1, high: 100, frequency: maxHz },
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

/**
 * "Just light up when active": dark below `idleBelow`, then a steady solid
 * colour (no flashing) above it. The calm alternative to {@link pulseHandler}.
 */
export function activeIndicatorHandler(
  keys: readonly number[],
  color: Rgb,
  idleBelow = 5,
): GameSenseHandler {
  const idle = Math.min(99, Math.max(1, Math.round(idleBelow)));
  return {
    'device-type': PER_KEY_DEVICE,
    'custom-zone-keys': [...keys],
    mode: 'color',
    color: [
      { low: 0, high: idle - 1, color: { red: 0, green: 0, blue: 0 } },
      { low: idle, high: 100, color: rgbObject(color) },
    ],
  };
}

/** An 8-bit-per-channel RGB color, matching the GameSense color object. */
export interface Rgb {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

/** Construct an {@link Rgb}, clamping each channel to the 0–255 range. */
export function rgb(red: number, green: number, blue: number): Rgb {
  return { red: clampChannel(red), green: clampChannel(green), blue: clampChannel(blue) };
}

/** Parse a `#rrggbb` / `#rgb` hex string into an {@link Rgb}. Throws on bad input. */
export function rgbFromHex(hex: string): Rgb {
  const cleaned = hex.trim().replace(/^#/, '');
  const expanded =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }
  return {
    red: parseInt(expanded.slice(0, 2), 16),
    green: parseInt(expanded.slice(2, 4), 16),
    blue: parseInt(expanded.slice(4, 6), 16),
  };
}

/** Linear interpolation between two colors. `t` is clamped to 0–1. */
export function lerpColor(from: Rgb, to: Rgb, t: number): Rgb {
  const clamped = Math.min(1, Math.max(0, t));
  return {
    red: Math.round(from.red + (to.red - from.red) * clamped),
    green: Math.round(from.green + (to.green - from.green) * clamped),
    blue: Math.round(from.blue + (to.blue - from.blue) * clamped),
  };
}

function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(255, Math.max(0, Math.round(value)));
}

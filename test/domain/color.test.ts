import { describe, expect, it } from 'vitest';
import { lerpColor, rgb, rgbFromHex } from '../../src/domain/color.js';

describe('rgb', () => {
  it('clamps channels to 0–255 and rounds', () => {
    expect(rgb(-10, 300, 12.6)).toEqual({ red: 0, green: 255, blue: 13 });
  });

  it('treats non-finite channels as 0', () => {
    expect(rgb(NaN, Infinity, -Infinity)).toEqual({ red: 0, green: 0, blue: 0 });
  });
});

describe('rgbFromHex', () => {
  it('parses #rrggbb', () => {
    expect(rgbFromHex('#1aff80')).toEqual({ red: 26, green: 255, blue: 128 });
  });

  it('parses shorthand #rgb', () => {
    expect(rgbFromHex('#0f8')).toEqual({ red: 0, green: 255, blue: 136 });
  });

  it('tolerates missing # and whitespace', () => {
    expect(rgbFromHex('  ff0000 ')).toEqual({ red: 255, green: 0, blue: 0 });
  });

  it('throws on invalid input', () => {
    expect(() => rgbFromHex('nope')).toThrow(/Invalid hex/);
    expect(() => rgbFromHex('#12345')).toThrow(/Invalid hex/);
  });
});

describe('lerpColor', () => {
  const black = rgb(0, 0, 0);
  const white = rgb(255, 255, 255);

  it('returns endpoints at t=0 and t=1', () => {
    expect(lerpColor(black, white, 0)).toEqual(black);
    expect(lerpColor(black, white, 1)).toEqual(white);
  });

  it('interpolates the midpoint', () => {
    expect(lerpColor(black, white, 0.5)).toEqual({ red: 128, green: 128, blue: 128 });
  });

  it('clamps t outside 0–1', () => {
    expect(lerpColor(black, white, -1)).toEqual(black);
    expect(lerpColor(black, white, 2)).toEqual(white);
  });
});

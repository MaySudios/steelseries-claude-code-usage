import { describe, expect, it } from 'vitest';
import { MonoBitmap, buildClaudeLogo } from '../../src/infrastructure/gamesense/bitmap.js';

describe('MonoBitmap.toScreenBytes', () => {
  it('packs MSB-first, row-major, 1 bit per pixel', () => {
    const bmp = new MonoBitmap(8, 1);
    bmp.set(0, 0); // MSB
    bmp.set(7, 0); // LSB
    expect(bmp.toScreenBytes()).toEqual([0b10000001]);
  });

  it('uses one byte per 8 px, padding the last byte', () => {
    const bmp = new MonoBitmap(9, 1);
    bmp.set(8, 0); // first px of the second byte
    expect(bmp.toScreenBytes()).toEqual([0b00000000, 0b10000000]);
  });

  it('produces exactly 640 bytes for a 128×40 screen', () => {
    expect(new MonoBitmap(128, 40).toScreenBytes()).toHaveLength(640);
  });

  it('ignores out-of-bounds writes', () => {
    const bmp = new MonoBitmap(4, 4);
    bmp.set(-1, 0);
    bmp.set(0, 99);
    expect(bmp.toScreenBytes().every((b) => b === 0)).toBe(true);
  });
});

describe('MonoBitmap drawing', () => {
  it('draws glyph text from the font', () => {
    const bmp = new MonoBitmap(40, 8);
    const end = bmp.drawText('CL', 0, 0, 1);
    expect(end).toBe(12); // 2 chars × 6px
    // 'C' top row is 0b01110 → pixels (1..3, 0) set, (0,0) clear.
    expect(bmp.get(0, 0)).toBe(false);
    expect(bmp.get(1, 0)).toBe(true);
  });

  it('centers a smaller bitmap onto a larger canvas', () => {
    const small = new MonoBitmap(2, 2);
    small.set(0, 0);
    const canvas = small.centeredOn(6, 6);
    expect(canvas.get(2, 2)).toBe(true); // offset (6-2)/2 = 2
  });
});

describe('buildClaudeLogo', () => {
  it('renders a non-empty 128×40 splash', () => {
    const bytes = buildClaudeLogo().toScreenBytes();
    expect(bytes).toHaveLength(640);
    expect(bytes.some((b) => b !== 0)).toBe(true);
  });
});

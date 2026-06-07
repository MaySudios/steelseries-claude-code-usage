import { describe, expect, it } from 'vitest';
import { parsePbm } from '../../src/infrastructure/gamesense/pbm.js';

describe('parsePbm', () => {
  it('parses an ASCII P1 bitmap (1 = lit)', () => {
    const bmp = parsePbm(Buffer.from('P1\n# comment\n2 2\n1 0\n0 1\n', 'ascii'));
    expect(bmp.width).toBe(2);
    expect(bmp.height).toBe(2);
    expect(bmp.get(0, 0)).toBe(true);
    expect(bmp.get(1, 0)).toBe(false);
    expect(bmp.get(1, 1)).toBe(true);
  });

  it('parses a binary P4 bitmap', () => {
    // 8×1, raster byte 0b10100000 → pixels x0 and x2 lit.
    const data = Buffer.concat([Buffer.from('P4\n8 1\n', 'ascii'), Buffer.from([0b10100000])]);
    const bmp = parsePbm(data);
    expect(bmp.get(0, 0)).toBe(true);
    expect(bmp.get(1, 0)).toBe(false);
    expect(bmp.get(2, 0)).toBe(true);
  });

  it('rejects unknown formats and oversized images', () => {
    expect(() => parsePbm(Buffer.from('P3\n1 1\n', 'ascii'))).toThrow(/PBM/);
    expect(() => parsePbm(Buffer.from('P1\n9999 9999\n', 'ascii'))).toThrow(/too large/);
  });
});

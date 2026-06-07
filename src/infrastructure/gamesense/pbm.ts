import { MonoBitmap } from './bitmap.js';

/**
 * Parse a NetPBM bitmap (PBM, magic `P1` ASCII or `P4` binary) into a
 * {@link MonoBitmap}. Per the PBM spec a bit value of `1` is black; we treat
 * that as a lit OLED pixel so a black-on-white drawing shows up illuminated.
 */
export function parsePbm(data: Buffer): MonoBitmap {
  const magic = data.subarray(0, 2).toString('ascii');
  if (magic === 'P1') return parseAsciiPbm(data.toString('ascii'));
  if (magic === 'P4') return parseBinaryPbm(data);
  throw new Error(`Unsupported image: expected a PBM file (P1 or P4), got "${magic}"`);
}

function parseAsciiPbm(text: string): MonoBitmap {
  const tokens = text
    .replace(/#[^\n]*/g, ' ') // strip comments
    .split(/\s+/)
    .filter((t) => t.length > 0);
  // tokens[0] === 'P1'
  const width = Number(tokens[1]);
  const height = Number(tokens[2]);
  assertDimensions(width, height);
  const bmp = new MonoBitmap(width, height);
  let i = 3;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tokens[i++] === '1') bmp.set(x, y);
    }
  }
  return bmp;
}

function parseBinaryPbm(data: Buffer): MonoBitmap {
  // Parse the ASCII header (P4, then width, height) allowing comments.
  let pos = 2;
  const nextToken = (): string => {
    while (pos < data.length && /\s/.test(String.fromCharCode(data[pos]!))) pos++;
    if (data[pos] === 0x23 /* # */) {
      while (pos < data.length && data[pos] !== 0x0a) pos++;
      return nextToken();
    }
    let token = '';
    while (pos < data.length && !/\s/.test(String.fromCharCode(data[pos]!))) {
      token += String.fromCharCode(data[pos]!);
      pos++;
    }
    return token;
  };

  const width = Number(nextToken());
  const height = Number(nextToken());
  assertDimensions(width, height);
  pos++; // single whitespace after the header precedes the raster

  const bmp = new MonoBitmap(width, height);
  const bytesPerRow = Math.ceil(width / 8);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const byte = data[pos + y * bytesPerRow + Math.floor(x / 8)] ?? 0;
      if ((byte >> (7 - (x % 8))) & 1) bmp.set(x, y);
    }
  }
  return bmp;
}

function assertDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Invalid PBM dimensions');
  }
  if (width > 256 || height > 128) {
    throw new Error(`PBM too large (${width}×${height}); max 256×128`);
  }
}

/**
 * Tiny dependency-free 1-bit bitmap used to render OLED screens (logos, custom
 * images). Produces the row-major, MSB-first byte array GameSense expects
 * (`⌈width*height/8⌉` bytes; bit 1 = white pixel).
 */
export class MonoBitmap {
  readonly width: number;
  readonly height: number;
  private readonly pixels: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8Array(width * height);
  }

  set(x: number, y: number, on = true): void {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return;
    this.pixels[py * this.width + px] = on ? 1 : 0;
  }

  get(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return this.pixels[y * this.width + x] === 1;
  }

  /** Bresenham line. */
  drawLine(x0: number, y0: number, x1: number, y1: number): void {
    let [ax, ay] = [Math.round(x0), Math.round(y0)];
    const [bx, by] = [Math.round(x1), Math.round(y1)];
    const dx = Math.abs(bx - ax);
    const dy = -Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1;
    const sy = ay < by ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(ax, ay);
      if (ax === bx && ay === by) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        ax += sx;
      }
      if (e2 <= dx) {
        err += dx;
        ay += sy;
      }
    }
  }

  fillRect(x: number, y: number, w: number, h: number, on = true): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, on);
    }
  }

  /** Draw a 5×7 glyph (7 rows, each a 5-bit value, MSB = leftmost) at scale. */
  drawGlyph(rows: readonly number[], x: number, y: number, scale = 1): void {
    rows.forEach((row, ry) => {
      for (let cx = 0; cx < 5; cx++) {
        if ((row >> (4 - cx)) & 1) this.fillRect(x + cx * scale, y + ry * scale, scale, scale);
      }
    });
  }

  /** Draw text using {@link FONT_5X7}. Unknown chars render as a blank cell. */
  drawText(text: string, x: number, y: number, scale = 1): number {
    let cursor = x;
    for (const ch of text.toUpperCase()) {
      const glyph = FONT_5X7[ch];
      if (glyph) this.drawGlyph(glyph, cursor, y, scale);
      cursor += 6 * scale; // 5px glyph + 1px gap
    }
    return cursor;
  }

  /** Compose another bitmap onto this one with its top-left at (x, y). */
  blit(other: MonoBitmap, x: number, y: number): void {
    for (let oy = 0; oy < other.height; oy++) {
      for (let ox = 0; ox < other.width; ox++) {
        if (other.get(ox, oy)) this.set(x + ox, y + oy);
      }
    }
  }

  /** Pack to GameSense screen bytes: row-major, MSB-first, bit 1 = white. */
  toScreenBytes(): number[] {
    const bytesPerRow = Math.ceil(this.width / 8);
    const out: number[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let b = 0; b < bytesPerRow; b++) {
        let byte = 0;
        for (let i = 0; i < 8; i++) {
          const px = b * 8 + i;
          if (px < this.width && this.get(px, y)) byte |= 1 << (7 - i);
        }
        out.push(byte);
      }
    }
    return out;
  }

  /** Center this bitmap onto a fresh `width×height` canvas (crop if larger). */
  centeredOn(width: number, height: number): MonoBitmap {
    const canvas = new MonoBitmap(width, height);
    canvas.blit(this, Math.floor((width - this.width) / 2), Math.floor((height - this.height) / 2));
    return canvas;
  }

  /** Inverse of {@link toScreenBytes} — unpack GameSense screen bytes. */
  static fromScreenBytes(bytes: readonly number[], width: number, height: number): MonoBitmap {
    const bmp = new MonoBitmap(width, height);
    const bytesPerRow = Math.ceil(width / 8);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byte = bytes[y * bytesPerRow + Math.floor(x / 8)] ?? 0;
        if ((byte >> (7 - (x % 8))) & 1) bmp.set(x, y);
      }
    }
    return bmp;
  }
}

/** Minimal 5×7 font (uppercase letters used by the built-in logo). */
export const FONT_5X7: Readonly<Record<string, number[]>> = {
  ' ': [0, 0, 0, 0, 0, 0, 0],
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
};

/** A starburst mark — generic, evocative, not a trademarked logo. */
export function drawStarburst(bmp: MonoBitmap, cx: number, cy: number, radius: number): void {
  const rays = 12;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const len = i % 2 === 0 ? radius : radius * 0.55;
    bmp.drawLine(cx, cy, cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
  }
}

/** The bundled 128×40 "Claude" splash: a starburst + the word CLAUDE. */
export function buildClaudeLogo(): MonoBitmap {
  const bmp = new MonoBitmap(128, 40);
  drawStarburst(bmp, 20, 20, 16);
  bmp.drawText('CLAUDE', 44, 13, 2); // 6 chars × 12px = 72px, fits in the right area
  return bmp;
}

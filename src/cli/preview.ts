import { type Rgb, lerpColor, rgbFromHex } from '../domain/color.js';
import { type Metric } from '../domain/metric.js';
import { renderTemplate } from '../application/metric-resolver.js';
import { type RenderScreen } from '../application/plugin-service.js';
import { MonoBitmap, drawStarburst } from '../infrastructure/gamesense/bitmap.js';
import { type ScreenImageBinding } from '../infrastructure/gamesense/gamesense-display.js';
import { type Config } from '../infrastructure/config/schema.js';

const WIDTH = 128;
const HEIGHT = 40;

/** Terminal preview of every OLED screen, as half-block art with current data. */
export function previewScreens(
  screens: readonly RenderScreen[],
  images: readonly ScreenImageBinding[],
  metrics: ReadonlyMap<string, Metric>,
): string {
  if (screens.length === 0) return 'OLED: disabled (no screens).';
  const blocks: string[] = [];
  screens.forEach((screen, index) => {
    const label = `Screen ${index + 1}/${screens.length} · ${screen.kind} · ${screen.seconds}s`;
    blocks.push(label);
    blocks.push(frameBitmap(screenBitmap(screen, images, metrics)));
    blocks.push('');
  });
  return blocks.join('\n');
}

/** Colored overview of the per-key bindings (ANSI truecolor swatches). */
export function previewKeys(config: Config): string {
  if (!config.keys.enabled) return 'Keys: disabled.';
  const lines = ['Per-key bindings:'];
  for (const binding of config.keys.bindings) {
    const keys = binding.keys.join(', ');
    let swatch: string;
    let extra = '';
    if (binding.type === 'gauge') {
      swatch = gradientSwatch(rgbFromHex(binding.from), rgbFromHex(binding.to));
    } else if (binding.type === 'threshold') {
      swatch = binding.bands.map((band) => solidSwatch(rgbFromHex(band.color))).join('');
      if (binding.flash) extra = ` flash@${binding.flash.atOrAbove}%`;
    } else {
      swatch = solidSwatch(rgbFromHex(binding.color));
      extra = binding.steady ? ' steady' : ` pulse ${binding.minHz}-${binding.maxHz}Hz`;
    }
    lines.push(
      `  ${binding.id.padEnd(10)} ${binding.type.padEnd(9)} ${swatch}${extra}  ← ${binding.metric}  [${keys}]`,
    );
  }
  return lines.join('\n');
}

function screenBitmap(
  screen: RenderScreen,
  images: readonly ScreenImageBinding[],
  metrics: ReadonlyMap<string, Metric>,
): MonoBitmap {
  if (screen.kind === 'image') {
    const image = images.find((candidate) => candidate.id === screen.imageId);
    return image
      ? MonoBitmap.fromScreenBytes(image.bytes, WIDTH, HEIGHT)
      : new MonoBitmap(WIDTH, HEIGHT);
  }

  const bmp = new MonoBitmap(WIDTH, HEIGHT);
  const hasIcon = screen.iconId !== 0;
  if (hasIcon) drawStarburst(bmp, 16, HEIGHT / 2, 12); // placeholder for the built-in icon
  const x0 = hasIcon ? 34 : 2;

  const lines = screen.lines.map((line) => renderTemplate(line, metrics)).slice(0, 3);
  const scale = lines.length >= 3 ? 1 : 2;
  const step = lines.length >= 3 ? 11 : 18;
  lines.forEach((line, index) => bmp.drawText(line, x0, 4 + index * step, scale));
  return bmp;
}

function frameBitmap(bmp: MonoBitmap): string {
  const border = '─'.repeat(bmp.width);
  const rows: string[] = [`┌${border}┐`];
  for (let y = 0; y < bmp.height; y += 2) {
    let row = '│';
    for (let x = 0; x < bmp.width; x++) {
      const top = bmp.get(x, y);
      const bottom = bmp.get(x, y + 1);
      row += top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' ';
    }
    rows.push(`${row}│`);
  }
  rows.push(`└${border}┘`);
  return rows.join('\n');
}

function solidSwatch(color: Rgb): string {
  return `\x1b[48;2;${color.red};${color.green};${color.blue}m  \x1b[0m`;
}

function gradientSwatch(from: Rgb, to: Rgb): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += solidSwatch(lerpColor(from, to, i / 5));
  return out;
}

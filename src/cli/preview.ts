import { type Rgb, lerpColor, rgbFromHex } from '../domain/color.js';
import { type Metric } from '../domain/metric.js';
import { renderTemplate } from '../application/metric-resolver.js';
import { type RenderScreen } from '../application/plugin-service.js';
import { type Config } from '../infrastructure/config/schema.js';

/** Rough character width of the 128px OLED for the preview box. */
const OLED_COLS = 22;

/** A plain-text preview of every OLED screen, with the current data filled in. */
export function previewScreens(
  screens: readonly RenderScreen[],
  metrics: ReadonlyMap<string, Metric>,
): string {
  if (screens.length === 0) return 'OLED: disabled (no screens).';
  const blocks: string[] = [];
  screens.forEach((screen, index) => {
    blocks.push(`Screen ${index + 1}/${screens.length} · ${screen.seconds}s`);
    blocks.push(boxed(screen.lines.map((line) => renderTemplate(line, metrics))));
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

function boxed(lines: readonly string[]): string {
  const inner = Math.max(OLED_COLS, ...lines.map((line) => line.length));
  const border = '─'.repeat(inner + 2);
  const body = lines.map((line) => `│ ${line.padEnd(inner)} │`);
  return [`┌${border}┐`, ...body, `└${border}┘`].join('\n');
}

function solidSwatch(color: Rgb): string {
  return `\x1b[48;2;${color.red};${color.green};${color.blue}m  \x1b[0m`;
}

function gradientSwatch(from: Rgb, to: Rgb): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += solidSwatch(lerpColor(from, to, i / 5));
  return out;
}

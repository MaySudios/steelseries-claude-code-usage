import { type GameSenseHandler } from './color-handlers.js';

/** Generic `screened` matches any OLED device and is what we use for text. */
export const GENERIC_SCREEN_DEVICE = 'screened';

/**
 * A multi-line OLED text handler — the proven, widely-used pattern (Patrick
 * Desjardins' Git PR display, gamesense-essentials, apex-oled-system-monitor).
 * Each entry in `lineKeys` is one line, bound to that key in the event's frame.
 *
 * Deliberately NO `icon-id`: GameSense does not reliably render an icon next to
 * MULTI-line text, so text pages stay icon-free (use an image page for graphics).
 * Keep to 2 lines on 128x40 — 3+ lines can crash the Engine. Bind with
 * `valueOptional: true` so repeated identical text still renders.
 */
export function screenTextHandler(
  lineKeys: readonly string[],
  deviceType: string = GENERIC_SCREEN_DEVICE,
): GameSenseHandler {
  if (lineKeys.length === 0) throw new Error('screenTextHandler requires at least one line key');
  return {
    'device-type': deviceType,
    mode: 'screen',
    zone: 'one',
    datas: [
      {
        lines: lineKeys.map((key) => ({ 'has-text': true, 'context-frame-key': key })),
      },
    ],
  };
}

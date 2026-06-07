import { type GameSenseHandler } from './color-handlers.js';

/**
 * Apex Pro / Apex 7 OLED resolution. Generic `screened` matches any screened
 * device (Apex Pro/7/TKL, Rival, Arctis), which is what we want for text. Use
 * `screened-128x40` only when sending raw bitmaps (exact dimension match).
 */
export const APEX_PRO_DEVICE = 'screened-128x40';
export const GENERIC_SCREEN_DEVICE = 'screened';

/**
 * A multi-line OLED text handler. Each entry in `lineKeys` becomes one logical
 * line bound to that key inside the event's `frame` object, rendered top to
 * bottom. Pair with `valueOptional: true` on the event so repeated identical
 * text is not suppressed by value caching.
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

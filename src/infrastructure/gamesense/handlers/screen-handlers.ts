import { type GameSenseHandler } from './color-handlers.js';

/**
 * Apex Pro / Apex 7 OLED resolution. Generic `screened` matches any OLED, which
 * is what we want for text. Raw bitmaps require an exact dimension match.
 */
export const APEX_PRO_DEVICE = 'screened-128x40';
export const GENERIC_SCREEN_DEVICE = 'screened';

/** Friendly names for GameSense's built-in OLED icons (left 32 px). */
export const ICON_IDS: Readonly<Record<string, number>> = Object.freeze({
  none: 0,
  health: 1,
  armor: 2,
  ammo: 3,
  money: 4,
  flash: 5,
  kills: 6,
  headshot: 7,
  helmet: 8,
  hunger: 10,
  air: 11,
  compass: 12,
  tool: 13,
  mana: 14,
  clock: 15,
  lightning: 16,
  bolt: 16,
  item: 17,
  at: 18,
  muted: 19,
  talking: 20,
  connect: 21,
  disconnect: 22,
  music: 23,
  play: 24,
  pause: 25,
  cpu: 27,
  gpu: 28,
  ram: 29,
  timer: 42,
  temperature: 43,
});

/** Resolve an icon name or numeric id to a built-in icon id (0 = none). */
export function resolveIcon(icon: string | number | undefined): number {
  if (icon === undefined) return 0;
  if (typeof icon === 'number') return Math.min(43, Math.max(0, Math.round(icon)));
  return ICON_IDS[icon.trim().toLowerCase()] ?? 0;
}

export interface ScreenTextOptions {
  /**
   * Built-in icon ids selectable at runtime via the event value (index into
   * this list). Defaults to `[0]` (no icon). When more than one is given the
   * handler is range-based so each screen can show a different icon.
   */
  readonly iconIds?: readonly number[];
  readonly deviceType?: string;
}

/**
 * A multi-line OLED text handler. Each entry in `lineKeys` becomes one logical
 * line bound to that key inside the event's `frame`, rendered top to bottom.
 * Pair with `valueOptional: true` so repeated identical text still renders.
 */
export function screenTextHandler(
  lineKeys: readonly string[],
  options: ScreenTextOptions = {},
): GameSenseHandler {
  if (lineKeys.length === 0) throw new Error('screenTextHandler requires at least one line key');
  const deviceType = options.deviceType ?? GENERIC_SCREEN_DEVICE;
  const iconIds = options.iconIds && options.iconIds.length > 0 ? options.iconIds : [0];
  const lines = lineKeys.map((key) => ({ 'has-text': true, 'context-frame-key': key }));

  if (iconIds.length === 1) {
    const frame: Record<string, unknown> = { lines };
    if (iconIds[0]) frame['icon-id'] = iconIds[0];
    return { 'device-type': deviceType, mode: 'screen', zone: 'one', datas: [frame] };
  }

  // Range-based: the event value selects which icon (and the same lines).
  return {
    'device-type': deviceType,
    mode: 'screen',
    zone: 'one',
    datas: iconIds.map((iconId, index) => ({
      low: index,
      high: index,
      datas: [{ 'icon-id': iconId, lines }],
    })),
  };
}

/**
 * A full-screen bitmap handler. `bytes` must match the device exactly
 * (640 bytes for the 128×40 Apex Pro). Bind with `valueOptional: true`.
 */
export function screenImageHandler(
  bytes: readonly number[],
  deviceType: string = APEX_PRO_DEVICE,
): GameSenseHandler {
  return {
    'device-type': deviceType,
    mode: 'screen',
    zone: 'one',
    datas: [{ 'has-text': false, 'image-data': [...bytes] }],
  };
}

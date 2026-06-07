/**
 * USB HID Usage IDs (Keyboard/Keypad page 0x07) — the integers GameSense
 * expects inside `custom-zone-keys`. Not ASCII, not PS/2 scan codes. The
 * SteelSeries example `[26,4,22,7]` (= W,A,S,D) confirms this mapping.
 */
export const HID_KEYCODES: Readonly<Record<string, number>> = Object.freeze({
  // Letters
  a: 4,
  b: 5,
  c: 6,
  d: 7,
  e: 8,
  f: 9,
  g: 10,
  h: 11,
  i: 12,
  j: 13,
  k: 14,
  l: 15,
  m: 16,
  n: 17,
  o: 18,
  p: 19,
  q: 20,
  r: 21,
  s: 22,
  t: 23,
  u: 24,
  v: 25,
  w: 26,
  x: 27,
  y: 28,
  z: 29,
  // Number row
  '1': 30,
  '2': 31,
  '3': 32,
  '4': 33,
  '5': 34,
  '6': 35,
  '7': 36,
  '8': 37,
  '9': 38,
  '0': 39,
  // Editing / whitespace
  enter: 40,
  return: 40,
  escape: 41,
  esc: 41,
  backspace: 42,
  tab: 43,
  space: 44,
  spacebar: 44,
  // Symbols
  minus: 45,
  dash: 45,
  equal: 46,
  lbracket: 47,
  rbracket: 48,
  backslash: 49,
  semicolon: 51,
  quote: 52,
  backquote: 53,
  grave: 53,
  comma: 54,
  period: 55,
  slash: 56,
  caps: 57,
  capslock: 57,
  // Function row
  f1: 58,
  f2: 59,
  f3: 60,
  f4: 61,
  f5: 62,
  f6: 63,
  f7: 64,
  f8: 65,
  f9: 66,
  f10: 67,
  f11: 68,
  f12: 69,
  // Navigation
  printscreen: 70,
  scrolllock: 71,
  pause: 72,
  insert: 73,
  home: 74,
  pageup: 75,
  delete: 76,
  del: 76,
  end: 77,
  pagedown: 78,
  right: 79,
  rightarrow: 79,
  left: 80,
  leftarrow: 80,
  down: 81,
  downarrow: 81,
  up: 82,
  uparrow: 82,
  // Modifiers
  lctrl: 224,
  lshift: 225,
  lalt: 226,
  lgui: 227,
  lwin: 227,
  rctrl: 228,
  rshift: 229,
  ralt: 230,
  rgui: 231,
  rwin: 231,
});

/**
 * Resolve a key token to its HID code. Accepts a raw number (passed through
 * after validation) or a case-insensitive key name. Throws on unknown names so
 * configuration mistakes surface early.
 */
export function resolveKey(token: string | number): number {
  if (typeof token === 'number') {
    if (!Number.isInteger(token) || token < 0 || token > 255) {
      throw new Error(`Invalid HID keycode: ${token} (expected an integer 0–255)`);
    }
    return token;
  }
  const normalized = token.trim().toLowerCase();
  const code = HID_KEYCODES[normalized];
  if (code === undefined) {
    throw new Error(`Unknown key name: "${token}". Use a HID code or a known key name.`);
  }
  return code;
}

/** Resolve a list of key tokens to HID codes, preserving order. */
export function resolveKeys(tokens: ReadonlyArray<string | number>): number[] {
  return tokens.map(resolveKey);
}

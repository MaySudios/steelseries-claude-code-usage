import { describe, expect, it } from 'vitest';
import { resolveKey, resolveKeys } from '../../src/infrastructure/gamesense/hid-keycodes.js';

describe('resolveKey', () => {
  it('maps WASD to the SDK-documented codes', () => {
    expect([resolveKey('w'), resolveKey('a'), resolveKey('s'), resolveKey('d')]).toEqual([
      26, 4, 22, 7,
    ]);
  });

  it('is case-insensitive and supports aliases', () => {
    expect(resolveKey('F5')).toBe(62);
    expect(resolveKey('SPACE')).toBe(44);
    expect(resolveKey('esc')).toBe(41);
    expect(resolveKey('uparrow')).toBe(82);
  });

  it('passes through valid raw HID codes', () => {
    expect(resolveKey(70)).toBe(70);
    expect(resolveKey(0)).toBe(0);
    expect(resolveKey(255)).toBe(255);
  });

  it('throws on unknown names and out-of-range codes', () => {
    expect(() => resolveKey('nope')).toThrow(/Unknown key/);
    expect(() => resolveKey(256)).toThrow(/Invalid HID/);
    expect(() => resolveKey(-1)).toThrow(/Invalid HID/);
    expect(() => resolveKey(1.5)).toThrow(/Invalid HID/);
  });
});

describe('resolveKeys', () => {
  it('resolves a list preserving order', () => {
    expect(resolveKeys(['1', '2', '3', 'f1'])).toEqual([30, 31, 32, 58]);
  });
});

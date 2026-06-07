import { describe, expect, it } from 'vitest';
import {
  corePropsCandidatePaths,
  locateGameSenseAddress,
  readCorePropsAddress,
} from '../../src/infrastructure/gamesense/core-props-locator.js';

describe('corePropsCandidatePaths', () => {
  it('points at %PROGRAMDATA% on Windows', () => {
    const paths = corePropsCandidatePaths('win32', { PROGRAMDATA: 'D:\\PD' });
    expect(paths[0]).toContain('SteelSeries Engine 3');
    expect(paths[0]).toContain('coreProps.json');
    expect(paths[0]?.startsWith('D:\\PD')).toBe(true);
  });

  it('points at /Library/Application Support on macOS', () => {
    expect(corePropsCandidatePaths('darwin', {})).toEqual([
      '/Library/Application Support/SteelSeries Engine 3/coreProps.json',
    ]);
  });
});

describe('readCorePropsAddress', () => {
  it('extracts the address field', async () => {
    const read = async () => JSON.stringify({ address: '127.0.0.1:61899' });
    expect(await readCorePropsAddress('whatever', read)).toBe('127.0.0.1:61899');
  });

  it('returns undefined for missing/empty address or unreadable file', async () => {
    expect(await readCorePropsAddress('x', async () => JSON.stringify({}))).toBeUndefined();
    expect(
      await readCorePropsAddress('x', async () => JSON.stringify({ address: '' })),
    ).toBeUndefined();
    expect(
      await readCorePropsAddress('x', async () => {
        throw new Error('ENOENT');
      }),
    ).toBeUndefined();
    expect(await readCorePropsAddress('x', async () => 'not json')).toBeUndefined();
  });
});

describe('locateGameSenseAddress', () => {
  it('returns the first readable address', async () => {
    const address = await locateGameSenseAddress({
      paths: ['/a', '/b'],
      readImpl: async (p) => (p === '/b' ? JSON.stringify({ address: '127.0.0.1:5000' }) : 'nope'),
    });
    expect(address).toBe('127.0.0.1:5000');
  });

  it('returns undefined when nothing is readable (Engine not running)', async () => {
    const address = await locateGameSenseAddress({
      paths: ['/a'],
      readImpl: async () => {
        throw new Error('ENOENT');
      },
    });
    expect(address).toBeUndefined();
  });
});

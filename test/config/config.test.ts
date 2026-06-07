import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  defaultConfig,
  loadConfigFile,
  loadConfigOrDefault,
  parseConfig,
} from '../../src/infrastructure/config/config-loader.js';
import {
  defaultConfigPath,
  resolveConfigPath,
} from '../../src/infrastructure/config/config-paths.js';
import { CONFIG_TEMPLATE } from '../../src/infrastructure/config/config-template.js';

describe('defaultConfig', () => {
  it('produces a fully-populated config with sensible defaults', () => {
    const config = defaultConfig();
    expect(config.game).toBe('CLAUDE_CODE_USAGE');
    expect(config.pollIntervalSeconds).toBe(10);
    expect(config.oled.enabled).toBe(true);
    expect(config.oled.screens.length).toBeGreaterThanOrEqual(1);
    expect(config.keys.bindings.length).toBeGreaterThanOrEqual(1);
    expect(config.keys.bindings[0]?.type).toBe('gauge');
    expect(config.planLimits.enabled).toBe(false);
  });
});

describe('parseConfig', () => {
  it('rejects an invalid game id', () => {
    expect(() => parseConfig({ game: 'lower case' })).toThrow();
  });

  it('rejects an unknown top-level key (strict)', () => {
    expect(() => parseConfig({ nonsense: true })).toThrow();
  });

  it('rejects an unknown binding type', () => {
    expect(() =>
      parseConfig({ keys: { bindings: [{ id: 'x', type: 'rainbow', metric: 'm', keys: ['a'] }] } }),
    ).toThrow();
  });

  it('applies binding defaults for a gauge', () => {
    const config = parseConfig({
      keys: { bindings: [{ id: 'g', type: 'gauge', metric: 'block.usagePct', keys: ['f1'] }] },
    });
    const binding = config.keys.bindings[0];
    expect(binding?.type).toBe('gauge');
    if (binding?.type === 'gauge') {
      expect(binding.from).toBe('#00ff00');
      expect(binding.to).toBe('#ff0000');
    }
  });
});

describe('config paths', () => {
  it('prefers explicit, then SSCU_CONFIG, then platform default', () => {
    expect(resolveConfigPath('/explicit.yaml', { env: {} })).toEqual({
      path: '/explicit.yaml',
      explicit: true,
    });
    expect(resolveConfigPath(undefined, { env: { SSCU_CONFIG: '/from/env.yaml' } })).toEqual({
      path: '/from/env.yaml',
      explicit: true,
    });
    const fallback = resolveConfigPath(undefined, {
      env: {},
      platform: 'linux',
      home: '/home/dev',
    });
    expect(fallback.explicit).toBe(false);
    expect(fallback.path).toContain('steelseries-claude-usage');
  });

  it('uses %APPDATA% on Windows and XDG on Linux', () => {
    expect(
      defaultConfigPath({
        platform: 'win32',
        env: { APPDATA: 'C:\\Users\\d\\AppData\\Roaming' },
        home: 'C:\\Users\\d',
      }),
    ).toContain('AppData');
    expect(
      defaultConfigPath({ platform: 'linux', env: { XDG_CONFIG_HOME: '/cfg' }, home: '/home/d' }),
    ).toBe('/cfg/steelseries-claude-usage/config.yaml'.replaceAll('/', sep()));
  });
});

describe('loadConfigFile (round-trip)', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sscu-cfg-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loads and validates the YAML template written by `config init`', async () => {
    const path = join(dir, 'config.yaml');
    await writeFile(path, CONFIG_TEMPLATE);
    const config = await loadConfigFile(path);
    expect(config.game).toBe('CLAUDE_CODE_USAGE');
    expect(config.oled.screens).toHaveLength(3); // plain text by default
    expect('lines' in config.oled.screens[0]!).toBe(true);
    expect(config.keys.bindings.map((b) => b.id)).toEqual(['headroom', 'burn', 'alert']);
  });

  it('loads JSON too', async () => {
    const path = join(dir, 'config.json');
    await writeFile(path, JSON.stringify({ pollIntervalSeconds: 30 }));
    expect((await loadConfigFile(path)).pollIntervalSeconds).toBe(30);
  });

  it('falls back to defaults when the file is absent', async () => {
    const result = await loadConfigOrDefault(join(dir, 'missing.yaml'));
    expect(result.loaded).toBe(false);
    expect(result.config.game).toBe('CLAUDE_CODE_USAGE');
  });
});

function sep(): string {
  return process.platform === 'win32' ? '\\' : '/';
}

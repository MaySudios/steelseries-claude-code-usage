import { homedir } from 'node:os';
import { join } from 'node:path';

export interface ConfigPathOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  readonly home?: string;
}

/** The conventional config location for the current platform. */
export function defaultConfigPath(options: ConfigPathOptions = {}): string {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const home = options.home ?? homedir();

  if (platform === 'win32') {
    const appData = env.APPDATA ?? join(home, 'AppData', 'Roaming');
    return join(appData, 'steelseries-claude-usage', 'config.yaml');
  }
  const xdgConfig = env.XDG_CONFIG_HOME ?? join(home, '.config');
  return join(xdgConfig, 'steelseries-claude-usage', 'config.yaml');
}

/**
 * Resolve which config path to use: an explicit `--config`, then `$SSCU_CONFIG`,
 * then the platform default. `explicit` flags whether the user chose it.
 */
export function resolveConfigPath(
  explicit: string | undefined,
  options: ConfigPathOptions = {},
): { path: string; explicit: boolean } {
  if (explicit) return { path: explicit, explicit: true };
  const fromEnv = (options.env ?? process.env).SSCU_CONFIG;
  if (fromEnv && fromEnv.trim() !== '') return { path: fromEnv, explicit: true };
  return { path: defaultConfigPath(options), explicit: false };
}

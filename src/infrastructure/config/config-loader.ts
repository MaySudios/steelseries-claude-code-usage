import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { type Config, ConfigSchema } from './schema.js';

/** The fully-defaulted configuration (zero-config mode). */
export function defaultConfig(): Config {
  return ConfigSchema.parse({});
}

/** Validate an arbitrary parsed object into a {@link Config}. Throws on invalid input. */
export function parseConfig(data: unknown): Config {
  return ConfigSchema.parse(data ?? {});
}

/** Read and validate a YAML or JSON config file. */
export async function loadConfigFile(path: string): Promise<Config> {
  const raw = await readFile(path, 'utf8');
  const data: unknown = path.toLowerCase().endsWith('.json') ? JSON.parse(raw) : parseYaml(raw);
  return parseConfig(data);
}

/**
 * Load a config file, falling back to built-in defaults when it is absent.
 * Parse/validation errors are propagated so the user learns of a broken file.
 */
export async function loadConfigOrDefault(
  path: string,
): Promise<{ config: Config; loaded: boolean }> {
  try {
    return { config: await loadConfigFile(path), loaded: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { config: defaultConfig(), loaded: false };
    }
    throw error;
  }
}

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface CorePropsOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  /** Explicit candidate file paths (skips platform defaults). */
  readonly paths?: readonly string[];
  /** Injectable file reader (testing). */
  readonly readImpl?: (path: string) => Promise<string>;
}

/**
 * Default `coreProps.json` locations per platform. SteelSeries Engine writes
 * this file with the local HTTP server address whenever it is running.
 */
export function corePropsCandidatePaths(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): string[] {
  if (platform === 'win32') {
    const programData = env.PROGRAMDATA ?? 'C:\\ProgramData';
    return [join(programData, 'SteelSeries', 'SteelSeries Engine 3', 'coreProps.json')];
  }
  // macOS (and any other Unix where the Engine might run).
  return ['/Library/Application Support/SteelSeries Engine 3/coreProps.json'];
}

/** Read the `address` ("host:port") from a coreProps file, or `undefined`. */
export async function readCorePropsAddress(
  filePath: string,
  readImpl: (path: string) => Promise<string> = (path) => readFile(path, 'utf8'),
): Promise<string | undefined> {
  try {
    const raw = await readImpl(filePath);
    const parsed = JSON.parse(raw) as { address?: unknown };
    return typeof parsed.address === 'string' && parsed.address.length > 0
      ? parsed.address
      : undefined;
  } catch {
    return undefined; // absent file ⇒ Engine not running
  }
}

/**
 * Locate the GameSense server address by scanning the candidate coreProps
 * files. Returns `undefined` when SteelSeries Engine is not running.
 */
export async function locateGameSenseAddress(
  options: CorePropsOptions = {},
): Promise<string | undefined> {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const paths = options.paths ?? corePropsCandidatePaths(platform, env);
  for (const path of paths) {
    const address = await readCorePropsAddress(path, options.readImpl);
    if (address !== undefined) return address;
  }
  return undefined;
}

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildClaudeLogo } from './bitmap.js';
import { parsePbm } from './pbm.js';

/** Built-in image name → 128×40 screen bytes. */
const BUILT_INS: Readonly<Record<string, () => number[]>> = {
  claude: () => buildClaudeLogo().toScreenBytes(),
};

/** Whether an image source is a known built-in (vs. a file path). */
export function isBuiltInImage(source: string): boolean {
  return source.trim().toLowerCase() in BUILT_INS;
}

/** Resolve a built-in image synchronously, or `undefined` if it is a file path. */
export function resolveBuiltInImage(source: string): number[] | undefined {
  return BUILT_INS[source.trim().toLowerCase()]?.();
}

/**
 * Resolve an image source to 128×40 GameSense screen bytes. A built-in name
 * (e.g. `claude`) renders procedurally; anything else is read as a PBM file,
 * centered onto a 128×40 canvas.
 */
export async function resolveImage(source: string): Promise<number[]> {
  const builtIn = BUILT_INS[source.trim().toLowerCase()];
  if (builtIn) return builtIn();
  const data = await readFile(expandTilde(source));
  return parsePbm(data).centeredOn(128, 40).toScreenBytes();
}

function expandTilde(path: string): string {
  const trimmed = path.trim();
  if (trimmed === '~' || trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return join(homedir(), trimmed.slice(1));
  }
  return trimmed;
}

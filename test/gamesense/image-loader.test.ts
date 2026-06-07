import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  isBuiltInImage,
  resolveBuiltInImage,
  resolveImage,
} from '../../src/infrastructure/gamesense/image-loader.js';

describe('built-in images', () => {
  it('recognises and renders the claude logo to 640 bytes', () => {
    expect(isBuiltInImage('claude')).toBe(true);
    expect(isBuiltInImage('CLAUDE')).toBe(true);
    expect(isBuiltInImage('whatever.pbm')).toBe(false);
    expect(resolveBuiltInImage('claude')).toHaveLength(640);
    expect(resolveBuiltInImage('nope')).toBeUndefined();
  });

  it('resolves the built-in via the async path too', async () => {
    expect(await resolveImage('claude')).toHaveLength(640);
  });
});

describe('resolveImage from a PBM file', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sscu-img-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads a PBM and centers it to 128×40 (640 bytes)', async () => {
    const path = join(dir, 'dot.pbm');
    await writeFile(path, 'P1\n2 2\n1 1\n1 1\n', 'ascii');
    const bytes = await resolveImage(path);
    expect(bytes).toHaveLength(640);
    expect(bytes.some((b) => b !== 0)).toBe(true);
  });
});

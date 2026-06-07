import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JsonlUsageSource } from '../../src/infrastructure/claude/jsonl-usage-source.js';

function assistantLine(opts: {
  ts: string;
  model: string;
  input: number;
  output?: number;
  messageId?: string;
  requestId?: string;
}): string {
  return JSON.stringify({
    type: 'assistant',
    timestamp: opts.ts,
    requestId: opts.requestId,
    message: {
      id: opts.messageId,
      model: opts.model,
      usage: { input_tokens: opts.input, output_tokens: opts.output ?? 0 },
    },
  });
}

describe('JsonlUsageSource (integration, temp dir)', () => {
  let root: string;
  let projectsDir: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'sscu-test-'));
    projectsDir = join(root, 'projects');
    const projectA = join(projectsDir, 'project-a');
    await mkdir(projectA, { recursive: true });

    // Session 1 — two distinct turns.
    await writeFile(
      join(projectA, 'session-1.jsonl'),
      [
        assistantLine({
          ts: '2026-06-07T10:00:00Z',
          model: 'claude-opus-4-8',
          input: 100,
          messageId: 'm1',
          requestId: 'r1',
        }),
        '',
        'this is not json and must be skipped',
        JSON.stringify({ type: 'user', message: { content: 'hi' } }),
        assistantLine({
          ts: '2026-06-07T10:05:00Z',
          model: 'claude-opus-4-8',
          input: 200,
          messageId: 'm2',
          requestId: 'r2',
        }),
      ].join('\n'),
    );

    // Session 2 — duplicates m1/r1 (archived copy) plus one new turn.
    await writeFile(
      join(projectA, 'session-2.jsonl'),
      [
        assistantLine({
          ts: '2026-06-07T10:00:00Z',
          model: 'claude-opus-4-8',
          input: 100,
          messageId: 'm1',
          requestId: 'r1',
        }),
        assistantLine({
          ts: '2026-06-07T11:00:00Z',
          model: 'claude-sonnet-4-6',
          input: 50,
          messageId: 'm3',
          requestId: 'r3',
        }),
      ].join('\n'),
    );

    // A non-jsonl file that must be ignored entirely.
    await writeFile(
      join(projectA, 'notes.txt'),
      assistantLine({ ts: '2026-06-07T12:00:00Z', model: 'x', input: 9999 }),
    );
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('reads, dedupes and sorts entries across files', async () => {
    const source = new JsonlUsageSource({ projectDirs: [projectsDir], lookbackDays: 0 });
    const entries = await source.load();

    // m1/m2/m3 — the duplicate m1 and the .txt file are excluded.
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.messageId)).toEqual(['m1', 'm2', 'm3']);
    // Sorted ascending by timestamp.
    expect(entries[0]?.timestamp.getTime()).toBeLessThan(entries[2]?.timestamp.getTime() ?? 0);
  });

  it('returns nothing for a non-existent directory', async () => {
    const source = new JsonlUsageSource({ projectDirs: [join(root, 'does-not-exist')] });
    expect(await source.load()).toEqual([]);
  });

  it('picks up new entries when a transcript grows (cache invalidation)', async () => {
    const grow = await mkdtemp(join(tmpdir(), 'sscu-grow-'));
    const proj = join(grow, 'projects', 'p');
    await mkdir(proj, { recursive: true });
    const file = join(proj, 'active.jsonl');
    await writeFile(
      file,
      assistantLine({
        ts: '2026-06-07T10:00:00Z',
        model: 'm',
        input: 1,
        messageId: 'a',
        requestId: 'a',
      }),
    );

    const source = new JsonlUsageSource({ projectDirs: [join(grow, 'projects')], lookbackDays: 0 });
    expect(await source.load()).toHaveLength(1);

    await appendFile(
      file,
      '\n' +
        assistantLine({
          ts: '2026-06-07T10:01:00Z',
          model: 'm',
          input: 1,
          messageId: 'b',
          requestId: 'b',
        }),
    );
    expect(await source.load()).toHaveLength(2);

    await rm(grow, { recursive: true, force: true });
  });
});

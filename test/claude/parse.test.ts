import { describe, expect, it } from 'vitest';
import { dedupeEntries, parseUsageLine } from '../../src/infrastructure/claude/parse.js';
import { entry } from '../helpers.js';

const REAL_LINE = JSON.stringify({
  type: 'assistant',
  timestamp: '2026-06-07T20:59:12.655Z',
  requestId: 'req_011Cbpa',
  message: {
    id: 'msg_015v3P',
    model: 'claude-opus-4-8',
    usage: {
      input_tokens: 18798,
      cache_creation_input_tokens: 5179,
      cache_read_input_tokens: 20892,
      output_tokens: 4445,
    },
  },
});

describe('parseUsageLine', () => {
  it('parses a real assistant usage line', () => {
    const parsed = parseUsageLine(REAL_LINE);
    expect(parsed).not.toBeNull();
    expect(parsed?.model).toBe('claude-opus-4-8');
    expect(parsed?.messageId).toBe('msg_015v3P');
    expect(parsed?.requestId).toBe('req_011Cbpa');
    expect(parsed?.timestamp.toISOString()).toBe('2026-06-07T20:59:12.655Z');
    expect(parsed?.tokens).toEqual({
      inputTokens: 18798,
      outputTokens: 4445,
      cacheCreationInputTokens: 5179,
      cacheReadInputTokens: 20892,
    });
  });

  it('reads a pre-computed costUSD when present', () => {
    const line = JSON.stringify({
      type: 'assistant',
      timestamp: '2026-06-07T20:00:00.000Z',
      message: { model: 'claude-sonnet-4-5', usage: { input_tokens: 1 } },
      costUSD: 0.42,
    });
    expect(parseUsageLine(line)?.costUSD).toBe(0.42);
  });

  it('returns null for non-assistant rows', () => {
    expect(parseUsageLine(JSON.stringify({ type: 'last-prompt', sessionId: 'x' }))).toBeNull();
    expect(parseUsageLine(JSON.stringify({ type: 'user', message: { content: 'hi' } }))).toBeNull();
  });

  it('returns null for assistant rows without usage', () => {
    expect(
      parseUsageLine(JSON.stringify({ type: 'assistant', message: { model: 'x' } })),
    ).toBeNull();
  });

  it('returns null for malformed JSON, blank lines, and bad timestamps', () => {
    expect(parseUsageLine('not json')).toBeNull();
    expect(parseUsageLine('   ')).toBeNull();
    expect(parseUsageLine('')).toBeNull();
    expect(
      parseUsageLine(
        JSON.stringify({ type: 'assistant', timestamp: 'nope', message: { usage: {} } }),
      ),
    ).toBeNull();
  });

  it('defaults a missing model to "unknown"', () => {
    const line = JSON.stringify({
      type: 'assistant',
      timestamp: '2026-06-07T20:00:00.000Z',
      message: { usage: { input_tokens: 1 } },
    });
    expect(parseUsageLine(line)?.model).toBe('unknown');
  });
});

describe('dedupeEntries', () => {
  it('drops duplicates by messageId:requestId, keeping the first', () => {
    const a = entry({ messageId: 'm1', requestId: 'r1', inputTokens: 1 });
    const b = entry({ messageId: 'm1', requestId: 'r1', inputTokens: 999 });
    const c = entry({ messageId: 'm2', requestId: 'r1', inputTokens: 2 });
    const result = dedupeEntries([a, b, c]);
    expect(result).toHaveLength(2);
    expect(result[0]?.tokens.inputTokens).toBe(1);
  });

  it('never dedupes entries missing an id', () => {
    const a = entry({ messageId: undefined, requestId: 'r1' });
    const b = entry({ messageId: 'm1', requestId: undefined });
    const c = entry({ messageId: undefined, requestId: undefined });
    expect(dedupeEntries([a, b, c])).toHaveLength(3);
  });
});

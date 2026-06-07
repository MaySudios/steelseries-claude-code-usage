import { describe, expect, it } from 'vitest';
import { homedir } from 'node:os';
import { isAbsolute } from 'node:path';
import {
  AnthropicPlanUsageSource,
  extractPlanLimits,
  findAccessToken,
  resolveCredentialsPath,
} from '../../src/infrastructure/anthropic/plan-usage-source.js';
import { nullLogger } from '../helpers.js';

describe('resolveCredentialsPath', () => {
  it('defaults to ~/.claude/.credentials.json', () => {
    const path = resolveCredentialsPath(undefined);
    expect(path.startsWith(homedir())).toBe(true);
    expect(path).toContain('.credentials.json');
  });

  it('expands a leading ~ and returns an absolute path', () => {
    const path = resolveCredentialsPath('~/custom/creds.json');
    expect(path.startsWith(homedir())).toBe(true);
    expect(isAbsolute(path)).toBe(true);
  });

  it('resolves relative paths against home (never leaves them relative)', () => {
    expect(isAbsolute(resolveCredentialsPath('creds.json'))).toBe(true);
  });
});

describe('findAccessToken', () => {
  it('finds a nested camelCase or snake_case token', () => {
    expect(findAccessToken({ claudeAiOauth: { accessToken: 'tok-1' } })).toBe('tok-1');
    expect(findAccessToken({ a: { b: { access_token: 'tok-2' } } })).toBe('tok-2');
  });

  it('returns undefined when absent', () => {
    expect(findAccessToken({ foo: 'bar' })).toBeUndefined();
    expect(findAccessToken('nope')).toBeUndefined();
  });
});

describe('extractPlanLimits', () => {
  it('maps known buckets with labels and reset times', () => {
    const limits = extractPlanLimits({
      five_hour: { utilization: 42, resets_at: '2026-06-07T20:00:00Z' },
      seven_day: { utilization: 13 },
      seven_day_opus: 88,
      ignored: { somethingElse: true },
    });
    expect(limits).toEqual([
      { id: 'five-hour', label: '5h', utilization: 42, resetsAt: new Date('2026-06-07T20:00:00Z') },
      { id: 'seven-day', label: 'Weekly', utilization: 13, resetsAt: undefined },
      { id: 'seven-day-opus', label: 'Opus', utilization: 88, resetsAt: undefined },
    ]);
  });

  it('returns [] for non-object payloads', () => {
    expect(extractPlanLimits(null)).toEqual([]);
    expect(extractPlanLimits('x')).toEqual([]);
  });
});

describe('AnthropicPlanUsageSource', () => {
  it('returns [] when no credentials are present', async () => {
    const source = new AnthropicPlanUsageSource({
      readImpl: async () => {
        throw new Error('ENOENT');
      },
      logger: nullLogger,
    });
    expect(await source.fetch()).toEqual([]);
  });

  it('reads the token, calls the endpoint, and parses the response', async () => {
    let authHeader: string | undefined;
    const source = new AnthropicPlanUsageSource({
      readImpl: async () => JSON.stringify({ claudeAiOauth: { accessToken: 'secret' } }),
      fetchImpl: (async (_url: string, init?: RequestInit) => {
        authHeader = (init?.headers as Record<string, string>)?.Authorization;
        return {
          ok: true,
          status: 200,
          json: async () => ({ five_hour: { utilization: 50 } }),
        } as Response;
      }) as typeof fetch,
      logger: nullLogger,
    });

    const limits = await source.fetch();
    expect(authHeader).toBe('Bearer secret');
    expect(limits).toEqual([
      { id: 'five-hour', label: '5h', utilization: 50, resetsAt: undefined },
    ]);
  });

  it('returns [] on a non-OK response', async () => {
    const source = new AnthropicPlanUsageSource({
      readImpl: async () => JSON.stringify({ accessToken: 'x' }),
      fetchImpl: (async () =>
        ({ ok: false, status: 401, json: async () => ({}) }) as Response) as typeof fetch,
      logger: nullLogger,
    });
    expect(await source.fetch()).toEqual([]);
  });
});

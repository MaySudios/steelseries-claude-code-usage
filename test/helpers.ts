import { type Clock, type Logger } from '../src/domain/ports.js';
import { tokenCounts } from '../src/domain/tokens.js';
import { type UsageEntry } from '../src/domain/usage-entry.js';

/** A clock frozen at a fixed instant. */
export function fixedClock(iso: string): Clock {
  const fixed = new Date(iso).getTime();
  return { now: () => new Date(fixed) };
}

/** A logger that swallows everything (keeps test output clean). */
export const nullLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export interface EntryOverrides {
  timestamp?: string | Date;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  costUSD?: number;
  messageId?: string;
  requestId?: string;
}

/** Build a {@link UsageEntry} for tests with sensible defaults. */
export function entry(overrides: EntryOverrides = {}): UsageEntry {
  const ts = overrides.timestamp ?? '2026-06-07T12:00:00.000Z';
  return {
    timestamp: ts instanceof Date ? ts : new Date(ts),
    model: overrides.model ?? 'claude-sonnet-4-5',
    tokens: tokenCounts({
      inputTokens: overrides.inputTokens ?? 0,
      outputTokens: overrides.outputTokens ?? 0,
      cacheCreationInputTokens: overrides.cacheCreationInputTokens ?? 0,
      cacheReadInputTokens: overrides.cacheReadInputTokens ?? 0,
    }),
    costUSD: overrides.costUSD,
    messageId: overrides.messageId,
    requestId: overrides.requestId,
  };
}

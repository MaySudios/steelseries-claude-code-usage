import { type TokenCounts } from './tokens.js';

/**
 * One assistant turn parsed from a Claude Code JSONL transcript.
 *
 * `messageId` + `requestId` form the deduplication key (Claude Code may write
 * the same turn to several transcripts). `costUSD` is Claude Code's own
 * pre-computed figure when present; it lets us honour the `auto`/`display`
 * cost modes without re-deriving pricing.
 */
export interface UsageEntry {
  readonly timestamp: Date;
  readonly model: string;
  readonly tokens: TokenCounts;
  readonly costUSD: number | undefined;
  readonly messageId: string | undefined;
  readonly requestId: string | undefined;
}

/**
 * Deduplication key, mirroring ccusage's `message.id:requestId` strategy.
 * Returns `undefined` when either id is missing, signalling "do not dedupe"
 * (the entry is then always counted).
 */
export function dedupeKey(entry: Pick<UsageEntry, 'messageId' | 'requestId'>): string | undefined {
  if (!entry.messageId || !entry.requestId) return undefined;
  return `${entry.messageId}:${entry.requestId}`;
}

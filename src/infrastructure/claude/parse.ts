import { type UsageEntry, dedupeKey } from '../../domain/usage-entry.js';
import { tokenCounts } from '../../domain/tokens.js';

/**
 * Parse a single Claude Code JSONL line into a {@link UsageEntry}.
 *
 * Returns `null` for anything that is not a usage-bearing assistant turn
 * (other event types, malformed JSON, missing usage block). This keeps the
 * caller a simple `.map(parseUsageLine).filter(Boolean)` pipeline.
 */
export function parseUsageLine(line: string): UsageEntry | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  let record: unknown;
  try {
    record = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isObject(record)) return null;
  if (record.type !== 'assistant') return null;

  const message = record.message;
  if (!isObject(message)) return null;
  const usage = message.usage;
  if (!isObject(usage)) return null;

  const timestamp = parseTimestamp(record.timestamp);
  if (timestamp === null) return null;

  return {
    timestamp,
    model:
      typeof message.model === 'string' && message.model.length > 0 ? message.model : 'unknown',
    tokens: tokenCounts({
      inputTokens: asNumber(usage.input_tokens),
      outputTokens: asNumber(usage.output_tokens),
      cacheCreationInputTokens: asNumber(usage.cache_creation_input_tokens),
      cacheReadInputTokens: asNumber(usage.cache_read_input_tokens),
    }),
    costUSD: asNumber(record.costUSD),
    messageId: typeof message.id === 'string' ? message.id : undefined,
    requestId: typeof record.requestId === 'string' ? record.requestId : undefined,
  };
}

/**
 * Drop duplicate turns by `message.id:requestId`, keeping the first occurrence.
 * Entries lacking either id are never treated as duplicates (always kept).
 */
export function dedupeEntries(entries: Iterable<UsageEntry>): UsageEntry[] {
  const seen = new Set<string>();
  const result: UsageEntry[] = [];
  for (const entry of entries) {
    const key = dedupeKey(entry);
    if (key === undefined) {
      result.push(entry);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

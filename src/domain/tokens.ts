/**
 * Token accounting primitives.
 *
 * Claude Code records four distinct token classes per assistant turn. They are
 * priced differently, so we keep them separate throughout the domain and only
 * collapse them when a single headline number is needed.
 */
export interface TokenCounts {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly cacheReadInputTokens: number;
}

export const ZERO_TOKENS: TokenCounts = Object.freeze({
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
});

/** Build a {@link TokenCounts}, treating any missing/NaN field as 0. */
export function tokenCounts(partial: Partial<TokenCounts>): TokenCounts {
  return {
    inputTokens: safe(partial.inputTokens),
    outputTokens: safe(partial.outputTokens),
    cacheCreationInputTokens: safe(partial.cacheCreationInputTokens),
    cacheReadInputTokens: safe(partial.cacheReadInputTokens),
  };
}

/** Element-wise sum of two token counts. */
export function addTokens(a: TokenCounts, b: TokenCounts): TokenCounts {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheCreationInputTokens: a.cacheCreationInputTokens + b.cacheCreationInputTokens,
    cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
  };
}

/** Sum a collection of token counts (empty collection → {@link ZERO_TOKENS}). */
export function sumTokens(counts: Iterable<TokenCounts>): TokenCounts {
  let acc = ZERO_TOKENS;
  for (const c of counts) acc = addTokens(acc, c);
  return acc;
}

/** Grand total across all four token classes. */
export function totalTokens(t: TokenCounts): number {
  return t.inputTokens + t.outputTokens + t.cacheCreationInputTokens + t.cacheReadInputTokens;
}

function safe(n: number | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

import { describe, expect, it } from 'vitest';
import {
  ZERO_TOKENS,
  addTokens,
  sumTokens,
  tokenCounts,
  totalTokens,
} from '../../src/domain/tokens.js';

describe('tokenCounts', () => {
  it('defaults every missing field to 0', () => {
    expect(tokenCounts({})).toEqual(ZERO_TOKENS);
  });

  it('coerces NaN/Infinity to 0', () => {
    expect(tokenCounts({ inputTokens: NaN, outputTokens: Infinity })).toEqual(ZERO_TOKENS);
  });

  it('keeps provided finite values', () => {
    expect(tokenCounts({ inputTokens: 10, cacheReadInputTokens: 5 })).toEqual({
      inputTokens: 10,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 5,
    });
  });
});

describe('addTokens / sumTokens', () => {
  it('adds element-wise', () => {
    const a = tokenCounts({ inputTokens: 1, outputTokens: 2 });
    const b = tokenCounts({ inputTokens: 3, cacheReadInputTokens: 4 });
    expect(addTokens(a, b)).toEqual({
      inputTokens: 4,
      outputTokens: 2,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 4,
    });
  });

  it('sums an empty iterable to ZERO_TOKENS', () => {
    expect(sumTokens([])).toEqual(ZERO_TOKENS);
  });

  it('sums many counts', () => {
    const counts = [
      tokenCounts({ inputTokens: 1 }),
      tokenCounts({ inputTokens: 1, outputTokens: 2 }),
      tokenCounts({ cacheCreationInputTokens: 3 }),
    ];
    expect(sumTokens(counts)).toEqual({
      inputTokens: 2,
      outputTokens: 2,
      cacheCreationInputTokens: 3,
      cacheReadInputTokens: 0,
    });
  });
});

describe('totalTokens', () => {
  it('sums all four classes', () => {
    expect(
      totalTokens(
        tokenCounts({
          inputTokens: 1,
          outputTokens: 2,
          cacheCreationInputTokens: 3,
          cacheReadInputTokens: 4,
        }),
      ),
    ).toBe(10);
  });
});

import { describe, expect, it } from 'vitest';
import { cacheHitRatio } from '../../src/domain/aggregate.js';
import { severityFromPercent } from '../../src/domain/metric.js';
import { tokenCounts } from '../../src/domain/tokens.js';
import { dedupeKey } from '../../src/domain/usage-entry.js';

describe('dedupeKey', () => {
  it('joins messageId and requestId', () => {
    expect(dedupeKey({ messageId: 'msg_1', requestId: 'req_1' })).toBe('msg_1:req_1');
  });

  it('returns undefined when either id is missing', () => {
    expect(dedupeKey({ messageId: 'msg_1', requestId: undefined })).toBeUndefined();
    expect(dedupeKey({ messageId: undefined, requestId: 'req_1' })).toBeUndefined();
    expect(dedupeKey({ messageId: undefined, requestId: undefined })).toBeUndefined();
  });
});

describe('cacheHitRatio', () => {
  it('is 0 with no input tokens', () => {
    expect(cacheHitRatio(tokenCounts({}))).toBe(0);
  });

  it('computes cache reads over (input + cache reads)', () => {
    expect(cacheHitRatio(tokenCounts({ inputTokens: 25, cacheReadInputTokens: 75 }))).toBeCloseTo(
      0.75,
      10,
    );
  });
});

describe('severityFromPercent', () => {
  const thresholds = { warn: 50, critical: 80 };

  it('maps bands correctly', () => {
    expect(severityFromPercent(0, thresholds)).toBe('idle');
    expect(severityFromPercent(10, thresholds)).toBe('ok');
    expect(severityFromPercent(50, thresholds)).toBe('warn');
    expect(severityFromPercent(79, thresholds)).toBe('warn');
    expect(severityFromPercent(80, thresholds)).toBe('critical');
    expect(severityFromPercent(140, thresholds)).toBe('critical');
  });
});

import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatDuration,
  formatPercent,
  formatRate,
  formatTokens,
  modelFamily,
} from '../../src/application/formatters.js';

describe('formatCurrency', () => {
  it('shows cents below 100 and whole dollars at/above 100', () => {
    expect(formatCurrency(4.21)).toBe('$4.21');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(146.32)).toBe('$146');
    expect(formatCurrency(99.99)).toBe('$99.99'); // just below the no-cents band
    expect(formatCurrency(150)).toBe('$150');
  });

  it('respects a custom symbol and tolerates non-finite input', () => {
    expect(formatCurrency(5, '€')).toBe('€5.00');
    expect(formatCurrency(NaN)).toBe('$0.00');
  });
});

describe('formatTokens', () => {
  it('scales to k and M, trimming trailing .0', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(1500)).toBe('1.5k');
    expect(formatTokens(612000)).toBe('612k');
    expect(formatTokens(1500000)).toBe('1.5M');
  });
});

describe('formatDuration', () => {
  it('formats minutes as Hh Mm', () => {
    expect(formatDuration(133)).toBe('2h13m');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(-5)).toBe('0m');
  });
});

describe('misc formatters', () => {
  it('formatPercent rounds', () => {
    expect(formatPercent(43.6)).toBe('44%');
  });

  it('formatRate appends /m', () => {
    expect(formatRate(1800)).toBe('1.8k/m');
  });

  it('modelFamily shortens known families', () => {
    expect(modelFamily('claude-opus-4-8')).toBe('Opus');
    expect(modelFamily('claude-sonnet-4-6')).toBe('Sonnet');
    expect(modelFamily('claude-haiku-4-5')).toBe('Haiku');
    expect(modelFamily(undefined)).toBeUndefined();
    expect(modelFamily('gpt-4o')).toBe('gpt-4o');
  });
});

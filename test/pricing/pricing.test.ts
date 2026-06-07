import { describe, expect, it, vi } from 'vitest';
import { embeddedPricingFor } from '../../src/infrastructure/pricing/embedded-pricing.js';
import {
  LiteLlmPricingProvider,
  lookupInMap,
} from '../../src/infrastructure/pricing/litellm-pricing-provider.js';
import { nullLogger } from '../helpers.js';

describe('embeddedPricingFor', () => {
  it('matches by family regardless of version', () => {
    expect(embeddedPricingFor('claude-opus-4-8')?.inputCostPerToken).toBe(1.5e-5);
    expect(embeddedPricingFor('claude-sonnet-4-6')?.inputCostPerToken).toBe(3e-6);
    expect(embeddedPricingFor('claude-haiku-4-5-20251001')?.inputCostPerToken).toBe(1e-6);
  });

  it('returns undefined for unknown families', () => {
    expect(embeddedPricingFor('gpt-4o')).toBeUndefined();
  });
});

describe('lookupInMap', () => {
  const map = {
    'claude-opus-4-8': { input_cost_per_token: 1.5e-5, output_cost_per_token: 7.5e-5 },
    'anthropic/claude-sonnet-4-6': { input_cost_per_token: 3e-6, output_cost_per_token: 1.5e-5 },
  };

  it('matches exact keys', () => {
    expect(lookupInMap(map, 'claude-opus-4-8')?.outputCostPerToken).toBe(7.5e-5);
  });

  it('matches via the anthropic/ prefix', () => {
    expect(lookupInMap(map, 'claude-sonnet-4-6')?.inputCostPerToken).toBe(3e-6);
  });

  it('strips a trailing date stamp', () => {
    expect(lookupInMap(map, 'claude-opus-4-8-20260101')?.inputCostPerToken).toBe(1.5e-5);
  });

  it('derives cache pricing when absent (1.25x / 0.1x input)', () => {
    const pricing = lookupInMap({ m: { input_cost_per_token: 1e-5 } }, 'm');
    expect(pricing?.cacheCreationInputTokenCost).toBeCloseTo(1.25e-5, 12);
    expect(pricing?.cacheReadInputTokenCost).toBeCloseTo(1e-6, 12);
  });

  it('returns undefined when missing', () => {
    expect(lookupInMap(map, 'nope')).toBeUndefined();
  });
});

describe('LiteLlmPricingProvider', () => {
  it('uses embedded pricing in offline mode without fetching', async () => {
    const fetchImpl = vi.fn();
    const provider = new LiteLlmPricingProvider({ offline: true, fetchImpl });
    expect((await provider.getPricing('claude-opus-4-8'))?.inputCostPerToken).toBe(1.5e-5);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fetches and prefers the remote map, caching across calls', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        'claude-opus-4-8': { input_cost_per_token: 9.9e-9, output_cost_per_token: 1 },
      }),
    );
    const provider = new LiteLlmPricingProvider({ fetchImpl, logger: nullLogger });

    expect((await provider.getPricing('claude-opus-4-8'))?.inputCostPerToken).toBe(9.9e-9);
    await provider.getPricing('claude-opus-4-8');
    expect(fetchImpl).toHaveBeenCalledTimes(1); // cached
  });

  it('falls back to embedded pricing when the fetch fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    const provider = new LiteLlmPricingProvider({ fetchImpl, logger: nullLogger });
    expect((await provider.getPricing('claude-sonnet-4-6'))?.inputCostPerToken).toBe(3e-6);
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

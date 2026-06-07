import { type ModelPricing } from '../../domain/cost.js';

/**
 * Offline fallback pricing, keyed by model *family*. Anthropic has historically
 * kept per-tier pricing stable across versions, so matching on `opus`/`sonnet`/
 * `haiku` keeps cost estimates sensible even for brand-new model strings that
 * the upstream LiteLLM dataset has not yet published. Figures are per-token USD.
 */
export const EMBEDDED_PRICING: Readonly<Record<string, ModelPricing>> = Object.freeze({
  opus: {
    inputCostPerToken: 1.5e-5,
    outputCostPerToken: 7.5e-5,
    cacheCreationInputTokenCost: 1.875e-5,
    cacheReadInputTokenCost: 1.5e-6,
  },
  sonnet: {
    inputCostPerToken: 3e-6,
    outputCostPerToken: 1.5e-5,
    cacheCreationInputTokenCost: 3.75e-6,
    cacheReadInputTokenCost: 3e-7,
  },
  haiku: {
    inputCostPerToken: 1e-6,
    outputCostPerToken: 5e-6,
    cacheCreationInputTokenCost: 1.25e-6,
    cacheReadInputTokenCost: 1e-7,
  },
});

/** Best-effort family match for a model string. */
export function embeddedPricingFor(model: string): ModelPricing | undefined {
  const normalized = model.toLowerCase();
  if (normalized.includes('opus')) return EMBEDDED_PRICING.opus;
  if (normalized.includes('sonnet')) return EMBEDDED_PRICING.sonnet;
  if (normalized.includes('haiku')) return EMBEDDED_PRICING.haiku;
  return undefined;
}

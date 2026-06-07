import { type ModelPricing } from '../../domain/cost.js';
import { type Clock, type Logger, type PricingProvider } from '../../domain/ports.js';
import { embeddedPricingFor } from './embedded-pricing.js';

const DEFAULT_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const DEFAULT_TIMEOUT_MS = 8000;

interface RawPriceEntry {
  readonly input_cost_per_token?: number;
  readonly output_cost_per_token?: number;
  readonly cache_creation_input_token_cost?: number;
  readonly cache_read_input_token_cost?: number;
}

export interface LiteLlmPricingProviderOptions {
  /** Never touch the network; use the embedded family table only. */
  readonly offline?: boolean;
  readonly url?: string;
  readonly timeoutMs?: number;
  readonly cacheTtlMs?: number;
  readonly fetchImpl?: typeof fetch;
  readonly clock?: Clock;
  readonly logger?: Logger;
}

/**
 * Resolves per-token pricing from the LiteLLM dataset, with graceful offline
 * fallback to {@link embeddedPricingFor}. The remote map is fetched lazily and
 * cached; any network failure degrades silently to the embedded figures so the
 * plugin never blocks on connectivity.
 */
export class LiteLlmPricingProvider implements PricingProvider {
  private readonly options: LiteLlmPricingProviderOptions;
  private map: Record<string, RawPriceEntry> | undefined;
  private fetchedAtMs = 0;
  private inflight: Promise<void> | undefined;

  constructor(options: LiteLlmPricingProviderOptions = {}) {
    this.options = options;
  }

  async getPricing(model: string): Promise<ModelPricing | undefined> {
    if (!this.options.offline) {
      await this.ensureLoaded();
      const fromMap = this.map ? lookupInMap(this.map, model) : undefined;
      if (fromMap) return fromMap;
    }
    return embeddedPricingFor(model);
  }

  private async ensureLoaded(): Promise<void> {
    const now = this.options.clock?.now().getTime() ?? Date.now();
    const ttl = this.options.cacheTtlMs ?? DEFAULT_TTL_MS;
    if (this.map && now - this.fetchedAtMs < ttl) return;
    if (this.inflight) return this.inflight;

    this.inflight = this.fetchMap(now).finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }

  private async fetchMap(now: number): Promise<void> {
    const url = this.options.url ?? DEFAULT_URL;
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = (await response.json()) as Record<string, RawPriceEntry>;
      this.map = json;
      this.fetchedAtMs = now;
      this.options.logger?.debug(`pricing: loaded ${Object.keys(json).length} models from LiteLLM`);
    } catch (error) {
      this.options.logger?.warn(
        `pricing: LiteLLM fetch failed (${String(error)}); using embedded pricing`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Look up a model with progressively looser matching. Exported for testing. */
export function lookupInMap(
  map: Record<string, RawPriceEntry>,
  model: string,
): ModelPricing | undefined {
  const candidates = [
    model,
    `anthropic/${model}`,
    `claude-3-5-${model}`,
    model.replace(/-\d{8}$/, ''), // strip trailing -YYYYMMDD date stamp
    `anthropic/${model.replace(/-\d{8}$/, '')}`,
  ];
  for (const key of candidates) {
    const entry = map[key];
    if (entry && entry.input_cost_per_token !== undefined) return toModelPricing(entry);
  }
  return undefined;
}

function toModelPricing(entry: RawPriceEntry): ModelPricing {
  const input = entry.input_cost_per_token ?? 0;
  return {
    inputCostPerToken: input,
    outputCostPerToken: entry.output_cost_per_token ?? 0,
    // Anthropic cache pricing: write ≈ 1.25× input, read ≈ 0.1× input when absent.
    cacheCreationInputTokenCost: entry.cache_creation_input_token_cost ?? input * 1.25,
    cacheReadInputTokenCost: entry.cache_read_input_token_cost ?? input * 0.1,
  };
}

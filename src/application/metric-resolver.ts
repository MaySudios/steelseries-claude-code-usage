import { cacheHitRatio } from '../domain/aggregate.js';
import { totalCost } from '../domain/cost.js';
import { clampPercent } from '../domain/math.js';
import { type Metric, type MetricSeverity, severityFromPercent } from '../domain/metric.js';
import { totalTokens } from '../domain/tokens.js';
import {
  formatCurrency,
  formatDuration,
  formatPercent,
  formatRate,
  formatTokens,
  modelFamily,
} from './formatters.js';
import { type UsageSnapshot } from './usage-snapshot.js';

export interface MetricResolverOptions {
  readonly currencySymbol?: string;
  /** Burn rate (tokens/min) mapped to 100% for the burn gauge/pulse. Default 3000. */
  readonly burnScaleTokensPerMin?: number;
  /** Headroom % that turns the indicator amber. Default 70. */
  readonly usageWarnPct?: number;
  /** Headroom % that turns the indicator red. Default 90. */
  readonly usageCriticalPct?: number;
}

/**
 * Turns a {@link UsageSnapshot} into a flat map of display-ready {@link Metric}s
 * keyed by stable ids (`block.cost`, `today.cost`, `plan.weekly`, …). The OLED
 * templating and per-key RGB layers both consume this map, so there is exactly
 * one place that decides what each number means and how it is formatted.
 */
export class MetricResolver {
  private readonly symbol: string;
  private readonly burnScale: number;
  private readonly thresholds: { readonly warn: number; readonly critical: number };

  constructor(options: MetricResolverOptions = {}) {
    this.symbol = options.currencySymbol ?? '$';
    this.burnScale = options.burnScaleTokensPerMin ?? 3000;
    this.thresholds = {
      warn: options.usageWarnPct ?? 70,
      critical: options.usageCriticalPct ?? 90,
    };
  }

  resolve(snapshot: UsageSnapshot): Map<string, Metric> {
    const metrics = new Map<string, Metric>();
    const add = (metric: Metric): void => void metrics.set(metric.id, metric);

    const block = snapshot.activeBlock;
    const usagePct = block?.usageRatio !== undefined ? block.usageRatio * 100 : undefined;
    const blockSeverity: MetricSeverity =
      usagePct !== undefined
        ? severityFromPercent(usagePct, this.thresholds)
        : block
          ? 'ok'
          : 'idle';

    add({
      id: 'block.cost',
      label: '5h',
      value: formatCurrency(block ? totalCost(block.block.cost) : 0, this.symbol),
      percent: undefined,
      severity: blockSeverity,
    });
    add({
      id: 'block.timeLeft',
      label: 'left',
      value: block ? formatDuration(block.minutesRemaining) : '—',
      percent: undefined,
      severity: blockSeverity,
    });
    add({
      id: 'block.usagePct',
      label: 'use',
      value: usagePct !== undefined ? formatPercent(usagePct) : '—',
      percent: usagePct !== undefined ? clampPercent(usagePct) : undefined,
      severity: blockSeverity,
    });
    add({
      id: 'block.tokens',
      label: 'tok',
      value: formatTokens(block ? totalTokens(block.block.tokens) : 0),
      percent: undefined,
      severity: blockSeverity,
    });

    // Burn reflects the *recent* token rate, so it idles to 0 between prompts
    // (a live "is Claude generating right now" signal, not a block average).
    const recentRate = snapshot.recentRateTokensPerMin;
    const burnPct = clampPercent((recentRate / this.burnScale) * 100);
    const burnSeverity: MetricSeverity =
      burnPct > 0 ? severityFromPercent(burnPct, this.thresholds) : 'idle';
    add({
      id: 'block.burnRate',
      label: 'burn',
      value: formatRate(recentRate),
      percent: burnPct,
      severity: burnSeverity,
    });
    add({
      id: 'block.burnPct',
      label: 'burn',
      value: formatPercent(burnPct),
      percent: burnPct,
      severity: burnSeverity,
    });
    add({
      id: 'block.projCost',
      label: 'proj',
      value: formatCurrency(block ? block.projectedCostUSD : 0, this.symbol),
      percent: undefined,
      severity: blockSeverity,
    });
    add({
      id: 'block.projTokens',
      label: 'proj',
      value: formatTokens(block ? block.projectedTokens : 0),
      percent: undefined,
      severity: blockSeverity,
    });

    add({
      id: 'today.cost',
      label: 'today',
      value: formatCurrency(totalCost(snapshot.today.cost), this.symbol),
      percent: undefined,
      severity: 'info',
    });
    add({
      id: 'today.tokens',
      label: 'today',
      value: formatTokens(totalTokens(snapshot.today.tokens)),
      percent: undefined,
      severity: 'info',
    });
    add({
      id: 'month.cost',
      label: 'month',
      value: formatCurrency(totalCost(snapshot.month.cost), this.symbol),
      percent: undefined,
      severity: 'info',
    });

    const cachePct = cacheHitRatio(snapshot.today.tokens) * 100;
    add({
      id: 'cache.hitPct',
      label: 'cache',
      value: formatPercent(cachePct),
      percent: clampPercent(cachePct),
      severity: 'ok',
    });

    add({
      id: 'model.current',
      label: 'model',
      value: modelFamily(snapshot.recentModel) ?? '—',
      percent: undefined,
      severity: snapshot.recentModel ? 'info' : 'idle',
    });
    // Numeric "level" so a model can drive a threshold-coloured key
    // (idle 0 · Haiku 20 · Sonnet 50 · Opus 90).
    add({
      id: 'model.level',
      label: 'model',
      value: modelFamily(snapshot.recentModel) ?? '—',
      percent: modelLevel(snapshot.recentModel),
      severity: snapshot.recentModel ? 'info' : 'idle',
    });

    for (const limit of snapshot.planLimits) {
      add({
        id: `plan.${limit.id}`,
        label: limit.label,
        value: formatPercent(limit.utilization),
        percent: clampPercent(limit.utilization),
        severity: severityFromPercent(limit.utilization, this.thresholds),
      });
      if (limit.resetsAt) {
        add({
          id: `plan.${limit.id}.reset`,
          label: `${limit.label} reset`,
          value: formatDuration((limit.resetsAt.getTime() - snapshot.now.getTime()) / 60000),
          percent: undefined,
          severity: 'info',
        });
      }
    }

    return metrics;
  }
}

/**
 * Substitute `${metric.id}` tokens in a template with the metric's formatted
 * value. Unknown ids resolve to an empty string.
 */
export function renderTemplate(template: string, metrics: ReadonlyMap<string, Metric>): string {
  return template.replace(/\$\{([^}]+)\}/g, (_match, id: string) => {
    const metric = metrics.get(id.trim());
    return metric ? metric.value : '';
  });
}

function modelLevel(model: string | undefined): number {
  const family = modelFamily(model);
  if (family === 'Opus') return 90;
  if (family === 'Sonnet') return 50;
  if (family === 'Haiku') return 20;
  return model ? 60 : 0;
}

/**
 * Severity ramp shared by the OLED (icon/labels) and per-key RGB (color bands).
 * Ordered from "nothing happening" to "you are about to hit a ceiling".
 */
export type MetricSeverity = 'idle' | 'ok' | 'info' | 'warn' | 'critical';

export const SEVERITY_ORDER: readonly MetricSeverity[] = ['idle', 'ok', 'info', 'warn', 'critical'];

/**
 * A resolved, display-ready metric. The resolver turns raw usage data into
 * these; the OLED renders `label`/`value` and the RGB layer consumes `percent`
 * and `severity`.
 */
export interface Metric {
  /** Stable identifier, e.g. `block.cost`. */
  readonly id: string;
  /** Short label suited to a tiny screen, e.g. `5h`. */
  readonly label: string;
  /** Pre-formatted value, e.g. `$4.21` or `2h13m`. */
  readonly value: string;
  /** Gauge value 0–100 when the metric is proportional, else `undefined`. */
  readonly percent: number | undefined;
  readonly severity: MetricSeverity;
}

/** Map a 0–100 percentage to a severity using ascending thresholds. */
export function severityFromPercent(
  percent: number,
  thresholds: { readonly warn: number; readonly critical: number },
): MetricSeverity {
  if (percent >= thresholds.critical) return 'critical';
  if (percent >= thresholds.warn) return 'warn';
  if (percent > 0) return 'ok';
  return 'idle';
}

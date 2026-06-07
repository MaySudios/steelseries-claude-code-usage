/** Compact, glanceable formatting for a 128x40 OLED. */

/** `$4.21`; amounts ≥ 100 drop the cents to save pixels. */
export function formatCurrency(usd: number, symbol = '$'): string {
  const value = Number.isFinite(usd) ? usd : 0;
  if (Math.abs(value) >= 100) return `${symbol}${Math.round(value)}`;
  return `${symbol}${value.toFixed(2)}`;
}

/** `950` → `950`, `1500` → `1.5k`, `612000` → `612k`, `1500000` → `1.5M`. */
export function formatTokens(count: number): string {
  const value = Math.round(Number.isFinite(count) ? count : 0);
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trimOneDecimal(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trimOneDecimal(value / 1_000)}k`;
  return `${value}`;
}

/** `133` → `2h13m`, `45` → `45m`, `0` → `0m`. */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours > 0 ? `${hours}h${mins}m` : `${mins}m`;
}

/** `43` → `43%`. */
export function formatPercent(percent: number): string {
  return `${Math.round(Number.isFinite(percent) ? percent : 0)}%`;
}

/** Token burn rate per minute, e.g. `1.8k/m`. */
export function formatRate(tokensPerMinute: number): string {
  return `${formatTokens(tokensPerMinute)}/m`;
}

/** Short model family label, e.g. `Opus`, `Sonnet`, `Haiku`. */
export function modelFamily(model: string | undefined): string | undefined {
  if (!model) return undefined;
  const normalized = model.toLowerCase();
  if (normalized.includes('opus')) return 'Opus';
  if (normalized.includes('sonnet')) return 'Sonnet';
  if (normalized.includes('haiku')) return 'Haiku';
  return model;
}

function trimOneDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

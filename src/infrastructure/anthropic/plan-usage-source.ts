import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { type Logger, type PlanUsageSource } from '../../domain/ports.js';
import { type PlanLimit } from '../../domain/plan-usage.js';

const DEFAULT_URL = 'https://api.anthropic.com/api/oauth/usage';
const DEFAULT_TIMEOUT_MS = 8000;

/** Friendly labels for the utilization buckets Anthropic is known to expose. */
const LABELS: Readonly<Record<string, string>> = {
  five_hour: '5h',
  seven_day: 'Weekly',
  seven_day_opus: 'Opus',
  seven_day_sonnet: 'Sonnet',
  seven_day_oauth_apps: 'Apps',
};

export interface AnthropicPlanUsageSourceOptions {
  /** Path to Claude Code's OAuth credentials. Default `~/.claude/.credentials.json`. */
  readonly credentialsPath?: string;
  readonly url?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
  readonly readImpl?: (path: string) => Promise<string>;
  readonly logger?: Logger;
}

/**
 * EXPERIMENTAL, opt-in source of subscription utilization, mirroring Lucxar's
 * Stream Deck plugin: it reads Claude Code's local OAuth token and queries
 * Anthropic's usage endpoint. The response schema is undocumented, so parsing
 * is deliberately defensive — any failure yields an empty list and the local
 * token/cost telemetry continues unaffected.
 */
export class AnthropicPlanUsageSource implements PlanUsageSource {
  private readonly options: AnthropicPlanUsageSourceOptions;

  constructor(options: AnthropicPlanUsageSourceOptions = {}) {
    this.options = options;
  }

  async fetch(): Promise<PlanLimit[]> {
    const token = await this.readToken();
    if (!token) {
      this.options.logger?.debug('plan limits: no OAuth token found; skipping');
      return [];
    }

    const fetchImpl = this.options.fetchImpl ?? fetch;
    const url = this.options.url ?? DEFAULT_URL;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    try {
      const response = await fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'anthropic-beta': 'oauth-2025-04-20',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        this.options.logger?.warn(`plan limits: usage endpoint returned HTTP ${response.status}`);
        return [];
      }
      return extractPlanLimits(await response.json());
    } catch (error) {
      // Log only the concise message — never the full error/token context.
      this.options.logger?.warn(`plan limits: usage request failed (${errorMessage(error)})`);
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  private async readToken(): Promise<string | undefined> {
    const path = resolveCredentialsPath(this.options.credentialsPath);
    const readImpl = this.options.readImpl ?? ((p: string) => readFile(p, 'utf8'));
    try {
      const parsed: unknown = JSON.parse(await readImpl(path));
      return findAccessToken(parsed);
    } catch {
      return undefined;
    }
  }
}

/** Resolve the credentials path, expanding a leading `~` and normalising it. */
export function resolveCredentialsPath(raw: string | undefined): string {
  if (!raw || raw.trim() === '') return join(homedir(), '.claude', '.credentials.json');
  const trimmed = raw.trim();
  const expanded =
    trimmed === '~' || trimmed.startsWith('~/') || trimmed.startsWith('~\\')
      ? join(homedir(), trimmed.slice(1))
      : trimmed;
  return isAbsolute(expanded) ? resolve(expanded) : resolve(homedir(), expanded);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.name === 'AbortError' ? 'timeout' : error.message;
  return 'unknown error';
}

/** Recursively find an `accessToken`/`access_token` string anywhere in the JSON. */
export function findAccessToken(value: unknown, depth = 0): string | undefined {
  if (depth > 6 || !isObject(value)) return undefined;
  for (const key of ['accessToken', 'access_token']) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  }
  for (const nested of Object.values(value)) {
    const found = findAccessToken(nested, depth + 1);
    if (found) return found;
  }
  return undefined;
}

/**
 * Map a usage payload into {@link PlanLimit}s. Accepts top-level buckets whose
 * value is either a number (utilization) or an object carrying a utilization-
 * like number and an optional reset timestamp.
 */
export function extractPlanLimits(payload: unknown): PlanLimit[] {
  if (!isObject(payload)) return [];
  const limits: PlanLimit[] = [];
  for (const [key, value] of Object.entries(payload)) {
    const utilization = readUtilization(value);
    if (utilization === undefined) continue;
    limits.push({
      id: slug(key),
      label: LABELS[key] ?? prettify(key),
      utilization,
      resetsAt: readReset(value),
    });
  }
  return limits;
}

function readUtilization(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!isObject(value)) return undefined;
  for (const key of ['utilization', 'used_pct', 'percent', 'usage', 'used']) {
    const candidate = value[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
  }
  return undefined;
}

function readReset(value: unknown): Date | undefined {
  if (!isObject(value)) return undefined;
  for (const key of ['resets_at', 'reset_at', 'resetsAt', 'resets']) {
    const candidate = value[key];
    if (typeof candidate === 'string') {
      const date = new Date(candidate);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  return undefined;
}

function slug(key: string): string {
  return (
    key
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || key
  );
}

function prettify(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

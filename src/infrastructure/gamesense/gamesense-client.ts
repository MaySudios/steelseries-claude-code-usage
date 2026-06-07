import { type GameSenseHandler } from './handlers/color-handlers.js';
import { type HttpTransport } from './http-transport.js';

/** GameSense restricts game/event identifiers to this charset. */
const IDENTIFIER_RE = /^[A-Z0-9_-]+$/;

export class GameSenseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | undefined,
  ) {
    super(message);
    this.name = 'GameSenseError';
  }
}

export interface GameMetadataInput {
  readonly displayName?: string;
  readonly developer?: string;
  /** Deactivation timer (1000–60000 ms). Default GameSense behaviour is 15000. */
  readonly deinitializeTimerMs?: number;
}

export interface BindEventInput {
  readonly event: string;
  readonly handlers: readonly GameSenseHandler[];
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly iconId?: number;
  readonly valueOptional?: boolean;
}

export interface RegisterEventInput {
  readonly event: string;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly iconId?: number;
  readonly valueOptional?: boolean;
}

export interface SendEventInput {
  readonly event: string;
  readonly value?: number;
  readonly frame?: Record<string, unknown>;
}

/**
 * Thin, typed wrapper over the GameSense HTTP JSON API. Knows nothing about
 * Claude usage — it just registers a game, binds events/handlers, and posts
 * event values/heartbeats to the local SteelSeries Engine.
 */
export class GameSenseClient {
  constructor(
    private readonly address: string,
    private readonly transport: HttpTransport,
    private readonly game: string,
  ) {
    assertIdentifier(game, 'game');
  }

  async registerGame(metadata: GameMetadataInput = {}): Promise<void> {
    const body: Record<string, unknown> = { game: this.game };
    if (metadata.displayName !== undefined) body.game_display_name = metadata.displayName;
    if (metadata.developer !== undefined) body.developer = metadata.developer;
    if (metadata.deinitializeTimerMs !== undefined) {
      body.deinitialize_timer_length_ms = clampDeinit(metadata.deinitializeTimerMs);
    }
    await this.post('/game_metadata', body);
  }

  async bindEvent(input: BindEventInput): Promise<void> {
    assertIdentifier(input.event, 'event');
    if (input.handlers.length === 0) throw new Error('bindEvent requires at least one handler');
    await this.post('/bind_game_event', {
      game: this.game,
      event: input.event,
      min_value: input.minValue ?? 0,
      max_value: input.maxValue ?? 100,
      icon_id: input.iconId ?? 0,
      value_optional: input.valueOptional ?? false,
      handlers: input.handlers,
    });
  }

  async registerEvent(input: RegisterEventInput): Promise<void> {
    assertIdentifier(input.event, 'event');
    await this.post('/register_game_event', {
      game: this.game,
      event: input.event,
      min_value: input.minValue ?? 0,
      max_value: input.maxValue ?? 100,
      icon_id: input.iconId ?? 0,
      value_optional: input.valueOptional ?? false,
    });
  }

  async sendEvent(input: SendEventInput): Promise<void> {
    assertIdentifier(input.event, 'event');
    const data: Record<string, unknown> = {};
    if (input.value !== undefined) data.value = Math.round(input.value);
    if (input.frame !== undefined) data.frame = input.frame;
    await this.post('/game_event', { game: this.game, event: input.event, data });
  }

  async heartbeat(): Promise<void> {
    await this.post('/game_heartbeat', { game: this.game });
  }

  async removeGame(): Promise<void> {
    await this.post('/remove_game', { game: this.game });
  }

  private async post(path: string, body: unknown): Promise<void> {
    const response = await this.transport.post(`http://${this.address}${path}`, body);
    if (response.status !== 200) {
      const { code, message } = parseError(response.body);
      throw new GameSenseError(
        `GameSense ${path} failed (HTTP ${response.status})${message ? `: ${message}` : ''}`,
        response.status,
        code,
      );
    }
  }
}

function assertIdentifier(value: string, kind: 'game' | 'event'): void {
  if (!IDENTIFIER_RE.test(value)) {
    throw new Error(
      `Invalid GameSense ${kind} id "${value}": only A-Z, 0-9, hyphen and underscore are allowed`,
    );
  }
}

function clampDeinit(ms: number): number {
  return Math.min(60000, Math.max(1000, Math.round(ms)));
}

function parseError(body: string): { code: number | undefined; message: string | undefined } {
  try {
    const parsed = JSON.parse(body) as { code?: number; error?: string };
    return { code: parsed.code, message: parsed.error };
  } catch {
    return { code: undefined, message: body.trim() || undefined };
  }
}

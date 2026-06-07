import { clampPercent } from '../../domain/math.js';
import { type Display, type DisplayFrame, type Logger } from '../../domain/ports.js';
import { type GameMetadataInput, type GameSenseClient } from './gamesense-client.js';
import { type GameSenseHandler } from './handlers/color-handlers.js';
import { screenTextHandler } from './handlers/screen-handlers.js';

/** Binds one GameSense event to a pre-built per-key handler. */
export interface KeyEventBinding {
  /** Must match a key in {@link DisplayFrame.keyValues}. */
  readonly id: string;
  /** UPPERCASE GameSense event name. */
  readonly event: string;
  /** Pre-built color handler (includes `device-type` and `custom-zone-keys`). */
  readonly handler: GameSenseHandler;
}

export interface ScreenBinding {
  readonly event: string;
  /** Frame keys, one per OLED line (top to bottom). */
  readonly lineKeys: readonly string[];
  readonly deviceType?: string;
}

export interface GameSenseDisplayPlan {
  readonly metadata: GameMetadataInput;
  readonly screen?: ScreenBinding;
  readonly keys: readonly KeyEventBinding[];
}

/**
 * Implements the {@link Display} port over the GameSense API. At {@link connect}
 * it registers the game and binds every event/handler once; each {@link render}
 * then only posts current values (and OLED line text), exactly matching
 * GameSense's "bind handlers once, stream values" model.
 */
export class GameSenseDisplay implements Display {
  private connected = false;

  constructor(
    private readonly client: GameSenseClient,
    private readonly plan: GameSenseDisplayPlan,
    private readonly logger?: Logger,
  ) {}

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.client.registerGame(this.plan.metadata);

    if (this.plan.screen) {
      await this.client.bindEvent({
        event: this.plan.screen.event,
        valueOptional: true, // OLED text may repeat; don't let value caching suppress it
        handlers: [screenTextHandler(this.plan.screen.lineKeys, this.plan.screen.deviceType)],
      });
    }

    for (const key of this.plan.keys) {
      await this.client.bindEvent({
        event: key.event,
        minValue: 0,
        maxValue: 100,
        handlers: [key.handler],
      });
    }

    this.connected = true;
    this.logger?.debug(
      `gamesense: connected (screen=${this.plan.screen ? 'yes' : 'no'}, keys=${this.plan.keys.length})`,
    );
  }

  async render(frame: DisplayFrame): Promise<void> {
    if (!this.connected) await this.connect();

    if (this.plan.screen) {
      const frameData: Record<string, unknown> = {};
      this.plan.screen.lineKeys.forEach((key, index) => {
        frameData[key] = frame.screenLines[index] ?? '';
      });
      await this.client.sendEvent({ event: this.plan.screen.event, value: 0, frame: frameData });
    }

    for (const key of this.plan.keys) {
      const value = frame.keyValues[key.id];
      if (value === undefined) continue;
      await this.client.sendEvent({ event: key.event, value: clampPercent(value) });
    }
  }

  async heartbeat(): Promise<void> {
    await this.client.heartbeat();
  }

  async dispose(): Promise<void> {
    try {
      await this.client.removeGame();
    } catch (error) {
      this.logger?.debug(`gamesense: removeGame failed during dispose: ${String(error)}`);
    }
    this.connected = false;
  }
}

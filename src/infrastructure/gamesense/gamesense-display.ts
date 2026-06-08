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
  /** Built-in icon (0–43) shown next to the event in SteelSeries GG. */
  readonly iconId?: number;
}

/** The OLED text event (multi-line). All text pages share it; only the frame changes. */
export interface ScreenTextBinding {
  readonly event: string;
  readonly lineKeys: readonly string[];
  readonly deviceType?: string;
  /** Built-in icon (0–43): shown in GG and, if > 0, drawn on the OLED. */
  readonly iconId?: number;
}

export interface GameSenseDisplayPlan {
  readonly metadata: GameMetadataInput;
  readonly screen?: ScreenTextBinding;
  readonly keys: readonly KeyEventBinding[];
}

/**
 * Implements the {@link Display} port over GameSense. Binds at most one text
 * event and one image event once, plus the key events. Each {@link render}
 * sends ONLY the active page's event — which fully replaces the OLED, so pages
 * never stack — mirroring how real GameSense OLED apps rotate content.
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
    // Clear any stale registration from a previous version (e.g. old image
    // events) so SteelSeries GG shows a clean, current event list.
    try {
      await this.client.removeGame();
    } catch {
      /* nothing registered yet — fine */
    }
    await this.client.registerGame(this.plan.metadata);

    if (this.plan.screen) {
      const { event, lineKeys, deviceType, iconId = 0 } = this.plan.screen;
      await this.client.bindEvent({
        event,
        valueOptional: true,
        iconId,
        handlers: [screenTextHandler(lineKeys, deviceType, iconId)],
      });
    }

    for (const key of this.plan.keys) {
      await this.client.bindEvent({
        event: key.event,
        minValue: 0,
        maxValue: 100,
        iconId: key.iconId ?? 0,
        handlers: [key.handler],
      });
    }

    this.connected = true;
    this.logger?.debug(
      `gamesense: connected (text=${this.plan.screen ? 'yes' : 'no'}, keys=${this.plan.keys.length})`,
    );
  }

  async render(frame: DisplayFrame): Promise<void> {
    if (!this.connected) await this.connect();
    await this.renderScreen(frame);

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

  private async renderScreen(frame: DisplayFrame): Promise<void> {
    const content = frame.screen;
    if (content === undefined || this.plan.screen === undefined) return;

    const frameData: Record<string, unknown> = {};
    this.plan.screen.lineKeys.forEach((key, index) => {
      frameData[key] = content.lines[index] ?? '';
    });
    await this.client.sendEvent({ event: this.plan.screen.event, value: 0, frame: frameData });
  }
}

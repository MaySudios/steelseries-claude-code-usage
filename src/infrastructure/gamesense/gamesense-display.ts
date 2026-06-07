import { clampPercent } from '../../domain/math.js';
import { type Display, type DisplayFrame, type Logger } from '../../domain/ports.js';
import { type GameMetadataInput, type GameSenseClient } from './gamesense-client.js';
import { type GameSenseHandler } from './handlers/color-handlers.js';
import { screenImageHandler, screenTextHandler } from './handlers/screen-handlers.js';

/** Binds one GameSense event to a pre-built per-key handler. */
export interface KeyEventBinding {
  /** Must match a key in {@link DisplayFrame.keyValues}. */
  readonly id: string;
  /** UPPERCASE GameSense event name. */
  readonly event: string;
  /** Pre-built color handler (includes `device-type` and `custom-zone-keys`). */
  readonly handler: GameSenseHandler;
}

/** The shared OLED text event. The value selects which icon (index into `iconIds`). */
export interface ScreenTextBinding {
  readonly event: string;
  readonly lineKeys: readonly string[];
  readonly iconIds: readonly number[];
  readonly deviceType?: string;
}

/** One OLED image event with its static bitmap. `id` matches `ScreenContent.imageId`. */
export interface ScreenImageBinding {
  readonly id: string;
  readonly event: string;
  readonly bytes: readonly number[];
}

export interface GameSenseDisplayPlan {
  readonly metadata: GameMetadataInput;
  readonly screen?: ScreenTextBinding;
  readonly images?: readonly ScreenImageBinding[];
  readonly keys: readonly KeyEventBinding[];
}

/**
 * Implements the {@link Display} port over the GameSense API. At {@link connect}
 * it registers the game and binds every event/handler once (the shared text
 * event, one event per image, and the key events); each {@link render} then only
 * posts current values — matching GameSense's "bind once, stream values" model.
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
      const { event, lineKeys, iconIds, deviceType } = this.plan.screen;
      await this.client.bindEvent({
        event,
        valueOptional: true,
        minValue: 0,
        maxValue: Math.max(0, iconIds.length - 1),
        handlers: [screenTextHandler(lineKeys, { iconIds, deviceType })],
      });
    }

    for (const image of this.plan.images ?? []) {
      await this.client.bindEvent({
        event: image.event,
        valueOptional: true,
        handlers: [screenImageHandler(image.bytes)],
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
      `gamesense: connected (text=${this.plan.screen ? 'yes' : 'no'}, images=${this.plan.images?.length ?? 0}, keys=${this.plan.keys.length})`,
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
    if (content === undefined) return;

    if (content.kind === 'text' && this.plan.screen) {
      const { event, lineKeys, iconIds } = this.plan.screen;
      const iconIndex = Math.max(0, iconIds.indexOf(content.iconId));
      const frameData: Record<string, unknown> = {};
      lineKeys.forEach((key, index) => {
        frameData[key] = content.lines[index] ?? '';
      });
      await this.client.sendEvent({ event, value: iconIndex, frame: frameData });
      return;
    }

    if (content.kind === 'image') {
      const image = this.plan.images?.find((candidate) => candidate.id === content.imageId);
      if (image) await this.client.sendEvent({ event: image.event, value: 0 });
    }
  }
}

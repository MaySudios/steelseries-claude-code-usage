import { rgbFromHex } from '../domain/color.js';
import { computeIntervals } from '../application/intervals.js';
import { type RenderPlan, type RenderScreen } from '../application/plugin-service.js';
import {
  type Config,
  type KeyBindingConfig,
  type OledScreenConfig,
} from '../infrastructure/config/schema.js';
import {
  type GameSenseDisplayPlan,
  type KeyEventBinding,
  type ScreenImageBinding,
} from '../infrastructure/gamesense/gamesense-display.js';
import {
  type GameSenseHandler,
  activeIndicatorHandler,
  gaugeHandler,
  pulseHandler,
  thresholdHandler,
} from '../infrastructure/gamesense/handlers/color-handlers.js';
import { resolveIcon } from '../infrastructure/gamesense/handlers/screen-handlers.js';
import { resolveKeys } from '../infrastructure/gamesense/hid-keycodes.js';
import { resolveBuiltInImage } from '../infrastructure/gamesense/image-loader.js';

export interface BuiltPlan {
  readonly plan: GameSenseDisplayPlan;
  readonly renderPlan: RenderPlan;
}

type ImageScreenConfig = Extract<OledScreenConfig, { image: string }>;

function isImageScreen(screen: OledScreenConfig): screen is ImageScreenConfig {
  return 'image' in screen;
}

/**
 * Translate validated config into a GameSense binding plan + a render plan.
 * `images` supplies pre-loaded bytes for file-based image screens; built-in
 * images (e.g. `claude`) are resolved here synchronously.
 */
export function buildDisplayPlan(config: Config, images: Record<string, number[]> = {}): BuiltPlan {
  const intervals = computeIntervals({
    pollIntervalSeconds: config.pollIntervalSeconds,
    rotateSeconds: config.oled.rotateSeconds,
  });
  const screens = config.oled.screens;
  const defaultSeconds = config.oled.rotateSeconds;

  // Text screens → shared line keys + the distinct icon set (value selects icon).
  const lineCounts: number[] = [];
  const iconIds: number[] = [];
  for (const screen of screens) {
    if (isImageScreen(screen)) continue;
    lineCounts.push(screen.lines.length);
    const iconId = resolveIcon(screen.icon);
    if (!iconIds.includes(iconId)) iconIds.push(iconId);
  }
  const maxLines = Math.max(1, ...lineCounts);
  const lineKeys = Array.from({ length: maxLines }, (_unused, index) => `line${index}`);
  const resolvedIconIds = iconIds.length > 0 ? iconIds : [0];

  // One image event per distinct image source we can resolve.
  const imageBindings: ScreenImageBinding[] = [];
  const eventBySource = new Map<string, string>();
  for (const screen of screens) {
    if (!isImageScreen(screen) || eventBySource.has(screen.image)) continue;
    const bytes = images[screen.image] ?? resolveBuiltInImage(screen.image);
    if (!bytes) continue; // file image not pre-loaded — skip rather than crash
    const event = `OLEDIMG${imageBindings.length}`;
    eventBySource.set(screen.image, event);
    imageBindings.push({ id: screen.image, event, bytes });
  }

  // Per-key bindings.
  const keys: KeyEventBinding[] = [];
  const keyMetrics: { id: string; metric: string }[] = [];
  if (config.keys.enabled) {
    for (const binding of config.keys.bindings) {
      keys.push({
        id: binding.id,
        event: eventName(binding.id),
        handler: buildHandler(binding, resolveKeys(binding.keys)),
      });
      keyMetrics.push({ id: binding.id, metric: binding.metric });
    }
  }

  const hasTextScreens = lineCounts.length > 0;
  const plan: GameSenseDisplayPlan = {
    metadata: {
      displayName: config.displayName,
      developer: config.developer,
      deinitializeTimerMs: intervals.deinitMs,
    },
    screen:
      config.oled.enabled && hasTextScreens
        ? { event: 'OLED', lineKeys, iconIds: resolvedIconIds, deviceType: config.oled.deviceType }
        : undefined,
    images: config.oled.enabled ? imageBindings : [],
    keys,
  };

  // Render plan — drop image screens we could not resolve.
  const renderScreens: RenderScreen[] = [];
  for (const screen of screens) {
    const seconds = screen.seconds ?? defaultSeconds;
    if (isImageScreen(screen)) {
      if (eventBySource.has(screen.image)) {
        renderScreens.push({ kind: 'image', imageId: screen.image, seconds });
      }
    } else {
      renderScreens.push({
        kind: 'text',
        lines: screen.lines,
        iconId: resolveIcon(screen.icon),
        seconds,
      });
    }
  }

  const renderPlan: RenderPlan = {
    oledEnabled: config.oled.enabled,
    screens: renderScreens,
    keysEnabled: config.keys.enabled,
    keyMetrics,
  };

  return { plan, renderPlan };
}

/** GameSense event name for a binding id (must be UPPERCASE-safe). */
export function eventName(id: string): string {
  return `KEY_${id.toUpperCase()}`;
}

function buildHandler(binding: KeyBindingConfig, hidKeys: number[]): GameSenseHandler {
  switch (binding.type) {
    case 'gauge':
      return gaugeHandler(hidKeys, rgbFromHex(binding.from), rgbFromHex(binding.to));
    case 'threshold':
      return thresholdHandler(
        hidKeys,
        binding.bands.map((band) => ({ upTo: band.upTo, color: rgbFromHex(band.color) })),
        binding.flash,
      );
    case 'pulse':
      return binding.steady
        ? activeIndicatorHandler(hidKeys, rgbFromHex(binding.color), binding.idleBelow)
        : pulseHandler(hidKeys, rgbFromHex(binding.color), {
            minHz: binding.minHz,
            maxHz: binding.maxHz,
            idleBelow: binding.idleBelow,
          });
  }
}

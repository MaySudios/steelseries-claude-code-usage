import { rgbFromHex } from '../domain/color.js';
import { computeIntervals } from '../application/intervals.js';
import { type RenderPlan, type RenderScreen } from '../application/plugin-service.js';
import { type Config, type KeyBindingConfig } from '../infrastructure/config/schema.js';
import {
  type GameSenseDisplayPlan,
  type KeyEventBinding,
} from '../infrastructure/gamesense/gamesense-display.js';
import {
  type GameSenseHandler,
  activeIndicatorHandler,
  gaugeHandler,
  pulseHandler,
  thresholdHandler,
} from '../infrastructure/gamesense/handlers/color-handlers.js';
import { resolveKeys } from '../infrastructure/gamesense/hid-keycodes.js';

export interface BuiltPlan {
  readonly plan: GameSenseDisplayPlan;
  readonly renderPlan: RenderPlan;
}

/** Translate validated config into a GameSense binding plan + a render plan. */
export function buildDisplayPlan(config: Config): BuiltPlan {
  const intervals = computeIntervals({
    pollIntervalSeconds: config.pollIntervalSeconds,
    rotateSeconds: config.oled.rotateSeconds,
  });
  const defaultSeconds = config.oled.rotateSeconds;

  const renderScreens: RenderScreen[] = config.oled.screens.map((screen) => ({
    lines: screen.lines,
    seconds: screen.seconds ?? defaultSeconds,
  }));
  const maxLines = Math.max(1, ...renderScreens.map((screen) => screen.lines.length));
  const lineKeys = Array.from({ length: maxLines }, (_unused, index) => `line${index}`);

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

  const plan: GameSenseDisplayPlan = {
    metadata: {
      displayName: config.displayName,
      developer: config.developer,
      deinitializeTimerMs: intervals.deinitMs,
    },
    screen:
      config.oled.enabled && renderScreens.length > 0
        ? { event: 'OLED', lineKeys, deviceType: config.oled.deviceType }
        : undefined,
    keys,
  };

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

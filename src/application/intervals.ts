import { clamp } from '../domain/math.js';

export interface Intervals {
  /** How often usage data is recomputed. */
  readonly pollIntervalMs: number;
  /** How often the device is re-rendered (also keeps GameSense alive). */
  readonly renderIntervalMs: number;
  /** GameSense deactivation timer to request (must exceed renderIntervalMs). */
  readonly deinitMs: number;
}

/**
 * Derive timer intervals from user config. Rendering is decoupled from data
 * polling so OLED screens can rotate smoothly without re-reading transcripts,
 * and the render cadence is bounded so GameSense never deactivates mid-run.
 */
export function computeIntervals(input: {
  pollIntervalSeconds: number;
  rotateSeconds: number;
}): Intervals {
  const pollIntervalMs = Math.round(input.pollIntervalSeconds * 1000);
  const rotateMs = input.rotateSeconds > 0 ? input.rotateSeconds * 1000 : pollIntervalMs;
  const renderIntervalMs = clamp(Math.min(rotateMs, pollIntervalMs), 1000, 10_000);
  const deinitMs = clamp(renderIntervalMs * 3, 15_000, 60_000);
  return { pollIntervalMs, renderIntervalMs, deinitMs };
}

import { type Clock } from '../domain/ports.js';

/** Real wall-clock time source. */
export const systemClock: Clock = {
  now: () => new Date(),
};

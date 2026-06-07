/**
 * A subscription/plan utilization figure, as surfaced by Anthropic's OAuth
 * usage endpoint (the data Lucxar's Stream Deck plugin renders). This is the
 * optional "how close am I to my plan limits" data source, complementary to
 * the always-available local token/cost telemetry.
 */
export interface PlanLimit {
  /** Stable identifier, e.g. `5h`, `weekly`, `opus-7d`, `sonnet-7d`. */
  readonly id: string;
  /** Human label, e.g. `Weekly`. */
  readonly label: string;
  /** Percentage of the limit consumed (0–100, may exceed 100). */
  readonly utilization: number;
  /** When the window resets, if known. */
  readonly resetsAt: Date | undefined;
}

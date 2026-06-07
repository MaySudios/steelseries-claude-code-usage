import { type ActiveBlockStats, type UsageBlock } from '../domain/block.js';
import { sumCost, totalCost } from '../domain/cost.js';
import { type Clock } from '../domain/ports.js';
import { sumTokens, totalTokens } from '../domain/tokens.js';
import { type UsageEntry } from '../domain/usage-entry.js';
import { type CostCalculator } from './cost-calculator.js';
import { floorToHour } from './time.js';

const DEFAULT_SESSION_MS = 5 * 60 * 60 * 1000; // 5 hours

export interface BlockCalculatorOptions {
  /** Length of a billing block. Default 5 hours. */
  readonly sessionLengthMs?: number;
}

/**
 * Groups usage entries into rolling billing blocks and derives forward-looking
 * statistics for the active one (burn rate, projection, headroom-vs-peak).
 * The algorithm matches ccusage: a block opens at the first activity floored to
 * the hour and closes once `sessionLength` elapses or after a same-length gap.
 */
export class BlockCalculator {
  private readonly sessionLengthMs: number;

  constructor(
    private readonly coster: CostCalculator,
    private readonly clock: Clock,
    options: BlockCalculatorOptions = {},
  ) {
    this.sessionLengthMs = options.sessionLengthMs ?? DEFAULT_SESSION_MS;
  }

  computeBlocks(entries: readonly UsageEntry[]): UsageBlock[] {
    const sorted = [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const first = sorted[0];
    if (first === undefined) return [];

    const blocks: UsageBlock[] = [];
    let groupStart = floorToHour(first.timestamp);
    let group: UsageEntry[] = [];
    let lastTime = first.timestamp.getTime();

    for (const entry of sorted) {
      const sinceStart = entry.timestamp.getTime() - groupStart.getTime();
      const sinceLast = entry.timestamp.getTime() - lastTime;
      if (
        group.length > 0 &&
        (sinceStart >= this.sessionLengthMs || sinceLast >= this.sessionLengthMs)
      ) {
        blocks.push(this.materialize(groupStart, group));
        group = [];
        groupStart = floorToHour(entry.timestamp);
      }
      group.push(entry);
      lastTime = entry.timestamp.getTime();
    }
    if (group.length > 0) blocks.push(this.materialize(groupStart, group));
    return blocks;
  }

  /** The currently active block, if any. */
  activeBlock(blocks: readonly UsageBlock[]): UsageBlock | undefined {
    return blocks.find((block) => block.isActive);
  }

  /** Forward-looking stats for the active block, or `undefined` if none. */
  activeStats(blocks: readonly UsageBlock[]): ActiveBlockStats | undefined {
    const block = this.activeBlock(blocks);
    if (block === undefined) return undefined;

    const now = this.clock.now().getTime();
    const minutesElapsed = Math.max((now - block.startTime.getTime()) / 60000, 0);
    const minutesRemaining = Math.max((block.endTime.getTime() - now) / 60000, 0);

    const usedTokens = totalTokens(block.tokens);
    const usedCost = totalCost(block.cost);
    const burnRate = minutesElapsed > 0 ? usedTokens / minutesElapsed : 0;
    const projectedTokens = usedTokens + burnRate * minutesRemaining;
    const projectedCostUSD =
      minutesElapsed > 0
        ? (usedCost / minutesElapsed) * (minutesElapsed + minutesRemaining)
        : usedCost;

    const limitTokens = deriveLimit(blocks, block);
    const usageRatio =
      limitTokens !== undefined && limitTokens > 0 ? usedTokens / limitTokens : undefined;

    return {
      block,
      minutesElapsed,
      minutesRemaining,
      burnRateTokensPerMin: burnRate,
      projectedTokens,
      projectedCostUSD,
      usageRatio,
      limitTokens,
    };
  }

  /** Convenience: blocks + active stats from raw entries in one call. */
  statsFromEntries(entries: readonly UsageEntry[]): ActiveBlockStats | undefined {
    return this.activeStats(this.computeBlocks(entries));
  }

  private materialize(start: Date, group: readonly UsageEntry[]): UsageBlock {
    const tokens = sumTokens(group.map((entry) => entry.tokens));
    const cost = sumCost(group.map((entry) => this.coster.cost(entry)));
    const models = [...new Set(group.map((entry) => entry.model))];
    const lastActivity = new Date(Math.max(...group.map((entry) => entry.timestamp.getTime())));
    const endTime = new Date(start.getTime() + this.sessionLengthMs);

    const now = this.clock.now().getTime();
    const isActive =
      now >= start.getTime() &&
      now < endTime.getTime() &&
      now - lastActivity.getTime() < this.sessionLengthMs;

    return {
      startTime: start,
      endTime,
      lastActivity,
      tokens,
      cost,
      entryCount: group.length,
      models,
      isActive,
    };
  }
}

/** Highest total-token block among completed (non-active) blocks; `undefined` if none. */
function deriveLimit(blocks: readonly UsageBlock[], active: UsageBlock): number | undefined {
  let max = 0;
  let found = false;
  for (const block of blocks) {
    if (block === active) continue;
    const total = totalTokens(block.tokens);
    if (total > max) max = total;
    found = true;
  }
  return found && max > 0 ? max : undefined;
}

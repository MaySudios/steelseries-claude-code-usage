import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { type Clock, type Logger, type UsageSource } from '../../domain/ports.js';
import { type UsageEntry } from '../../domain/usage-entry.js';
import { type ClaudePathOptions, resolveClaudeProjectDirs } from './claude-paths.js';
import { dedupeEntries, parseUsageLine } from './parse.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_DAYS = 35;
/** Skip absurdly large transcripts to avoid loading GBs into memory. */
const MAX_FILE_BYTES = 512 * 1024 * 1024;

export interface JsonlUsageSourceOptions {
  /** Explicit project directories (skips auto-discovery). */
  readonly projectDirs?: readonly string[];
  /** Ignore transcripts whose mtime is older than this many days. Default 35. */
  readonly lookbackDays?: number;
  readonly clock?: Clock;
  readonly logger?: Logger;
  readonly pathOptions?: ClaudePathOptions;
}

interface FileInfo {
  readonly path: string;
  readonly mtimeMs: number;
  readonly size: number;
}

interface CacheEntry {
  readonly mtimeMs: number;
  readonly size: number;
  readonly entries: readonly UsageEntry[];
}

/**
 * Reads Claude Code usage from local JSONL transcripts. Fully offline: it only
 * touches files the user's own machine already wrote. Two cost controls keep
 * repeated polls cheap even with thousands of large transcripts:
 *  - an mtime lookback skips old files entirely;
 *  - a per-file cache (keyed on mtime+size) re-parses only changed files, so a
 *    long-running daemon only ever re-reads the session(s) currently growing.
 */
export class JsonlUsageSource implements UsageSource {
  private readonly options: JsonlUsageSourceOptions;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options: JsonlUsageSourceOptions = {}) {
    this.options = options;
  }

  async load(): Promise<UsageEntry[]> {
    const dirs = this.options.projectDirs ?? resolveClaudeProjectDirs(this.options.pathOptions);
    const lookbackDays = this.options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
    const now = this.options.clock?.now().getTime() ?? Date.now();
    const cutoff = lookbackDays > 0 ? now - lookbackDays * DAY_MS : 0;

    const entries: UsageEntry[] = [];
    const seen = new Set<string>();
    let reparsed = 0;

    for (const dir of dirs) {
      for (const file of await this.collectJsonlFiles(dir, cutoff)) {
        seen.add(file.path);
        const cached = this.cache.get(file.path);
        if (cached && cached.mtimeMs === file.mtimeMs && cached.size === file.size) {
          entries.push(...cached.entries);
          continue;
        }
        const parsed = await this.readEntries(file.path);
        this.cache.set(file.path, { mtimeMs: file.mtimeMs, size: file.size, entries: parsed });
        entries.push(...parsed);
        reparsed++;
      }
    }

    this.pruneCache(seen);
    entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const deduped = dedupeEntries(entries);
    this.options.logger?.debug(
      `claude usage: ${entries.length} entries (${reparsed} files re-parsed), ${deduped.length} after dedupe`,
    );
    return deduped;
  }

  private async collectJsonlFiles(dir: string, cutoff: number): Promise<FileInfo[]> {
    let dirents;
    try {
      dirents = await readdir(dir, { withFileTypes: true });
    } catch {
      return []; // directory absent — expected for non-default installs
    }

    const files: FileInfo[] = [];
    for (const dirent of dirents) {
      const full = join(dir, dirent.name);
      if (dirent.isDirectory()) {
        files.push(...(await this.collectJsonlFiles(full, cutoff)));
      } else if (dirent.isFile() && dirent.name.endsWith('.jsonl')) {
        const info = await statOrNull(full);
        if (info === null) continue;
        if (cutoff > 0 && info.mtimeMs < cutoff) continue;
        if (info.size > MAX_FILE_BYTES) {
          this.options.logger?.warn(
            `claude usage: skipping ${full} (${info.size} bytes exceeds ${MAX_FILE_BYTES})`,
          );
          continue;
        }
        files.push({ path: full, mtimeMs: info.mtimeMs, size: info.size });
      }
    }
    return files;
  }

  private async readEntries(file: string): Promise<UsageEntry[]> {
    let content: string;
    try {
      content = await readFile(file, 'utf8');
    } catch (error) {
      this.options.logger?.debug(`claude usage: failed to read ${file}: ${String(error)}`);
      return [];
    }
    const entries: UsageEntry[] = [];
    for (const line of content.split('\n')) {
      const entry = parseUsageLine(line);
      if (entry !== null) entries.push(entry);
    }
    return entries;
  }

  private pruneCache(seen: ReadonlySet<string>): void {
    for (const path of this.cache.keys()) {
      if (!seen.has(path)) this.cache.delete(path);
    }
  }
}

async function statOrNull(file: string): Promise<{ mtimeMs: number; size: number } | null> {
  try {
    const info = await stat(file);
    return { mtimeMs: info.mtimeMs, size: info.size };
  } catch {
    return null;
  }
}

import { homedir } from 'node:os';
import { join } from 'node:path';

export interface ClaudePathOptions {
  /** Environment to read `CLAUDE_CONFIG_DIR` from. Defaults to `process.env`. */
  readonly env?: NodeJS.ProcessEnv;
  /** Home directory override (testing). Defaults to `os.homedir()`. */
  readonly home?: string;
}

/**
 * Resolve candidate Claude Code `projects` directories in priority order,
 * mirroring ccusage's discovery:
 *
 *  1. `CLAUDE_CONFIG_DIR` (comma-separated list of config dirs), if set;
 *  2. `~/.config/claude/projects` (current default);
 *  3. `~/.claude/projects` (legacy).
 *
 * Returned paths are not guaranteed to exist — the caller filters those out.
 */
export function resolveClaudeProjectDirs(options: ClaudePathOptions = {}): string[] {
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();

  const override = env.CLAUDE_CONFIG_DIR;
  if (override && override.trim() !== '') {
    return override
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((dir) => join(dir, 'projects'));
  }

  return [join(home, '.config', 'claude', 'projects'), join(home, '.claude', 'projects')];
}

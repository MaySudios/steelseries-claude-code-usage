import { describe, expect, it } from 'vitest';
import { resolveClaudeProjectDirs } from '../../src/infrastructure/claude/claude-paths.js';

describe('resolveClaudeProjectDirs', () => {
  it('uses default ~/.config/claude and legacy ~/.claude locations', () => {
    const dirs = resolveClaudeProjectDirs({ home: '/home/dev', env: {} });
    expect(dirs).toEqual([
      '/home/dev/.config/claude/projects'.replaceAll('/', pathSep()),
      '/home/dev/.claude/projects'.replaceAll('/', pathSep()),
    ]);
  });

  it('honours a single CLAUDE_CONFIG_DIR override', () => {
    const dirs = resolveClaudeProjectDirs({
      home: '/home/dev',
      env: { CLAUDE_CONFIG_DIR: '/custom/claude' },
    });
    expect(dirs).toEqual(['/custom/claude/projects'.replaceAll('/', pathSep())]);
  });

  it('splits a comma-separated CLAUDE_CONFIG_DIR and trims blanks', () => {
    const dirs = resolveClaudeProjectDirs({
      home: '/home/dev',
      env: { CLAUDE_CONFIG_DIR: ' /a , /b , ' },
    });
    expect(dirs).toEqual([
      '/a/projects'.replaceAll('/', pathSep()),
      '/b/projects'.replaceAll('/', pathSep()),
    ]);
  });

  it('ignores an empty override', () => {
    const dirs = resolveClaudeProjectDirs({ home: '/home/dev', env: { CLAUDE_CONFIG_DIR: '   ' } });
    expect(dirs).toHaveLength(2);
  });
});

// path.join uses the platform separator; normalise expectations to match.
function pathSep(): string {
  return process.platform === 'win32' ? '\\' : '/';
}

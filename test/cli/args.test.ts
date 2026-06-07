import { describe, expect, it } from 'vitest';
import { parseArgs } from '../../src/cli/args.js';

describe('parseArgs', () => {
  it('defaults to the run command', () => {
    expect(parseArgs([])).toEqual({ command: 'run', positionals: [], flags: {} });
  });

  it('parses a command with boolean flags', () => {
    const parsed = parseArgs(['stats', '--json', '--offline']);
    expect(parsed.command).toBe('stats');
    expect(parsed.flags).toEqual({ json: true, offline: true });
  });

  it('parses value flags (space and = forms) and short aliases', () => {
    expect(parseArgs(['run', '--config', '/a.yaml']).flags.config).toBe('/a.yaml');
    expect(parseArgs(['run', '--config=/b.yaml']).flags.config).toBe('/b.yaml');
    expect(parseArgs(['run', '-c', '/c.yaml']).flags.config).toBe('/c.yaml');
  });

  it('maps short boolean aliases', () => {
    expect(parseArgs(['-v']).flags.verbose).toBe(true);
    expect(parseArgs(['-h']).flags.help).toBe(true);
    expect(parseArgs(['-V']).flags.version).toBe(true);
  });

  it('keeps subcommand positionals', () => {
    const parsed = parseArgs(['config', 'init', '--force']);
    expect(parsed.command).toBe('config');
    expect(parsed.positionals).toEqual(['init']);
    expect(parsed.flags.force).toBe(true);
  });

  it('treats everything after -- as positionals', () => {
    expect(parseArgs(['run', '--', '--not-a-flag']).positionals).toEqual(['--not-a-flag']);
  });
});

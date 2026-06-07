export interface ParsedArgs {
  readonly command: string;
  readonly positionals: string[];
  readonly flags: Record<string, string | boolean>;
}

const SHORT_FLAGS: Readonly<Record<string, string>> = {
  c: 'config',
  v: 'verbose',
  q: 'quiet',
  h: 'help',
  V: 'version',
};

/** Flags that take a following value (everything else is boolean). */
const VALUE_FLAGS = new Set(['config']);

/** A tiny, dependency-free argv parser (`command [positionals] [--flags]`). */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === undefined) continue;

    if (token === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (token.startsWith('--')) {
      const [key, inlineValue] = splitOnce(token.slice(2), '=');
      if (inlineValue !== undefined) flags[key] = inlineValue;
      else if (VALUE_FLAGS.has(key)) flags[key] = argv[++i] ?? '';
      else flags[key] = true;
    } else if (token.startsWith('-') && token.length > 1) {
      const key = SHORT_FLAGS[token.slice(1)] ?? token.slice(1);
      if (VALUE_FLAGS.has(key)) flags[key] = argv[++i] ?? '';
      else flags[key] = true;
    } else {
      positionals.push(token);
    }
  }

  const command = positionals.shift() ?? 'run';
  return { command, positionals, flags };
}

function splitOnce(input: string, separator: string): [string, string | undefined] {
  const index = input.indexOf(separator);
  if (index === -1) return [input, undefined];
  return [input.slice(0, index), input.slice(index + 1)];
}

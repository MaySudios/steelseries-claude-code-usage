import { type Logger } from '../../domain/ports.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };

/**
 * Writes to **stderr** at or above a threshold, leaving stdout clean for data
 * commands (`stats`, `config path`) that other tools may pipe.
 */
export class ConsoleLogger implements Logger {
  constructor(private readonly level: LogLevel = 'info') {}

  debug(message: string, ...args: unknown[]): void {
    this.write('debug', message, args);
  }
  info(message: string, ...args: unknown[]): void {
    this.write('info', message, args);
  }
  warn(message: string, ...args: unknown[]): void {
    this.write('warn', message, args);
  }
  error(message: string, ...args: unknown[]): void {
    this.write('error', message, args);
  }

  private write(level: Exclude<LogLevel, 'silent'>, message: string, args: unknown[]): void {
    if (RANK[level] < RANK[this.level]) return;
    const line = `[${level}] ${message}`;
    if (args.length > 0) console.error(line, ...args);
    else console.error(line);
  }
}

/** A logger that discards everything. */
export const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

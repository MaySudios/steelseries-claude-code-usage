import { describe, expect, it } from 'vitest';
import {
  GameSenseClient,
  GameSenseError,
} from '../../src/infrastructure/gamesense/gamesense-client.js';
import { staticColorHandler } from '../../src/infrastructure/gamesense/handlers/color-handlers.js';
import { rgb } from '../../src/domain/color.js';
import { FakeTransport } from './fake-transport.js';

function client(transport: FakeTransport, game = 'CLAUDE_CODE_USAGE'): GameSenseClient {
  return new GameSenseClient('127.0.0.1:61899', transport, game);
}

describe('GameSenseClient identifiers', () => {
  it('rejects an invalid game id', () => {
    expect(() => client(new FakeTransport(), 'lower case')).toThrow(/Invalid GameSense game/);
  });

  it('rejects an invalid event id', async () => {
    await expect(
      client(new FakeTransport()).sendEvent({ event: 'bad event', value: 1 }),
    ).rejects.toThrow(/Invalid GameSense event/);
  });
});

describe('GameSenseClient requests', () => {
  it('registers game metadata, clamping the deinit timer', async () => {
    const transport = new FakeTransport();
    await client(transport).registerGame({
      displayName: 'Claude Usage',
      developer: 'MaySudios',
      deinitializeTimerMs: 999999,
    });
    expect(transport.paths()).toEqual(['/game_metadata']);
    expect(transport.lastBody()).toEqual({
      game: 'CLAUDE_CODE_USAGE',
      game_display_name: 'Claude Usage',
      developer: 'MaySudios',
      deinitialize_timer_length_ms: 60000,
    });
  });

  it('binds an event with handlers and defaults', async () => {
    const transport = new FakeTransport();
    await client(transport).bindEvent({
      event: 'KEY_HEADROOM',
      handlers: [staticColorHandler([41], rgb(0, 255, 0))],
    });
    const body = transport.lastBody();
    expect(body.event).toBe('KEY_HEADROOM');
    expect(body.min_value).toBe(0);
    expect(body.max_value).toBe(100);
    expect(body.value_optional).toBe(false);
    expect(Array.isArray(body.handlers)).toBe(true);
  });

  it('sends an event with a rounded value and a frame', async () => {
    const transport = new FakeTransport();
    await client(transport).sendEvent({ event: 'OLED', value: 41.7, frame: { line0: 'hi' } });
    expect(transport.lastBody()).toEqual({
      game: 'CLAUDE_CODE_USAGE',
      event: 'OLED',
      data: { value: 42, frame: { line0: 'hi' } },
    });
  });

  it('posts heartbeat and remove_game', async () => {
    const transport = new FakeTransport();
    const c = client(transport);
    await c.heartbeat();
    await c.removeGame();
    expect(transport.paths()).toEqual(['/game_heartbeat', '/remove_game']);
  });

  it('throws a GameSenseError carrying the parsed error code', async () => {
    const transport = new FakeTransport();
    transport.status = 400;
    transport.responseBody = JSON.stringify({ code: 2, error: 'disallowed characters' });
    await expect(client(transport).heartbeat()).rejects.toBeInstanceOf(GameSenseError);
    await expect(client(transport).heartbeat()).rejects.toMatchObject({ status: 400, code: 2 });
  });
});

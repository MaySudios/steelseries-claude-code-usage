import { describe, expect, it } from 'vitest';
import { rgb } from '../../src/domain/color.js';
import { GameSenseClient } from '../../src/infrastructure/gamesense/gamesense-client.js';
import {
  GameSenseDisplay,
  type GameSenseDisplayPlan,
} from '../../src/infrastructure/gamesense/gamesense-display.js';
import { gaugeHandler } from '../../src/infrastructure/gamesense/handlers/color-handlers.js';
import { FakeTransport } from './fake-transport.js';

function setup(): { transport: FakeTransport; display: GameSenseDisplay } {
  const transport = new FakeTransport();
  const client = new GameSenseClient('127.0.0.1:1', transport, 'CLAUDE_CODE_USAGE');
  const plan: GameSenseDisplayPlan = {
    metadata: { displayName: 'Claude Usage', developer: 'MaySudios' },
    screen: { event: 'OLED', lineKeys: ['line0', 'line1'], iconIds: [0] },
    keys: [
      {
        id: 'headroom',
        event: 'KEY_HEADROOM',
        handler: gaugeHandler([30, 31], rgb(0, 255, 0), rgb(255, 0, 0)),
      },
    ],
  };
  return { transport, display: new GameSenseDisplay(client, plan) };
}

const textScreen = (lines: string[]) => ({ kind: 'text', lines, iconId: 0 }) as const;

describe('GameSenseDisplay.connect', () => {
  it('registers the game then binds the screen and key events', async () => {
    const { transport, display } = setup();
    await display.connect();
    expect(transport.paths()).toEqual(['/game_metadata', '/bind_game_event', '/bind_game_event']);
    // The OLED bind must opt into value_optional so repeated text renders.
    expect(transport.calls[1]?.body.event).toBe('OLED');
    expect(transport.calls[1]?.body.value_optional).toBe(true);
    expect(transport.calls[2]?.body.event).toBe('KEY_HEADROOM');
  });

  it('is idempotent', async () => {
    const { transport, display } = setup();
    await display.connect();
    await display.connect();
    expect(transport.calls).toHaveLength(3);
  });
});

describe('GameSenseDisplay.render', () => {
  it('auto-connects then streams OLED frame text and key values', async () => {
    const { transport, display } = setup();
    await display.render({
      screen: textScreen(['top', 'bottom', 'ignored']),
      keyValues: { headroom: 73 },
    });

    // 3 bind calls + 2 event calls
    const eventCalls = transport.calls.filter((c) => c.path === '/game_event');
    expect(eventCalls).toHaveLength(2);

    const screenEvent = eventCalls[0]?.body as {
      event: string;
      data: { frame: Record<string, string> };
    };
    expect(screenEvent.event).toBe('OLED');
    expect(screenEvent.data.frame).toEqual({ line0: 'top', line1: 'bottom' }); // third line dropped

    const keyEvent = eventCalls[1]?.body as { event: string; data: { value: number } };
    expect(keyEvent.event).toBe('KEY_HEADROOM');
    expect(keyEvent.data.value).toBe(73);
  });

  it('pads missing OLED lines and skips keys with no value', async () => {
    const { transport, display } = setup();
    await display.connect();
    transport.calls.length = 0;
    await display.render({ screen: textScreen(['only-one']), keyValues: {} });

    const eventCalls = transport.calls.filter((c) => c.path === '/game_event');
    expect(eventCalls).toHaveLength(1); // only the screen event; no key value supplied
    const frame = (eventCalls[0]?.body as { data: { frame: Record<string, string> } }).data.frame;
    expect(frame).toEqual({ line0: 'only-one', line1: '' });
  });
});

describe('GameSenseDisplay lifecycle', () => {
  it('heartbeats and disposes', async () => {
    const { transport, display } = setup();
    await display.connect();
    transport.calls.length = 0;
    await display.heartbeat();
    await display.dispose();
    expect(transport.paths()).toEqual(['/game_heartbeat', '/remove_game']);
  });
});

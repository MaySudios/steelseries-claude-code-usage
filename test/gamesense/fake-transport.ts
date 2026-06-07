import {
  type HttpResponse,
  type HttpTransport,
} from '../../src/infrastructure/gamesense/http-transport.js';

export interface RecordedCall {
  readonly url: string;
  readonly path: string;
  readonly body: Record<string, unknown>;
}

/** Records every POST and returns a configurable canned response. */
export class FakeTransport implements HttpTransport {
  readonly calls: RecordedCall[] = [];
  status = 200;
  responseBody = '';

  async post(url: string, json: unknown): Promise<HttpResponse> {
    const path = new URL(url).pathname;
    this.calls.push({ url, path, body: json as Record<string, unknown> });
    return { status: this.status, body: this.responseBody };
  }

  /** Paths in call order, e.g. `['/game_metadata', '/bind_game_event']`. */
  paths(): string[] {
    return this.calls.map((call) => call.path);
  }

  lastBody(): Record<string, unknown> {
    const last = this.calls.at(-1);
    if (!last) throw new Error('no calls recorded');
    return last.body;
  }
}

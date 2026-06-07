export interface HttpResponse {
  readonly status: number;
  readonly body: string;
}

/** Minimal POST-only transport so the client can be tested without a network. */
export interface HttpTransport {
  post(url: string, json: unknown): Promise<HttpResponse>;
}

/** `fetch`-based transport with a hard timeout (the GameSense server is local). */
export class FetchHttpTransport implements HttpTransport {
  constructor(
    private readonly timeoutMs: number = 4000,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async post(url: string, json: unknown): Promise<HttpResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
        signal: controller.signal,
      });
      return { status: response.status, body: await response.text() };
    } finally {
      clearTimeout(timer);
    }
  }
}

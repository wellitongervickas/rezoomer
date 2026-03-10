import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIAdapter } from '@/ai/openai.ts';
import { AppError } from '@/core/errors.ts';

function createSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function sseData(content: string): string {
  const chunk = JSON.stringify({
    choices: [{ delta: { content }, finish_reason: null }],
  });
  return `data: ${chunk}\n\n`;
}

describe('OpenAIAdapter', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function createAdapter(apiKey = 'sk-test') {
    return new OpenAIAdapter(
      'https://api.openai.com/v1',
      'gpt-4o',
      async () => apiKey,
    );
  }

  it('streams tokens from SSE response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSSEStream([
        sseData('Hello'),
        sseData(' World'),
        'data: [DONE]\n\n',
      ]),
    });

    const adapter = createAdapter();
    const tokens: string[] = [];

    for await (const token of adapter.generateCompletion([
      { role: 'user', content: 'test' },
    ])) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['Hello', ' World']);
  });

  it('handles multi-line SSE chunks in single data event', async () => {
    const combined =
      sseData('A') + sseData('B') + sseData('C') + 'data: [DONE]\n\n';

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSSEStream([combined]),
    });

    const adapter = createAdapter();
    const tokens: string[] = [];

    for await (const token of adapter.generateCompletion([
      { role: 'user', content: 'test' },
    ])) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['A', 'B', 'C']);
  });

  it('skips chunks with no content in delta', async () => {
    const noContentChunk = `data: ${JSON.stringify({
      choices: [{ delta: {}, finish_reason: null }],
    })}\n\n`;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSSEStream([noContentChunk, sseData('real'), 'data: [DONE]\n\n']),
    });

    const adapter = createAdapter();
    const tokens: string[] = [];

    for await (const token of adapter.generateCompletion([
      { role: 'user', content: 'test' },
    ])) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['real']);
  });

  it('skips malformed JSON chunks', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSSEStream([
        'data: {invalid json}\n\n',
        sseData('valid'),
        'data: [DONE]\n\n',
      ]),
    });

    const adapter = createAdapter();
    const tokens: string[] = [];

    for await (const token of adapter.generateCompletion([
      { role: 'user', content: 'test' },
    ])) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['valid']);
  });

  it('throws PROVIDER_ERROR on HTTP error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    });

    const adapter = createAdapter();
    const stream = adapter.generateCompletion([
      { role: 'user', content: 'test' },
    ]);

    try {
      for await (const _ of stream) {
        // should not reach
      }
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('PROVIDER_ERROR');
      expect((err as AppError).message).toContain('429');
    }
  });

  it('throws PROVIDER_ERROR on network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Network error'));

    const adapter = createAdapter();
    const stream = adapter.generateCompletion([
      { role: 'user', content: 'test' },
    ]);

    try {
      for await (const _ of stream) {
        // should not reach
      }
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('PROVIDER_ERROR');
    }
  });

  it('throws PROVIDER_ERROR when response body is null', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: null,
    });

    const adapter = createAdapter();
    const stream = adapter.generateCompletion([
      { role: 'user', content: 'test' },
    ]);

    try {
      for await (const _ of stream) {
        // should not reach
      }
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).message).toContain('null');
    }
  });

  it('throws PROVIDER_ERROR when API key retrieval fails', async () => {
    const adapter = new OpenAIAdapter(
      'https://api.openai.com/v1',
      'gpt-4o',
      async () => { throw new Error('Key not found'); },
    );

    const stream = adapter.generateCompletion([
      { role: 'user', content: 'test' },
    ]);

    try {
      for await (const _ of stream) {
        // should not reach
      }
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('PROVIDER_ERROR');
    }
  });

  it('sends correct request body', async () => {
    let capturedBody: any;

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        body: createSSEStream(['data: [DONE]\n\n']),
      };
    });

    const adapter = createAdapter();

    for await (const _ of adapter.generateCompletion(
      [{ role: 'user', content: 'hello' }],
      { temperature: 0 },
    )) {
      // consume
    }

    expect(capturedBody).toEqual({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
      temperature: 0,
    });
  });

  it('sends Authorization header with API key', async () => {
    let capturedHeaders: any;

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedHeaders = opts.headers;
      return {
        ok: true,
        body: createSSEStream(['data: [DONE]\n\n']),
      };
    });

    const adapter = createAdapter('sk-my-key');

    for await (const _ of adapter.generateCompletion([
      { role: 'user', content: 'test' },
    ])) {
      // consume
    }

    expect(capturedHeaders['Authorization']).toBe('Bearer sk-my-key');
  });

  it('re-throws AbortError without wrapping', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    const adapter = createAdapter();
    const stream = adapter.generateCompletion([
      { role: 'user', content: 'test' },
    ]);

    try {
      for await (const _ of stream) {
        // should not reach
      }
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DOMException);
      expect((err as DOMException).name).toBe('AbortError');
    }
  });
});

import type { IAIProvider, ChatMessage } from '@/core/types.ts';
import { AppError } from '@/core/errors.ts';

interface OpenAIChatRequest {
  model: string;
  messages: { role: string; content: string }[];
  stream: boolean;
  temperature?: number;
}

interface OpenAIStreamChunk {
  choices: {
    delta: { content?: string };
    finish_reason: string | null;
  }[];
}

export class OpenAIAdapter implements IAIProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly getApiKey: () => Promise<string>,
  ) {}

  async *generateCompletion(
    messages: ChatMessage[],
    options?: { signal?: AbortSignal; temperature?: number },
  ): AsyncIterable<string> {
    let apiKey: string;
    try {
      apiKey = await this.getApiKey();
    } catch (cause) {
      throw new AppError('PROVIDER_ERROR', 'Failed to retrieve API key.', cause);
    }

    const body: OpenAIChatRequest = {
      model: this.model,
      messages,
      stream: true,
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: options?.signal,
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        throw cause;
      }
      throw new AppError('PROVIDER_ERROR', 'Network request to OpenAI failed.', cause);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new AppError(
        'PROVIDER_ERROR',
        `OpenAI returned HTTP ${response.status}: ${text}`,
      );
    }

    if (!response.body) {
      throw new AppError('PROVIDER_ERROR', 'OpenAI response body is null.');
    }

    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader();

    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice('data: '.length);
          if (data === '[DONE]') return;

          let chunk: OpenAIStreamChunk;
          try {
            chunk = JSON.parse(data) as OpenAIStreamChunk;
          } catch {
            continue;
          }

          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        }
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        throw cause;
      }
      throw new AppError('PROVIDER_ERROR', 'Error reading OpenAI stream.', cause);
    } finally {
      reader.releaseLock();
    }
  }
}

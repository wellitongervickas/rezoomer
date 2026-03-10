import { describe, it, expect, vi } from 'vitest';
import { ResumeAgent } from '@/agents/resumeAgent.ts';
import type { ResumeAgentEvent } from '@/agents/resumeAgent.ts';
import type { IAIProvider, ChatMessage } from '@/core/types.ts';

function createMockProvider(responses: string[][]): IAIProvider {
  let callIndex = 0;
  return {
    async *generateCompletion(
      _messages: ChatMessage[],
      _options?: { signal?: AbortSignal; temperature?: number },
    ): AsyncIterable<string> {
      const tokens = responses[callIndex++] ?? [];
      for (const token of tokens) {
        yield token;
      }
    },
  };
}

async function collectEvents(
  stream: AsyncIterable<ResumeAgentEvent>,
): Promise<ResumeAgentEvent[]> {
  const events: ResumeAgentEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

describe('ResumeAgent', () => {
  it('emits correct event sequence: step→step→step→tokens→done', async () => {
    const provider = createMockProvider([
      ['analysis ', 'result'],      // step 1: analyze
      ['match ', 'result'],          // step 2: match
      ['Hello', ' World', '!'],      // step 3: generate (streamed)
    ]);

    const agent = new ResumeAgent(provider);
    const events = await collectEvents(
      agent.tailor('resume text', 'job description'),
    );

    expect(events[0]).toEqual({ kind: 'step', step: 'analyzing' });
    expect(events[1]).toEqual({ kind: 'step', step: 'matching' });
    expect(events[2]).toEqual({ kind: 'step', step: 'generating' });
    expect(events[3]).toEqual({ kind: 'token', content: 'Hello' });
    expect(events[4]).toEqual({ kind: 'token', content: ' World' });
    expect(events[5]).toEqual({ kind: 'token', content: '!' });
    expect(events[6]).toEqual({ kind: 'done', content: 'Hello World!' });
    expect(events).toHaveLength(7);
  });

  it('accumulates tokens correctly in done event', async () => {
    const provider = createMockProvider([
      ['a'],
      ['b'],
      ['chunk1', 'chunk2', 'chunk3'],
    ]);

    const agent = new ResumeAgent(provider);
    const events = await collectEvents(
      agent.tailor('resume', 'job'),
    );

    const doneEvent = events.find((e) => e.kind === 'done');
    expect(doneEvent).toEqual({ kind: 'done', content: 'chunk1chunk2chunk3' });
  });

  it('handles empty AI response for generate step', async () => {
    const provider = createMockProvider([
      ['analysis'],
      ['match'],
      [], // empty generation
    ]);

    const agent = new ResumeAgent(provider);
    const events = await collectEvents(
      agent.tailor('resume', 'job'),
    );

    const doneEvent = events.find((e) => e.kind === 'done');
    expect(doneEvent).toEqual({ kind: 'done', content: '' });
  });

  it('passes temperature 0 to all AI calls', async () => {
    const temperatures: (number | undefined)[] = [];

    const provider: IAIProvider = {
      async *generateCompletion(
        _messages: ChatMessage[],
        options?: { signal?: AbortSignal; temperature?: number },
      ): AsyncIterable<string> {
        temperatures.push(options?.temperature);
        yield 'ok';
      },
    };

    const agent = new ResumeAgent(provider);
    await collectEvents(agent.tailor('resume', 'job'));

    expect(temperatures).toEqual([0, 0, 0]);
  });

  it('forwards abort signal to provider', async () => {
    const signals: (AbortSignal | undefined)[] = [];

    const provider: IAIProvider = {
      async *generateCompletion(
        _messages: ChatMessage[],
        options?: { signal?: AbortSignal; temperature?: number },
      ): AsyncIterable<string> {
        signals.push(options?.signal);
        yield 'ok';
      },
    };

    const controller = new AbortController();
    const agent = new ResumeAgent(provider);
    await collectEvents(
      agent.tailor('resume', 'job', { signal: controller.signal }),
    );

    expect(signals).toHaveLength(3);
    signals.forEach((s) => expect(s).toBe(controller.signal));
  });

  it('propagates AI provider errors', async () => {
    const provider: IAIProvider = {
      async *generateCompletion(): AsyncIterable<string> {
        throw new Error('API failed');
      },
    };

    const agent = new ResumeAgent(provider);

    await expect(
      collectEvents(agent.tailor('resume', 'job')),
    ).rejects.toThrow('API failed');
  });

  it('calls AI with correct prompt functions', async () => {
    const messages: string[] = [];

    const provider: IAIProvider = {
      async *generateCompletion(
        msgs: ChatMessage[],
      ): AsyncIterable<string> {
        messages.push(msgs[0].content);
        yield 'result';
      },
    };

    const agent = new ResumeAgent(provider);
    await collectEvents(agent.tailor('my resume', 'my job'));

    // Step 1 prompt contains job description
    expect(messages[0]).toContain('my job');
    // Step 2 prompt contains both analysis and resume
    expect(messages[1]).toContain('my resume');
    // Step 3 prompt contains resume and job description
    expect(messages[2]).toContain('my resume');
    expect(messages[2]).toContain('my job');
  });
});

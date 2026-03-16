import type { GenerationOptions, IAIProvider } from '@/core/types.ts';
import { ANALYZE_PROMPT, MATCH_PROMPT, GENERATE_PROMPT } from '@/core/prompts.ts';

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type ResumeAgentStep = 'analyzing' | 'matching' | 'generating';

export type ResumeAgentEvent =
  | { kind: 'step'; step: ResumeAgentStep }
  | { kind: 'token'; content: string }
  | { kind: 'done'; content: string };

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class ResumeAgent {
  constructor(private readonly ai: IAIProvider) {}

  async *tailor(
    resumeText: string,
    jobDescription: string,
    options?: { signal?: AbortSignal; options?: GenerationOptions },
  ): AsyncIterable<ResumeAgentEvent> {
    const aiOpts = { signal: options?.signal, temperature: 0 };

    // Step 1 — Analyze job description
    yield { kind: 'step', step: 'analyzing' };
    const analysis = await this.collect(
      this.ai.generateCompletion(
        [{ role: 'user', content: ANALYZE_PROMPT(jobDescription) }],
        aiOpts,
      ),
    );

    // Step 2 — Match skills
    yield { kind: 'step', step: 'matching' };
    const matchResult = await this.collect(
      this.ai.generateCompletion(
        [{ role: 'user', content: MATCH_PROMPT(analysis, resumeText) }],
        aiOpts,
      ),
    );

    // Step 3 — Generate tailored resume (streamed)
    yield { kind: 'step', step: 'generating' };
    const chunks: string[] = [];

    for await (const token of this.ai.generateCompletion(
      [
        {
          role: 'user',
          content: GENERATE_PROMPT(matchResult, resumeText, jobDescription, options?.options),
        },
      ],
      aiOpts,
    )) {
      chunks.push(token);
      yield { kind: 'token', content: token };
    }

    yield { kind: 'done', content: chunks.join('') };
  }

  private async collect(stream: AsyncIterable<string>): Promise<string> {
    const chunks: string[] = [];
    for await (const token of stream) {
      chunks.push(token);
    }
    return chunks.join('');
  }
}

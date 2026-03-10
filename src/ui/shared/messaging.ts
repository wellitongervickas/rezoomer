import type { TailoredResume } from '@/core/types.ts';

export type ExtensionMessage =
  | { type: 'VAULT_UNLOCK'; password: string }
  | { type: 'VAULT_LOCK' }
  | { type: 'VAULT_STATUS' }
  | { type: 'SAVE_API_KEY'; providerConfigId: string; apiKey: string }
  | { type: 'DELETE_API_KEY'; providerConfigId: string }
  | { type: 'SAVE_BASE_RESUME'; label: string; content: string }
  | { type: 'UPDATE_BASE_RESUME'; id: string; label: string; content: string }
  | { type: 'DELETE_BASE_RESUME'; id: string }
  | { type: 'GET_BASE_RESUMES' }
  | { type: 'TAILOR_RESUME'; baseResumeId: string; jobDescription: string }
  | { type: 'LIST_TAILORED'; page: number; pageSize: number }
  | { type: 'EXPORT_PDF'; tailoredResumeId: string };

export type ExtensionResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function sendMessage<T = unknown>(message: ExtensionMessage): Promise<T> {
  const response = await chrome.runtime.sendMessage(message) as ExtensionResponse<T>;
  if (!response.success) {
    throw new Error(response.error);
  }
  return response.data;
}

// ---------------------------------------------------------------------------
// Port-based streaming for resume tailoring
// ---------------------------------------------------------------------------

export type ResumeAgentEvent =
  | { kind: 'step'; step: 'analyzing' | 'matching' | 'generating' }
  | { kind: 'token'; content: string }
  | { kind: 'done'; content: string; resume: TailoredResume }
  | { kind: 'error'; message: string; code?: string };

export function streamTailorResume(
  params: { baseResumeId: string; jobDescription: string; companyName?: string; roleTitle?: string },
  onEvent: (event: ResumeAgentEvent) => void,
): { abort: () => void } {
  const port = chrome.runtime.connect({ name: 'tailor' });

  port.onMessage.addListener((event: ResumeAgentEvent) => {
    onEvent(event);
  });

  port.postMessage(params);

  return {
    abort: () => port.disconnect(),
  };
}

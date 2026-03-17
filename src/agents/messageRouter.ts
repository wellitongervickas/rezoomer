import type { Container } from '@/extension/container.ts';
import { AppError } from '@/core/errors.ts';
import type { BaseResume, EasyApplyFields, VaultSettings } from '@/core/types.ts';
import { DEFAULT_PROVIDERS } from '@/core/types.ts';
import {
  fillEasyApplyModal,
  scrapeLinkedInJobPage,
} from '@/extension/linkedinScraper.ts';

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

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
  | { type: 'EXPORT_PDF'; tailoredResumeId: string }
  | { type: 'SAVE_SETTINGS'; settings: VaultSettings }
  | { type: 'GET_SETTINGS' }
  | { type: 'SCRAPE_LINKEDIN_JOB' }
  | { type: 'FILL_EASY_APPLY'; fields: EasyApplyFields };

export type ExtensionResponse =
  | { success: true; data?: unknown }
  | { success: false; error: string; code?: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(data?: unknown): ExtensionResponse {
  return { success: true, data };
}

function fail(error: string, code?: string): ExtensionResponse {
  return { success: false, error, code };
}

function handleError(err: unknown): ExtensionResponse {
  if (err instanceof AppError) return fail(err.message, err.code);
  return fail(err instanceof Error ? err.message : 'An unexpected error occurred.');
}

function requireUnlocked(
  container: Container,
): asserts container is Container & { sessionKey: CryptoKey } {
  if (container.sessionKey === null) {
    throw new AppError('VAULT_LOCKED', 'Vault is locked. Please unlock it first.');
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createMessageRouter(
  container: Container,
): (message: ExtensionMessage) => Promise<ExtensionResponse> {
  const defaultProvider = DEFAULT_PROVIDERS.find((p) => p.isDefault) ?? DEFAULT_PROVIDERS[0];

  async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
    switch (message.type) {
      // ----------------------------------------------------------------
      // Vault
      // ----------------------------------------------------------------
      case 'VAULT_UNLOCK': {
        try {
          const initialized = await container.vault.isInitialized();
          if (!initialized) {
            await container.vault.initialize(message.password);
          }
          container.sessionKey = await container.vault.unlock(message.password);
          await chrome.storage.session.set({ vaultPassword: message.password });
          return ok();
        } catch (err) {
          return handleError(err);
        }
      }

      case 'VAULT_LOCK': {
        container.sessionKey = null;
        await chrome.storage.session.remove('vaultPassword');
        return ok();
      }

      case 'VAULT_STATUS': {
        try {
          const initialized = await container.vault.isInitialized();
          return ok({ initialized, unlocked: container.sessionKey !== null });
        } catch (err) {
          return handleError(err);
        }
      }

      // ----------------------------------------------------------------
      // API keys
      // ----------------------------------------------------------------
      case 'SAVE_API_KEY': {
        try {
          requireUnlocked(container);
          await container.vault.saveApiKey(
            container.sessionKey,
            message.providerConfigId,
            message.apiKey,
          );
          return ok();
        } catch (err) {
          return handleError(err);
        }
      }

      case 'DELETE_API_KEY': {
        try {
          await container.vault.deleteApiKey(message.providerConfigId);
          return ok();
        } catch (err) {
          return handleError(err);
        }
      }

      // ----------------------------------------------------------------
      // Base resume CRUD (encrypted in vault)
      // ----------------------------------------------------------------
      case 'SAVE_BASE_RESUME': {
        try {
          requireUnlocked(container);
          if (!message.label.trim() || !message.content.trim()) {
            throw new AppError('VALIDATION_ERROR', 'Label and content are required.');
          }
          const now = Date.now();
          const resume: BaseResume = {
            id: crypto.randomUUID(),
            label: message.label,
            content: message.content,
            createdAt: now,
            updatedAt: now,
          };
          await container.vault.saveResume(container.sessionKey, resume);
          return ok(resume);
        } catch (err) {
          return handleError(err);
        }
      }

      case 'UPDATE_BASE_RESUME': {
        try {
          requireUnlocked(container);
          const existing = await container.vault.getResume(
            container.sessionKey,
            message.id,
          );
          if (!existing) {
            throw new AppError('RESUME_NOT_FOUND', `Resume with id "${message.id}" was not found.`);
          }

          const updated: BaseResume = {
            id: existing.id,
            label: message.label,
            content: message.content,
            createdAt: existing.createdAt,
            updatedAt: Date.now(),
          };

          await container.vault.saveResume(container.sessionKey, updated);
          return ok(updated);
        } catch (err) {
          return handleError(err);
        }
      }

      case 'DELETE_BASE_RESUME': {
        try {
          await container.vault.deleteResume(message.id);
          return ok();
        } catch (err) {
          return handleError(err);
        }
      }

      case 'GET_BASE_RESUMES': {
        try {
          requireUnlocked(container);
          const resumes = await container.vault.getAllResumes(container.sessionKey);
          return ok(resumes);
        } catch (err) {
          return handleError(err);
        }
      }

      // ----------------------------------------------------------------
      // Settings
      // ----------------------------------------------------------------
      case 'SAVE_SETTINGS': {
        try {
          requireUnlocked(container);
          await container.vault.saveSettings(container.sessionKey, message.settings);
          return ok();
        } catch (err) {
          return handleError(err);
        }
      }

      case 'GET_SETTINGS': {
        try {
          requireUnlocked(container);
          const settings = await container.vault.getSettings(container.sessionKey);
          return ok(settings);
        } catch (err) {
          return handleError(err);
        }
      }

      // ----------------------------------------------------------------
      // Resume tailoring
      // ----------------------------------------------------------------
      case 'TAILOR_RESUME': {
        try {
          requireUnlocked(container);

          const baseResume = await container.vault.getResume(
            container.sessionKey,
            message.baseResumeId,
          );
          if (!baseResume) {
            return fail(`Base resume "${message.baseResumeId}" not found.`, 'RESUME_NOT_FOUND');
          }

          let tailoredContent = '';
          for await (const event of container.resumeAgent.tailor(
            baseResume.content,
            message.jobDescription,
          )) {
            if (event.kind === 'done') tailoredContent = event.content;
          }

          const tailoredResume = {
            id: crypto.randomUUID(),
            baseResumeId: message.baseResumeId,
            jobDescription: {
              rawText: message.jobDescription,
            },
            content: tailoredContent,
            providerId: defaultProvider.id,
            model: defaultProvider.model,
            createdAt: Date.now(),
          };

          await container.resumeRepo.saveTailoredResume(tailoredResume);
          return ok(tailoredResume);
        } catch (err) {
          return handleError(err);
        }
      }

      // ----------------------------------------------------------------
      // Tailored resume listing
      // ----------------------------------------------------------------
      case 'LIST_TAILORED': {
        try {
          const [items, total] = await Promise.all([
            container.resumeRepo.listTailoredResumes(message.page, message.pageSize),
            container.resumeRepo.countTailoredResumes(),
          ]);
          return ok({ items, total });
        } catch (err) {
          return handleError(err);
        }
      }

      // ----------------------------------------------------------------
      // PDF export
      // ----------------------------------------------------------------
      case 'EXPORT_PDF': {
        try {
          const resume = await container.resumeRepo.getTailoredResume(message.tailoredResumeId);
          if (!resume) {
            throw new AppError('RESUME_NOT_FOUND', `Resume with id "${message.tailoredResumeId}" was not found.`);
          }

          const html = container.exporter.export(resume.content);

          const base64 = btoa(unescape(encodeURIComponent(html)));
          const dataUrl = `data:text/html;base64,${base64}`;
          return ok({ dataUrl });
        } catch (err) {
          return handleError(err);
        }
      }

      // ----------------------------------------------------------------
      // LinkedIn integration
      // ----------------------------------------------------------------
      case 'SCRAPE_LINKEDIN_JOB': {
        try {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (!tab?.id) {
            throw new AppError('VALIDATION_ERROR', 'No active tab found.');
          }

          const url = tab.url ?? '';
          if (!url.startsWith('https://www.linkedin.com/jobs/view/')) {
            throw new AppError(
              'LINKEDIN_NOT_JOB_PAGE',
              'Navigate to a LinkedIn job listing first.',
            );
          }

          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scrapeLinkedInJobPage,
            world: 'MAIN',
          });

          const data = results[0]?.result;
          if (!data || !data.jobDescription) {
            throw new AppError(
              'LINKEDIN_SCRAPE_FAILED',
              'Could not read job details. LinkedIn may have changed its layout.',
            );
          }

          return ok(data);
        } catch (err) {
          return handleError(err);
        }
      }

      case 'FILL_EASY_APPLY': {
        try {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (!tab?.id) {
            throw new AppError('VALIDATION_ERROR', 'No active tab found.');
          }

          const url = tab.url ?? '';
          if (!url.startsWith('https://www.linkedin.com/')) {
            throw new AppError(
              'LINKEDIN_NOT_JOB_PAGE',
              'Navigate to a LinkedIn job page first.',
            );
          }

          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: fillEasyApplyModal,
            args: [message.fields],
            world: 'MAIN',
          });

          const result = results[0]?.result;
          if (!result) {
            throw new AppError('EASY_APPLY_FILL_FAILED', 'Fill script returned no result.');
          }

          if (result.skippedFields.includes('modal_not_found')) {
            throw new AppError(
              'EASY_APPLY_NOT_FOUND',
              'Easy Apply modal not detected. Open the modal first.',
            );
          }

          return ok(result);
        } catch (err) {
          return handleError(err);
        }
      }

      default: {
        const _exhaustive: never = message;
        return fail(`Unknown message type.`);
      }
    }
  }

  return handleMessage;
}

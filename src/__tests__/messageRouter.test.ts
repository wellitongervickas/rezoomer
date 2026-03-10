import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMessageRouter, type ExtensionMessage } from '@/agents/messageRouter.ts';
import type { Container } from '@/extension/container.ts';
import { AppError } from '@/core/errors.ts';

function createMockContainer(overrides?: Partial<Container>): Container {
  return {
    sessionKey: null,
    vault: {
      initialize: vi.fn().mockResolvedValue(undefined),
      unlock: vi.fn().mockResolvedValue({} as CryptoKey),
      isInitialized: vi.fn().mockResolvedValue(false),
      saveApiKey: vi.fn().mockResolvedValue(undefined),
      getApiKey: vi.fn().mockResolvedValue('sk-test'),
      deleteApiKey: vi.fn().mockResolvedValue(undefined),
      saveResume: vi.fn().mockResolvedValue(undefined),
      getResume: vi.fn().mockResolvedValue(null),
      getAllResumes: vi.fn().mockResolvedValue([]),
      deleteResume: vi.fn().mockResolvedValue(undefined),
      saveSettings: vi.fn().mockResolvedValue(undefined),
      getSettings: vi.fn().mockResolvedValue(null),
    } as any,
    resumeRepo: {
      saveBaseResume: vi.fn().mockResolvedValue(undefined),
      getBaseResume: vi.fn().mockResolvedValue(null),
      getAllBaseResumes: vi.fn().mockResolvedValue([]),
      deleteBaseResume: vi.fn().mockResolvedValue(undefined),
      saveTailoredResume: vi.fn().mockResolvedValue(undefined),
      getTailoredResume: vi.fn().mockResolvedValue(null),
      listTailoredResumes: vi.fn().mockResolvedValue([]),
    } as any,
    aiProvider: {} as any,
    resumeAgent: {
      tailor: vi.fn(),
    } as any,
    exporter: {
      export: vi.fn().mockReturnValue('<html></html>'),
    } as any,
    ...overrides,
  };
}

describe('messageRouter', () => {
  describe('vault operations', () => {
    it('VAULT_UNLOCK initializes and unlocks when not initialized', async () => {
      const container = createMockContainer();
      const fakeKey = {} as CryptoKey;
      container.vault.isInitialized = vi.fn().mockResolvedValue(false);
      container.vault.unlock = vi.fn().mockResolvedValue(fakeKey);

      const router = createMessageRouter(container);
      const result = await router({ type: 'VAULT_UNLOCK', password: 'pw' });

      expect(result.success).toBe(true);
      expect(container.vault.initialize).toHaveBeenCalledWith('pw');
      expect(container.vault.unlock).toHaveBeenCalledWith('pw');
      expect(container.sessionKey).toBe(fakeKey);
    });

    it('VAULT_UNLOCK skips init when already initialized', async () => {
      const container = createMockContainer();
      container.vault.isInitialized = vi.fn().mockResolvedValue(true);
      container.vault.unlock = vi.fn().mockResolvedValue({} as CryptoKey);

      const router = createMessageRouter(container);
      await router({ type: 'VAULT_UNLOCK', password: 'pw' });

      expect(container.vault.initialize).not.toHaveBeenCalled();
    });

    it('VAULT_UNLOCK returns error for wrong password', async () => {
      const container = createMockContainer();
      container.vault.isInitialized = vi.fn().mockResolvedValue(true);
      container.vault.unlock = vi.fn().mockRejectedValue(
        new AppError('INVALID_PASSWORD', 'Wrong password'),
      );

      const router = createMessageRouter(container);
      const result = await router({ type: 'VAULT_UNLOCK', password: 'wrong' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('INVALID_PASSWORD');
      }
    });

    it('VAULT_LOCK clears session key', async () => {
      const container = createMockContainer();
      container.sessionKey = {} as CryptoKey;

      const router = createMessageRouter(container);
      const result = await router({ type: 'VAULT_LOCK' });

      expect(result.success).toBe(true);
      expect(container.sessionKey).toBeNull();
    });

    it('VAULT_STATUS returns initialized and unlocked state', async () => {
      const container = createMockContainer();
      container.vault.isInitialized = vi.fn().mockResolvedValue(true);
      container.sessionKey = {} as CryptoKey;

      const router = createMessageRouter(container);
      const result = await router({ type: 'VAULT_STATUS' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ initialized: true, unlocked: true });
      }
    });
  });

  describe('locked vault enforcement', () => {
    const lockedOperations: ExtensionMessage[] = [
      { type: 'SAVE_API_KEY', providerConfigId: 'openai', apiKey: 'sk-x' },
      { type: 'SAVE_BASE_RESUME', label: 'Test', content: 'Content' },
      { type: 'UPDATE_BASE_RESUME', id: '1', label: 'Test', content: 'Content' },
      { type: 'GET_BASE_RESUMES' },
      { type: 'TAILOR_RESUME', baseResumeId: '1', jobDescription: 'job' },
      { type: 'SAVE_SETTINGS', settings: { id: 'default', theme: 'dark', defaultProviderId: 'x', exportFormat: 'pdf' } },
      { type: 'GET_SETTINGS' },
    ];

    lockedOperations.forEach((msg) => {
      it(`${msg.type} fails when vault is locked`, async () => {
        const container = createMockContainer();
        container.sessionKey = null;

        const router = createMessageRouter(container);
        const result = await router(msg);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.code).toBe('VAULT_LOCKED');
        }
      });
    });
  });

  describe('base resume CRUD', () => {
    it('SAVE_BASE_RESUME validates empty label', async () => {
      const container = createMockContainer();
      container.sessionKey = {} as CryptoKey;

      const router = createMessageRouter(container);
      const result = await router({
        type: 'SAVE_BASE_RESUME',
        label: '   ',
        content: 'Some content',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('VALIDATION_ERROR');
      }
    });

    it('SAVE_BASE_RESUME validates empty content', async () => {
      const container = createMockContainer();
      container.sessionKey = {} as CryptoKey;

      const router = createMessageRouter(container);
      const result = await router({
        type: 'SAVE_BASE_RESUME',
        label: 'Valid Label',
        content: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('VALIDATION_ERROR');
      }
    });

    it('SAVE_BASE_RESUME saves and returns resume on success', async () => {
      const container = createMockContainer();
      container.sessionKey = {} as CryptoKey;

      const router = createMessageRouter(container);
      const result = await router({
        type: 'SAVE_BASE_RESUME',
        label: 'My Resume',
        content: '# John Doe',
      });

      expect(result.success).toBe(true);
      expect(container.vault.saveResume).toHaveBeenCalled();
      if (result.success) {
        const data = result.data as any;
        expect(data.label).toBe('My Resume');
        expect(data.content).toBe('# John Doe');
        expect(data.id).toBeDefined();
      }
    });

    it('UPDATE_BASE_RESUME returns RESUME_NOT_FOUND for missing id', async () => {
      const container = createMockContainer();
      container.sessionKey = {} as CryptoKey;
      container.vault.getResume = vi.fn().mockResolvedValue(null);

      const router = createMessageRouter(container);
      const result = await router({
        type: 'UPDATE_BASE_RESUME',
        id: 'nonexistent',
        label: 'Updated',
        content: 'updated content',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('RESUME_NOT_FOUND');
      }
    });

    it('UPDATE_BASE_RESUME preserves createdAt and updates updatedAt', async () => {
      const container = createMockContainer();
      container.sessionKey = {} as CryptoKey;
      const originalCreatedAt = 1000;
      container.vault.getResume = vi.fn().mockResolvedValue({
        id: 'r1',
        label: 'Old',
        content: 'old',
        createdAt: originalCreatedAt,
        updatedAt: originalCreatedAt,
      });

      const router = createMessageRouter(container);
      const result = await router({
        type: 'UPDATE_BASE_RESUME',
        id: 'r1',
        label: 'New',
        content: 'new',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as any;
        expect(data.createdAt).toBe(originalCreatedAt);
        expect(data.updatedAt).toBeGreaterThan(originalCreatedAt);
      }
    });
  });

  describe('resume tailoring', () => {
    it('TAILOR_RESUME returns error when base resume not found', async () => {
      const container = createMockContainer();
      container.sessionKey = {} as CryptoKey;
      container.vault.getResume = vi.fn().mockResolvedValue(null);

      const router = createMessageRouter(container);
      const result = await router({
        type: 'TAILOR_RESUME',
        baseResumeId: 'missing',
        jobDescription: 'Some job',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('RESUME_NOT_FOUND');
      }
    });

    it('TAILOR_RESUME runs pipeline and saves result', async () => {
      const container = createMockContainer();
      container.sessionKey = {} as CryptoKey;
      container.vault.getResume = vi.fn().mockResolvedValue({
        id: 'base1',
        label: 'Base',
        content: '# Resume',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      container.resumeAgent.tailor = vi.fn().mockImplementation(
        async function* () {
          yield { kind: 'step', step: 'analyzing' };
          yield { kind: 'step', step: 'matching' };
          yield { kind: 'step', step: 'generating' };
          yield { kind: 'done', content: '# Tailored Resume' };
        },
      );

      const router = createMessageRouter(container);
      const result = await router({
        type: 'TAILOR_RESUME',
        baseResumeId: 'base1',
        jobDescription: 'Senior Engineer at ACME',
      });

      expect(result.success).toBe(true);
      expect(container.resumeRepo.saveTailoredResume).toHaveBeenCalled();
      if (result.success) {
        const data = result.data as any;
        expect(data.content).toBe('# Tailored Resume');
        expect(data.baseResumeId).toBe('base1');
      }
    });
  });

  describe('export', () => {
    it('EXPORT_PDF returns error for missing resume', async () => {
      const container = createMockContainer();
      container.resumeRepo.getTailoredResume = vi.fn().mockResolvedValue(null);

      const router = createMessageRouter(container);
      const result = await router({
        type: 'EXPORT_PDF',
        tailoredResumeId: 'missing',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('RESUME_NOT_FOUND');
      }
    });

    it('EXPORT_PDF returns data URL', async () => {
      const container = createMockContainer();
      container.resumeRepo.getTailoredResume = vi.fn().mockResolvedValue({
        id: 't1',
        baseResumeId: 'b1',
        jobDescription: { rawText: 'job', roleTitle: 'Engineer' },
        content: '# Tailored',
        providerId: 'openai',
        model: 'gpt-4o',
        createdAt: Date.now(),
      });
      container.exporter.export = vi.fn().mockReturnValue('<html>test</html>');

      const router = createMessageRouter(container);
      const result = await router({
        type: 'EXPORT_PDF',
        tailoredResumeId: 't1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as any;
        expect(data.dataUrl).toMatch(/^data:text\/html;base64,/);
      }
    });
  });

  describe('error handling', () => {
    it('wraps AppError with code', async () => {
      const container = createMockContainer();
      container.vault.isInitialized = vi.fn().mockRejectedValue(
        new AppError('PROVIDER_ERROR', 'DB failed'),
      );

      const router = createMessageRouter(container);
      const result = await router({ type: 'VAULT_STATUS' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('PROVIDER_ERROR');
        expect(result.error).toBe('DB failed');
      }
    });

    it('wraps generic errors without code', async () => {
      const container = createMockContainer();
      container.vault.isInitialized = vi.fn().mockRejectedValue(
        new Error('Unknown failure'),
      );

      const router = createMessageRouter(container);
      const result = await router({ type: 'VAULT_STATUS' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unknown failure');
        expect(result.code).toBeUndefined();
      }
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { VaultService } from '@/vault/vault.ts';
import { KeyDerivationService } from '@/vault/keyDerivation.ts';
import { EncryptionService } from '@/vault/encryption.ts';
import { AppError } from '@/core/errors.ts';
import { __resetDB } from '@/storage/db.ts';

beforeEach(async () => {
  await __resetDB();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('rezoomer');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
});

function createVault() {
  return new VaultService(new KeyDerivationService(), new EncryptionService());
}

describe('VaultService', () => {
  describe('lifecycle', () => {
    it('initializes and unlocks with correct password', async () => {
      const vault = createVault();
      await vault.initialize('my-password');

      const key = await vault.unlock('my-password');
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
    });

    it('reports initialized status after init', async () => {
      const vault = createVault();
      expect(await vault.isInitialized()).toBe(false);

      await vault.initialize('pw');
      expect(await vault.isInitialized()).toBe(true);
    });

    it('rejects wrong password', async () => {
      const vault = createVault();
      await vault.initialize('correct');

      try {
        await vault.unlock('wrong');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe('INVALID_PASSWORD');
      }
    });

    it('throws VAULT_NOT_INITIALIZED when unlocking before init', async () => {
      const vault = createVault();

      try {
        await vault.unlock('any-password');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe('VAULT_NOT_INITIALIZED');
      }
    });
  });

  describe('API keys', () => {
    it('saves and retrieves an API key', async () => {
      const vault = createVault();
      await vault.initialize('pw');
      const key = await vault.unlock('pw');

      await vault.saveApiKey(key, 'openai', 'sk-test-123');
      const retrieved = await vault.getApiKey(key, 'openai');
      expect(retrieved).toBe('sk-test-123');
    });

    it('returns null for missing provider', async () => {
      const vault = createVault();
      await vault.initialize('pw');
      const key = await vault.unlock('pw');

      const result = await vault.getApiKey(key, 'nonexistent');
      expect(result).toBeNull();
    });

    it('replaces existing key for same provider', async () => {
      const vault = createVault();
      await vault.initialize('pw');
      const key = await vault.unlock('pw');

      await vault.saveApiKey(key, 'openai', 'old-key');
      await vault.saveApiKey(key, 'openai', 'new-key');

      const retrieved = await vault.getApiKey(key, 'openai');
      expect(retrieved).toBe('new-key');
    });

    it('deletes an API key', async () => {
      const vault = createVault();
      await vault.initialize('pw');
      const key = await vault.unlock('pw');

      await vault.saveApiKey(key, 'openai', 'sk-delete-me');
      await vault.deleteApiKey('openai');

      const result = await vault.getApiKey(key, 'openai');
      expect(result).toBeNull();
    });

    it('delete is safe when key does not exist', async () => {
      const vault = createVault();
      await vault.initialize('pw');
      await vault.unlock('pw');

      await expect(vault.deleteApiKey('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('encrypted resumes', () => {
    it('saves and retrieves a resume', async () => {
      const vault = createVault();
      await vault.initialize('pw');
      const key = await vault.unlock('pw');

      const resume = {
        id: 'r1',
        label: 'My Resume',
        content: '# John Doe\nSenior Engineer',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await vault.saveResume(key, resume);
      const retrieved = await vault.getResume(key, 'r1');
      expect(retrieved).toEqual(resume);
    });

    it('returns null for missing resume', async () => {
      const vault = createVault();
      await vault.initialize('pw');
      const key = await vault.unlock('pw');

      const result = await vault.getResume(key, 'nonexistent');
      expect(result).toBeNull();
    });

    it('retrieves all resumes', async () => {
      const vault = createVault();
      await vault.initialize('pw');
      const key = await vault.unlock('pw');

      const now = Date.now();
      await vault.saveResume(key, { id: 'a', label: 'A', content: 'a', createdAt: now, updatedAt: now });
      await vault.saveResume(key, { id: 'b', label: 'B', content: 'b', createdAt: now, updatedAt: now });

      const all = await vault.getAllResumes(key);
      expect(all).toHaveLength(2);
      expect(all.map((r) => r.id).sort()).toEqual(['a', 'b']);
    });

    it('deletes a resume', async () => {
      const vault = createVault();
      await vault.initialize('pw');
      const key = await vault.unlock('pw');

      const now = Date.now();
      await vault.saveResume(key, { id: 'del', label: 'X', content: 'x', createdAt: now, updatedAt: now });
      await vault.deleteResume('del');

      const result = await vault.getResume(key, 'del');
      expect(result).toBeNull();
    });
  });

  describe('encrypted settings', () => {
    it('saves and retrieves settings', async () => {
      const vault = createVault();
      await vault.initialize('pw');
      const key = await vault.unlock('pw');

      const settings = {
        id: 'default',
        theme: 'dark' as const,
        defaultProviderId: 'openai-gpt-4o',
        exportFormat: 'pdf' as const,
      };

      await vault.saveSettings(key, settings);
      const retrieved = await vault.getSettings(key);
      expect(retrieved).toEqual(settings);
    });

    it('returns null when no settings saved', async () => {
      const vault = createVault();
      await vault.initialize('pw');
      const key = await vault.unlock('pw');

      const result = await vault.getSettings(key);
      expect(result).toBeNull();
    });
  });
});

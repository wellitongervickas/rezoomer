import type { BaseResume, EncryptedEntry, VaultMeta, VaultSettings } from '@/core/types.ts';
import { AppError } from '@/core/errors.ts';
import { getDB } from '@/storage/db.ts';
import type { KeyDerivationService } from './keyDerivation.ts';
import type { EncryptionService } from './encryption.ts';

const VAULT_META_ID = 'meta';
const KNOWN_PLAINTEXT = 'REZOOMER_VAULT_OK';

export class VaultService {
  constructor(
    private readonly keyDerivation: KeyDerivationService,
    private readonly encryption: EncryptionService,
  ) {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async initialize(password: string): Promise<void> {
    const salt = this.keyDerivation.generateSalt();
    const key = await this.keyDerivation.deriveKey(password, salt.buffer);

    const { ciphertext, iv } = await this.encryption.encrypt(key, KNOWN_PLAINTEXT);

    const meta: VaultMeta = {
      id: VAULT_META_ID,
      salt: salt.buffer,
      iv,
      verificationCipher: ciphertext,
    };

    const db = await getDB();
    await db.put('vault', meta);
  }

  async unlock(password: string): Promise<CryptoKey> {
    const meta = await this.loadMeta();
    const key = await this.keyDerivation.deriveKey(password, meta.salt);

    try {
      const plaintext = await this.encryption.decrypt(
        key,
        meta.verificationCipher,
        meta.iv,
      );
      if (plaintext !== KNOWN_PLAINTEXT) {
        throw new AppError('INVALID_PASSWORD', 'The provided password is incorrect.');
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('INVALID_PASSWORD', 'The provided password is incorrect.');
    }

    return key;
  }

  async isInitialized(): Promise<boolean> {
    const db = await getDB();
    const meta = await db.get('vault', VAULT_META_ID);
    return meta !== undefined;
  }

  // ---------------------------------------------------------------------------
  // API Keys
  // ---------------------------------------------------------------------------

  async saveApiKey(
    key: CryptoKey,
    providerConfigId: string,
    apiKey: string,
  ): Promise<void> {
    const { ciphertext, iv } = await this.encryption.encrypt(key, apiKey);

    const entry: EncryptedEntry = {
      id: crypto.randomUUID(),
      providerConfigId,
      ciphertext,
      iv,
    };

    const db = await getDB();
    const existing = await db.getAll('encryptedKeys');
    const previous = existing.find((e) => e.providerConfigId === providerConfigId);
    if (previous) {
      await db.delete('encryptedKeys', previous.id);
    }
    await db.put('encryptedKeys', entry);
  }

  async getApiKey(
    key: CryptoKey,
    providerConfigId: string,
  ): Promise<string | null> {
    const db = await getDB();
    const entries = await db.getAll('encryptedKeys');
    const entry = entries.find((e) => e.providerConfigId === providerConfigId);
    if (!entry) return null;

    return this.encryption.decrypt(key, entry.ciphertext, entry.iv);
  }

  async deleteApiKey(providerConfigId: string): Promise<void> {
    const db = await getDB();
    const entries = await db.getAll('encryptedKeys');
    const entry = entries.find((e) => e.providerConfigId === providerConfigId);
    if (entry) {
      await db.delete('encryptedKeys', entry.id);
    }
  }

  // ---------------------------------------------------------------------------
  // Resumes (encrypted)
  // ---------------------------------------------------------------------------

  async saveResume(key: CryptoKey, resume: BaseResume): Promise<void> {
    const { ciphertext, iv } = await this.encryption.encrypt(
      key,
      JSON.stringify(resume),
    );

    const db = await getDB();
    await db.put('encryptedResumes', { id: resume.id, ciphertext, iv });
  }

  async getResume(key: CryptoKey, id: string): Promise<BaseResume | null> {
    const db = await getDB();
    const record = await db.get('encryptedResumes', id);
    if (!record) return null;

    const json = await this.encryption.decrypt(key, record.ciphertext, record.iv);
    return JSON.parse(json) as BaseResume;
  }

  async getAllResumes(key: CryptoKey): Promise<BaseResume[]> {
    const db = await getDB();
    const records = await db.getAll('encryptedResumes');

    const decrypted = await Promise.all(
      records.map(async (record) => {
        const json = await this.encryption.decrypt(key, record.ciphertext, record.iv);
        return JSON.parse(json) as BaseResume;
      }),
    );

    return decrypted;
  }

  async deleteResume(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('encryptedResumes', id);
  }

  // ---------------------------------------------------------------------------
  // Settings (encrypted)
  // ---------------------------------------------------------------------------

  async saveSettings(key: CryptoKey, settings: VaultSettings): Promise<void> {
    const { ciphertext, iv } = await this.encryption.encrypt(
      key,
      JSON.stringify(settings),
    );

    const db = await getDB();
    await db.put('encryptedSettings', { id: settings.id, ciphertext, iv });
  }

  async getSettings(key: CryptoKey): Promise<VaultSettings | null> {
    const db = await getDB();
    const record = await db.get('encryptedSettings', 'default');
    if (!record) return null;

    const json = await this.encryption.decrypt(key, record.ciphertext, record.iv);
    return JSON.parse(json) as VaultSettings;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async loadMeta(): Promise<VaultMeta> {
    const db = await getDB();
    const meta = await db.get('vault', VAULT_META_ID);
    if (!meta) {
      throw new AppError(
        'VAULT_NOT_INITIALIZED',
        'Vault has not been initialized. Please set a master password first.',
      );
    }
    return meta;
  }
}

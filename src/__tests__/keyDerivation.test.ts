import { describe, it, expect } from 'vitest';
import { KeyDerivationService } from '@/vault/keyDerivation.ts';

describe('KeyDerivationService', () => {
  const service = new KeyDerivationService();

  it('generates 32-byte salt', () => {
    const salt = service.generateSalt();
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.length).toBe(32);
  });

  it('generates unique salts', () => {
    const salt1 = service.generateSalt();
    const salt2 = service.generateSalt();
    const identical = salt1.every((b, i) => b === salt2[i]);
    expect(identical).toBe(false);
  });

  it('derives a CryptoKey from password and salt', async () => {
    const salt = service.generateSalt();
    const key = await service.deriveKey('my-password', salt.buffer);
    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    expect(key.extractable).toBe(false);
    expect(key.usages).toContain('encrypt');
    expect(key.usages).toContain('decrypt');
  });

  it('derives same key for same password and salt', async () => {
    const salt = service.generateSalt();
    const key1 = await service.deriveKey('same-password', salt.buffer);
    const key2 = await service.deriveKey('same-password', salt.buffer);

    // Keys are non-extractable, so verify by encrypting/decrypting
    const plaintext = 'test';
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key1,
      new TextEncoder().encode(plaintext),
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key2,
      cipher,
    );
    expect(new TextDecoder().decode(decrypted)).toBe(plaintext);
  });

  it('derives different keys for different passwords', async () => {
    const salt = service.generateSalt();
    const key1 = await service.deriveKey('password-a', salt.buffer);
    const key2 = await service.deriveKey('password-b', salt.buffer);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key1,
      new TextEncoder().encode('test'),
    );

    await expect(
      crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, cipher),
    ).rejects.toThrow();
  });
});

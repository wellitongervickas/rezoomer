import { describe, it, expect, beforeAll } from 'vitest';
import { EncryptionService } from '@/vault/encryption.ts';
import { KeyDerivationService } from '@/vault/keyDerivation.ts';

describe('EncryptionService', () => {
  const encryption = new EncryptionService();
  const keyDerivation = new KeyDerivationService();
  let key: CryptoKey;

  beforeAll(async () => {
    const salt = keyDerivation.generateSalt();
    key = await keyDerivation.deriveKey('test-password', salt.buffer);
  });

  it('round-trips plaintext through encrypt/decrypt', async () => {
    const plaintext = 'Hello, World!';
    const { ciphertext, iv } = await encryption.encrypt(key, plaintext);
    const decrypted = await encryption.decrypt(key, ciphertext, iv);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypts empty string', async () => {
    const { ciphertext, iv } = await encryption.encrypt(key, '');
    const decrypted = await encryption.decrypt(key, ciphertext, iv);
    expect(decrypted).toBe('');
  });

  it('encrypts large text', async () => {
    const plaintext = 'x'.repeat(100_000);
    const { ciphertext, iv } = await encryption.encrypt(key, plaintext);
    const decrypted = await encryption.decrypt(key, ciphertext, iv);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypts unicode text', async () => {
    const plaintext = 'Oi mundo! 🌍 日本語テスト';
    const { ciphertext, iv } = await encryption.encrypt(key, plaintext);
    const decrypted = await encryption.decrypt(key, ciphertext, iv);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext for same plaintext (random IV)', async () => {
    const plaintext = 'deterministic?';
    const result1 = await encryption.encrypt(key, plaintext);
    const result2 = await encryption.encrypt(key, plaintext);

    const bytes1 = new Uint8Array(result1.ciphertext);
    const bytes2 = new Uint8Array(result2.ciphertext);

    const identical = bytes1.every((b, i) => b === bytes2[i]);
    expect(identical).toBe(false);
  });

  it('fails to decrypt with wrong key', async () => {
    const { ciphertext, iv } = await encryption.encrypt(key, 'secret');

    const wrongSalt = keyDerivation.generateSalt();
    const wrongKey = await keyDerivation.deriveKey('wrong-password', wrongSalt.buffer);

    await expect(encryption.decrypt(wrongKey, ciphertext, iv)).rejects.toThrow();
  });

  it('fails to decrypt with tampered IV', async () => {
    const { ciphertext, iv } = await encryption.encrypt(key, 'secret');

    const tamperedIv = new Uint8Array(iv);
    tamperedIv[0] ^= 0xff;

    await expect(
      encryption.decrypt(key, ciphertext, tamperedIv.buffer),
    ).rejects.toThrow();
  });

  it('fails to decrypt with tampered ciphertext', async () => {
    const { ciphertext, iv } = await encryption.encrypt(key, 'secret');

    const tampered = new Uint8Array(ciphertext);
    tampered[0] ^= 0xff;

    await expect(
      encryption.decrypt(key, tampered.buffer, iv),
    ).rejects.toThrow();
  });
});

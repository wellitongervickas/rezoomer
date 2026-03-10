const IV_BYTES = 12;

export class EncryptionService {
  async encrypt(
    key: CryptoKey,
    plaintext: string,
  ): Promise<{ ciphertext: ArrayBuffer; iv: ArrayBuffer }> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext),
    );
    return { ciphertext, iv: iv.buffer };
  }

  async decrypt(
    key: CryptoKey,
    ciphertext: ArrayBuffer,
    iv: ArrayBuffer,
  ): Promise<string> {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );
    return new TextDecoder().decode(decrypted);
  }
}

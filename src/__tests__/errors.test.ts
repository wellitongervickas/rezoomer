import { describe, it, expect } from 'vitest';
import { AppError } from '@/core/errors.ts';

describe('AppError', () => {
  it('stores code and message', () => {
    const err = new AppError('VAULT_LOCKED', 'Vault is locked');
    expect(err.code).toBe('VAULT_LOCKED');
    expect(err.message).toBe('Vault is locked');
    expect(err.name).toBe('AppError');
  });

  it('stores optional cause', () => {
    const cause = new TypeError('original');
    const err = new AppError('PROVIDER_ERROR', 'Wrapped', cause);
    expect(err.cause).toBe(cause);
  });

  it('is an instance of Error', () => {
    const err = new AppError('VALIDATION_ERROR', 'Bad input');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('can be caught as AppError', () => {
    try {
      throw new AppError('RESUME_NOT_FOUND', 'Not found');
    } catch (err) {
      expect(err instanceof AppError).toBe(true);
      if (err instanceof AppError) {
        expect(err.code).toBe('RESUME_NOT_FOUND');
      }
    }
  });

  it('preserves code through re-throw', () => {
    function inner() {
      throw new AppError('ENCRYPTION_ERROR', 'AES failed');
    }

    function outer() {
      try {
        inner();
      } catch (err) {
        throw err;
      }
    }

    try {
      outer();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('ENCRYPTION_ERROR');
    }
  });
});

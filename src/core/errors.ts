export type ErrorCode =
  | 'VAULT_LOCKED'
  | 'VAULT_NOT_INITIALIZED'
  | 'INVALID_PASSWORD'
  | 'RESUME_NOT_FOUND'
  | 'PROVIDER_ERROR'
  | 'VALIDATION_ERROR'
  | 'ENCRYPTION_ERROR'
  | 'AGENT_ERROR';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

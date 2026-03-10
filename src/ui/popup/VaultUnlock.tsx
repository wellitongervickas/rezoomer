import { useState, FormEvent } from 'react';

interface Props {
  initialized: boolean;
  unlocked: boolean;
  onUnlock: (password: string) => Promise<void>;
  onLock: () => Promise<void>;
}

export function VaultUnlock({ initialized, unlocked, onUnlock, onLock }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCreating = !initialized;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (isCreating && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await onUnlock(password);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock vault.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLock() {
    setLoading(true);
    setError(null);
    try {
      await onLock();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lock vault.');
    } finally {
      setLoading(false);
    }
  }

  if (unlocked) {
    return (
      <div className="vault-section">
        <div className="vault-section__badge">
          <span>&#10003;</span>
          <span>Vault unlocked</span>
        </div>
        <button
          className="btn btn-danger btn-full"
          onClick={handleLock}
          disabled={loading}
        >
          {loading ? 'Locking…' : 'Lock Vault'}
        </button>
        {error && <div className="vault-section__error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="vault-section">
      <p className="vault-section__title">
        {isCreating ? 'Create Vault' : 'Unlock Vault'}
      </p>
      <form onSubmit={handleSubmit} noValidate>
        <div className="vault-section__field">
          <label className="form-label" htmlFor="vault-password">
            Password
          </label>
          <input
            id="vault-password"
            type="password"
            className="form-input"
            autoComplete={isCreating ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isCreating ? 'Choose a strong password' : 'Enter your password'}
            required
          />
        </div>

        {isCreating && (
          <div className="vault-section__field">
            <label className="form-label" htmlFor="vault-confirm">
              Confirm Password
            </label>
            <input
              id="vault-confirm"
              type="password"
              className="form-input"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              required
            />
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-full"
          disabled={loading}
        >
          {loading
            ? isCreating
              ? 'Creating…'
              : 'Unlocking…'
            : isCreating
              ? 'Create Vault'
              : 'Unlock'}
        </button>
      </form>

      {error && <div className="vault-section__error">{error}</div>}
    </div>
  );
}

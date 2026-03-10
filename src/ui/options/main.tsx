import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useVaultStatus } from '../shared/hooks.ts';
import { ApiKeyManager } from './ApiKeyManager.tsx';
import { BaseResumeManager } from './BaseResumeManager.tsx';
import './styles.css';

type Tab = 'api-keys' | 'base-resumes';

function VaultUnlock({
  onUnlock,
}: {
  onUnlock: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    try {
      await onUnlock(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock vault.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="vault-container">
      <div className="vault-card">
        <div className="vault-icon">🔒</div>
        <h2 className="vault-title">Unlock Vault</h2>
        <p className="vault-description">
          Enter your vault password to manage API keys and base resumes.
        </p>
        <form className="vault-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="vault-password" className="form-label">
              Password
            </label>
            <input
              id="vault-password"
              type="password"
              className="form-input"
              placeholder="Vault password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>
          {error && <p className="status-message status-error">{error}</p>}
          <div className="button-row" style={{ marginTop: '16px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !password}
              style={{ flex: 1 }}
            >
              {submitting ? 'Unlocking…' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OptionsApp() {
  const { initialized, unlocked, loading, unlock, lock } = useVaultStatus();
  const [activeTab, setActiveTab] = useState<Tab>('api-keys');

  if (loading) {
    return (
      <div className="page">
        <p className="muted-text">Loading…</p>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Rezoomer Settings</h1>
          <p className="page-subtitle">
            {initialized
              ? 'Your vault is locked.'
              : 'No vault found. Set a password to initialize.'}
          </p>
        </div>
        <VaultUnlock onUnlock={unlock} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Rezoomer Settings</h1>
          <p className="page-subtitle">Configure API providers and manage your base resumes.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={lock}>
          Lock Vault
        </button>
      </div>

      <nav className="tabs">
        <button
          className={`tab-btn${activeTab === 'api-keys' ? ' active' : ''}`}
          onClick={() => setActiveTab('api-keys')}
        >
          API Keys
        </button>
        <button
          className={`tab-btn${activeTab === 'base-resumes' ? ' active' : ''}`}
          onClick={() => setActiveTab('base-resumes')}
        >
          Base Resumes
        </button>
      </nav>

      {activeTab === 'api-keys' && <ApiKeyManager vaultUnlocked={unlocked} />}
      {activeTab === 'base-resumes' && <BaseResumeManager />}
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

createRoot(root).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>,
);

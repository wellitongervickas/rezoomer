import { useState } from 'react';
import { DEFAULT_PROVIDERS } from '@/core/types.ts';
import { useMessaging } from '../shared/hooks.ts';

interface ApiKeyManagerProps {
  vaultUnlocked: boolean;
}

const DEFAULT_PROVIDER = DEFAULT_PROVIDERS.find((p) => p.isDefault)!;

export function ApiKeyManager({ vaultUnlocked }: ApiKeyManagerProps) {
  const [apiKey, setApiKey] = useState('');
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saved' | 'deleted' | 'error'>('idle');
  const { send, loading, error } = useMessaging();

  async function handleSave() {
    if (!apiKey.trim()) return;
    const result = await send({
      type: 'SAVE_API_KEY',
      providerConfigId: DEFAULT_PROVIDER.id,
      apiKey: apiKey.trim(),
    });
    if (result !== null) {
      setSavedStatus('saved');
      setApiKey('');
      setTimeout(() => setSavedStatus('idle'), 3000);
    } else {
      setSavedStatus('error');
    }
  }

  async function handleDelete() {
    const result = await send({
      type: 'DELETE_API_KEY',
      providerConfigId: DEFAULT_PROVIDER.id,
    });
    if (result !== null) {
      setSavedStatus('deleted');
      setApiKey('');
      setTimeout(() => setSavedStatus('idle'), 3000);
    } else {
      setSavedStatus('error');
    }
  }

  return (
    <section className="card">
      <h2 className="section-title">API Keys</h2>

      {!vaultUnlocked && (
        <div className="warning-banner">
          Vault is locked. Unlock the vault to manage API keys.
        </div>
      )}

      <div className="provider-row">
        <span className="provider-badge">{DEFAULT_PROVIDER.displayName}</span>
        <span className="provider-model">{DEFAULT_PROVIDER.model}</span>
      </div>

      <div className="form-group">
        <label htmlFor="api-key-input" className="form-label">
          API Key
        </label>
        <input
          id="api-key-input"
          type="password"
          className="form-input"
          placeholder="sk-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={!vaultUnlocked || loading}
          autoComplete="off"
        />
      </div>

      <div className="button-row">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!vaultUnlocked || loading || !apiKey.trim()}
        >
          {loading ? 'Saving…' : 'Save Key'}
        </button>
        <button
          className="btn btn-danger"
          onClick={handleDelete}
          disabled={!vaultUnlocked || loading}
        >
          Delete Key
        </button>
      </div>

      {savedStatus === 'saved' && (
        <p className="status-message status-success">API key saved successfully.</p>
      )}
      {savedStatus === 'deleted' && (
        <p className="status-message status-success">API key deleted.</p>
      )}
      {(savedStatus === 'error' || error) && (
        <p className="status-message status-error">{error ?? 'An error occurred.'}</p>
      )}
    </section>
  );
}

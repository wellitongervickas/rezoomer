import type React from 'react';
import { StrictMode, useEffect, useReducer, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

import { useVaultStatus } from '../shared/hooks.ts';
import { sendMessage, streamTailorResume } from '../shared/messaging.ts';
import type { ResumeAgentEvent } from '../shared/messaging.ts';
import { JobDescriptionInput } from './JobDescriptionInput.tsx';
import { TailoringProgress } from './TailoringProgress.tsx';
import type { TailoringStep } from './TailoringProgress.tsx';
import { ResumePreview } from './ResumePreview.tsx';
import { HistoryList } from './HistoryList.tsx';
import { ApiKeyManager } from '../options/ApiKeyManager.tsx';
import { BaseResumeManager } from '../options/BaseResumeManager.tsx';
import type { TailoredResume, GenerationOptions, VaultSettings } from '@/core/types.ts';
import { DEFAULT_VAULT_SETTINGS } from '@/core/types.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'generate' | 'history' | 'settings';

type GeneratePhase =
  | { kind: 'idle' }
  | { kind: 'generating'; step: TailoringStep; streamedText: string }
  | { kind: 'done'; resume: TailoredResume };

interface AppState {
  tab: Tab;
  generatePhase: GeneratePhase;
  selectedHistoryResume: TailoredResume | null;
}

type AppAction =
  | { type: 'SET_TAB'; tab: Tab }
  | { type: 'GENERATING_START' }
  | { type: 'GENERATING_STEP'; step: TailoringStep; text: string }
  | { type: 'GENERATING_DONE'; resume: TailoredResume }
  | { type: 'GENERATING_CANCEL' }
  | { type: 'SELECT_HISTORY_RESUME'; resume: TailoredResume }
  | { type: 'CLEAR_HISTORY_RESUME' };

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, tab: action.tab };
    case 'GENERATING_START':
      return {
        ...state,
        generatePhase: { kind: 'generating', step: 'analyzing', streamedText: '' },
      };
    case 'GENERATING_STEP':
      return {
        ...state,
        generatePhase: {
          kind: 'generating',
          step: action.step,
          streamedText: action.text,
        },
      };
    case 'GENERATING_DONE':
      return { ...state, generatePhase: { kind: 'done', resume: action.resume } };
    case 'GENERATING_CANCEL':
      return { ...state, generatePhase: { kind: 'idle' } };
    case 'SELECT_HISTORY_RESUME':
      return { ...state, selectedHistoryResume: action.resume };
    case 'CLEAR_HISTORY_RESUME':
      return { ...state, selectedHistoryResume: null };
    default:
      return state;
  }
}

const INITIAL_STATE: AppState = {
  tab: 'generate',
  generatePhase: { kind: 'idle' },
  selectedHistoryResume: null,
};

// ---------------------------------------------------------------------------
// Unlock form
// ---------------------------------------------------------------------------

interface UnlockFormProps {
  onUnlock: (password: string) => Promise<void>;
  error: string | null;
}

function UnlockForm({ onUnlock, error }: UnlockFormProps) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setLocalError(null);
    try {
      await onUnlock(password);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Incorrect password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="unlock-screen">
      <div className="unlock-card">
        <h1 className="unlock-card__title">Rezoomer</h1>
        <p className="unlock-card__subtitle">Unlock your vault to continue</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="vault-password">
              Vault Password
            </label>
            <input
              id="vault-password"
              type="password"
              className="form-input"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>
          {(localError ?? error) && (
            <p className="form-error">{localError ?? error}</p>
          )}
          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={submitting || !password}
          >
            {submitting ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main app
// ---------------------------------------------------------------------------

function App() {
  const vault = useVaultStatus();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const abortRef = useRef<{ abort: () => void } | null>(null);
  const [settings, setSettings] = useState<VaultSettings | null>(null);
  const [generationDefaults, setGenerationDefaults] = useState<GenerationOptions | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  if (vault.loading) {
    return <div className="app-loading">Loading…</div>;
  }

  if (!vault.unlocked) {
    async function handleUnlock(password: string) {
      setUnlockError(null);
      try {
        await vault.unlock(password);
      } catch (err) {
        setUnlockError(err instanceof Error ? err.message : 'Unlock failed');
        throw err;
      }
    }
    return <UnlockForm onUnlock={handleUnlock} error={unlockError} />;
  }

  useEffect(() => {
    if (!vault.unlocked || settingsLoaded) return;

    let cancelled = false;

    (async () => {
      try {
        const loaded = await sendMessage<VaultSettings | null>({ type: 'GET_SETTINGS' });
        if (cancelled) return;

        const effectiveSettings: VaultSettings =
          loaded ?? DEFAULT_VAULT_SETTINGS;

        const genDefaults: GenerationOptions =
          effectiveSettings.generationDefaults ?? DEFAULT_VAULT_SETTINGS.generationDefaults!;

        setSettings(effectiveSettings);
        setGenerationDefaults(genDefaults);
      } catch {
        // If settings cannot be loaded, fall back to defaults.
        setSettings(DEFAULT_VAULT_SETTINGS);
        setGenerationDefaults(DEFAULT_VAULT_SETTINGS.generationDefaults!);
      } finally {
        if (!cancelled) setSettingsLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [vault.unlocked, settingsLoaded]);

  function handleGenerate(
    baseResumeId: string,
    jobDescription: string,
    company: string,
    role: string,
    options: GenerationOptions,
  ) {
    dispatch({ type: 'GENERATING_START' });

    let accumulated = '';

    const handle = streamTailorResume(
      { baseResumeId, jobDescription, companyName: company, roleTitle: role, options },
      (event: ResumeAgentEvent) => {
        switch (event.kind) {
          case 'step':
            accumulated = '';
            dispatch({ type: 'GENERATING_STEP', step: event.step, text: '' });
            break;
          case 'token':
            accumulated += event.content;
            dispatch({ type: 'GENERATING_STEP', step: 'generating', text: accumulated });
            break;
          case 'done':
            dispatch({ type: 'GENERATING_DONE', resume: event.resume });
            abortRef.current = null;
            break;
          case 'error':
            dispatch({ type: 'GENERATING_CANCEL' });
            abortRef.current = null;
            alert(`Error: ${event.message}`);
            break;
        }
      },
    );

    abortRef.current = handle;
  }

  function handleCancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: 'GENERATING_CANCEL' });
  }

  const { tab, generatePhase, selectedHistoryResume } = state;

  function handleRebuildFromResume(resume: TailoredResume) {
    const { baseResumeId, jobDescription } = resume;
    dispatch({ type: 'SET_TAB', tab: 'generate' });
    handleGenerate(
      baseResumeId,
      jobDescription.rawText,
      jobDescription.companyName ?? '',
      jobDescription.roleTitle ?? '',
    );
  }

  async function handleGenerationOptionsChange(options: GenerationOptions) {
    setGenerationDefaults(options);

    if (!settings) return;

    const nextSettings: VaultSettings = {
      ...settings,
      generationDefaults: options,
    };

    setSettings(nextSettings);

    try {
      await sendMessage<void>({ type: 'SAVE_SETTINGS', settings: nextSettings });
    } catch {
      // Persist failure is non-fatal for the UI; user can still generate.
    }
  }

  return (
    <div className="app">
      <nav className="tab-bar">
        <button
          type="button"
          className={`tab-bar__tab${tab === 'generate' ? ' tab-bar__tab--active' : ''}`}
          onClick={() => dispatch({ type: 'SET_TAB', tab: 'generate' })}
        >
          Generate
        </button>
        <button
          type="button"
          className={`tab-bar__tab${tab === 'history' ? ' tab-bar__tab--active' : ''}`}
          onClick={() => dispatch({ type: 'SET_TAB', tab: 'history' })}
        >
          History
        </button>
        <button
          type="button"
          className={`tab-bar__tab${tab === 'settings' ? ' tab-bar__tab--active' : ''}`}
          onClick={() => dispatch({ type: 'SET_TAB', tab: 'settings' })}
        >
          Settings
        </button>
        <button
          type="button"
          className="tab-bar__icon"
          title="Lock vault"
          onClick={() => vault.lock()}
        >
          &#128274;
        </button>
      </nav>

      <main className="app-content">
        {tab === 'generate' && (
          <>
            {generatePhase.kind === 'idle' && (
              <JobDescriptionInput
                onGenerate={handleGenerate}
                isGenerating={false}
                initialOptions={generationDefaults ?? DEFAULT_VAULT_SETTINGS.generationDefaults!}
                onOptionsChange={handleGenerationOptionsChange}
              />
            )}
            {generatePhase.kind === 'generating' && (
              <TailoringProgress
                step={generatePhase.step}
                streamedText={generatePhase.streamedText}
                onCancel={handleCancel}
              />
            )}
            {generatePhase.kind === 'done' && (
              <ResumePreview
                resume={generatePhase.resume}
                onBack={() => dispatch({ type: 'GENERATING_CANCEL' })}
                onRebuild={() => handleRebuildFromResume(generatePhase.resume)}
              />
            )}
          </>
        )}

        {tab === 'history' && (
          <>
            {selectedHistoryResume ? (
              <ResumePreview
                resume={selectedHistoryResume}
                onBack={() => dispatch({ type: 'CLEAR_HISTORY_RESUME' })}
                onRebuild={() => handleRebuildFromResume(selectedHistoryResume)}
              />
            ) : (
              <HistoryList
                onSelect={(r) => dispatch({ type: 'SELECT_HISTORY_RESUME', resume: r })}
              />
            )}
          </>
        )}

        {tab === 'settings' && (
          <div className="settings-panel">
            <section className="settings-section">
              <h3 className="settings-section__title">API Keys</h3>
              <ApiKeyManager vaultUnlocked />
            </section>
            <section className="settings-section">
              <h3 className="settings-section__title">Base Resumes</h3>
              <BaseResumeManager />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

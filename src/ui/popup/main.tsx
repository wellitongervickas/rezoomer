import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { useVaultStatus } from '../shared/hooks.ts';
import { VaultUnlock } from './VaultUnlock.tsx';
import { QuickActions } from './QuickActions.tsx';

function Spinner() {
  return (
    <div className="spinner">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      Loading…
    </div>
  );
}

function App() {
  const { initialized, unlocked, loading, unlock, lock } = useVaultStatus();

  if (loading) return <Spinner />;

  return (
    <>
      <div className="popup-header">
        <span className="popup-header__icon">&#9672;</span>
        <span className="popup-header__title">Rezoomer</span>
      </div>

      <VaultUnlock
        initialized={initialized}
        unlocked={unlocked}
        onUnlock={unlock}
        onLock={lock}
      />

      {unlocked && (
        <>
          <div className="popup-divider" />
          <QuickActions />
        </>
      )}
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

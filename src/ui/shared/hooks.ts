import { useState, useEffect, useCallback } from 'react';
import { sendMessage, ExtensionMessage } from './messaging.ts';

// ---------------------------------------------------------------------------
// useMessaging
// ---------------------------------------------------------------------------

export function useMessaging<T = unknown>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (message: ExtensionMessage): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const data = await sendMessage<T>(message);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { send, loading, error };
}

// ---------------------------------------------------------------------------
// useVaultStatus
// ---------------------------------------------------------------------------

interface VaultStatus {
  initialized: boolean;
  unlocked: boolean;
}

export function useVaultStatus() {
  const [status, setStatus] = useState<VaultStatus>({ initialized: false, unlocked: false });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await sendMessage<VaultStatus>({ type: 'VAULT_STATUS' });
      setStatus(data);
    } catch {
      // Vault service not ready
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const unlock = useCallback(async (password: string) => {
    await sendMessage({ type: 'VAULT_UNLOCK', password });
    await refresh();
  }, [refresh]);

  const lock = useCallback(async () => {
    await sendMessage({ type: 'VAULT_LOCK' });
    await refresh();
  }, [refresh]);

  return { ...status, loading, unlock, lock, refresh };
}

import { createContainer } from './container.ts';
import { createMessageRouter } from '@/agents/messageRouter.ts';
import { AppError } from '@/core/errors.ts';
import { DEFAULT_PROVIDERS } from '@/core/types.ts';

const container = createContainer();
const handleMessage = createMessageRouter(container);

// Restore vault session if the service worker was killed and restarted
const sessionReady = (async () => {
  try {
    const { vaultPassword } = await chrome.storage.session.get('vaultPassword');
    if (vaultPassword) {
      container.sessionKey = await container.vault.unlock(vaultPassword);
      console.log('Vault session restored from storage');
    }
  } catch (err) {
    console.warn('Vault session restore failed:', err);
  }
})();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  sessionReady.then(() => handleMessage(message)).then(sendResponse);
  return true;
});

// ---------------------------------------------------------------------------
// Port-based streaming for resume tailoring
// ---------------------------------------------------------------------------

const defaultProvider = DEFAULT_PROVIDERS.find((p) => p.isDefault) ?? DEFAULT_PROVIDERS[0];

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'tailor') return;

  const abort = new AbortController();
  port.onDisconnect.addListener(() => abort.abort());

  port.onMessage.addListener(async (msg: { baseResumeId: string; jobDescription: string; companyName?: string; roleTitle?: string }) => {
    await sessionReady;
    try {
      if (container.sessionKey === null) {
        port.postMessage({ kind: 'error', message: 'Vault is locked.', code: 'VAULT_LOCKED' });
        return;
      }

      const baseResume = await container.vault.getResume(container.sessionKey, msg.baseResumeId);
      if (!baseResume) {
        port.postMessage({ kind: 'error', message: 'Base resume not found.', code: 'RESUME_NOT_FOUND' });
        return;
      }

      let tailoredContent = '';

      for await (const event of container.resumeAgent.tailor(
        baseResume.content,
        msg.jobDescription,
        { signal: abort.signal },
      )) {
        if (event.kind === 'done') {
          tailoredContent = event.content;

          const tailoredResume = {
            id: crypto.randomUUID(),
            baseResumeId: msg.baseResumeId,
            jobDescription: {
              rawText: msg.jobDescription,
              companyName: msg.companyName,
              roleTitle: msg.roleTitle,
            },
            content: tailoredContent,
            providerId: defaultProvider.id,
            model: defaultProvider.model,
            createdAt: Date.now(),
          };

          await container.resumeRepo.saveTailoredResume(tailoredResume);
          port.postMessage({ kind: 'done', content: tailoredContent, resume: tailoredResume });
        } else {
          port.postMessage(event);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof AppError ? err.message : 'Generation failed.';
      const code = err instanceof AppError ? err.code : undefined;
      try {
        port.postMessage({ kind: 'error', message, code });
      } catch {
        // Port already disconnected
      }
    }
  });
});

chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true });

console.log('Rezoomer service worker started');

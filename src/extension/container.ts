import { KeyDerivationService } from '@/vault/keyDerivation.ts';
import { EncryptionService } from '@/vault/encryption.ts';
import { VaultService } from '@/vault/vault.ts';
import { IndexedDBResumeRepo } from '@/storage/resumeRepo.ts';
import { OpenAIAdapter } from '@/ai/openai.ts';
import { ExportService } from './exportService.ts';
import { ResumeAgent } from '@/agents/resumeAgent.ts';
import { AppError } from '@/core/errors.ts';
import { DEFAULT_PROVIDERS } from '@/core/types.ts';

export interface Container {
  sessionKey: CryptoKey | null;
  readonly vault: VaultService;
  readonly resumeRepo: IndexedDBResumeRepo;
  readonly aiProvider: OpenAIAdapter;
  readonly resumeAgent: ResumeAgent;
  readonly exporter: ExportService;
}

export function createContainer(): Container {
  const keyDerivation = new KeyDerivationService();
  const encryption = new EncryptionService();
  const vault = new VaultService(keyDerivation, encryption);
  const resumeRepo = new IndexedDBResumeRepo();
  const exporter = new ExportService();

  const defaultProvider = DEFAULT_PROVIDERS.find((p) => p.isDefault) ?? DEFAULT_PROVIDERS[0];

  const getApiKey = async (): Promise<string> => {
    if (container.sessionKey === null) {
      throw new AppError('VAULT_LOCKED', 'Vault is locked. Please unlock it first.');
    }

    const apiKey = await vault.getApiKey(container.sessionKey, defaultProvider.id);
    if (!apiKey) {
      throw new AppError(
        'VAULT_LOCKED',
        `No API key stored for provider "${defaultProvider.id}". Please save an API key first.`,
      );
    }

    return apiKey;
  };

  const aiProvider = new OpenAIAdapter(defaultProvider.baseUrl, defaultProvider.model, getApiKey);
  const resumeAgent = new ResumeAgent(aiProvider);

  const container: Container = {
    sessionKey: null,
    vault,
    resumeRepo,
    aiProvider,
    resumeAgent,
    exporter,
  };

  return container;
}

// ---------------------------------------------------------------------------
// Domain entities
// ---------------------------------------------------------------------------

export interface BaseResume {
  readonly id: string;
  readonly content: string;
  readonly label: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface TailoredResume {
  readonly id: string;
  readonly baseResumeId: string;
  readonly jobDescription: JobDescription;
  readonly content: string;
  readonly providerId: string;
  readonly model: string;
  readonly createdAt: number;
}

export interface JobDescription {
  readonly rawText: string;
  readonly companyName?: string;
  readonly roleTitle?: string;
}

export interface AIProviderConfig {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly model: string;
  readonly baseUrl: string;
  readonly isDefault: boolean;
}

export interface VaultMeta {
  readonly id: string;
  readonly salt: ArrayBuffer;
  readonly iv: ArrayBuffer;
  readonly verificationCipher: ArrayBuffer;
}

export interface EncryptedRecord {
  readonly id: string;
  readonly ciphertext: ArrayBuffer;
  readonly iv: ArrayBuffer;
}

export interface EncryptedEntry extends EncryptedRecord {
  readonly providerConfigId: string;
}

export interface VaultSettings {
  readonly id: string;
  readonly theme: 'light' | 'dark' | 'system';
  readonly defaultProviderId: string;
  readonly exportFormat: 'pdf' | 'markdown';
}

export const DEFAULT_VAULT_SETTINGS: VaultSettings = {
  id: 'default',
  theme: 'system',
  defaultProviderId: 'openai-gpt-4o',
  exportFormat: 'pdf',
};

// ---------------------------------------------------------------------------
// Provider defaults
// ---------------------------------------------------------------------------

export const DEFAULT_PROVIDERS: readonly AIProviderConfig[] = [
  {
    id: 'openai-gpt-4o',
    name: 'openai',
    displayName: 'OpenAI GPT-4o',
    model: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    isDefault: true,
  },
] as const;

// ---------------------------------------------------------------------------
// Ports (interfaces with real polymorphism value)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface IAIProvider {
  generateCompletion(
    messages: ChatMessage[],
    options?: { signal?: AbortSignal; temperature?: number },
  ): AsyncIterable<string>;
}

export interface IResumeRepository {
  saveBaseResume(resume: BaseResume): Promise<void>;
  getBaseResume(id: string): Promise<BaseResume | null>;
  getAllBaseResumes(): Promise<BaseResume[]>;
  deleteBaseResume(id: string): Promise<void>;
  saveTailoredResume(resume: TailoredResume): Promise<void>;
  getTailoredResume(id: string): Promise<TailoredResume | null>;
  listTailoredResumes(page: number, pageSize: number): Promise<TailoredResume[]>;
  countTailoredResumes(): Promise<number>;
}

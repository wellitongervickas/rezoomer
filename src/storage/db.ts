import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface RezoomerDB extends DBSchema {
  vault: {
    key: string;
    value: {
      id: string;
      salt: ArrayBuffer;
      iv: ArrayBuffer;
      verificationCipher: ArrayBuffer;
    };
  };
  encryptedKeys: {
    key: string;
    value: {
      id: string;
      providerConfigId: string;
      ciphertext: ArrayBuffer;
      iv: ArrayBuffer;
    };
  };
  baseResumes: {
    key: string;
    value: {
      id: string;
      content: string;
      label: string;
      createdAt: number;
      updatedAt: number;
    };
  };
  tailoredResumes: {
    key: string;
    value: {
      id: string;
      baseResumeId: string;
      jobDescription: { rawText: string; companyName?: string; roleTitle?: string };
      content: string;
      providerId: string;
      model: string;
      createdAt: number;
    };
    indexes: { 'by-created': number };
  };
  providerConfigs: {
    key: string;
    value: {
      id: string;
      name: string;
      displayName: string;
      model: string;
      baseUrl: string;
      isDefault: boolean;
    };
  };
  encryptedResumes: {
    key: string;
    value: {
      id: string;
      ciphertext: ArrayBuffer;
      iv: ArrayBuffer;
    };
  };
  encryptedSettings: {
    key: string;
    value: {
      id: string;
      ciphertext: ArrayBuffer;
      iv: ArrayBuffer;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<RezoomerDB>> | null = null;

/** @internal Closes and resets the cached DB connection. Used in tests only. */
export async function __resetDB(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

export function getDB(): Promise<IDBPDatabase<RezoomerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RezoomerDB>('rezoomer', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('vault', { keyPath: 'id' });
          db.createObjectStore('encryptedKeys', { keyPath: 'id' });
          db.createObjectStore('baseResumes', { keyPath: 'id' });
          const tailoredStore = db.createObjectStore('tailoredResumes', { keyPath: 'id' });
          tailoredStore.createIndex('by-created', 'createdAt');
          db.createObjectStore('providerConfigs', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('encryptedResumes', { keyPath: 'id' });
          db.createObjectStore('encryptedSettings', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

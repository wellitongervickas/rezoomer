import 'fake-indexeddb/auto';

// Minimal chrome API stub for tests
(globalThis as any).chrome = {
  storage: {
    session: {
      set: async () => {},
      get: async () => ({}),
      remove: async () => {},
    },
  },
};

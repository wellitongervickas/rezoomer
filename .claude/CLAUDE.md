# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MV3 Chrome browser extension that generates tailored resumes using AI. Client-side only — no backend. All data encrypted at rest via WebCrypto (PBKDF2 + AES-GCM-256). Only external call is to the OpenAI API.

**Principles:** Clean architecture, SOLID, modular adapters, security-first, avoid unnecessary dependencies.

## Commands

```bash
pnpm build          # Production build → dist/ (loadable as unpacked extension)
pnpm dev            # Vite dev server (UI iteration only; use unpacked extension for full testing)
pnpm test           # Run all tests once
pnpm test:watch     # Run tests in watch mode
```

**Single test file:**
```bash
pnpm vitest run src/__tests__/vault.test.ts
```

No separate lint script — TypeScript strict mode (`noImplicitAny`, etc.) enforces quality at build time.

## Architecture

### Request Flow

```
React Sidepanel (ui/)
  └─ messaging.ts ──────────────────────────────────────────────┐
                                                                 ↓
Service Worker (extension/serviceWorker.ts)                      │
  └─ messageRouter.ts ← chrome.runtime.onMessage (simple requests)
  └─ chrome.runtime.onConnect port 'tailor' (streaming)
        └─ container.ts (DI root)
              ├─ VaultService     (vault/)
              ├─ ResumeAgent      (agents/resumeAgent.ts)
              ├─ OpenAIAdapter    (ai/openai.ts  implements IAIProvider)
              ├─ IndexedDBResumeRepo (storage/)
              └─ ExportService    (extension/exportService.ts)
```

### Two Communication Patterns

- **Simple requests** — `chrome.runtime.onMessage` → `messageRouter` returns `ExtensionResponse` (typed discriminated union of 24 message types)
- **Streaming** — `chrome.runtime.onConnect` with port `'tailor'` → yields `ResumeAgentEvent` (`step` | `token` | `done`) for real-time resume generation

### Resume Generation Pipeline (3 steps in `resumeAgent.ts`)

1. **Analyze** — Extract skills/keywords from job description
2. **Match** — Map candidate experience against requirements
3. **Generate** — Produce tailored resume (streamed tokens)

Prompts live in `core/prompts.ts`. The agent is an `async *tailor()` generator that yields `ResumeAgentEvent`.

### Security Model

- Vault password is never stored on disk — held in `chrome.storage.session` (memory-only, cleared on browser close)
- `CryptoKey` is held in `container.ts` memory only (`sessionKey` field), never serialized
- PBKDF2 (600k iterations, SHA-256) for key derivation; AES-GCM-256 for encryption
- Password verification uses `KNOWN_PLAINTEXT = "REZOOMER_VAULT_OK"` encrypted at init time
- All HTML rendered from AI output goes through DOMPurify

### Interfaces

Only two port interfaces exist (`IAIProvider`, `IResumeRepository`) — both represent real polymorphism points. Do not add interfaces for single-implementation services.

### DI Container (`extension/container.ts`)

`createContainer()` wires 6 fields. `getApiKey` is a closure that fetches from vault, requiring the session key. Adding a new service means wiring it here and exposing it to `messageRouter`.

### Message Router (`agents/messageRouter.ts`)

Discriminated union dispatch with compile-time exhaustiveness (TypeScript `never` default branch). Adding a new message type: define the type in `core/types.ts`, add a case here, add the handler call to the appropriate service.

## Build Details

Vite runs two builds:
1. **Sidepanel** — standard Vite React build → `dist/assets/`
2. **Service worker** — separate IIFE bundle (`inlineDynamicImports: true`) → `dist/service-worker.js`

Two custom Vite plugins in `vite.config.ts`:
- `stripCrossOriginPlugin` — removes `crossorigin` attrs from HTML (breaks `chrome-extension://` context)
- `serviceWorkerPlugin` — triggers the second Vite build + copies `manifest.json` to `dist/`

## Tests

- 95 tests across 10 files in `src/__tests__/`
- `fake-indexeddb/auto` for IndexedDB mocking
- Global `chrome.storage.session` stub in `src/__tests__/setup.ts`
- jsdom environment (configured in `vitest.config.ts`)

## Adding a New AI Provider

1. Implement `IAIProvider` (from `core/types.ts`) — must return `AsyncIterable<string>`
2. Add to `DEFAULT_PROVIDERS` in `core/types.ts`
3. Wire in `container.ts`

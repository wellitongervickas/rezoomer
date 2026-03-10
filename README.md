# Rezoomer

**AI-powered resume tailoring, entirely in your browser.**

![Chrome 116+](https://img.shields.io/badge/Chrome-116%2B-blue?logo=googlechrome&logoColor=white)
![TypeScript Strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

<img width="465" height="346" alt="image" src="https://github.com/user-attachments/assets/cb5c41b6-f5f9-4109-9092-af49e754895b" />


## What is Rezoomer?

Rezoomer is a browser extension that tailors your resume to any job description using AI. Paste a job posting, select your base resume, and get a tailored version in seconds — with streaming output so you can watch it being written.

Everything runs client-side. Your resume and API key are encrypted locally and never touch a third-party server (the only external call is to the OpenAI API).

Works on **Chrome 116+** and **Brave**.

## Why Rezoomer?

- **Privacy-first** — All sensitive data encrypted at rest with AES-GCM-256. Your master key lives in memory only and is never written to disk.
- **No backend** — Zero server infrastructure. The extension talks directly to OpenAI from your browser.
- **Honest AI** — Three-step pipeline (analyze job, match skills, generate) that reframes your experience but never fabricates it.
- **Clean architecture** — Domain-driven, SOLID principles, easily extensible to other AI providers.
- **Zero bloat** — Five runtime dependencies. PDF export via native `window.print()`.

## Features

### Encrypted Vault

PBKDF2 key derivation (600,000 iterations, SHA-256) + AES-GCM-256 encryption. Your API keys and base resumes are encrypted before they ever touch storage.

### Three-Step Resume Agent

1. **Analyze** — Extracts skills, seniority, keywords, and domain from the job description
2. **Match** — Maps your experience against the job requirements
3. **Generate** — Produces a tailored Markdown resume emphasizing relevant experience

Streaming output with real-time progress indicators for each step.

### Resume History

Every generated resume is stored in IndexedDB and browseable from the History tab.

### PDF Export

Zero-dependency export via `window.print()` with clean HTML rendering from Markdown.

### Safe Markdown Rendering

Uses `marked` for Markdown-to-HTML conversion with `DOMPurify` sanitization. XSS-safe by design.

### Pluggable AI Providers

`IAIProvider` interface with `AsyncIterable<string>` streaming. OpenAI (GPT-4o) ships by default — implement the interface to add your own provider.

## Installation

### From Source

```bash
git clone https://github.com/wellitongervickas/rezoomer.git
cd rezoomer
pnpm install
pnpm build
```

Then load the extension:

1. Open `chrome://extensions` (or `brave://extensions`)
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder

<!-- ### Chrome Web Store -->
<!-- TODO: Not yet published -->

## Getting Started

1. **Create your vault** — Click the Rezoomer icon in the toolbar to open the side panel, then set a master password (8+ characters). This creates the encrypted vault.

2. **Add your API key** — Go to the **Settings** tab in the side panel and paste your OpenAI API key. It gets encrypted immediately with your vault key.

3. **Add a base resume** — Still in Settings, add one or more base resumes in Markdown format. These are your "master" resumes that will be tailored.

4. **Generate a tailored resume** — Switch to the **Generate** tab, paste a job description, select a base resume, and click **Generate**. Watch the three-step pipeline stream the result in real time.

5. **Export** — Review the tailored resume in the preview, then export to PDF or copy the Markdown.

<!-- TODO: Add GIF showing the generate flow -->

## Architecture

```
UI (React)  →  messaging.ts  →  Service Worker  →  messageRouter
                                                        │
                                  ┌─────────┬───────────┼───────────┐
                                  │         │           │           │
                                Vault   ResumeAgent  ResumeRepo  Exporter
                                  │         │           │
                              WebCrypto  IAIProvider  IndexedDB
```

### Domain Layers

| Directory    | Responsibility                                                                          | Key Files                                              |
| ------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `core/`      | Types, errors, prompts, markdown rendering, resume print template                       | `types.ts`, `errors.ts`, `prompts.ts`, `markdown.ts`, `resumeTemplate.ts` |
| `agents/`    | Message routing (discriminated union dispatch), resume agent (3-step pipeline)          | `messageRouter.ts`, `resumeAgent.ts`                   |
| `vault/`     | Encryption at rest: PBKDF2 key derivation, AES-GCM-256 encrypt/decrypt, vault lifecycle | `vault.ts`, `keyDerivation.ts`, `encryption.ts`        |
| `storage/`   | IndexedDB schema and resume repository                                                  | `db.ts`, `resumeRepo.ts`                               |
| `ai/`        | AI provider adapters                                                                    | `openai.ts`                                            |
| `extension/` | MV3 glue: service worker, DI container, export service                                  | `serviceWorker.ts`, `container.ts`, `exportService.ts` |
| `ui/`        | React side panel (Generate, History, Settings tabs), reusable settings components, shared utils | `sidepanel/`, `options/`, `shared/`                    |

### Design Decisions

- **Discriminated union messages** — Exhaustive `switch` with `never` default ensures compile-time safety when adding new message types. No REST-like router overhead.
- **DI container** — `container.ts` wires all services. Session `CryptoKey` held in memory on the container, never serialized.
- **`IAIProvider` with `AsyncIterable<string>`** — Enables streaming and provider swapping without touching orchestration code.
- **No use-case classes** — The message router calls services directly, avoiding unnecessary indirection at this scale.

## Security

| Layer                       | Detail                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Encryption at rest**      | All sensitive data (API keys, base resumes, settings) encrypted with AES-GCM-256. Key derived via PBKDF2 (600,000 iterations, SHA-256). |
| **CryptoKey lifecycle**     | Derived on vault unlock, held in service worker memory, discarded on lock or browser close. Auto-restored across service worker restarts via `chrome.storage.session` (memory-only, never persisted to disk). |
| **Content Security Policy** | `script-src 'self'`; `connect-src` limited to `self` and `https://api.openai.com`.                                                      |
| **XSS prevention**          | All Markdown-generated HTML sanitized through DOMPurify before DOM insertion.                                                           |
| **Minimal permissions**     | `sidePanel`, `storage`, `activeTab`. Single host permission: `https://api.openai.com/*`.                                                |
| **What leaves the browser** | Only the OpenAI API call (resume text + job description). No telemetry, no analytics, no third-party requests.                          |

## Tech Stack

| Category     | Tool                                |
| ------------ | ----------------------------------- |
| Language     | TypeScript (strict mode)            |
| UI           | React 18                            |
| Build        | Vite 6                              |
| Storage      | IndexedDB via `idb` 8               |
| Markdown     | `marked` 17                         |
| Sanitization | `DOMPurify` 3                       |
| Encryption   | WebCrypto API (native)              |
| AI           | OpenAI Chat Completions (streaming) |

## Project Structure

```
src/
├── agents/        # Message routing + resume tailoring agent
├── ai/            # AI provider adapters (OpenAI)
├── core/          # Domain types, errors, prompts, markdown
├── extension/     # Service worker, DI container, export service
├── storage/       # IndexedDB schema + resume repository
├── ui/
│   ├── sidepanel/ # Main app (Generate, History, Settings tabs)
│   ├── options/   # Reusable settings components (API keys, base resumes)
│   └── shared/    # Hooks, messaging client, markdown export, shared styles
└── vault/         # PBKDF2 key derivation + AES-GCM encryption
```

## Development

### Prerequisites

- Node.js 18+
- pnpm

### Commands

| Command         | Description                                                                 |
| --------------- | --------------------------------------------------------------------------- |
| `pnpm dev`   | Vite dev server (for UI iteration; use unpacked extension for full testing) |
| `pnpm build` | Production build to `dist/`                                                 |

After building, load `dist/` as an unpacked extension in `chrome://extensions` with Developer mode enabled.

### Adding a New AI Provider

1. Implement the `IAIProvider` interface from `src/core/types.ts`
2. Add a new entry to `DEFAULT_PROVIDERS` in `src/core/types.ts`
3. Wire the adapter in `src/extension/container.ts`

The `IAIProvider` interface requires a single method:

```typescript
generateCompletion(
  messages: ChatMessage[],
  options?: { signal?: AbortSignal; temperature?: number },
): AsyncIterable<string>;
```

## Roadmap

- [ ] Unit + integration tests
- [ ] CI pipeline (GitHub Actions)
- [ ] Chrome Web Store publishing
- [ ] LICENSE file
- [ ] Multiple AI providers in the UI (model selector)
- [ ] Resume templates and formatting options
- [ ] Firefox MV3 support
- [ ] Content script for extracting job descriptions from job boards

## Contributing

Contributions are welcome! This project is in early development — there is plenty to do.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Push and open a Pull Request

### Code Style

- TypeScript strict mode — no `any`
- Follow existing patterns (discriminated unions, DI container, domain-oriented structure)
- Keep dependencies minimal

## License

<!-- TODO: Choose and add a LICENSE file (MIT or Apache-2.0 recommended) -->

License not yet selected. See [Roadmap](#roadmap).

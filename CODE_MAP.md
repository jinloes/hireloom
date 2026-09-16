# Hireloom Code Map

This map answers "where does this behavior live?" For architectural reasoning
and trust boundaries, see [`ARCHITECTURE.md`](ARCHITECTURE.md). Keep this file
current when files or responsibilities change.

## Runtime entry points

| Location                | Responsibility                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `index.html`            | Browser/Tauri webview HTML shell and application metadata                                                          |
| `src/main.tsx`          | React root and Strict Mode entry point                                                                             |
| `src/App.tsx`           | Top-level studio orchestration, resume library, import/export, AI review state, dialogs, and notifications         |
| `src-tauri/src/main.rs` | Native binary entry point; delegates to `hireloom_lib::run`                                                        |
| `src-tauri/src/lib.rs`  | Tauri application builder, commands, native validation, local persistence, export, and Copilot subprocess boundary |

## Frontend

| Location                           | Responsibility                                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/model.ts`                     | Zod persistence and AI proposal schemas, domain types, limits, factories, import validation, proposal application, readiness, keyword matching, and filenames |
| `src/useWorkspace.ts`              | Initial load, serialized debounced autosave, dirty/error state, retries, browser unload protection, and native close protection                               |
| `src/platform.ts`                  | Runtime adapter: Tauri IPC on desktop and isolated `localStorage`/downloads in browser preview                                                                |
| `src/components/Editor.tsx`        | Accessible content fields and experience/education/skills editing                                                                                             |
| `src/components/CopilotPanel.tsx`  | CLI status/login controls, per-request consent, job text, local keyword overlap, and proposal review                                                          |
| `src/components/ResumePreview.tsx` | Continuous on-screen resume preview                                                                                                                           |
| `src/components/StylePanel.tsx`    | Template and accent selection                                                                                                                                 |
| `src/ResumeDocument.tsx`           | Lazy-loaded React PDF document, embedded font registration, pagination, and PDF blob creation                                                                 |
| `src/App.css`                      | Application shell, editor, preview, responsive behavior, focus, dialogs, and reduced-motion styling                                                           |
| `src/vite-env.d.ts`                | Vite client type declarations                                                                                                                                 |

## Native backend

`src-tauri/src/lib.rs` is intentionally one native module in the current MVP.
Its internal areas are:

| Area                | Key symbols                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Shared contract     | `Resume`, `Workspace`, `AiProposal`, nested DTOs, enums, and size/count constants                           |
| Tauri commands      | `load_workspace`, `save_workspace`, `export_document`, `copilot_status`, `copilot_login`, `generate_resume` |
| Persistence         | `workspace_path`, `load_workspace_from_path`, `serialize_valid_workspace`, `write_atomic`                   |
| Validation          | `validate_workspace`, `validate_resume`, `validate_ai_proposal`, export and text validators                 |
| Copilot isolation   | `copilot_paths`, `ensure_copilot_config`, `configure_copilot_command`, `copilot_generation_args`            |
| AI request/response | `build_generation_prompt`, `generate_resume_with_copilot`, `parse_ai_proposal`                              |
| Process control     | `run_process`, capped output readers, timeout and error summarization                                       |
| Application setup   | `run`, managed state, plugin registration, command registration, and exit routing                           |

Related native configuration:

| Location                              | Responsibility                                                          |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `src-tauri/tauri.conf.json`           | Product metadata, window defaults, build hooks, CSP, and bundle targets |
| `src-tauri/capabilities/default.json` | Minimal main-window permissions                                         |
| `src-tauri/Cargo.toml`                | Rust crate metadata and dependencies                                    |
| `src-tauri/build.rs`                  | Tauri build integration                                                 |
| `src-tauri/icons/`                    | Desktop bundle icons                                                    |
| `src-tauri/Cargo.lock`                | Locked Rust dependency graph                                            |

## Assets

| Location                           | Responsibility                         |
| ---------------------------------- | -------------------------------------- |
| `src/assets/fonts/NotoSans-*.ttf`  | Bundled sans-serif PDF fonts           |
| `src/assets/fonts/NotoSerif-*.ttf` | Bundled serif PDF fonts                |
| `src/assets/fonts/OFL.txt`         | SIL Open Font License displayed in-app |
| `public/hireloom.svg`              | Application logo and browser icon      |

## Tests

| Location                              | Coverage                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/model.test.ts`                   | Workspace validation, proposal invariants, readiness, keywords, and filenames                                                        |
| `src/App.test.tsx`                    | Load/save failures, serialized saves, consent, proposal review, stale detection, undo, and AI errors                                 |
| `src/test/setup.ts`                   | Vitest DOM setup and cleanup                                                                                                         |
| `src-tauri/src/lib.rs` `tests` module | Native validation, atomic writes, isolated Copilot config, prompt redaction, proposal parsing, subprocess flags, timeout, and errors |
| `e2e/studio.spec.ts`                  | Browser editing, persistence, import/export, PDF text, document management, corrupt data, and pagination                             |

## Tooling and automation

| Location                               | Responsibility                                            |
| -------------------------------------- | --------------------------------------------------------- |
| `package.json` / `package-lock.json`   | JavaScript dependencies and development commands          |
| `vite.config.ts`                       | React/Vite build and fixed Tauri development server       |
| `vitest.config.ts`                     | Frontend unit/component test configuration                |
| `playwright.config.ts`                 | Chromium/WebKit browser tests and local Vite server       |
| `tsconfig.json` / `tsconfig.node.json` | Strict application and tooling TypeScript configuration   |
| `.github/workflows/checks.yml`         | Frontend and cross-platform native CI                     |
| `.github/copilot-instructions.md`      | Concise repository constraints supplied to GitHub Copilot |
| `.prettierignore`                      | Formatter exclusions                                      |
| `.gitignore` / `src-tauri/.gitignore`  | Generated and private-data exclusions                     |
| `.vscode/extensions.json`              | Recommended editor extensions                             |

## Common change paths

| Goal                               | Start here                            | Usually also inspect                                                      |
| ---------------------------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| Change resume fields or limits     | `src/model.ts`                        | `src-tauri/src/lib.rs`, editor, preview, PDF, tests, backup compatibility |
| Change autosave or recovery        | `src/useWorkspace.ts`                 | `src/platform.ts`, `App.tsx`, frontend and E2E tests                      |
| Change desktop storage or exports  | `src-tauri/src/lib.rs`                | `src/platform.ts`, Tauri capabilities/config, native tests                |
| Change browser preview behavior    | `src/platform.ts`                     | `App.tsx`, Playwright tests, README privacy/storage text                  |
| Change AI prompt or proposal shape | `src-tauri/src/lib.rs`                | `src/model.ts`, `platform.ts`, `CopilotPanel.tsx`, native/frontend tests  |
| Change editing UI                  | `src/components/Editor.tsx`           | `App.tsx`, preview/PDF, accessibility and browser tests                   |
| Change visual templates            | `StylePanel.tsx`, `ResumePreview.tsx` | `ResumeDocument.tsx`, `App.css`, PDF E2E coverage                         |
| Add a Tauri command                | `src-tauri/src/lib.rs`                | `src/platform.ts`, capabilities, contract tests, architecture docs        |
| Add a dependency or command        | Relevant manifest                     | lockfile, CI workflow, README development steps                           |

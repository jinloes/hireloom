# Hireloom Code Map

This map answers "where does this behavior live?" For architectural reasoning
and trust boundaries, see [`ARCHITECTURE.md`](ARCHITECTURE.md). Keep this file
current when files or responsibilities change.

## Runtime entry points

| Location                | Responsibility                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`            | Browser/Tauri webview HTML shell and application metadata                                                                                                                                                                                                                                                                                                       |
| `src/main.tsx`          | React root and Strict Mode entry point                                                                                                                                                                                                                                                                                                                          |
| `src/App.tsx`           | Top-level full-width Content/Copilot/Design/Preview workspace orchestration, transient mode and Preview scroll, per-resume Content/Experience selection, shared item-removal Undo, resume library, import/export, whole-resume and feedback-refinable inline highlight guidance state, transient resume-wide highlight review state, dialogs, and notifications |
| `src-tauri/src/main.rs` | Native binary entry point; delegates to `hireloom_lib::run`                                                                                                                                                                                                                                                                                                     |
| `src-tauri/src/lib.rs`  | Tauri application builder, commands, native validation, local persistence, export, and Copilot SDK/CLI boundary                                                                                                                                                                                                                                                 |

## Frontend

| Location                               | Responsibility                                                                                                                                                                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/model.ts`                         | Zod persistence, whole-resume AI and transient APR/review option schemas, UTF-8 and target-binding validators, domain types, limits, factories, import validation, exact-target atomic one/two-bullet application, readiness, keyword matching, and filenames                                    |
| `src/useWorkspace.ts`                  | Initial load, serialized debounced autosave, dirty/error state, retries, browser unload protection, and native close protection                                                                                                                                                                  |
| `src/platform.ts`                      | Runtime adapter: validated Tauri IPC on desktop plus isolated `localStorage` and downloads in browser preview                                                                                                                                                                                    |
| `src/components/Editor.tsx`            | Accessible visible Content section tabs, responsive Experience summary/master-detail editing, typed item-removal requests, top/end insertion, reordering, skills editing, inline highlight guidance placement, and the consented resume-wide highlight review action with inline weakness badges |
| `src/components/HighlightGuidance.tsx` | Bounded per-highlight disclosure, per-request consent, weak review-status disclosure, factual dimensions, direct rewrite options, freeform refinement feedback, accessible selection, and apply or keep controls                                                                                 |
| `src/components/CopilotPanel.tsx`      | CLI status/login controls, per-request consent, job text, local keyword overlap, and whole-resume proposal review                                                                                                                                                                                |
| `src/components/ResumePreview.tsx`     | Continuous on-screen resume preview                                                                                                                                                                                                                                                              |
| `src/components/StylePanel.tsx`        | Template and accent selection                                                                                                                                                                                                                                                                    |
| `src/ResumeDocument.tsx`               | Lazy-loaded React PDF document, embedded font registration, pagination, and PDF blob creation                                                                                                                                                                                                    |
| `src/App.css`                          | Full-width workspace panels, primary/secondary tabs, bounded active-panel scrolling, responsive Experience master-detail, shared item Undo, focus, dialogs, and reduced-motion styling                                                                                                           |
| `src/vite-env.d.ts`                    | Vite client type declarations                                                                                                                                                                                                                                                                    |

## Native backend

`src-tauri/src/lib.rs` is intentionally one native module in the current MVP.
Its internal areas are:

| Area                | Key symbols                                                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contract     | `Resume`, `Workspace`, `AiProposal`, APR target/analysis DTOs, nested DTOs, enums, and size/count constants                                                                               |
| Tauri commands      | `load_workspace`, `save_workspace`, `export_document`, `copilot_status`, `copilot_login`, `generate_resume`, `analyze_accomplishment`, `refine_accomplishment`, `review_highlights`       |
| Persistence         | `workspace_path`, `load_workspace_from_path`, `serialize_valid_workspace`, `write_atomic`                                                                                                 |
| Validation          | `validate_workspace`, `validate_resume`, `validate_ai_proposal`, export and text validators                                                                                               |
| Copilot isolation   | `GENERATE_RESUME_MODEL`, `INLINE_APR_MODEL`, `CopilotPaths`, `copilot_paths`, `ensure_copilot_config`, `parse_jsonc`, SDK client/session builders, and status/login command configuration |
| AI request/response | Luna whole-resume plus Gemini APR analysis/refinement prompts and parsers, SDK session lifecycle, typed event validation, local target binding, and the shared no-fallback request runner |
| Process control     | Direct CLI status/login `run_process`, capped output readers, timeout, and error summarization                                                                                            |
| Application setup   | `run`, managed state, plugin registration, command registration, and exit routing                                                                                                         |

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

| Location                              | Coverage                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/model.test.ts`                   | Workspace validation, whole-resume and APR option contracts, UTF-8 limits, batch highlight review target binding, binding and atomic one/two-bullet application invariants, readiness, keywords, and filenames                                                                                                                                                                      |
| `src/App.test.tsx`                    | Workspace and Content tab semantics/focus, current Preview state, Experience selection, cross-mode item-removal recovery, load/save failures, serialized saves, highlight reordering, per-request AI consent, review-guided and legacy option/refinement flows, staleness, exact apply/keep/undo, batch highlight review consent gating, badge text, badge staleness, and AI errors |
| `src/test/setup.ts`                   | Vitest DOM setup and cleanup                                                                                                                                                                                                                                                                                                                                                        |
| `src-tauri/src/lib.rs` `tests` module | Native validation, atomic writes, isolated Copilot config, whole-resume/APR analysis and refinement prompt boundaries, locked-down SDK configuration, typed response validation, final-response bounds, and direct subprocess isolation/errors                                                                                                                                      |
| `e2e/studio.spec.ts`                  | Exact-size and zoom-equivalent workspace/Content tabs, full-width panel geometry and scroll preservation, responsive Experience master-detail and cross-mode item Undo, browser editing, persistence, desktop-only guidance and highlight review negative controls, import/export, ATS-relevant PDF order/content, document management, corrupt data, and pagination                |

## Tooling and automation

| Location                               | Responsibility                                                      |
| -------------------------------------- | ------------------------------------------------------------------- |
| `package.json` / `package-lock.json`   | JavaScript dependencies and development commands                    |
| `vite.config.ts`                       | React/Vite build and fixed Tauri development server                 |
| `vitest.config.ts`                     | Frontend unit/component test configuration                          |
| `playwright.config.ts`                 | Chromium/WebKit browser tests and local Vite server                 |
| `tsconfig.json` / `tsconfig.node.json` | Strict application and tooling TypeScript configuration             |
| `.github/workflows/checks.yml`         | Frontend and cross-platform native CI                               |
| `.github/copilot-instructions.md`      | Concise repository constraints supplied to GitHub Copilot           |
| `.run/*.run.xml`                       | Shared IntelliJ IDEA/RustRover development and check configurations |
| `.prettierignore`                      | Formatter exclusions                                                |
| `.gitignore` / `src-tauri/.gitignore`  | Generated and private-data exclusions                               |
| `.vscode/extensions.json`              | Recommended editor extensions                                       |

## Common change paths

| Goal                               | Start here                            | Usually also inspect                                                             |
| ---------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| Change resume fields or limits     | `src/model.ts`                        | `src-tauri/src/lib.rs`, editor, preview, PDF, tests, backup compatibility        |
| Change autosave or recovery        | `src/useWorkspace.ts`                 | `src/platform.ts`, `App.tsx`, frontend and E2E tests                             |
| Change desktop storage or exports  | `src-tauri/src/lib.rs`                | `src/platform.ts`, Tauri capabilities/config, native tests                       |
| Change browser preview behavior    | `src/platform.ts`                     | `App.tsx`, Playwright tests, README privacy/storage text                         |
| Change AI prompt or proposal shape | `src-tauri/src/lib.rs`                | `src/model.ts`, `platform.ts`, relevant guidance/panel, native/frontend tests    |
| Change editing UI                  | `src/components/Editor.tsx`           | `HighlightGuidance.tsx`, `App.tsx`, preview/PDF, accessibility and browser tests |
| Change visual templates            | `StylePanel.tsx`, `ResumePreview.tsx` | `ResumeDocument.tsx`, `App.css`, PDF E2E coverage                                |
| Add a Tauri command                | `src-tauri/src/lib.rs`                | `src/platform.ts`, capabilities, contract tests, architecture docs               |
| Add a dependency or command        | Relevant manifest                     | lockfile, CI workflow, README development steps                                  |

# Hireloom Code Map

This map answers "where does this behavior live?" Production `.ts`, `.tsx`,
`.rs`, and `.css` modules aim to stay near or under ~20 KB along natural domain
boundaries (as a pragmatic guideline, not a hard cap) so single `view` reads
rarely truncate. For architectural reasoning and trust boundaries, see
[`ARCHITECTURE.md`](ARCHITECTURE.md). Keep this file current when files or
responsibilities change.

## Runtime entry points

| Location                | Responsibility                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `index.html`            | Browser/Tauri webview HTML shell and application metadata                                                      |
| `src/main.tsx`          | React root and Strict Mode entry point                                                                         |
| `src/App.tsx`           | Top-level studio shell orchestration, document/history state, Career Library wiring, and hook/pane composition |
| `src-tauri/src/main.rs` | Native binary entry point; delegates to `hireloom_lib::run`                                                    |
| `src-tauri/src/lib.rs`  | Tauri application builder, managed state, IPC command handlers, and module wiring                              |

## Frontend domain, hooks, and document I/O

| Location                            | Responsibility                                                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/model.ts`                      | Public domain barrel re-exporting all schemas, types, helpers, and builders from `src/model/*`                          |
| `src/model/schemas.ts`              | Zod Workspace v2 persistence schemas, v1→v2 upgrade, limits, resume/entry factories, and sample resume                  |
| `src/model/ai.ts`                   | AI provider settings/status, whole-resume & single-role proposals, APR review/refinement schemas, and target validators |
| `src/model/library.ts`              | Master Career Library schemas, resume-to-library item synchronization, and tailored variant builder                     |
| `src/model/analysis.ts`             | Keyword triage helpers, URL normalization, page-count estimation, exact PDF page counting, and filenames                |
| `src/keywords.ts`                   | Curated + dynamic job-description keyword extraction and phrase-boundary matching across all resume sections            |
| `src/audit.ts`                      | Deterministic local resume quality checks across Completeness, Impact & Verbs, Formatting & Length, and Role Alignment  |
| `src/diff.ts`                       | Bounded LCS word-level diffing for inline review of AI rewrites and variant comparison                                  |
| `src/uiPreferences.ts`              | Validated `localStorage` persistence (`hireloom.ui-prefs.v1`) for theme, split width, zoom, and sidebar preferences     |
| `src/useWorkspace.ts`               | Initial load (with v1 upgrade), identity-cached dirty checks, serialized debounced autosave, and close protection       |
| `src/hooks/useStudioAiWorkflows.ts` | Studio AI provider status/settings/keys, cancellable rewrite/APR workflows, and selective proposal application          |
| `src/hooks/useResumeDocumentIo.ts`  | Lazy-loaded PDF/DOCX/JSON backup export and JSON/PDF/DOCX import (+ cancellable AI cleanup) workflow hook               |
| `src/platform.ts`                   | Runtime adapter: validated Tauri IPC (including `cancel_ai_request`) on desktop and isolated `localStorage` in browser  |
| `src/ResumeDocument.tsx`            | Lazy-loaded React PDF document, embedded fonts, external `http(s)` links, A4/US Letter & density pagination             |
| `src/docxExport.ts`                 | Lazy-loaded local single-column OpenXML (`.docx`) document, hyperlink relationship, & style builder                     |
| `src/docx/zipArchive.ts`            | OpenXML run/hyperlink/paragraph XML serializers, `_rels/document.xml.rels`, XML sanitization, and local ZIP writer      |
| `src/resumeImport.ts`               | Lazy-loaded PDF/DOCX resume import orchestrator and optional AI-assisted section mapping redactor/merger                |
| `src/import/extractText.ts`         | Local `.pdf` (`pdfjs-dist` `'self'` worker) and `.docx` (bounded ZIP/XML) line extraction                               |
| `src/import/parseSections.ts`       | Deterministic resume section heading detection, contact/URL extraction, and heuristic draft parser                      |
| `src/vite-env.d.ts`                 | Vite client type declarations                                                                                           |

## Frontend components and styles

| Location                                              | Responsibility                                                                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/studio/StudioShellChrome.tsx`         | Collapsible studio navigation rail, dismissible AI promo, non-studio topbar, notices, and loading/fatal states                    |
| `src/components/studio/StudioDocumentToolbar.tsx`     | Document title, autosave/privacy badges, theme toggle, undo/redo, PDF/DOCX export, and overflow menu                              |
| `src/components/studio/StudioEditPane.tsx`            | Studio tablist (`Content`, `Tailor & Coach`, `Design`), active AI cancel strip, and license footer                                |
| `src/components/studio/StudioPreviewPane.tsx`         | Preview mode switcher (`Live sheet`, `PDF proof`, `Compare`), zoom controls, and Quality Checks bar                               |
| `src/components/studio/VariantCompareView.tsx`        | Word-level diff sheet comparing the active resume against the Master Career Library or another variant                            |
| `src/components/studio/ResumeLibraryView.tsx`         | "My resumes" document management grid (create, open, duplicate, delete, import, backup)                                           |
| `src/components/studio/StudioDialogs.tsx`             | Accessible modal dialogs for confirmed resume deletion, PDF/DOCX import review, and font license display                          |
| `src/components/CareerLibraryView.tsx`                | Master Career Library view and interactive tailored-resume variant builder                                                        |
| `src/components/studio/CareerLibrarySectionCards.tsx` | Career Library canonical item cards for Experience, Projects, Education, Certifications, and Skill Groups                         |
| `src/components/Editor.tsx`                           | Top-level resume content editor (personal details, summary, section focus jumps, section composition)                             |
| `src/components/editor/FieldPrimitives.tsx`           | Shared accessible `Field`, `MonthYearPicker`, `BulletListEditor`, and `MoveButtons` controls                                      |
| `src/components/editor/ExperienceSection.tsx`         | Collapsible Experience cards with inline APR coaching and Career Library sync                                                     |
| `src/components/editor/ProjectsSection.tsx`           | Collapsible Projects cards with inline APR coaching and Career Library sync                                                       |
| `src/components/editor/CredentialsSections.tsx`       | Collapsible Education and Certifications editor sections                                                                          |
| `src/components/editor/SkillsAndCustomSections.tsx`   | Categorized Skill Groups, interactive flat skill chips, and user-defined Custom Sections                                          |
| `src/components/CopilotPanel.tsx`                     | AI studio panel orchestrating provider settings, rewrite consent, keyword triage, proposals, and APR                              |
| `src/components/copilot/ProposalPrimitives.tsx`       | Shared `WordDiffText` and `GroundingBadge` review primitives                                                                      |
| `src/components/copilot/ProviderConnectionCard.tsx`   | Collapsible AI provider/model/verifier settings, live provider model refresh, OS credential key controls, and Copilot CLI sign-in |
| `src/components/copilot/KeywordTriageCard.tsx`        | Interactive job-description keyword chips (`Add skill`, `Skip`, `Restore`)                                                        |
| `src/components/copilot/RewriteProposalsSection.tsx`  | Whole-resume and single-role selective proposal cards with per-item `Include` / `Keep original` toggles                           |
| `src/components/copilot/AprCoachingSection.tsx`       | APR accomplishment target picker, rubric feedback, Q&A inputs, and initial/refined rewrite comparison                             |
| `src/components/ResumePreview.tsx`                    | Live on-screen resume preview honoring section order, page size, density, and measured page-break markers                         |
| `src/components/StylePanel.tsx`                       | Template, accent, page-size (`A4` / `US Letter`), spacing density, and section-order controls                                     |
| `src/App.css`                                         | CSS entry sheet importing the five focused stylesheets under `src/styles/`                                                        |
| `src/styles/base-and-editor.css`                      | Core tokens, studio shell baseline, buttons, form controls, and editor card styles                                                |
| `src/styles/preview-and-copilot.css`                  | Resume paper preview, templates, Tailor & Coach panel, APR cards, and style-picker styles                                         |
| `src/styles/library-and-v2.css`                       | Resume library, quality checks, word diffs, skill groups, Career Library, and import dialog styles                                |
| `src/styles/theme-and-ai.css`                         | 100dvh studio viewport, WCAG 2.2 AA light/dark theme tokens, split-pane resizer, and AI provider UI                               |
| `src/styles/studio-modes.css`                         | Tailor & Coach sub-views, active AI cancel banner, PDF page proof stage, and variant diff comparison styles                       |

## Native backend

`src-tauri/src/` is organized into focused domain modules wired by `lib.rs`:

| Location                           | Responsibility                                                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src-tauri/src/lib.rs`             | Tauri builder, `CopilotOperationLock`, `AiCancelFlag` (`cancel_ai_request`), IPC commands, and close/exit routing                                  |
| `src-tauri/src/contract.rs`        | Serde workspace/resume/Career Library/AI/APR/import DTOs, `AI_CANCELLED_MESSAGE`, v1→v2 upgrade types, and size/count constants                    |
| `src-tauri/src/validation.rs`      | Strict workspace, resume, Career Library, AI proposal, APR target/question/answer, and export byte validators                                      |
| `src-tauri/src/storage.rs`         | App-data `workspace.json` & `ai-settings.json` paths, v1→v2 load parsing, atomic temp-file writes, and owner-only permissions                      |
| `src-tauri/src/copilot.rs`         | Isolated Copilot CLI paths, JSONC config enforcement, allowlisted env/args, ACP model discovery, cancellable process runner, and JSON event parser |
| `src-tauri/src/providers.rs`       | `ProviderKind`, `AiSettings`, OS keyring `CredentialStore`, API-key resolution, and model/endpoint URL validation                                  |
| `src-tauri/src/provider_http.rs`   | Shared cancellable HTTP completion and `/models` discovery client for OpenAI, Anthropic, Google Gemini, and Ollama endpoints                       |
| `src-tauri/src/prompts.rs`         | Redacted, delimited untrusted prompt builders for whole-resume, single-role, APR, grounding verifier, and import mapping                           |
| `src-tauri/src/responses.rs`       | Strict JSON parsers/normalizers for whole-resume, single-role, grounding verification, and resume import responses                                 |
| `src-tauri/src/apr_responses.rs`   | Strict JSON parsers, unchanged-rewrite normalizers, and target/answer echo binders for APR analysis and refinement                                 |
| `src-tauri/src/workflows.rs`       | Provider dispatch (`dispatch_ai_prompt`) and end-to-end native AI + optional grounding-verifier orchestration                                      |
| `src-tauri/src/tests_workspace.rs` | Native unit tests for v2 validation, v1 migration, Career Library invariants, atomic saves, and PDF/DOCX export headers                            |
| `src-tauri/src/tests_ai.rs`        | Native unit tests for Copilot CLI isolation, prompt PII/URL redaction, APR/refinement binding, timeouts, and error handling                        |
| `src-tauri/src/tests_providers.rs` | Native unit tests for multi-provider HTTP adapters, keyring storage, endpoint validation, grounding verifier, and import assist                    |

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

| Location                                          | Coverage                                                                                                                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/model.test.ts`                               | Workspace v2 validation, v1→v2 migration, Career Library sync/variants, selective AI proposals, APR analysis/refinement contract, dynamic keywords, quality audit, word diffs, DOCX round-trip, and filenames                       |
| `src/App.test.tsx`                                | Load/save failures, serialized saves, separate AI consent, selective proposal/APR/refinement review, inline APR launch, keyword triage, quality checks, Career Library variants, staleness, and AI errors                           |
| `src/test/setup.ts`                               | Vitest DOM setup and cleanup                                                                                                                                                                                                        |
| `src-tauri/src/tests_{workspace,ai,providers}.rs` | Native validation, migration, atomic writes, isolated Copilot CLI, HTTP provider adapters, grounding verification, prompt redaction, and process bounds                                                                             |
| `e2e/studio.spec.ts`                              | Browser editing, persistence, Projects/Categorized Skills/US Letter/Compact density, DOCX & PDF export, local PDF/DOCX resume import, `@axe-core/playwright` WCAG 2.2 AA scans, ATS PDF reading order, corrupt data, and pagination |

## Tooling and automation

| Location                               | Responsibility                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `package.json` / `package-lock.json`   | JavaScript dependencies, full verification commands, and low-noise `check:fast` / `*:quiet` runs |
| `vite.config.ts`                       | React/Vite build and fixed Tauri development server                                              |
| `vitest.config.ts`                     | Frontend unit/component test configuration                                                       |
| `playwright.config.ts`                 | Chromium/WebKit browser tests and local Vite server                                              |
| `tsconfig.json` / `tsconfig.node.json` | Strict application and tooling TypeScript configuration                                          |
| `.github/workflows/checks.yml`         | Frontend and cross-platform native CI                                                            |
| `PRODUCT.md`                           | Product vision, personas, positioning, core journeys, capabilities, and non-goals                |
| `.github/copilot-instructions.md`      | Concise repository invariant summary aligned with `AGENTS.md`                                    |
| `.run/*.run.xml`                       | Shared IntelliJ IDEA/RustRover development and check configurations                              |
| `.ignore`                              | Ripgrep/code-search exclusions for lockfiles, build outputs, binary fonts, and icons             |
| `.prettierignore`                      | Formatter exclusions                                                                             |
| `.gitignore` / `src-tauri/.gitignore`  | Generated and private-data exclusions                                                            |
| `.vscode/extensions.json`              | Recommended editor extensions                                                                    |

## Common change paths

| Goal                               | Start here                                                | Usually also inspect                                                               |
| ---------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Change resume fields or limits     | `src/model/schemas.ts`                                    | `src-tauri/src/{contract,validation}.rs`, editor section, preview, PDF/DOCX, tests |
| Change Career Library or variants  | `src/model/library.ts`, `CareerLibraryView.tsx`           | `CareerLibrarySectionCards.tsx`, `src-tauri/src/validation.rs`, tests              |
| Change autosave or recovery        | `src/useWorkspace.ts`                                     | `src/platform.ts`, `src/App.tsx`, frontend and E2E tests                           |
| Change desktop storage or exports  | `src-tauri/src/storage.rs`, `src-tauri/src/lib.rs`        | `src/platform.ts`, `src/hooks/useResumeDocumentIo.ts`, Tauri capabilities, tests   |
| Change PDF/DOCX import or export   | `src/import/*`, `src/docxExport.ts`, `ResumeDocument.tsx` | `src/docx/zipArchive.ts`, `src/hooks/useResumeDocumentIo.ts`, E2E tests            |
| Change browser preview behavior    | `src/platform.ts`                                         | `src/App.tsx`, Playwright tests, README privacy/storage text                       |
| Change AI prompt or proposal shape | `src-tauri/src/{prompts,responses,apr_responses}.rs`      | `src/model/ai.ts`, `useStudioAiWorkflows.ts`, `src/components/copilot/*`, tests    |
| Change AI providers or credentials | `src-tauri/src/{providers,provider_http,workflows}.rs`    | `ProviderConnectionCard.tsx`, `src/platform.ts`, `tests_providers.rs`              |
| Change editing UI                  | `src/components/Editor.tsx`, `src/components/editor/*`    | `StudioEditPane.tsx`, preview/PDF, accessibility and browser tests                 |
| Change visual templates or theme   | `StylePanel.tsx`, `ResumePreview.tsx`, `src/styles/*`     | `ResumeDocument.tsx`, `docxExport.ts`, PDF and axe E2E coverage                    |
| Add a Tauri command                | `src-tauri/src/lib.rs`                                    | `src/platform.ts`, capabilities, contract tests, architecture docs                 |
| Add a dependency or command        | Relevant manifest                                         | lockfile, CI workflow, README development steps                                    |

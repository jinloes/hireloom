# Hireloom Code Map

This map answers "where does this behavior live?" For architectural reasoning
and trust boundaries, see [`ARCHITECTURE.md`](ARCHITECTURE.md). Keep this file
current when files or responsibilities change. Entries are lists rather than
tables so the map stays compact for agents and diffs.

## Runtime entry points

- `index.html`: browser/Tauri webview HTML shell and application metadata.
- `src/main.tsx`: React root and Strict Mode entry point.
- `src/App.tsx`: top-level workspace composition; owns mode, library, notice,
  busy, undo, per-resume Content view, and item-removal state, and wires hooks
  to the shell components.
- `src-tauri/src/main.rs`: native binary entry point; delegates to
  `hireloom_lib::run`.
- `src-tauri/src/lib.rs`: module declarations, public contract re-exports, and
  `run` (managed state, plugins, command registration, exit routing).

## Frontend

State and domain logic:

- `src/model.ts`: Zod workspace persistence, whole-resume AI and transient APR/review
  option schemas, UTF-8 and target-binding validators, domain types, limits,
  factories, import validation, exact-target atomic one/two-bullet application,
  readiness, keyword matching, and filenames.
- `src/resumeExtensions.ts`: target-job and typed Projects, Certifications,
  Awards, Volunteer Experience, Publications, and Languages schemas, types,
  defaults, and explicit section order.
- `src/workspaceMigration.ts`: strict version-1 parsing and lossless migration
  into the version-2 workspace contract.
- `src/targetAudit.ts`: deterministic local audit findings and exact editor
  navigation targets.
- `src/useWorkspace.ts`: initial load, serialized debounced autosave,
  dirty/error state, retries, browser unload protection, and native close
  protection.
- `src/useHighlightGuidance.ts`: transient inline highlight guidance
  (analyze, refine, select, apply) and resume-wide highlight review state,
  target staleness, and the Editor guidance/review controllers.
- `src/useResumeGeneration.ts`: whole-resume proposal consent, request, stale
  guard, apply, and discard.
- `src/useWorkspaceTransfer.ts`: local PDF export plus workspace backup export
  and append-only import.
- `src/contentView.ts`: per-resume Content view reconciliation and pure
  item-removal/restore edits with focus targets for Undo.
- `src/platform.ts`: runtime adapter; validated Tauri IPC on desktop plus
  isolated `localStorage` and downloads in browser preview.

Shell components (`src/components/`):

- `Sidebar.tsx`: brand, new resume, studio/library navigation, recent
  documents, and local-status footer.
- `WorkspaceHeader.tsx`: top bar, notices, save-error recovery, and heading.
- `ResumeLibrary.tsx`: document grid with open, duplicate, delete, import, and
  backup actions.
- `DocumentToolbar.tsx`: resume title, save status, AI undo, document actions
  menu, and PDF export.
- `WorkspaceTabs.tsx`: top-level Content/Copilot/Design/Preview tablist with
  roving keyboard focus.
- `PreviewPanel.tsx`: live preview toolbar, scroll surface, and readiness bar.
- `Dialogs.tsx`: font license and delete confirmation dialogs.

Content editing (`src/components/`):

- `Editor.tsx`: public Editor API and accessible Content section tabs;
  composes `editor/` sections and handles focus targets.
- `editor/PersonalSection.tsx`, `SummarySection.tsx`, `EducationSection.tsx`,
  `SkillsSection.tsx`: per-section fields.
- `editor/AdditionalSection.tsx`: typed optional-section editing plus entry and
  section reordering.
- `editor/ExperienceSection.tsx`: Experience summary rail with top/end
  insertion and selection.
- `editor/ExperienceEditor.tsx`: selected experience fields, highlight list,
  reordering, removal requests, guidance placement, and review badges.
- `editor/HighlightReviewAction.tsx`: consented resume-wide highlight review
  control and status.
- `editor/fields.tsx`: shared `Field`, month/year pickers, and entry controls.
- `editor/helpers.ts`: pure date, title, reorder, and factory helpers.
- `editor/types.ts`: shared editor and review controller types.
- `HighlightGuidance.tsx`: bounded per-highlight disclosure, per-request
  consent, weak review-status disclosure, factual dimensions, direct rewrite
  options, freeform refinement feedback, accessible selection, and apply or keep
  controls.

Other UI:

- `src/components/CopilotPanel.tsx`: target-job metadata, CLI status/login
  controls, per-request consent, local keyword overlap, and whole-resume
  proposal review.
- `src/components/TargetAudit.tsx`: explainable local findings and direct
  navigation actions.
- `src/components/ResumePreview.tsx`: continuous on-screen resume preview.
- `src/components/StylePanel.tsx`: template and accent selection.
- `src/ResumeDocument.tsx`: lazy-loaded React PDF document, embedded font
  registration, pagination, and PDF blob creation.
- `src/App.css`: ordered `@import` entry point for `src/styles/`: `base`
  (fonts, tokens, resets), `shell`, `studio`, `editor`, `preview`, `notices`,
  `copilot`, `guidance`, `style-panel`, `library`, `dialogs`, and trailing
  `responsive` rules. Keep the import order; cascade depends on it.
- `src/vite-env.d.ts`: Vite client type declarations.

## Native backend (`src-tauri/src/`)

Each module is kept under about 20 KB and holds its own `#[cfg(test)]` tests.

- `contract.rs`: the Rust half of the persistence/IPC contract. `Resume`,
  `Workspace`, `AiProposal`, APR target/analysis/option and highlight review
  DTOs, enums, `CommandResult`, size/count limits, timeouts, and the
  `GENERATE_RESUME_MODEL` / `INLINE_APR_MODEL` routes.
- `commands.rs`: `AppState` locks and every `#[tauri::command]`
  (`load_workspace`, `save_workspace`, `export_document`, `copilot_status`,
  `copilot_login`, `generate_resume`, `analyze_accomplishment`,
  `refine_accomplishment`, `review_highlights`) plus `ensure_consent`.
- `persistence.rs`: `workspace_path`, version-1 migration,
  `load_workspace_from_path`, `serialize_valid_workspace`, restricted
  directories, `write_atomic`, and platform-specific `replace_path`.
- `validation.rs`: workspace, resume, text, date, AI request target
  (`validate_apr_target`, `validate_apr_review`,
  `validate_highlight_review_targets`), and export validators.
- `ai/mod.rs`: `*_with_copilot` request orchestration, model routing, and local
  target binding (`bind_highlight_reviews`); hosts the model-routing test.
- `ai/prompts.rs`: whole-resume, APR analysis, APR refinement, and highlight
  review prompt builders with contact redaction and untrusted-data framing.
- `ai/responses.rs`: strict parsing and validation of Copilot proposals, APR
  analyses/options, and highlight reviews.
- `copilot/cli.rs`: CLI discovery, `probe_copilot`, `login_to_copilot`, and
  direct status/login command isolation.
- `copilot/profile.rs`: `CopilotPaths`, `copilot_paths`, isolated profile
  config (`ensure_copilot_config`), and JSONC parsing.
- `copilot/sdk.rs`: `run_copilot_prompt`, locked-down SDK client/session
  configuration, session lifecycle, typed event validation, and final-response
  extraction.
- `process.rs`: `run_process`, capped output readers, timeouts, and error
  summarization for direct CLI subprocesses.
- `test_support.rs`: test-only fixtures (`sample_resume`, `sample_workspace`,
  APR targets, `test_directory`, Unix `fake_executable`).

Related native configuration:

- `src-tauri/tauri.conf.json`: product metadata, window defaults, build hooks,
  CSP, and bundle targets.
- `src-tauri/capabilities/default.json`: minimal main-window permissions.
- `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock`: crate metadata and locked
  dependencies.
- `src-tauri/build.rs`: Tauri build integration.
- `src-tauri/icons/`: desktop bundle icons.

## Assets

- `src/assets/fonts/NotoSans-*.ttf` / `NotoSerif-*.ttf`: bundled PDF fonts.
- `src/assets/fonts/OFL.txt`: SIL Open Font License displayed in-app.
- `public/hireloom.svg`: application logo and browser icon.

## Tests

- `src/model.test.ts`: workspace validation, whole-resume and APR option
  contracts, UTF-8 limits, batch highlight review target binding, atomic
  one/two-bullet application invariants, readiness, keywords, and filenames.
- `src/targetAudit.test.ts`: deterministic audit setup, evidence, alignment,
  URL, and chronology findings.
- `src/App.<area>.test.tsx`: React workflows against the rendered App with a
  mocked platform. `workspace` (tab semantics/focus, Preview state, Experience
  selection, highlight reordering), `persistence` (load/save failures,
  serialized saves), `removal` (cross-mode item-removal recovery), `copilot`
  (whole-resume consent and AI errors), `guidance` (inline options, refinement,
  staleness, exact apply/keep/undo), and `review` (batch review consent gating,
  badges, and staleness).
- `src/test/appHarness.tsx`: shared App test fixtures and platform mock helpers;
  each test file keeps its own hoisted `vi.mock` calls.
- `src/test/setup.ts`: Vitest DOM setup and cleanup.
- Native `#[cfg(test)]` modules beside the code they cover: validation and
  consent (`validation.rs`, `commands.rs`), atomic writes (`persistence.rs`),
  isolated Copilot config (`copilot/profile.rs`), prompt boundaries
  (`ai/prompts.rs`), model routing (`ai/mod.rs`), locked-down SDK configuration
  and final-response bounds (`copilot/sdk.rs`), typed response validation
  (`ai/responses.rs`), and Unix-only subprocess isolation/errors
  (`copilot/cli.rs`, `process.rs`).
- `e2e/*.spec.ts`: Chromium/WebKit browser flows. `editing` (edit/save/reload,
  top/end insertion, legacy dates), `navigation` (exact-size and
  zoom-equivalent tabs, panel geometry, scroll preservation, Experience
  master-detail), `removal-undo`, `documents` (example, design, backups,
  duplicate/delete, corrupt data, malformed imports), `pdf` (ATS-relevant
  order/content, pagination), and `copilot-preview` (desktop-only highlight
  review negative control). Shared helpers live in `e2e/helpers.ts`.

## Tooling and automation

- `package.json` / `package-lock.json`: JavaScript dependencies and commands.
- `eslint.config.js`: ESLint flat config (`@eslint/js`, `typescript-eslint`,
  React Hooks, React Refresh, `eslint-config-prettier`).
- `.prettierrc.json`: Prettier defaults marker for editors.
- `.husky/pre-commit` and the `lint-staged` block in `package.json`: pre-commit
  ESLint fixes, Prettier, and rustfmt for staged files.
- `.editorconfig`: editor defaults aligned with Prettier and rustfmt.
- `src-tauri/rustfmt.toml`: default rustfmt style with the crate edition.
- `vite.config.ts`: React/Vite build and fixed Tauri development server.
- `vitest.config.ts`: frontend unit/component test configuration.
- `playwright.config.ts`: Chromium/WebKit browser tests and local Vite server.
- `tsconfig.json` / `tsconfig.node.json`: strict TypeScript configuration.
- `.github/workflows/checks.yml`: frontend and cross-platform native CI.
- `.github/copilot-instructions.md`: concise repository constraints supplied to
  GitHub Copilot.
- `.run/*.run.xml`: shared IntelliJ IDEA/RustRover run configurations.
- `.prettierignore`, `.gitignore`, `src-tauri/.gitignore`: formatter,
  generated, and private-data exclusions.
- `.vscode/extensions.json`: recommended editor extensions.

## Common change paths

- Resume fields or limits: `src/model.ts`, then `contract.rs`, `validation.rs`,
  editor, preview, PDF, tests, and backup compatibility.
- Autosave or recovery: `src/useWorkspace.ts`, then `src/platform.ts`,
  `App.tsx`, frontend and E2E tests.
- Item removal or Undo: `src/contentView.ts`, then `App.tsx` and the removal
  tests.
- Desktop storage or exports: `persistence.rs` and `commands.rs`, then
  `src/platform.ts`, Tauri capabilities/config, and native tests.
- Browser preview behavior: `src/platform.ts`, then `App.tsx`, Playwright tests,
  and README privacy/storage text.
- AI prompt or proposal shape: `ai/prompts.rs` and `ai/responses.rs`, then
  `contract.rs`, `src/model.ts`, `platform.ts`, the relevant guidance/panel, and
  native/frontend tests.
- Copilot process isolation: `copilot/`, then `process.rs` and ARCHITECTURE's
  Copilot boundary.
- Editing UI: the owning `src/components/editor/` section, then `Editor.tsx`,
  `HighlightGuidance.tsx`, `useHighlightGuidance.ts`, preview/PDF,
  accessibility and browser tests.
- Workspace shell or document actions: the shell component, then `App.tsx`,
  `useWorkspaceTransfer.ts`, and App/E2E tests.
- Visual templates: `StylePanel.tsx`, `ResumePreview.tsx`, then
  `ResumeDocument.tsx`, `src/styles/`, and PDF E2E coverage.
- New Tauri command: `commands.rs` and `lib.rs` registration, then
  `src/platform.ts`, capabilities, contract tests, and architecture docs.
- New dependency or command: the relevant manifest, lockfile, CI workflow, and
  README development steps.

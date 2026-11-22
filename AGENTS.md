# Hireloom Agent Guide

This file is the repository-level operating guide for coding agents and
contributors. It applies to the entire repository. More specific `AGENTS.md`
files may be added later for subdirectories; the closest file wins.

## Start here

Navigate selectively so context stays focused on the task at hand:

1. Read [`CODE_MAP.md`](CODE_MAP.md) first to jump straight to the narrowest
   owning `<20 KB` module and its paired tests.
2. Read [`ARCHITECTURE.md`](ARCHITECTURE.md) when changing boundaries, IPC or
   persistence contracts, trust boundaries, AI isolation, or data flows.
3. Read [`PRODUCT.md`](PRODUCT.md) when changing user-facing capabilities,
   personas, journeys, UX principles, or checking explicit non-goals.
4. Read [`README.md`](README.md) when changing setup, commands, privacy/storage
   disclosures, or supported platforms.

Do not read all top-level documents upfront for routine, localized code changes,
but always verify affected documents under the
[Documentation maintenance contract](#documentation-maintenance-contract) before
finishing.

## Context-window efficiency

Follow these rules to work effectively within a ~264k token context window:

- **Keep production source and style files under 20 KB (~500 lines).** File
  `view` tools truncate around 20 KB (`20,480` bytes). Every non-test `.ts`,
  `.tsx`, `.rs`, and `.css` file is intentionally kept `<20 KB` so a single
  `view` reads the complete module without truncation or multi-range pagination.
  Split growing modules by domain, hook, or subcomponent before they cross
  ~20 KB rather than re-accumulating monoliths.
- **Use `grep -n` + `view_range` on large test files.** Integration and E2E
  suites (`src/App.test.tsx`, `src/model.test.ts`, `e2e/studio.spec.ts`)
  can exceed 20 KB; locate relevant `it(...)` / `test(...)` blocks with `grep`
  and read bounded line ranges instead of loading entire test files.
- **Always scope `glob` and `grep` queries.** Some `glob` tools ignore
  `.gitignore`/`.ignore` (an unscoped `**/*` enumerates `node_modules` and
  `src-tauri/target`), whereas ripgrep (`grep`) honors `.ignore`. Scope file
  searches to `src/**`, `src-tauri/src/**`, or `e2e/**`, and pass narrow path or
  glob filters to `grep`.
- **Use quiet, targeted checks while iterating.** During edit-verify loops, run
  focused selectors (`npx vitest run src/model.test.ts --reporter=dot`,
  `cargo test -q --manifest-path src-tauri/Cargo.toml <test_name>`) or
  `npm run check:fast` (`tsc --noEmit` + dot-reporter Vitest + `cargo test -q`)
  instead of verbose full builds after every edit. Run the full required checks
  for the touched surface once implementation is ready.
- **Batch independent tool calls.** Combine independent `view`, `grep`, and
  `edit` calls into a single parallel turn rather than sequential turns.
- **Keep `.github/copilot-instructions.md` concise and non-redundant.** Both
  `.github/copilot-instructions.md` and `AGENTS.md` may be injected into agent
  context automatically. Keep `.github/copilot-instructions.md` as a compact
  invariant summary aligned with this file rather than duplicating detailed
  workflows across both files.

## Non-negotiable product constraints

- Keep resume data local. Do not add analytics, remote fonts, cloud persistence,
  or background uploads.
- Treat the browser build as an explicitly labeled preview with independent
  browser-local storage and no Copilot connection.
- Require explicit consent for every AI request. Exclude dedicated contact
  fields, treat all user and job-description text as untrusted, and require
  review before applying a proposal.
- Never let AI invent work history, employers, dates, qualifications,
  responsibilities, achievements, or metrics.
- Keep the Copilot child process isolated. Do not give it tools, shell access,
  ambient project context, hooks, custom instructions, built-in MCP servers, or
  the developer's normal Copilot home.
- Keep the TypeScript schemas in `src/model/` (re-exported via `src/model.ts`)
  and the Rust types and validators in `src-tauri/src/contract.rs` and
  `src-tauri/src/validation.rs` aligned. They are the persistence and IPC
  contract.
- Reject malformed, oversized, unsupported, or mismatched data with a visible
  error. Never replace a corrupt workspace with an empty one.
- Generate PDFs and DOCX files locally as selectable, single-column text. Bundle
  fonts and licenses; do not reference remote font URLs.
- Preserve labeled controls, keyboard navigation, visible focus, reduced-motion
  support, and meaningful live status or alert messages.
- Do not broaden `src-tauri/capabilities/default.json` or the CSP without a
  documented, narrowly justified requirement.
- Do not commit resumes, exports, tokens, app data, generated bundles, test
  artifacts, or other personal data.

## Change workflow

1. Use [`CODE_MAP.md`](CODE_MAP.md) to identify the narrowest owning `<20 KB`
   module and read it directly.
2. Preserve the frontend/native contract when changing persisted or IPC data.
3. Add or update the smallest relevant test for behavior changes, iterating with
   targeted tests or `npm run check:fast`.
4. Before finishing, run the required checks for the changed surface:

| Change                                                                 | Required checks                                                                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| TypeScript, React, schemas, or browser behavior                        | `npm test` and `npm run build`                                                                 |
| Browser user flows or PDF/DOCX import and export behavior              | `npm run test:e2e`                                                                             |
| Rust, Tauri commands, persistence, export, or Copilot process behavior | `cargo test --manifest-path src-tauri/Cargo.toml`                                              |
| Rust quality or capability changes                                     | `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`                             |
| Formatting-sensitive changes                                           | `npm run format:check` and, for Rust, `cargo fmt --manifest-path src-tauri/Cargo.toml --check` |

Automated tests must not authenticate with Copilot or make live Copilot
requests. Native Copilot tests use fake executables.

## Documentation maintenance contract

Documentation is part of every code change, not a follow-up task. Before
finishing a change, inspect all five documents below and update every one whose
statements are affected:

| Document          | Update when                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`       | Setup, commands, user-visible behavior, privacy, storage, limitations, dependencies, or supported platforms change                     |
| `PRODUCT.md`      | Product vision, target personas, competitive positioning, core user journeys, shipped capabilities, UX principles, or non-goals change |
| `ARCHITECTURE.md` | A boundary, data flow, trust boundary, persistence or IPC contract, major dependency, invariant, or deployment shape changes           |
| `CODE_MAP.md`     | Files, directories, entry points, commands, tests, generated artifacts, or module responsibilities change                              |
| `AGENTS.md`       | Contributor workflow, required checks, repository-wide constraints, or documentation rules change                                      |

Also keep `.github/copilot-instructions.md` consistent with `AGENTS.md`.
Unchanged documentation is acceptable only after confirming the code change
does not alter what that document says. Code changes are incomplete while
affected documentation is stale.

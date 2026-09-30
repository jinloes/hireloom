# Hireloom Agent Guide

This file is the repository-level operating guide for coding agents and
contributors. It applies to the entire repository. More specific `AGENTS.md`
files may be added later for subdirectories; the closest file wins.

## Start here

Before changing code, orient in this order:

1. [`CODE_MAP.md`](CODE_MAP.md) for file ownership and where changes belong.
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) for boundaries, data flows, and design
   constraints; read at least the sections for every boundary you cross.
3. [`README.md`](README.md) for product behavior, setup, and supported features;
   its GitHub Copilot section is the source of truth for AI feature behavior.

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
- Keep the TypeScript schemas in `src/model.ts` and the Rust types in
  `src-tauri/src/contract.rs` and validators in `src-tauri/src/validation.rs`
  aligned. They are the persistence and IPC contract.
- Reject malformed, oversized, unsupported, or mismatched data with a visible
  error. Never replace a corrupt workspace with an empty one.
- Generate PDFs locally as selectable, single-column text. Bundle fonts and
  licenses; do not reference remote font URLs.
- Preserve labeled controls, keyboard navigation, visible focus, reduced-motion
  support, and meaningful live status or alert messages.
- Do not broaden `src-tauri/capabilities/default.json` or the CSP without a
  documented, narrowly justified requirement.
- Do not commit resumes, exports, tokens, app data, generated bundles, test
  artifacts, or other personal data.

## Change workflow

1. Use the code map to identify the narrowest owning module.
2. Preserve the frontend/native contract when changing persisted or IPC data.
3. Add or update the smallest relevant test for behavior changes.
4. After all code changes are done, run `npm run format:all` (ESLint fixes,
   Prettier, rustfmt), then run the relevant checks:

- TypeScript, React, schemas, or browser behavior: `npm test`,
  `npm run lint`, and `npm run build`.
- Browser user flows or PDF export behavior: `npm run test:e2e`.
- Rust, Tauri commands, persistence, export, or Copilot process behavior:
  `cargo test --manifest-path src-tauri/Cargo.toml`.
- Rust quality or capability changes:
  `npm run clippy:rust` (all targets, warnings denied).
  CI also runs clippy on Windows, so gate Unix-only imports and tests with
  `#[cfg(unix)]`.
- Formatting: `npm run format:check` and, for Rust, `npm run format:rust:check`.
  Use the standard tools with default settings (Prettier, ESLint, rustfmt,
  Clippy); fix code rather than disabling rules, and scope any justified
  exception narrowly in `eslint.config.js` with a reason. A husky pre-commit
  hook runs lint-staged (ESLint fixes and Prettier for staged web files,
  rustfmt for staged Rust files); do not bypass it with `--no-verify`.

Automated tests must not authenticate with Copilot or make live Copilot
requests. Native Copilot tests use SDK configuration/event fixtures and fake
executables for direct status/login subprocess behavior.

## Keep files agent-readable

Agent file reads truncate around 20 KB. Keep new or edited source and
documentation files under that size by splitting along responsibility (as in
`src-tauri/src/`) rather than letting one file absorb a feature. In docs, prefer
lists to wide Markdown tables, which Prettier pads heavily, and link to the
owning document instead of repeating detail.

## Documentation maintenance contract

Documentation is part of every code change, not a follow-up task. Before
finishing a change, inspect all four documents below and update every one whose
statements are affected:

- `README.md`: setup, commands, user-visible behavior, privacy, storage,
  limitations, dependencies, or supported platforms change.
- `ARCHITECTURE.md`: a boundary, data flow, trust boundary, persistence or IPC
  contract, major dependency, invariant, or deployment shape changes.
- `CODE_MAP.md`: files, directories, entry points, commands, tests, generated
  artifacts, or module responsibilities change.
- `AGENTS.md`: contributor workflow, required checks, repository-wide
  constraints, or documentation rules change.

Also keep `.github/copilot-instructions.md` consistent with `AGENTS.md`.
Unchanged documentation is acceptable only after confirming the code change
does not alter what that document says. Code changes are incomplete while
affected documentation is stale.

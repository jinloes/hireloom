# Hireloom Agent Guide

This file is the repository-level operating guide for coding agents and
contributors. It applies to the entire repository. More specific `AGENTS.md`
files may be added later for subdirectories; the closest file wins.

## Start here

Read these documents before changing code:

1. [`README.md`](README.md) for product behavior, setup, and supported features.
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) for boundaries, data flows, and design
   constraints.
3. [`CODE_MAP.md`](CODE_MAP.md) for file ownership and where changes belong.

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
- Keep the TypeScript schemas in `src/model.ts` and the Rust types and validators
  in `src-tauri/src/lib.rs` aligned. They are the persistence and IPC contract.
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
4. Run the relevant checks:

| Change                                                                 | Required checks                                                                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| TypeScript, React, schemas, or browser behavior                        | `npm test` and `npm run build`                                                                 |
| Browser user flows or PDF export behavior                              | `npm run test:e2e`                                                                             |
| Rust, Tauri commands, persistence, export, or Copilot process behavior | `cargo test --manifest-path src-tauri/Cargo.toml`                                              |
| Rust quality or capability changes                                     | `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`                             |
| Formatting-sensitive changes                                           | `npm run format:check` and, for Rust, `cargo fmt --manifest-path src-tauri/Cargo.toml --check` |

Automated tests must not authenticate with Copilot or make live Copilot
requests. Native Copilot tests use fake executables.

## Documentation maintenance contract

Documentation is part of every code change, not a follow-up task. Before
finishing a change, inspect all four documents below and update every one whose
statements are affected:

| Document          | Update when                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `README.md`       | Setup, commands, user-visible behavior, privacy, storage, limitations, dependencies, or supported platforms change           |
| `ARCHITECTURE.md` | A boundary, data flow, trust boundary, persistence or IPC contract, major dependency, invariant, or deployment shape changes |
| `CODE_MAP.md`     | Files, directories, entry points, commands, tests, generated artifacts, or module responsibilities change                    |
| `AGENTS.md`       | Contributor workflow, required checks, repository-wide constraints, or documentation rules change                            |

Also keep `.github/copilot-instructions.md` consistent with `AGENTS.md`.
Unchanged documentation is acceptable only after confirming the code change
does not alter what that document says. Code changes are incomplete while
affected documentation is stale.

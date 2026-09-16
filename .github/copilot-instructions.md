# Hireloom

Hireloom is a local-first Tauri 2 desktop resume studio, using React, TypeScript,
Vite, and a Rust backend. The frontend also runs in an explicitly labeled browser
preview with separate browser-local storage and no Copilot connection.

Read `AGENTS.md` before making changes. Use `CODE_MAP.md` to find ownership and
`ARCHITECTURE.md` for boundaries and data flows.

- Keep resume data local. Never add analytics, remote fonts, or automatic AI calls.
- AI requires explicit per-request consent. Exclude contact information from the
  prompt, treat job descriptions as untrusted data, and review suggestions before
  applying them. Never invent work history, qualifications, or metrics.
- Do not broaden Tauri permissions or give the Copilot subprocess tools, shell
  access, user project context, or ambient Copilot configuration.
- Use the schemas in `src/model.ts` and matching Rust types as the persistence and
  IPC contract. Validate imports and AI output; surface errors rather than
  replacing corrupt files with an empty workspace.
- Keep PDF output selectable text, locally generated, and single-column. Bundle
  font assets and their licenses; do not use remote font URLs.
- Preserve accessibility: labeled fields, keyboard navigation, visible focus,
  reduced-motion support, and meaningful live status messages.
- Run `npm test`, `npm run build`, and `cargo test --manifest-path
src-tauri/Cargo.toml` for relevant changes. Browser flows use `npm run test:e2e`.
- Do not commit resumes, exported documents, tokens, app data, or generated build
  artifacts. Do not make live Copilot calls as part of automated tests.
- Treat documentation as part of the change. Before finishing, update `README.md`,
  `ARCHITECTURE.md`, `CODE_MAP.md`, and `AGENTS.md` wherever the code change
  affects their setup, behavior, boundaries, file ownership, or workflow.

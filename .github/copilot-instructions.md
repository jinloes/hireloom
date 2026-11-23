# Hireloom

Hireloom is a local-first Tauri 2 desktop resume studio (React, TypeScript, Vite,
Rust) with an explicitly labeled browser preview using separate `localStorage`
and no desktop AI connection.

Follow [`AGENTS.md`](../AGENTS.md) for contributor workflow, context-efficiency
guidelines, required checks, and documentation rules. Start with
[`CODE_MAP.md`](../CODE_MAP.md) to locate the narrowest owning module; consult
[`ARCHITECTURE.md`](../ARCHITECTURE.md), [`PRODUCT.md`](../PRODUCT.md), and
[`README.md`](../README.md) selectively when boundaries, product scope, or
setup/privacy behavior are affected.

- **Context efficiency:** Treat ~20 KB as a pragmatic guideline (not a hard cap)
  for production `.ts`/`.tsx`/`.rs`/`.css` modules—split along natural domain or
  component seams, never at the expense of cohesion or clean design; scope
  `glob`/`grep` to `src/**`, `src-tauri/src/**`, or `e2e/**`; use `view_range`
  on larger files; iterate with targeted tests or `npm run check:fast` before
  full checks.
- **Privacy & AI safety:** Keep resume data local (no analytics, remote fonts,
  or automatic AI calls). Require explicit per-request consent, exclude contact
  fields from prompts, store cloud API keys only in the OS credential manager,
  treat user/job text as untrusted, never invent facts or metrics, and keep the
  Copilot CLI subprocess isolated without tools, shell, or project context.
- **Contracts & storage:** Keep `src/model/` (`src/model.ts`) and
  `src-tauri/src/{contract,validation}.rs` aligned. Reject malformed/corrupt
  data visibly rather than replacing it with an empty workspace.
- **Exports & UX:** Keep PDF/DOCX local, selectable, single-column text with
  bundled fonts/licenses; preserve WCAG 2.2 AA labels, keyboard navigation,
  focus, reduced motion, and live status messages.
- **Verification & hygiene:** Run required checks from `AGENTS.md` (`npm test`,
  `npm run build`, `cargo test --manifest-path src-tauri/Cargo.toml`, and
  `npm run test:e2e` for browser/import/export flows) with no live AI calls,
  never commit personal data or artifacts, and update affected docs before
  finishing.

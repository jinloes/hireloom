# Hireloom

**Your experience, beautifully told.**

A local-first desktop resume studio built with Tauri 2, React, TypeScript, and
Rust. Create a thoughtful resume for each opportunity, optionally connect your
preferred AI provider to refine wording without invented facts, and export a
clean PDF or Word document without a watermark.

## Start the desktop app

Prerequisites: Node.js 22.12+ (24 LTS recommended), npm, Rust stable, and the
[Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/).
macOS needs Xcode Command Line Tools; Windows needs the MSVC build tools and
WebView2; Linux needs WebKitGTK 4.1 and the other listed system packages.

```sh
npm install
npm run tauri dev
```

`npm run dev` starts a **browser preview** at `http://localhost:1420`. It has
separate browser-local storage, supports editing, local PDF/DOCX import and
downloads, PDF page proofing, and variant comparison, and cannot connect to
desktop AI providers. It does not read your desktop workspace.

## What's included

- Multiple resume documents with rename, duplicate, confirmed deletion, a local
  **Master Career Library** for spinning up role-tailored variants, and an
  in-studio **Compare** view showing word-level diffs against your Career
  Library or any other resume variant.
- Local **PDF and Word (`.docx`) resume import** into a reviewable draft before
  adding to your workspace—no cloud upload or automatic AI call (with optional
  consented PII-redacted AI section cleanup on desktop).
- Personal details including clickable portfolio/LinkedIn and GitHub URLs;
  summary; reorderable experience, **projects** (with clickable URLs),
  education, **certifications** (with clickable credential URLs),
  **categorized skill groups** (plus flat skills), **custom sections** (such as
  Volunteering or Awards), and configurable **section order**.
- A **Live sheet** preview with estimated page-break markers, an on-demand
  **PDF proof** mode rendering exact PDF pagination and page counts in-studio,
  **90% / 100% / 125% zoom**, click-to-jump section navigation, a collapsible
  navigation rail (`Ctrl/Cmd+\`), a resizable split-pane divider, persisted
  **light and dark studio themes** (while keeping the resume paper white),
  Editorial and Modern layouts, three accent colors, **A4 and US Letter** page
  sizes, and **Compact / Standard / Spacious** density controls.
- Collapsible editor cards, interactive removable skill chips, bounded
  multi-step **Undo / Redo** (`Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z`, including
  one-click recovery on deleted entries and AI rewrites), and local autosaving
  with visible failures, retries, and recovery backup export.
- Single-column, selectable-text **PDF** (with embedded fonts and live
  hyperlinks) and **Word (`.docx`)** (with live OpenXML hyperlinks) exports.
- Workspace v2 JSON backups with automatic v1 migration on load and validated,
  non-destructive imports.
- Dynamic job-description keyword extraction with **Add skill / Coach APR /
  Skip / Restore** triage, plus deterministic local **Resume Quality Checks**
  across Completeness, Impact & Verbs, Formatting & Length, and Role Alignment.
- A focused **Tailor & Coach** panel (`Role Tailoring`, `APR Bullet Coach`, and
  `Provider Setup`) supporting isolated **GitHub Copilot CLI**, **OpenAI**,
  **Anthropic**, **Google Gemini** (with OS keychain API key storage), and local
  **Ollama / OpenAI-compatible** endpoints, optional **2-model factual grounding
  verification**, instant request cancellation, explicit per-request consent,
  selective word-diff review, and APR accomplishment coaching.
- Repository instructions for GitHub Copilot in `.github/copilot-instructions.md`.

Start with your own details, **upload an existing PDF or DOCX resume**, or click
**try a fictional example**. The example candidate, organizations, and work
history are demonstration content, not claims about a real person. The app opens
to a blank resume and never uploads an example or your content automatically.

## AI providers and GitHub Copilot

Open **Tailor & Coach → Provider Setup** in the desktop app to choose your AI
provider:

- **GitHub Copilot CLI** (`npm install -g @github/copilot`, then **Sign in with
  GitHub** inside Hireloom),
- **OpenAI**, **Anthropic**, or **Google Gemini** (API keys stored in your OS
  credential manager or read from standard environment variables—never written
  to `workspace.json`), or
- **Local Ollama / OpenAI-compatible** endpoints (such as `http://127.0.0.1:11434/v1`).

You can also enable **2-model factual verification** to have a second model
audit proposed bullets against your current resume (`Supported`, `Inferred`, or
`Unsupported`), and cancel any in-flight AI request immediately without losing
unsaved edits.

Hireloom uses a separate, app-specific Copilot configuration directory, so sign
in through Hireloom even if you already use Copilot for development. It does not
store an API key in the frontend or bundle the CLI. The app invokes the CLI from
Rust without a shell, sends the prompt through stdin, disables model tools,
custom instructions, hooks, built-in MCP servers, and remote session sharing,
and uses a neutral working directory instead of your projects. The subprocess
retains your real OS home only so the CLI can use the system credential store;
Copilot, GitHub CLI, cache, temporary, and working files remain redirected to
Hireloom-owned directories. Whole-resume and APR requests are pinned to
`claude-sonnet-5.5` with task-calibrated reasoning effort (`medium` for APR
accomplishment analysis and `low` for answer-guided refinement and whole-resume
rewrites). If that model is unavailable to the
signed-in account or installed CLI, the request fails visibly instead of
silently switching models. Responses use the CLI's JSON event stream so quoted
feedback remains valid structured data. Hireloom also accepts the CLI's
commented JSON configuration format while preserving existing settings and
enforcing its isolation controls.

Add real experience, projects, or skills, optionally paste a job description,
and check the consent box for each request. Copilot proposes a summary and
experience/project highlights with inline word-level diffs and per-item
selection toggles; it does not modify employer names, project names, URLs,
dates, education, certifications, or skills.
**Review every claim before applying.** AI can still make mistakes or invent
details. Suggestions are never silently applied. CLI errors, expired login,
malformed output, and the three-minute timeout leave your resume unchanged.

The **Analyze accomplishments** section (and inline **Coach with APR** buttons
in the editor) reviews one nonempty experience or project bullet
at a time using the Yale Office of Career Strategy's Action + Project + Result
(APR) method. Action identifies your specific contribution, Project gives the
meaningful work or problem context, and Result describes supported impact
(quantified only when your facts support it). Each part is marked clear,
partial, or missing, with improvement feedback, an optional fact-preserving
rewrite, and up to five questions that can help you add missing factual detail.

Selecting **Analyze with APR** shows the exact bullet first. A separate,
initially unchecked consent is required for every analysis. Only that bullet
and its role text are sent; resume and experience IDs and the bullet position
remain local. Results are review-only and never apply automatically. A rewrite
can update only the selected bullet and uses the existing one-step AI undo. If
the role, bullet, position, experience, or active resume changes, the visible
result is marked stale and cannot be applied until it is analyzed again.

Each APR question has an optional multiline answer field. After entering at
least one answer, check the separate, initially unchecked refinement consent and
select **Refine rewrite with answers**. Blank answers are omitted; submitted
answers are trimmed and paired with their displayed questions in order. The
refinement request sends only those question-and-answer pairs plus the original
role and bullet. It does not send IDs, APR feedback/status, the initial rewrite,
contact fields, or other resume content.

The original APR review remains visible beside one separately labeled latest
refined rewrite. A successful repeat replaces only the prior refinement. Each
candidate has its own explicit apply control and neither is automatic. Answers,
refinement consent, and refined output are transient and are not saved in the
workspace. Editing an answer clears refinement consent and makes only the prior
refinement stale until the exact submitted nonblank answers are restored or a
new refinement succeeds. CLI, timeout, malformed-output, and other request
failures keep the review, answers, prior refinement, and resume unchanged while
showing an error. Refinement is unavailable in the browser preview.

## Privacy and storage

- No app analytics, remote fonts, cloud database, or background resume uploads.
- Desktop resumes live in `workspace.json` within Tauri's app data directory for
  `app.hireloom.desktop`. On macOS this is typically
  `~/Library/Application Support/app.hireloom.desktop/`.
- Resume files and JSON/PDF/DOCX exports are **not encrypted**. Use device
  encryption, protect backups, and avoid shared OS accounts.
- Browser previews use the `hireloom.workspace.v1` localStorage key. Clearing
  browser data deletes that browser's workspace; export a backup first.
- Whole-resume AI requests send the summary, work history, projects (excluding
  project URLs), education, certifications (excluding credential URLs), skills,
  skill groups, professional headline, and job description to GitHub Copilot. APR requests
  send only the selected accomplishment and its role; an answer-guided
  refinement additionally sends only the nonblank displayed question/answer
  pairs. Dedicated name, email, phone, personal location, website, GitHub,
  project/certification URLs, APR diagnostics/initial rewrite, other resume
  fields, and local correlation IDs are excluded. **Anything you type into free
  text can still contain identifying information**; review and redact it yourself.
- Copilot authentication and session state use the app's `copilot` directory.
  The CLI may retain prompts and responses there, and GitHub processes the
  request according to your account's policies. Local-first does not mean
  offline AI or zero retention.
- Missing files create an empty workspace; corrupt files and unsupported
  versions block loading rather than being overwritten.

Use **Document actions → Back up workspace** or **My resumes → Back up all**.
Imports accept Hireloom version-1 and version-2 JSON backups up to 2 MB (upgrading
v1 backups automatically) and add new document copies rather than replacing
existing work. PDF and DOCX resume imports accept files up to 5 MB and parse
selectable text locally into a reviewable draft. Up to 50 resumes are supported.

## Development

Repository guides:

- [`AGENTS.md`](AGENTS.md) defines repository-wide constraints, required checks,
  and the documentation maintenance contract.
- [`PRODUCT.md`](PRODUCT.md) defines product vision, personas, positioning, core
  journeys, shipped capabilities, and explicit non-goals.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) explains runtime boundaries, data flows,
  trust boundaries, and invariants.
- [`CODE_MAP.md`](CODE_MAP.md) maps files and common changes to their owning
  modules.

Shared IntelliJ IDEA/RustRover run configurations are committed under `.run/`.
Use **Browser Preview** for the isolated browser build, **Desktop App** for
`tauri dev`, and the frontend, E2E, Rust test, build, and **Native Clippy**
configurations for the matching checks below. The IDE must have Node.js support
and Rust installed.

```sh
npm run check:fast   # quick typecheck + quiet unit & Rust tests while iterating
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
npm run test:rust
npm run clippy:rust
npm run format:check
```

Set `PLAYWRIGHT_PORT` to run browser tests on another port when `1420` is
already in use, for example `PLAYWRIGHT_PORT=1422 npm run test:e2e`.

The browser suite covers real editing, persistence, corrupt storage, imports,
document management, exported PDF/DOCX content, and automated WCAG 2.2 AA
accessibility checks (`@axe-core/playwright`) in Chromium and WebKit. It also
checks ATS-relevant PDF compatibility: standard section headings, complete
selectable text, and single-column extraction order. These checks do not claim
compatibility with every ATS or provide a hiring score. Frontend unit tests cover schemas, keyword boundaries, save failures, and AI
consent/review/undo, including answer binding and refinement staleness. Native
tests use fake CLI processes, including APR/refinement response and isolation
coverage; tests never authenticate or spend Copilot usage.

```sh
npm run tauri build
```

Platform bundles are written under `src-tauri/target/release/bundle/`.
Distribution signing and notarization are not configured. Build on each target
OS; the GitHub Actions workflow checks frontend and native code across macOS,
Windows, and Linux without creating a release.

For a faster local macOS bundle, use `npm run tauri build -- --debug --bundles app`.
The result is `src-tauri/target/debug/bundle/macos/Hireloom.app`. The PDF renderer
is intentionally lazy-loaded; Vite may warn about the size of that export-only
chunk.

Key code:

| Location                  | Responsibility                                                       |
| ------------------------- | -------------------------------------------------------------------- |
| `src/model/` (`model.ts`) | Validated Workspace v2, migration, Career Library, and AI contracts  |
| `src/audit.ts`            | Deterministic local resume quality checks                            |
| `src/keywords.ts`         | Dynamic job-description keyword extraction and phrase matching       |
| `src/diff.ts`             | Word-level diffing for selective AI proposal review                  |
| `src/resumeImport.ts`     | Lazy-loaded local PDF and DOCX resume text extraction and parsing    |
| `src/docxExport.ts`       | Lazy-loaded local single-column OpenXML (`.docx`) generation         |
| `src/useWorkspace.ts`     | Serialized autosaving and close protection                           |
| `src/hooks/`              | Studio AI workflows and document import/export orchestration         |
| `src/platform.ts`         | Desktop IPC and explicit browser-preview adapters                    |
| `src/components/`         | Editor, Career Library, preview, AI review, studio shell, and layout |
| `src/styles/` (`App.css`) | Studio layout, editor, preview, theme tokens, and accessibility CSS  |
| `src/ResumeDocument.tsx`  | Lazy-loaded, local PDF generation                                    |
| `src-tauri/src/`          | Modular native persistence, exports, and AI/Copilot boundaries       |

Documentation is part of implementation. Code changes must update the README for
affected setup or user behavior, the product guide for changed capabilities,
journeys, or non-goals, the architecture guide for changed boundaries or flows,
the code map for changed ownership or files, and `AGENTS.md` for changed
contributor rules. The full decision table is in
[`AGENTS.md`](AGENTS.md#documentation-maintenance-contract).

## Boundaries of this version

This is a local-first studio and is not affiliated with GitHub. There is no
cover-letter generator, cloud sync, or application tracker yet. PDF and DOCX
imports extract selectable text locally without OCR; scanned image PDFs and
multi-column layouts may require manual cleanup after import. Keyword targeting
and quality checks are transparent local rules, **not a proprietary ATS score or
a hiring guarantee**. Dashed preview lines show estimated page breaks; the
exported PDF is the definitive paginated version.

Noto Sans and Noto Serif are bundled locally under the
[SIL Open Font License](src/assets/fonts/OFL.txt), from
[the Noto fonts project](https://github.com/notofonts/noto-fonts). These fonts cover
Latin, Greek, and Cyrillic; full CJK, emoji, and right-to-left layout support are
not provided by this MVP. The name Hireloom is a working project name; trademark
and domain availability have not been checked.

## License

Hireloom is licensed under the
[PolyForm Noncommercial License 1.0.0](LICENSE.md). Commercial use is not
permitted without a separate license from the licensor.

# Hireloom

**Your experience, beautifully told.**

A local-first desktop resume studio built with Tauri 2, React, TypeScript, and
Rust. Create a thoughtful resume for each opportunity, use GitHub Copilot to
refine your wording, and export a clean PDF without a watermark.

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
separate browser-local storage, supports editing and PDF downloads, and cannot
connect to Copilot. It does not read your desktop workspace.

## What's included

- Multiple resume documents with rename, duplicate, and confirmed deletion.
- Personal details including portfolio, LinkedIn, and GitHub URLs; summary;
  reorderable experience with month/year dates and current-role support;
  education; and skills.
- A live preview, Editorial and Modern layouts, and three accent colors.
- Local autosaving with visible failures, retries, and recovery backup export.
- A4, selectable-text PDFs with embedded fonts and automatic page overflow.
- JSON workspace backups and validated, non-destructive imports.
- Job-description keyword overlap and a transparent resume-essentials checklist.
- In-app GitHub Copilot sign-in, factual rewriting, explicit consent, suggestion
  review, per-accomplishment APR analysis, stale-result protection, and one-step
  undo until the next edit.
- Repository instructions for GitHub Copilot in `.github/copilot-instructions.md`.

Start with your own details or click **try a fictional example**. The example
candidate, organizations, and work history are demonstration content, not claims
about a real person. The app opens to a blank resume and never uploads an example
or your content automatically.

## GitHub Copilot

Install the standalone [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli)
if you do not already have it:

```sh
npm install -g @github/copilot
```

Open the **Copilot** tab in the desktop app and select **Sign in with GitHub**.
Complete the browser authorization flow. A Copilot-enabled account, appropriate
organization policy, and available usage are required. The installed CLI and
account entitlement are separate: detecting the executable does not verify login.

Hireloom uses a separate, app-specific Copilot configuration directory, so sign
in through Hireloom even if you already use Copilot for development. It does not
store an API key in the frontend or bundle the CLI. The app invokes the CLI from
Rust without a shell, sends the prompt through stdin, disables model tools,
custom instructions, hooks, built-in MCP servers, and remote session sharing,
and uses a neutral working directory instead of your projects. The subprocess
retains your real OS home only so the CLI can use the system credential store;
Copilot, GitHub CLI, cache, temporary, and working files remain redirected to
Hireloom-owned directories. Whole-resume and APR requests are pinned to
`gpt-5.6-luna` for consistent behavior. If that model is unavailable to the
signed-in account or installed CLI, the request fails visibly instead of
silently switching models. Responses use the CLI's JSON event stream so quoted
feedback remains valid structured data. Hireloom also accepts the CLI's
commented JSON configuration format while preserving existing settings and
enforcing its isolation controls.

Add real experience or skills, optionally paste a job description, and check the
consent box for each request. Copilot proposes a summary and experience
highlights; it does not modify employer names, dates, education, or skills.
**Review every claim before applying.** AI can still make mistakes or invent
details. Suggestions are never silently applied. CLI errors, expired login,
malformed output, and the three-minute timeout leave your resume unchanged.

The **Analyze accomplishments** section reviews one nonempty experience bullet
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

## Privacy and storage

- No app analytics, remote fonts, cloud database, or background resume uploads.
- Desktop resumes live in `workspace.json` within Tauri's app data directory for
  `app.hireloom.desktop`. On macOS this is typically
  `~/Library/Application Support/app.hireloom.desktop/`.
- Resume files and JSON/PDF exports are **not encrypted**. Use device encryption,
  protect backups, and avoid shared OS accounts.
- Browser previews use the `hireloom.workspace.v1` localStorage key. Clearing
  browser data deletes that browser's workspace; export a backup first.
- Whole-resume AI requests send the summary, work history, education, skills,
  professional headline, and job description to GitHub Copilot. APR requests
  send only the selected accomplishment and its role. Dedicated name, email,
  phone, personal location, website, GitHub, and local correlation IDs are
  excluded. **Anything you type into free text can still contain identifying
  information**; review and redact it yourself.
- Copilot authentication and session state use the app's `copilot` directory.
  The CLI may retain prompts and responses there, and GitHub processes the
  request according to your account's policies. Local-first does not mean
  offline AI or zero retention.
- Missing files create an empty workspace; corrupt files and unsupported
  versions block loading rather than being overwritten.

Use **Document actions → Back up workspace** or **My resumes → Back up all**.
Imports accept Hireloom version-1 JSON backups up to 2 MB and add new document
copies rather than replacing existing work. Up to 50 resumes are supported.

## Development

Repository guides:

- [`AGENTS.md`](AGENTS.md) defines repository-wide constraints, required checks,
  and the documentation maintenance contract.
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
document management, and exported PDF text in Chromium and WebKit. It also
checks ATS-relevant PDF compatibility: standard section headings, complete
selectable text, and single-column extraction order. These checks do not claim
compatibility with every ATS or provide a hiring score. Frontend unit tests
cover schemas, keyword boundaries, save failures, and AI consent/review/undo.
Native tests use fake CLI processes, including APR response and isolation
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

| Location                 | Responsibility                                             |
| ------------------------ | ---------------------------------------------------------- |
| `src/model.ts`           | Validated document, import, and AI schemas; local feedback |
| `src/useWorkspace.ts`    | Serialized autosaving and close protection                 |
| `src/platform.ts`        | Desktop IPC and explicit browser-preview adapters          |
| `src/components/`        | Editor, preview, Copilot review, and layout controls       |
| `src/ResumeDocument.tsx` | Lazy-loaded, local PDF generation                          |
| `src-tauri/src/`         | Native persistence, exports, and Copilot process boundary  |

Documentation is part of implementation. Code changes must update the README for
affected setup or user behavior, the architecture guide for changed boundaries
or flows, the code map for changed ownership or files, and `AGENTS.md` for
changed contributor rules. The full decision table is in
[`AGENTS.md`](AGENTS.md#documentation-maintenance-contract).

## Boundaries of this first version

This is a working MVP and is not affiliated with GitHub. There is no PDF/DOCX resume import, DOCX export, cover-letter
generator, cloud sync, or application tracker yet. Keyword overlap is a small
local vocabulary check, **not a proprietary ATS score or a hiring guarantee**.
The on-screen preview is continuous; the exported PDF is the definitive
paginated version.

Noto Sans and Noto Serif are bundled locally under the
[SIL Open Font License](src/assets/fonts/OFL.txt), from
[the Noto fonts project](https://github.com/notofonts/noto-fonts). These fonts cover
Latin, Greek, and Cyrillic; full CJK, emoji, and right-to-left layout support are
not provided by this MVP. The name Hireloom is a working project name; trademark
and domain availability have not been checked.

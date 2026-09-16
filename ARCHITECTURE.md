# Hireloom Architecture

Hireloom is a local-first resume studio with one React application running in
two environments:

- a Tauri 2 desktop webview backed by Rust commands; and
- an explicitly labeled browser preview backed by browser-local storage.

The environments share the UI and domain model but intentionally do not share
storage. Only the desktop application can connect to GitHub Copilot.

## System context

```text
                         explicit reviewed request
                                    |
+-------------------+       +-------v--------+       +--------------------+
| React application | IPC   | Tauri/Rust     | spawn | GitHub Copilot CLI |
| editor + preview  +------>+ command layer  +------>+ isolated profile   |
+---------+---------+       +---+---------+--+       +--------------------+
          |                     |         |
          | browser preview     |         | save dialog
          v                     v         v
   localStorage only       workspace.json PDF/JSON export
```

The React application never receives filesystem paths, Copilot credentials, or
direct process access. Rust exposes a small command surface and validates data
again at the native boundary.

## Layers and ownership

### Domain and contract

`src/model.ts` is the frontend source of truth for workspace, resume, and AI
proposal shapes. Strict Zod schemas reject unknown fields and enforce size,
count, ID, and selection invariants.

Matching Serde types and validators in `src-tauri/src/lib.rs` protect the native
boundary. Persisted or IPC shape changes must be made in both languages. The
current workspace format is version `1`; compatibility-affecting changes require
an explicit migration/version decision rather than silently accepting or
discarding old data.

Experience dates created by the editor use `YYYY-MM`; ongoing roles use
`Present`. Preview and PDF render picker values as abbreviated month plus year.
Legacy free-text dates remain valid and visible until a user replaces them with
a picker value.

### Application orchestration

`src/App.tsx` owns top-level UI state and user workflows: document management,
backup import/export, PDF generation, Copilot status/login/generation, proposal
review, stale-result checks, and one-step AI undo.

Focused components remain controlled by `App`:

- `Editor` emits updated resume values.
- `StylePanel` emits template/accent changes.
- `CopilotPanel` renders consent and review controls but does not call native
  APIs itself.
- `ResumePreview` renders the continuous screen representation.
- `ResumeDocument` is dynamically imported only for PDF export.

### Persistence

`useWorkspace` owns the persistence lifecycle:

1. Load through the platform adapter.
2. If no saved workspace exists, create a new in-memory workspace.
3. If saved data is corrupt, surface the error and do not initialize an empty
   replacement.
4. Debounce edits for 450 ms.
5. Serialize writes through a promise queue so an older slow write cannot
   replace a newer snapshot.
6. Surface save failures while retaining retry and backup actions.
7. Block browser/native close while unsaved changes remain.

The desktop backend stores `workspace.json` in Tauri's app data directory. It
validates and writes through a same-directory temporary file, syncs it, and
atomically replaces the destination. On Unix, app data directories and files
are restricted to the current user.

The browser preview uses only `hireloom.workspace.v1` in `localStorage`.

### Platform adapter and IPC

`src/platform.ts` is the only frontend module that chooses between Tauri and
browser behavior. Its desktop methods invoke:

| Command           | Direction     | Result                                    |
| ----------------- | ------------- | ----------------------------------------- |
| `load_workspace`  | Rust to React | Validated workspace or no saved file      |
| `save_workspace`  | React to Rust | Atomically persisted workspace            |
| `export_document` | React to Rust | User-selected PDF/JSON save result        |
| `copilot_status`  | React to Rust | Local CLI availability and version detail |
| `copilot_login`   | React to Rust | App-specific web login completion         |
| `generate_resume` | React to Rust | Validated, non-applied AI proposal        |

Browser implementations provide local storage and browser downloads. AI methods
reject browser calls.

### PDF generation

`ResumeDocument.tsx` uses `@react-pdf/renderer` and bundled Noto fonts. The PDF
path is local, produces selectable text, uses a single-column A4 layout, and
allows content to wrap across pages. The on-screen preview is not treated as a
pagination oracle; the exported PDF is authoritative.

### Copilot boundary

AI is an opt-in editing aid, not an autonomous actor:

1. The UI requires consent for each generation and clears it afterward.
2. Rust validates the resume before constructing a prompt.
3. Dedicated name, email, phone, location, website, GitHub, and resume title
   fields are omitted from prompt data.
4. The prompt labels all resume/job text as untrusted and forbids following
   embedded instructions or inventing facts.
5. Rust starts the CLI directly without a shell, in a neutral app-owned working
   directory and app-specific home.
6. Hooks, memory, IDE auto-connect, tools, built-in MCPs, custom instructions,
   remote features, and auto-update are disabled.
7. Environment inheritance is allowlisted; process duration and output size are
   capped.
8. The response must match a strict proposal schema and contain exactly the
   original experience IDs.
9. React validates the proposal again, displays it for review, rejects stale
   proposals, and applies only summary and experience bullets.

Copilot authentication and request data may be retained inside the app-specific
Copilot directory and processed under GitHub account policies. "Local-first"
does not describe the optional AI request itself.

## Important data flows

### Edit and autosave

```text
field change
  -> controlled component
  -> App.changeResume (updates updatedAt)
  -> useWorkspace.update
  -> 450 ms debounce
  -> platform.saveWorkspace
  -> Tauri save_workspace OR browser localStorage
  -> visible saved/error state
```

### Backup import

```text
user-selected JSON
  -> browser File API and 2 MB pre-check
  -> strict workspace parsing
  -> new IDs and timestamps for imported copies
  -> 50-resume limit
  -> append without replacing existing resumes
  -> normal autosave path
```

### PDF export

```text
user action
  -> lazy import ResumeDocument
  -> local PDF blob with bundled fonts
  -> platform.exportDocument
  -> native validated save dialog OR browser download
```

### AI proposal

```text
per-request consent
  -> platform.generateResume
  -> Rust validation and redacted prompt
  -> isolated Copilot CLI process
  -> capped strict JSON response validation
  -> frontend schema and ID validation
  -> visible proposal
  -> user review and explicit apply
  -> stale-source guard
  -> summary/bullets only + undo snapshot
```

## Trust boundaries and invariants

- **Imported files are untrusted.** Enforce byte limits before parsing and
  strict schemas afterward.
- **Renderer IPC is untrusted.** Native commands validate workspaces, resumes,
  export names/content, consent, and AI output.
- **Job descriptions and resume text are untrusted prompt data.** They cannot
  alter system instructions.
- **AI output is untrusted.** It cannot introduce fields or change factual
  records; exact experience identity is required.
- **Filesystem choices belong to the user.** Exports use the native save dialog;
  the renderer does not choose arbitrary paths.
- **A missing workspace differs from a corrupt workspace.** Missing creates a
  new in-memory workspace; corrupt blocks loading.
- **Browser and desktop data are separate.** No implicit synchronization or
  migration occurs.
- **Capabilities stay minimal.** The main window currently needs core defaults,
  event listening, and explicit window destruction only.

## Verification strategy

- Vitest covers domain invariants and React workflows with mocked platform APIs.
- Rust unit tests cover native validation, atomic writes, prompt redaction,
  process isolation flags, bounded execution, and malformed responses.
- Playwright exercises the browser adapter in Chromium and WebKit, including
  persistence, recovery, imports, document management, and ATS-relevant PDF
  heading, text-preservation, and single-column extraction-order checks.
- GitHub Actions runs frontend checks and native checks across macOS, Windows,
  and Linux. Automated tests never make live Copilot requests.

## Deliberate current limitations

- Native backend code remains in one module while the command surface is small.
- There is no cloud account, synchronization, telemetry, application tracker,
  DOCX support, or arbitrary resume import.
- Keyword overlap is a small deterministic local vocabulary check, not an ATS
  score.
- Distribution signing and notarization are not configured.
- Bundled fonts do not provide full CJK, emoji, or right-to-left layout support.

## Architecture change checklist

When changing a boundary or flow:

1. Update TypeScript and Rust contracts together.
2. Re-evaluate validation at every crossed trust boundary.
3. Keep desktop and browser behavior intentionally distinct.
4. Confirm Tauri permissions and CSP remain minimal.
5. Add tests at the lowest layer that proves the invariant.
6. Update this document, [`CODE_MAP.md`](CODE_MAP.md), the relevant README
   sections, and repository instructions as required by [`AGENTS.md`](AGENTS.md).

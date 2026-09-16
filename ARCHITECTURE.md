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
review, transient APR answers/refinement, stale-result checks, and one-step AI
undo.

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

| Command                  | Direction     | Result                                         |
| ------------------------ | ------------- | ---------------------------------------------- |
| `load_workspace`         | Rust to React | Validated workspace or no saved file           |
| `save_workspace`         | React to Rust | Atomically persisted workspace                 |
| `export_document`        | React to Rust | User-selected PDF/JSON save result             |
| `copilot_status`         | React to Rust | Local CLI availability and version detail      |
| `copilot_login`          | React to Rust | App-specific web login completion              |
| `generate_resume`        | React to Rust | Validated, non-applied AI proposal             |
| `analyze_accomplishment` | React to Rust | Validated, transient APR review for one bullet |
| `refine_accomplishment`  | React to Rust | Validated, transient answer-bound rewrite      |

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
5. Rust starts the CLI directly without a shell in a neutral app-owned working
   directory. It preserves the real OS home so the CLI can reach the system
   credential store, while `COPILOT_HOME`, `GH_CONFIG_DIR`, XDG paths, cache, and
   temporary storage remain app-owned.
6. Whole-resume and APR requests explicitly use `gpt-5.6-luna`; unavailable
   model access is surfaced as a request failure with no fallback.
7. The app reads the CLI-owned JSON-with-comments configuration, preserves its
   existing settings, and atomically writes strict JSON with Hireloom's
   isolation controls enforced.
8. Hooks, memory, IDE auto-connect, tools, built-in MCPs, custom instructions,
   remote features, and auto-update are disabled.
9. Environment inheritance is allowlisted; process duration and output size are
   capped.
10. CLI output uses JSON events, and Rust extracts only the final assistant text
    before applying the feature-specific response schema. This avoids the
    plain-text renderer changing JSON escape sequences.
11. The response must match a strict proposal schema and contain exactly the
    original experience IDs.
12. React validates the proposal again, displays it for review, rejects stale
    proposals, and applies only summary and experience bullets.

APR analysis uses the same isolation and generation lock but a narrower
contract. React keeps resume ID, experience ID, and bullet index as local
correlation state. Rust receives and validates that target, sends only the role
and selected bullet as delimited untrusted prompt data, strictly validates the
Action/Project/Result response, and attaches the unchanged local target to the
result. The result is transient. React revalidates the echoed target and permits
an explicit apply only while the active resume, experience, role, bullet index,
and bullet text still match. Changes to unsent fields do not stale it, and the
single-bullet helper cannot change adjacent bullets or other resume fields.

APR refinement extends that transient contract without changing persistence.
React stores answer text by displayed question index, trims and omits blanks,
and requires at least one nonblank answer plus a fresh, refinement-specific
consent. IPC carries the exact local target, the complete current question list
for correlation, and a nonempty ordered subset of exact question/answer pairs.
TypeScript and Rust reject duplicate source or answered questions, unknown or
reordered questions, unknown fields, oversized values, mismatched target/pair
echoes, and empty, unchanged, or oversized rewrites.

Only `{ role, bullet, answers: [{ question, answer }] }` enters the delimited
untrusted Copilot prompt. IDs, question indexes, APR status/feedback, the
initial rewrite, contact fields, and other resume content remain outside prompt
data. The command reuses the same generation lock, pinned model, empty tool
list, isolated Copilot profile, JSON event transport, and process limits. Rust
attaches the unchanged target and submitted normalized answers after parsing;
the platform adapter revalidates both echoes.

The original review and one latest refinement remain separately reviewable and
require separate apply actions. Target changes stale both candidates; answer
changes stale only a prior refinement, and restoring the exact normalized pair
snapshot makes it fresh again. Success replaces only the latest refinement.
Failure preserves the analysis, answers, prior refinement, and resume while
clearing refinement consent. Selecting another APR target, discarding the
review, or applying either candidate clears all refinement state. None of this
state is autosaved.

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

### APR accomplishment analysis

```text
select one nonempty bullet
  -> show exact bullet + role-only disclosure
  -> separate single-use consent
  -> platform.analyzeAccomplishment
  -> Rust target validation + isolated shared Copilot runner
  -> role and bullet only in delimited untrusted prompt data
  -> strict APR response validation + local target echo
  -> visible Action / Project / Result feedback and factual questions
  -> stale-target guard
  -> optional explicit single-bullet rewrite + existing undo snapshot
```

### APR answer-guided refinement

```text
answer one or more displayed APR questions
  -> trim answers and omit blanks in display order
  -> separate single-use refinement consent
  -> platform.refineAccomplishment
  -> Rust target + full-question-list + ordered-pair validation
  -> shared isolated Copilot runner with role/bullet/answered pairs only
  -> strict changed-rewrite parsing + local target/pair echo
  -> frontend echo validation + separate latest-refinement review
  -> exact target and submitted-answer freshness guards
  -> explicit single-bullet apply + existing undo snapshot
```

## Trust boundaries and invariants

- **Imported files are untrusted.** Enforce byte limits before parsing and
  strict schemas afterward.
- **Renderer IPC is untrusted.** Native commands validate workspaces, resumes,
  export names/content, consent, and AI output.
- **Job descriptions, resume text, APR questions, and user answers are untrusted
  prompt data.** They cannot alter system instructions.
- **AI output is untrusted.** It cannot introduce fields or change factual
  records; exact experience identity is required for whole-resume proposals,
  while APR output is rebound to and revalidated against the exact local bullet
  target and refinement answer snapshot.
- **Filesystem choices belong to the user.** Exports use the native save dialog;
  the renderer does not choose arbitrary paths.
- **A missing workspace differs from a corrupt workspace.** Missing creates a
  new in-memory workspace; corrupt blocks loading.
- **Browser and desktop data are separate.** No implicit synchronization or
  migration occurs.
- **Capabilities stay minimal.** The main window currently needs core defaults,
  event listening, and explicit window destruction only.

## Verification strategy

- Vitest covers domain invariants and React workflows with mocked platform APIs,
  including APR/refinement consent, strict answer binding, staleness, failure
  preservation, and exact single-bullet application.
- Rust unit tests cover native validation, atomic writes, prompt redaction,
  process isolation flags, bounded execution, and malformed responses.
- Playwright exercises the browser adapter in Chromium and WebKit, including
  the no-Copilot APR/refinement negative control, persistence, recovery,
  imports, document management, and ATS-relevant PDF heading,
  text-preservation, and single-column extraction-order checks.
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

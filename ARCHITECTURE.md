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
+-------------------+       +-------v--------+  SDK  +--------------------+
| React application | IPC   | Tauri/Rust     +------>+ GitHub Copilot CLI |
| editor + preview  +------>+ command layer  | JSON | isolated profile   |
+---------+---------+       +---+---------+--+ RPC  +--------------------+
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
proposal shapes; typed target-job and optional-section schemas live in
`src/resumeExtensions.ts`. Strict Zod schemas reject unknown fields and enforce
size, count, ID, section-order, and selection invariants.

Matching Serde types in `src-tauri/src/contract.rs` and validators in
`src-tauri/src/validation.rs` protect the native boundary. Persisted or IPC shape changes must be made in both languages. The
current workspace format is version `2`. `src/workspaceMigration.ts` strictly
parses version 1 and migrates its `jobDescription` into
`targetJob.description`; native loading performs the matching migration before
validation. New optional sections default empty and their explicit order
defaults to Projects, Certifications, Awards, Volunteer Experience,
Publications, then Languages. Compatibility-affecting changes require an
explicit migration/version decision rather than silently accepting or
discarding old data.

Experience dates created by the editor use `YYYY-MM`; ongoing roles use
`Present`. Preview and PDF render picker values as abbreviated month plus year.
Legacy free-text dates remain valid and visible until a user replaces them with
a picker value.

### Application orchestration

`src/App.tsx` owns top-level UI state and composes the workflows: document
management, Copilot status/login, per-resume transient Content navigation and
selected Experience state, transient workspace mode and Preview scroll state,
bounded item-removal recovery, and one-step AI undo. Workflow state that App
wires but does not implement lives in focused hooks and pure modules:
`useHighlightGuidance` (inline guidance and resume-wide review, with target
staleness checks), `useResumeGeneration` (whole-resume proposals),
`useWorkspaceTransfer` (PDF export and backup import/export), and
`contentView` (item removal and restoration). They receive App's shared busy,
notice, undo, and resume-change callbacks, so there is still one source of
truth for resume edits.

Focused components remain controlled by `App`; shell pieces (`Sidebar`,
`WorkspaceHeader`, `ResumeLibrary`, `DocumentToolbar`, `WorkspaceTabs`,
`PreviewPanel`, `Dialogs`) are presentational, and:

- `Editor` (composing per-section modules under `components/editor/`) renders visible peer tabs with one selected Content section, emits
  updated resume values and typed item-removal requests, presents a responsive
  Experience summary/master-detail view with one selected editor, and places
  guidance under the active nonempty highlight.
- `HighlightGuidance` renders the bounded disclosure, feedback, accessible
  fixed-strategy option selection, and explicit apply or keep controls.
- `StylePanel` emits template/accent changes.
- `CopilotPanel` renders target-job setup, the local audit, whole-resume consent,
  and review controls but does not call native APIs itself.
- `ResumePreview` renders the continuous screen representation.
- `ResumeDocument` is dynamically imported only for PDF export.

The studio shell exposes Content, Copilot, Design, and Preview as one labeled
top-level tablist, and Content has its own section tablist. Both tiers use
roving focus with automatic activation. Inactive panels stay mounted but
`hidden`, so they leave the accessibility tree without losing transient
same-resume state; each active mode owns one bounded vertical scroll surface.

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
The key remains stable so existing browser work can be loaded and migrated to
the version-2 payload rather than becoming unreachable.

### Platform adapter and IPC

`src/platform.ts` is the only frontend module that chooses between Tauri and
browser behavior. Its desktop methods invoke these React-initiated commands:

- `load_workspace`: validated workspace or no saved file.
- `save_workspace`: atomically persisted workspace.
- `export_document`: user-selected PDF/JSON save result.
- `copilot_status`: local CLI availability and version detail.
- `copilot_login`: app-specific web login completion.
- `generate_resume`: validated, non-applied AI proposal.
- `analyze_accomplishment`: validated transient APR feedback and direct rewrite options, optionally focused by a matching weak review.
- `refine_accomplishment`: feedback-guided replacement APR option set.
- `review_highlights`: one batched, diagnosis-only APR verdict per sent highlight.

Browser implementations provide local storage and browser downloads. AI methods
reject browser calls.

### Native backend layering

`src-tauri/src/lib.rs` only declares modules and registers commands. Thin
handlers in `commands.rs` check consent, take locks, and validate input before
delegating downward: `persistence.rs` for app data, `ai/` for prompt building,
model routing, and strict response parsing, `copilot/` for the isolated CLI
profile and SDK session, and `process.rs` for bounded direct subprocesses.
Lower layers never call upward, and only `commands.rs` touches Tauri command
state. Modules stay under about 20 KB so each can be read whole.

### PDF generation

`ResumeDocument.tsx` uses `@react-pdf/renderer` and bundled Noto fonts. The PDF
path is local, produces selectable text, uses a single-column A4 layout, and
allows content to wrap across pages. The on-screen preview is not treated as a
pagination oracle; the exported PDF is authoritative.

### Local target-job audit

`src/targetAudit.ts` runs deterministic checks entirely in the renderer. It
uses the saved target description, structured resume fields, and a small
built-in vocabulary to report observed setup, content, evidence, job-alignment,
format-reference, and date-consistency issues. Findings explain the observation
and rationale and carry an exact Content section/field or target-job field for
navigation. They never assign an ATS score, fetch the source URL, contact
Copilot, or recommend representing an unsupported skill as fact.

### Copilot boundary

AI is an opt-in editing aid, not an autonomous actor:

1. The UI requires consent for each generation and clears it afterward.
2. Rust validates the resume before constructing a prompt.
3. Dedicated name, email, phone, location, website, GitHub, and resume title
   fields are omitted from prompt data.
4. The prompt labels all resume/job text as untrusted and forbids following
   embedded instructions or inventing facts.
5. Rust gives the official `github-copilot-sdk` the explicit installed CLI path.
   The SDK starts its JSON-RPC server without a shell in a neutral app-owned
   working directory. It preserves the real OS home so the CLI can reach the
   system credential store, while `COPILOT_HOME`, `GH_CONFIG_DIR`, XDG paths,
   cache, and temporary storage remain app-owned. Status and login remain narrow
   direct CLI subprocesses.
6. SDK clients use `ClientMode::Empty`; generation sessions explicitly expose
   zero tools, deny permission requests, and disable config/instruction
   discovery, hooks, skills, MCP apps and servers, host Git operations, managed
   settings, persistence, telemetry, citations, and file-change tracking.
7. The shared runner receives an explicit request-kind model:
   whole-resume generation uses `gpt-5.6-luna`, while inline APR analysis uses
   `gemini-3.8-flash`. Unavailable model access is surfaced as a
   request failure after one session attempt, with no retry or fallback.
8. The app reads the CLI-owned JSON-with-comments configuration, preserves its
   existing settings, and atomically writes strict JSON with Hireloom's
   isolation controls enforced.
9. Hooks, memory, IDE auto-connect, tools, built-in MCPs, custom instructions,
   remote features, and auto-update are disabled.
10. Environment inheritance is allowlisted and request duration is capped.
11. The SDK returns the last typed `assistant.message` after the session becomes
    idle. Rust accepts explicitly phased and unphased final answers, rejects
    commentary, tool requests, empty or malformed events, and responses above
    128 KB before applying the feature-specific schema. SDK-managed JSON-RPC
    avoids the plain-text renderer changing JSON escape sequences.
12. The response must match a strict proposal schema and contain exactly the
    original experience IDs.
13. React validates the proposal again, displays it for review, rejects stale
    proposals, and applies only summary and experience bullets.

Resume-wide highlight review reuses the same APR contract, isolation, model
route, and generation lock, but is diagnosis-only and batched. One consented
request carries every nonempty highlight of the active resume as indexed role
and bullet text. Rust rejects an oversized assembled prompt before any Copilot
contact instead of truncating or chunking, requires exactly one verdict per
requested index with no duplicates or unknown indexes, and rebinds verdicts to
the unchanged local targets. The response carries no rewrite text, and a
completed review never changes or persists resume content; React holds the
verdicts as transient session state and drops a badge as soon as its source
highlight changes.

Inline highlight guidance uses the existing internal APR contract, isolation,
and generation lock but presents it under the selected Experience highlight.
React keeps resume ID, experience ID, and bullet index as local correlation
state. Rust receives and validates that target, sends only the role and selected
highlight as delimited untrusted prompt data, and may additionally receive a
full-target-matching transient weak review. When present, only its Action,
Project, and Result status values are serialized into the prompt; local IDs and
positions remain local. Rust strictly validates the
Action/Project/Result response and fixed rewrite strategies, then attaches the
unchanged local target. Responses contain one to three unique entries in canonical
relative `concise`, `detail-forward`, `split` order. Unified strategies contain one
bullet; split contains exactly two ordered bullets and is omitted unless facts
support two nonredundant highlights. The single response supplies factual
feedback and at least one rewrite option, with no follow-up questions.

The result is transient. React revalidates the echoed target and permits an
explicit apply only after the user selects a fresh option and while the active
resume, experience, role, bullet index, and highlight text still match. Changes
to unsent fields do not stale it. Atomic apply splices either one or two
returned bullets at the exact index, preserves adjacent order and all other
resume fields, and rejects a split above the 30-highlight limit.

Freeform refinement feedback is a separate consented request carrying the
original role and highlight, current options, and feedback as delimited
untrusted data. The original role and highlight remain the complete factual
boundary: options are drafts, not new facts, and feedback may steer wording but
never authorizes invented claims. Refinement uses the same locked SDK path and
strict response contract. Success replaces the complete
option set and clears selection; failure preserves the prior options, selection,
feedback, and resume.

Prompt wording rules and the meaning of each rewrite strategy are user-facing
behavior described in the README's GitHub Copilot section; `ai/prompts.rs` is
authoritative. Architecturally, prompts may only restate supplied facts, and
strict parsing enforces UTF-8 byte limits, strategy order/cardinality, exact
target binding, and changed options regardless of what the prompt requested.

Option labels and tradeoffs are static UI text, so untrusted output cannot
define option semantics. Nothing is preselected. Failure preserves the current
result, selection, and resume while clearing consent. Guidance state is never
autosaved and is cleared by selecting another highlight, keeping, or applying.

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

Content section and selected Experience state are keyed by resume ID in React
memory. The selected top-level workspace mode and same-resume Preview scroll are
also transient UI state; changing resumes resets Preview scroll safely. None of
these values enters the workspace schema, backups, localStorage, or native IPC.
Removing a job, education entry, or highlight stores only that exact item, its
original index, and its parent identity where applicable for eight seconds.
Undo remains available across workspace and Content tab switches, returns to
the relevant Content target, reinserts the item into the current controlled
resume, and autosaves the restoration normally. Any later resume-data edit
clears the pending item recovery. This item-level record is separate from the
existing whole-resume snapshot used to undo an applied AI suggestion.

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

### Inline highlight guidance

```text
activate help under one nonempty highlight
  -> show exact highlight + role-only disclosure inline
  -> separate single-use consent
  -> platform.analyzeAccomplishment
  -> Rust target and optional weak-review validation + isolated shared Copilot runner
  -> explicit gemini-3.8-flash route with no fallback
  -> role, bullet, and eligible review statuses only in delimited untrusted prompt data
  -> strict APR response validation + local target echo
  -> visible What you did / Product or project / Impact feedback
  -> one-to-three direct fixed-strategy rewrite options
  -> stale-target guard
  -> explicit option selection
  -> optional feedback + separate consented refinement request
  -> replace options only after a valid refined response
  -> atomic one/two-bullet apply + exact prior-resume undo snapshot
```

The optional review context is derived at render/send time from the transient
resume-wide review state. It is used only when every target field still matches
and at least one Action, Project, or Result status is partial or missing.
Absent, all-clear, stale, and mismatched reviews preserve the legacy
role-and-highlight-only prompt. Refinement and whole-resume generation do not
receive review context.

### Resume-wide highlight review

```text
consent once in the Experience section
  -> collect every nonempty highlight of the active resume
  -> platform.reviewHighlights (desktop + consent guards)
  -> Rust target validation + isolated shared Copilot runner
  -> explicit gemini-3.8-flash route with no fallback
  -> one batched prompt of index, role, and bullet only
  -> actionable rejection when the prompt exceeds MAX_PROMPT_BYTES,
     with no truncation, chunking, or partial scan
  -> strict response: exactly one Action/Project/Result verdict per index
  -> local rebinding to the exact requested targets
  -> inline text badges naming each weak component
  -> badges cleared by any edit, removal, reorder, or resume switch
  -> no rewrite text, no resume change, nothing persisted
```

## Trust boundaries and invariants

- **Imported files are untrusted.** Enforce byte limits before parsing and
  strict schemas afterward.
- **Renderer IPC is untrusted.** Native commands validate workspaces, resumes,
  export names/content, consent, and AI output.
- **Job descriptions and resume text are untrusted prompt data.** They cannot
  alter system instructions.
- **AI output is untrusted.** It cannot introduce fields or change factual
  records; exact experience identity is required for whole-resume proposals,
  while APR output is rebound to and revalidated against the exact local bullet
  target.
- **Filesystem choices belong to the user.** Exports use the native save dialog;
  the renderer does not choose arbitrary paths.
- **A missing workspace differs from a corrupt workspace.** Missing creates a
  new in-memory workspace; corrupt blocks loading.
- **Browser and desktop data are separate.** No implicit synchronization or
  migration occurs.
- **Capabilities stay minimal.** The main window currently needs core defaults,
  event listening, and explicit window destruction only.

## Verification strategy

- Vitest covers domain invariants and React workflows against the rendered App
  with mocked platform APIs: navigation and focus, item-removal recovery,
  per-request consent, option shape and selection, staleness, failure
  preservation, and exact AI undo.
- Rust unit tests live beside each native module and cover validation, atomic
  writes, prompt redaction, model routing, SDK isolation settings, bounded
  execution, and malformed responses.
- Playwright exercises the browser adapter in Chromium and WebKit: workspace
  geometry at exact and zoom-equivalent sizes, editing, persistence, recovery,
  imports, document management, desktop-only AI negative controls, and
  ATS-relevant PDF text and reading order.
- Prettier, ESLint, rustfmt, and Clippy enforce standard style and lint rules.
- GitHub Actions runs frontend checks and native checks across macOS, Windows,
  and Linux. Automated tests never make live Copilot requests. See
  [`CODE_MAP.md`](CODE_MAP.md) for per-file test coverage.

## Deliberate current limitations

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

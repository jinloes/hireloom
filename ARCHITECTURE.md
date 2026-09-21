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
review, per-resume transient Content navigation and selected Experience state,
transient workspace mode and Preview scroll state, bounded item-removal
recovery, transient direct inline highlight guidance, stale-result checks, and
one-step AI undo.

Focused components remain controlled by `App`:

- `Editor` renders visible peer tabs with one selected Content section, emits
  updated resume values and typed item-removal requests, presents a responsive
  Experience summary/master-detail view with one selected editor, and places
  guidance under the active nonempty highlight.
- `HighlightGuidance` renders the bounded disclosure, feedback, accessible
  fixed-strategy option selection, and explicit apply or keep controls.
- `StylePanel` emits template/accent changes.
- `CopilotPanel` renders whole-resume consent and review controls but does not
  call native APIs itself.
- `ResumePreview` renders the continuous screen representation.
- `ResumeDocument` is dynamically imported only for PDF export.

The studio shell exposes Content, Copilot, Design, and Preview as one labeled
top-level tablist. One full-width panel is exposed at a time; inactive panels
remain mounted with the native `hidden` attribute so they leave the
accessibility tree without losing transient same-resume state. Content has its
own separately labeled tablist for Personal, Summary, Experience, Education,
and Skills. Both tab tiers use automatic local activation with roving focus,
Left/Right wrapping, and Home/End navigation. The tablists and item-removal Undo
remain outside panel scrolling, while each active mode owns one bounded vertical
scroll surface.

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

| Command                  | Direction     | Result                                                      |
| ------------------------ | ------------- | ----------------------------------------------------------- |
| `load_workspace`         | Rust to React | Validated workspace or no saved file                        |
| `save_workspace`         | React to Rust | Atomically persisted workspace                              |
| `export_document`        | React to Rust | User-selected PDF/JSON save result                          |
| `copilot_status`         | React to Rust | Local CLI availability and version detail                   |
| `copilot_login`          | React to Rust | App-specific web login completion                           |
| `generate_resume`        | React to Rust | Validated, non-applied AI proposal                          |
| `analyze_accomplishment` | React to Rust | Validated transient APR feedback and direct rewrite options |
| `refine_accomplishment`  | React to Rust | Feedback-guided replacement APR option set                  |

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

Inline highlight guidance uses the existing internal APR contract, isolation,
and generation lock but presents it under the selected Experience highlight.
React keeps resume ID, experience ID, and bullet index as local correlation
state. Rust receives and validates that target, sends only the role and selected
highlight as delimited untrusted prompt data, strictly validates the
Action/Project/Result response and fixed rewrite strategies, then attaches the
unchanged local target. Responses contain one to three unique entries in canonical
relative `concise`, `detail-forward`, `split` order. Unified strategies contain one
bullet; split contains exactly two ordered bullets and is omitted unless facts
support two nonredundant highlights. The prompt treats structure, clarity, specificity, and action-led wording
changes as truthful improvements even when impact is absent. It forbids
questions and unsupported suggestions; the single response immediately
supplies the factual feedback and at least one rewrite option.

The result is transient. React revalidates the echoed target and permits an
explicit apply only after the user selects a fresh option and while the active
resume, experience, role, bullet index, and highlight text still match. Changes
to unsent fields do not stale it. Atomic apply splices either one or two
returned bullets at the exact index, preserves adjacent order and all other
resume fields, and rejects a split above the 30-highlight limit.

Users may submit freeform feedback against the displayed option set through a
separate consented refinement request. The request includes the original role
and highlight, current options, and feedback as delimited untrusted data. The
original role and highlight remain the complete factual boundary; options are
drafts rather than new facts, and feedback may direct wording, emphasis, tone,
or length without authorizing invented claims. Refinement uses the same locked
Gemini SDK path and strict response contract. Success replaces the complete
option set and clears selection; failure preserves the prior options, selection,
feedback, and resume.

The Gemini-tuned prompt requires every bullet to begin with a strong action verb, naturally combines
Action with Product or project, includes Result only when supplied facts
support it, preserves supported named technologies and context, avoids APR
labels and first-person phrasing, and does not invent or overstate facts,
scope, ownership, outcomes, or metrics. Concise output must be materially
shorter without losing essential specificity; detail-forward output uses the
strongest supported details without filler; split output contains two
factually distinct, nonoverlapping contributions. Near-duplicate options and padded unsupported option sets are rejected by
instruction.
Strict parsing additionally enforces UTF-8 byte limits,
strategy order/cardinality, exact target binding, and changed options.

The inline option radiogroup uses static labels and tradeoffs; untrusted output
cannot define option semantics. Nothing is selected by default or after a
refresh. Failure preserves the current result, selection, and resume while
clearing request consent. Selecting another highlight, keeping
the current highlight, or applying the selected option clears all guidance
state. None of this state is autosaved.

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
  -> Rust target validation + isolated shared Copilot runner
  -> explicit gemini-3.8-flash route with no fallback
  -> role and bullet only in delimited untrusted prompt data
  -> strict APR response validation + local target echo
  -> visible What you did / Product or project / Impact feedback
  -> one-to-three direct fixed-strategy rewrite options
  -> stale-target guard
  -> explicit option selection
  -> optional feedback + separate consented refinement request
  -> replace options only after a valid refined response
  -> atomic one/two-bullet apply + exact prior-resume undo snapshot
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

- Vitest covers domain invariants and React workflows with mocked platform APIs,
  including both tab tiers and focus, current Preview data, stable Experience
  selection, cross-mode item-removal timing/restoration, guidance consent,
  canonical option shape, explicit no-default selection, staleness, failure
  preservation, atomic split order/cap, and exact AI undo.
- Rust unit tests cover native validation, atomic writes, prompt redaction,
  process isolation flags, bounded execution, and malformed responses.
- Playwright exercises the browser adapter in Chromium and WebKit, including
  exact-size and zoom-equivalent full-width workspace geometry, both tab tiers,
  active-panel and same-resume scroll preservation, responsive Experience
  master-detail editing, cross-mode item-removal recovery, the desktop-only
  inline guidance negative control, local editing, persistence, recovery,
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

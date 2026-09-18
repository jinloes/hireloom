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
review, transient inline highlight guidance and detail/refinement,
stale-result checks, and one-step AI undo.

Focused components remain controlled by `App`:

- `Editor` emits updated resume values and places guidance under the active
  nonempty highlight.
- `HighlightGuidance` renders the bounded disclosure, feedback, optional
  factual answers, separate idea confirmations, additional context, accessible
  fixed-strategy option selection, and explicit apply or keep controls.
- `StylePanel` emits template/accent changes.
- `CopilotPanel` renders whole-resume consent and review controls but does not
  call native APIs itself.
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

| Command                  | Direction     | Result                                                          |
| ------------------------ | ------------- | --------------------------------------------------------------- |
| `load_workspace`         | Rust to React | Validated workspace or no saved file                            |
| `save_workspace`         | React to Rust | Atomically persisted workspace                                  |
| `export_document`        | React to Rust | User-selected PDF/JSON save result                              |
| `copilot_status`         | React to Rust | Local CLI availability and version detail                       |
| `copilot_login`          | React to Rust | App-specific web login completion                               |
| `generate_resume`        | React to Rust | Validated, non-applied AI proposal                              |
| `analyze_accomplishment` | React to Rust | Validated transient APR feedback, questions, ideas, and options |
| `refine_accomplishment`  | React to Rust | Validated complete refreshed result with detail echoes          |

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

Inline highlight guidance uses the existing internal APR contract, isolation,
and generation lock but presents it under the selected Experience highlight.
React keeps resume ID, experience ID, and bullet index as local correlation
state. Rust receives and validates that target, sends only the role and selected
highlight as delimited untrusted prompt data, strictly validates the
Action/Project/Result response, fixed rewrite strategies, factual questions,
and separate confirmation-question ideas, then attaches the unchanged local
target. Options are empty or contain two to three unique entries in canonical
`concise`, `detail-forward`, `split` order. Unified strategies contain one
bullet; split contains exactly two ordered bullets and is omitted unless facts
support two nonredundant highlights. Questions and ideas are separately bounded
and unique across both groups. The UI suppresses factual questions when all
three dimensions are clear but keeps any separate ideas explicitly unsupported.

The result is transient. React revalidates the echoed target and permits an
explicit apply only after the user selects a fresh option and while the active
resume, experience, role, bullet index, and highlight text still match. Changes
to unsent fields do not stale it. Atomic apply splices either one or two
returned bullets at the exact index, preserves adjacent order and all other
resume fields, and rejects a split above the 30-highlight limit.

Detail-guided refinement extends that transient contract without persistence.
React stores answer text by displayed index in separate factual-question and
idea-confirmation groups plus one freeform context field. It trims values,
omits blanks, and requires at least one factual answer, confirmed idea answer,
or context value plus fresh refinement-specific consent. IPC carries the exact
local target, both complete source lists for correlation, ordered subsets of
exact question/answer pairs, and normalized context. TypeScript and Rust reject
duplicate or overlapping sources, unknown or reordered pairs, non-question
ideas, untrimmed or oversized details, unknown fields, and mismatched
target/detail echoes.

Only `{ role, bullet, answers, confirmedIdeaAnswers, additionalContext }`
enters the delimited untrusted Copilot prompt. IDs, unanswered source lists,
question indexes, prior APR status/feedback/options, contact fields, and other
resume content remain outside prompt data. Confirmed idea pairs are explicitly
labeled as user-confirmed facts. The command reuses the same generation lock,
pinned model, empty tool list, isolated Copilot profile, JSON event transport,
and process limits. Rust parses the same complete core result as initial
analysis, attaches the unchanged target and submitted detail echoes, and the
platform adapter revalidates every echo.

Initial and refined options share one prompt-level quality invariant: every
bullet begins with a strong action verb, naturally combines Action with Product
or project, includes Result only when supplied facts support it, preserves
concrete details, avoids APR labels and first-person phrasing, and does not
invent or overstate facts, scope, ownership, outcomes, or metrics. Strict
parsing additionally enforces UTF-8 byte limits, strategy order/cardinality,
separate question groups, exact target/detail binding, and changed options.

The inline option radiogroup uses static labels and tradeoffs; untrusted output
cannot define option semantics. Nothing is selected by default or after a
refresh. A successful refinement supersedes the initial complete result,
provides new blank answer fields for its refreshed questions and ideas, and
resets selection. Editing either answer group or context clears refinement
consent and makes a prior refinement and its selection stale; a fresh initial
result remains valid. Failure preserves the current result, details, selection,
and resume while clearing request consent. Selecting another highlight, keeping
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
  -> role and bullet only in delimited untrusted prompt data
  -> strict APR response validation + local target echo
  -> visible What you did / Product or project / Impact feedback
  -> optional factual-gap questions + separate unsupported Ideas to verify
  -> zero or two-to-three fixed-strategy rewrite options
  -> stale-target guard
  -> explicit option selection
  -> atomic one/two-bullet apply + exact prior-resume undo snapshot
```

### Inline detail-guided refinement

```text
answer factual questions, confirm idea questions, and/or add factual context
  -> trim inputs and omit blanks in each display order
  -> separate single-use refinement consent
  -> platform.refineAccomplishment
  -> Rust target + both full source lists + ordered pair/context validation
  -> isolated runner with role/bullet/answered pairs/confirmed ideas/context only
  -> strict complete refreshed result parsing + local target/detail echoes
  -> frontend echo validation + reset option selection/new answer fields
  -> exact target and submitted-detail freshness guards
  -> explicit one/two-highlight apply or keep + existing undo snapshot
```

## Trust boundaries and invariants

- **Imported files are untrusted.** Enforce byte limits before parsing and
  strict schemas afterward.
- **Renderer IPC is untrusted.** Native commands validate workspaces, resumes,
  export names/content, consent, and AI output.
- **Job descriptions, resume text, APR questions, idea questions, user answers,
  and additional context are untrusted prompt data.** They cannot alter system
  instructions; an idea becomes usable only through its separately confirmed
  answer.
- **AI output is untrusted.** It cannot introduce fields or change factual
  records; exact experience identity is required for whole-resume proposals,
  while APR output is rebound to and revalidated against the exact local bullet
  target and separate refinement answer/idea/context snapshots.
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
  including guidance/refinement consent, canonical option shape, separate
  question/idea binding, context-only refinement, explicit no-default
  selection, refreshed-result supersession, staleness, failure preservation,
  atomic split order/cap, and exact undo.
- Rust unit tests cover native validation, atomic writes, prompt redaction,
  process isolation flags, bounded execution, and malformed responses.
- Playwright exercises the browser adapter in Chromium and WebKit, including
  the desktop-only inline guidance negative control, local editing, persistence, recovery,
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

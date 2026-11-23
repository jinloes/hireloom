# Hireloom Product Guide

**Your experience, beautifully told.**

This document is the source of truth for Hireloom's product vision, target
personas, competitive positioning, core user journeys, shipped capabilities, and
explicit non-goals. Keep it current whenever user-facing workflows, product
scope, positioning, or feature boundaries change.

For technical boundaries and trust invariants, see
[`ARCHITECTURE.md`](ARCHITECTURE.md). For file ownership, see
[`CODE_MAP.md`](CODE_MAP.md). For contributor rules, see [`AGENTS.md`](AGENTS.md).

## Vision and positioning

Hireloom is a local-first desktop resume studio that competes with dedicated AI
resume builders (such as Rezi) on structured authoring, role tailoring,
ATS-friendly formatting, and actionable resume feedback—without cloud lock-in,
mandatory accounts, watermarks, usage telemetry, or AI-invented claims.

Users own their career data locally, connect GitHub Copilot CLI, cloud APIs
(OpenAI, Anthropic, Google Gemini via OS keychain), or local Ollama models when
they want writing assistance, and export clean, single-column PDF and Word
(`.docx`) resumes with live clickable links.

## Target personas

- **Primary persona — Privacy-conscious knowledge & technical professionals:**
  Engineers, designers, product managers, and analysts tailoring resumes across
  multiple roles who want fast iteration, role-specific keyword alignment, and
  grounded bullet coaching without uploading personal history to a SaaS resume
  platform.
- **Secondary persona — Multi-track candidates, students, and career switchers:**
  Applicants whose strongest proof lives in Projects, Certifications,
  Categorized Skills, or Volunteering/Awards rather than a single linear job
  list, and who need custom section ordering plus a reusable Career Library to
  assemble focused 1-page variants.

## Product principles and differentiation

1. **Truthful coaching over fabricated bullets.** Competing AI builders readily
   invent achievements or metrics to chase keyword scores. Hireloom never
   invents employers, dates, qualifications, responsibilities, or metrics:
   - **APR accomplishment coaching** (Yale Action + Project + Result) diagnoses
     one experience or project bullet at a time and asks targeted follow-up
     questions so the user supplies real missing context and outcomes.
   - **Whole-resume tailoring** shows inline word-level diffs with per-item
     **Include / Keep original** controls and one-step undo.
2. **Transparent diagnostics over black-box ATS scores.** Instead of claiming a
   proprietary 0–100 hiring prediction, Hireloom runs deterministic local
   **Resume Quality Checks** across _Completeness_, _Impact & Verbs_,
   _Formatting & Length_, and _Role Alignment_, explaining the exact reason and
   remediation tab for every warning.
3. **Private by default, consented per request.** Resumes live on disk in
   `workspace.json` (or isolated `localStorage` in the browser preview). Every
   Copilot call requires fresh per-request consent and omits dedicated contact
   fields and personal/project/certification URLs from the prompt.
4. **Parser-safe typography that stays out of the way.** Both PDF and `.docx`
   exports remain strictly single-column with selectable text, clear heading
   hierarchy, A4 and US Letter page support, and density controls to prevent
   awkward page-2 spillovers.

## Core user journeys

### 1. Fast start and local resume import

New users can start from a blank studio, load a clearly labeled fictional
example, or upload an existing `.pdf` or `.docx` resume (up to 5 MB). Import
runs locally on-device into a reviewable draft dialog showing detected counts
and warnings before adding a new resume—never overwriting existing work or
triggering automatic AI calls.

### 2. Structured authoring and Master Career Library

Users author Personal details, Profile summary, Experience, Projects, Education,
Certifications, Categorized Skill Groups (alongside flat skills), and Custom
Sections (such as Volunteering, Awards, or Publications). Canonical roles,
projects, education, certifications, and skill groups can be saved to the
workspace's **Master Career Library**, which detects drift on linked resume
items (Update library / Pull library) and builds tailored resume variants by
cherry-picking relevant entries for a target role.

### 3. Role-specific keyword triage and Tailor & Coach workflows

When a user pastes a job description in **Tailor & Coach**, Hireloom extracts
curated and dynamic role terms locally and separates **Matched**, **Missing**,
and **Skipped** keywords. Users can add skills they genuinely possess, skip
terms outside their background, jump straight to coaching a missing keyword, or
restore skipped terms. Focused sub-views separate **Role Tailoring** (whole
resume, 3 summary angles, or single-role tailoring with optional 2-model
grounding badges), **APR Bullet Coach** (rubric review + Q&A refinement), and
**Provider Setup** (Copilot CLI, OpenAI, Anthropic, Gemini, or local Ollama),
with instant in-flight request cancellation.

### 4. Page proofing, variant comparison, quality checks, and export

Users switch between **Editorial** (serif display) and **Modern** (sans-serif)
templates, three accent colors, **A4** or **US Letter** paper, **Compact /
Standard / Spacious** spacing density, and custom **Section order**. The right
pane switches between the **Live sheet** (advisory page-break lines and
clickable links), **PDF proof** (exact on-demand rendered PDF pagination and
page count), and **Compare** (word-level diffs against the Master Career Library
or another resume variant). The bottom bar surfaces essentials and expandable
**Quality checks**, and users export single-column **PDF** or **Word (`.docx`)**
files plus Workspace v2 JSON backups.

## Shipped capability map

| Capability area         | User-visible behavior                                                                                                    | Environment       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| Workspace & backups     | Up to 50 resumes, rename/duplicate/delete, atomic autosave, recovery backup, v2 JSON export, v1/v2 import                | Desktop & browser |
| Resume import           | Local `.pdf` and `.docx` text extraction (≤ 5 MB) into a review dialog (+ optional consented desktop AI cleanup)         | Desktop & browser |
| Resume sections         | Basics, Summary, Experience, Projects, Education, Certifications, Categorized & flat Skills, Custom sections             | Desktop & browser |
| Master Career Library   | Canonical item library, linked-entry drift detection, push/pull sync, cherry-picked variant builder, and variant diffing | Desktop & browser |
| Layout & pagination     | Editorial/Modern templates, 3 accents, A4 & US Letter, Compact/Standard/Spacious density, section reordering             | Desktop & browser |
| Studio ergonomics       | Full-height split-pane shell, collapsible sidebar (`Ctrl/Cmd+\`), persisted theme/zoom/divider prefs, multi-step undo    | Desktop & browser |
| Preview, proof & export | Live sheet, exact on-demand PDF page proof, variant Compare view, clickable links in single-column PDF and `.docx`       | Desktop & browser |
| Keyword targeting       | Curated + dynamic JD term extraction with Matched, Add skill, Coach APR, Skip, and Restore triage                        | Desktop & browser |
| Quality diagnostics     | Essentials bar + expandable deterministic checks (Completeness, Impact & Verbs, Formatting, Role Alignment)              | Desktop & browser |
| Tailor & Coach AI       | Copilot CLI, OpenAI, Anthropic, Gemini, or Ollama; OS keyring keys; 2-model grounding; cancellable APR & role tailoring  | Desktop only      |

## Explicit non-goals and current boundaries

- **No cloud persistence, accounts, or telemetry:** Never add analytics, remote
  fonts, silent uploads, or background cloud sync.
- **No unconsented or autonomous AI:** AI never runs on load, import, typing, or
  save, and never applies edits without human review.
- **No multi-column or decorative graphic layouts:** Multi-column tables,
  skill-percentage bars, and floating text boxes hurt ATS parsing and reading
  order; keep exports clean single-column documents.
- **No adjacent job-platform bloat:** Job boards, auto-apply bots, browser
  extensions, and AI video interviews dilute focus from crafting truthful,
  high-craft resumes.
- **Current known limitations:** Local PDF import extracts selectable text only
  (scanned image PDFs have no OCR); bundled Noto Sans/Serif fonts cover Latin,
  Greek, and Cyrillic (not full CJK, emoji, or RTL layout); cover-letter
  authoring and application tracking are not included.

## Prioritization rules for product changes

1. Prioritize activation, editing flow, import/export fidelity, page-fitting
   control, and truthful tailoring quality over breadth checklist features.
2. Keep the browser preview genuinely useful for local authoring, quality
   checks, keyword triage, and PDF/DOCX import/export while clearly labeling it
   as a preview without Copilot access.
3. Preserve accessibility as a product requirement: every new control needs an
   explicit label, keyboard operability, visible focus, reduced-motion respect,
   and clear status/alert feedback.

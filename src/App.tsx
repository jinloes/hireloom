import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Copy,
  FileText,
  FolderOpen,
  Github,
  LayoutTemplate,
  LoaderCircle,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  applyAprRewrite,
  applyProposal,
  createResume,
  documentFilename,
  errorMessage,
  exampleResume,
  MAX_WORKSPACE_BYTES,
  normalizeAprAnswers,
  parseWorkspace,
  resumeReadiness,
  type AprAnalysis,
  type AprQuestionAnswer,
  type AprRefinement,
  type AprTarget,
  type AiProposal,
  type Resume,
} from "./model";
import {
  analyzeAccomplishment,
  copilotStatus,
  desktop,
  exportDocument,
  generateResume,
  loginToCopilot,
  refineAccomplishment,
  type CopilotStatus,
} from "./platform";
import { useWorkspace } from "./useWorkspace";
import { Editor } from "./components/Editor";
import { ResumePreview } from "./components/ResumePreview";
import { CopilotPanel } from "./components/CopilotPanel";
import { StylePanel } from "./components/StylePanel";
import fontLicense from "./assets/fonts/OFL.txt?raw";
import "./App.css";

type Tab = "content" | "copilot" | "style";
type Notice = { kind: "success" | "error"; text: string };
type Suggestion = { value: AiProposal; source: string };
type AprSuggestion = { value: AprAnalysis; source: AprTarget };
type AprRefinementSuggestion = {
  value: AprRefinement;
  source: AprTarget;
  answers: AprQuestionAnswer[];
};

function App() {
  const {
    workspace,
    update,
    loadError,
    saveError,
    saving,
    dirty,
    flush,
    reload,
  } = useWorkspace();
  const [tab, setTab] = useState<Tab>("content");
  const [library, setLibrary] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [exporting, setExporting] = useState(false);
  const [copilot, setCopilot] = useState<CopilotStatus | null>(null);
  const [busy, setBusy] = useState<
    "status" | "login" | "generate" | "analyze" | "refine" | null
  >(null);
  const [consent, setConsent] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [aprTarget, setAprTarget] = useState<AprTarget | null>(null);
  const [aprConsent, setAprConsent] = useState(false);
  const [aprSuggestion, setAprSuggestion] = useState<AprSuggestion | null>(
    null,
  );
  const [aprAnswers, setAprAnswers] = useState<string[]>([]);
  const [aprRefinementConsent, setAprRefinementConsent] = useState(false);
  const [aprRefinement, setAprRefinement] =
    useState<AprRefinementSuggestion | null>(null);
  const [undo, setUndo] = useState<Resume | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [showLicense, setShowLicense] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const resume = workspace?.resumes.find(
    (item) => item.id === workspace.activeResumeId,
  );
  const blocked =
    busy === "generate" ||
    busy === "analyze" ||
    busy === "refine" ||
    busy === "login";

  function resetApr() {
    setAprTarget(null);
    setAprConsent(false);
    setAprSuggestion(null);
    setAprAnswers([]);
    setAprRefinementConsent(false);
    setAprRefinement(null);
  }

  const report = (error: unknown) =>
    setNotice({ kind: "error", text: errorMessage(error) });

  async function refreshCopilot() {
    setBusy("status");
    try {
      setCopilot(await copilotStatus());
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void refreshCopilot();
  }, []);

  function changeResume(next: Resume) {
    update((current) => ({
      ...current,
      resumes: current.resumes.map((item) =>
        item.id === next.id
          ? { ...next, updatedAt: new Date().toISOString() }
          : item,
      ),
    }));
    setUndo(null);
  }

  function selectResume(id: string) {
    update((current) => ({ ...current, activeResumeId: id }));
    setLibrary(false);
    setSuggestion(null);
    setConsent(false);
    setAprTarget(null);
    setAprConsent(false);
    setAprRefinementConsent(false);
    setUndo(null);
  }

  function addResume(next = createResume()) {
    if (!workspace || workspace.resumes.length >= 50) {
      report(
        new Error(
          "You can keep up to 50 resumes. Export a backup before removing any.",
        ),
      );
      return;
    }
    update((current) => ({
      ...current,
      activeResumeId: next.id,
      resumes: [...current.resumes, next],
    }));
    setLibrary(false);
    setTab("content");
    setSuggestion(null);
    setUndo(null);
    setConsent(false);
    resetApr();
  }

  async function exportPdf() {
    if (!resume) return;
    if (!resume.basics.name.trim()) {
      report(new Error("Add your name before exporting your resume."));
      return;
    }
    setExporting(true);
    try {
      const { createPdf } = await import("./ResumeDocument");
      const blob = await createPdf(resume);
      const saved = await exportDocument(
        blob,
        documentFilename(resume.title, "pdf"),
        "pdf",
      );
      if (saved)
        setNotice({
          kind: "success",
          text: desktop
            ? "Your PDF has been saved."
            : "Your PDF download has started.",
        });
    } catch (error) {
      report(error);
    } finally {
      setExporting(false);
    }
  }

  async function exportBackup() {
    if (!workspace) return;
    try {
      const blob = new Blob([JSON.stringify(workspace, null, 2)], {
        type: "application/json",
      });
      const saved = await exportDocument(blob, "hireloom-backup.json", "json");
      if (saved)
        setNotice({
          kind: "success",
          text: "Workspace backup exported. It contains personal data; store it somewhere safe.",
        });
    } catch (error) {
      report(error);
    }
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !workspace) return;
    try {
      if (file.size > MAX_WORKSPACE_BYTES)
        throw new Error("Choose a Hireloom JSON backup under 2 MB.");
      const imported = parseWorkspace(await file.text());
      const copies = imported.resumes.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
      }));
      update((current) => {
        if (current.resumes.length + copies.length > 50)
          throw new Error(
            "This import would exceed the 50-resume limit. Your existing resumes are unchanged.",
          );
        return {
          ...current,
          resumes: [...current.resumes, ...copies],
          activeResumeId: copies[0].id,
        };
      });
      setSuggestion(null);
      setUndo(null);
      setConsent(false);
      resetApr();
      setLibrary(false);
      setNotice({
        kind: "success",
        text: `Imported ${copies.length} resume${copies.length === 1 ? "" : "s"} without replacing your existing work.`,
      });
    } catch (error) {
      report(error);
    }
  }

  async function login() {
    setBusy("login");
    try {
      await loginToCopilot();
      setNotice({
        kind: "success",
        text: "GitHub sign-in completed. You can now request a resume rewrite.",
      });
      setCopilot(await copilotStatus());
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    if (!resume) return;
    if (
      !resume.summary.trim() &&
      !resume.experience.some(
        (entry) =>
          entry.role.trim() || entry.bullets.some((text) => text.trim()),
      ) &&
      !resume.skills.some((skill) => skill.trim())
    ) {
      report(
        new Error(
          "Add some experience, skills, or a draft summary first so Copilot has real facts to work with.",
        ),
      );
      return;
    }
    const source = JSON.stringify(resume);
    setBusy("generate");
    setSuggestion(null);
    try {
      const value = await generateResume(resume, consent);
      setSuggestion({ value, source });
      setNotice({
        kind: "success",
        text: "Your suggestions are ready to review. Your resume has not been changed.",
      });
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
      setConsent(false);
    }
  }

  function applySuggestions() {
    if (!resume || !suggestion) return;
    if (JSON.stringify(resume) !== suggestion.source) {
      report(
        new Error(
          "Your resume changed. Generate new suggestions before applying.",
        ),
      );
      return;
    }

    try {
      changeResume(applyProposal(resume, suggestion.value));
      setUndo(resume);
      setSuggestion(null);
      setNotice({
        kind: "success",
        text: "Suggestions applied. You can undo this until your next edit.",
      });
    } catch (error) {
      report(error);
    }
  }

  function selectAccomplishment(target: AprTarget) {
    setAprTarget(target);
    setAprConsent(false);
    setAprSuggestion(null);
    setAprAnswers([]);
    setAprRefinementConsent(false);
    setAprRefinement(null);
  }

  async function analyzeApr() {
    if (!resume || !aprTarget) return;
    if (!aprSourceIsCurrent(aprTarget)) {
      setAprConsent(false);
      report(
        new Error(
          "This accomplishment changed. Select it again before sending it to Copilot.",
        ),
      );
      return;
    }
    setBusy("analyze");
    setAprSuggestion(null);
    try {
      const value = await analyzeAccomplishment(aprTarget, aprConsent);
      setAprSuggestion({ value, source: aprTarget });
      setAprAnswers(value.questions.map(() => ""));
      setAprRefinementConsent(false);
      setAprRefinement(null);
      setNotice({
        kind: "success",
        text: "Your APR analysis is ready to review. Your resume has not been changed.",
      });
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
      setAprConsent(false);
    }
  }

  function aprSourceIsCurrent(source: AprTarget): boolean {
    if (!resume || resume.id !== source.resumeId) return false;
    const experience = resume.experience.find(
      (entry) => entry.id === source.experienceId,
    );
    return Boolean(
      experience &&
      experience.role === source.role &&
      experience.bullets[source.bulletIndex] === source.bullet,
    );
  }

  function currentAprAnswers(): AprQuestionAnswer[] {
    if (!aprSuggestion) return [];
    return normalizeAprAnswers(aprSuggestion.value.questions, aprAnswers);
  }

  function changeAprAnswer(index: number, value: string) {
    setAprAnswers((current) =>
      current.map((answer, answerIndex) =>
        answerIndex === index ? value : answer,
      ),
    );
    setAprRefinementConsent(false);
  }

  function aprRefinementIsCurrent(
    refinement: AprRefinementSuggestion,
  ): boolean {
    return (
      aprSourceIsCurrent(refinement.source) &&
      JSON.stringify(currentAprAnswers()) === JSON.stringify(refinement.answers)
    );
  }

  async function refineApr() {
    if (!aprSuggestion) return;
    if (!aprSourceIsCurrent(aprSuggestion.source)) {
      setAprRefinementConsent(false);
      report(
        new Error(
          "This accomplishment changed. Analyze it again before refining.",
        ),
      );
      return;
    }
    const answers = currentAprAnswers();
    if (!answers.length) {
      setAprRefinementConsent(false);
      report(new Error("Answer at least one APR question before refining."));
      return;
    }
    setBusy("refine");
    try {
      const value = await refineAccomplishment(
        aprSuggestion.source,
        aprSuggestion.value.questions,
        answers,
        aprRefinementConsent,
      );
      setAprRefinement({
        value,
        source: aprSuggestion.source,
        answers,
      });
      setNotice({
        kind: "success",
        text: "Your refined rewrite is ready to review. Your resume has not been changed.",
      });
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
      setAprRefinementConsent(false);
    }
  }

  function applyAprSuggestion() {
    if (!resume || !aprSuggestion) return;
    if (!aprSourceIsCurrent(aprSuggestion.source)) {
      report(
        new Error(
          "This accomplishment changed. Analyze it again before applying.",
        ),
      );
      return;
    }
    const rewrite = aprSuggestion.value.rewrite;
    try {
      changeResume(
        applyAprRewrite(resume, aprSuggestion.source, rewrite ?? ""),
      );
      setUndo(resume);
      resetApr();
      setNotice({
        kind: "success",
        text: "APR rewrite applied to one accomplishment. You can undo this until your next edit.",
      });
    } catch (error) {
      report(error);
    }
  }

  function applyAprRefinement() {
    if (!resume || !aprRefinement) return;
    if (!aprRefinementIsCurrent(aprRefinement)) {
      report(
        new Error(
          "This accomplishment or its answers changed. Refine it again before applying.",
        ),
      );
      return;
    }
    try {
      changeResume(
        applyAprRewrite(
          resume,
          aprRefinement.source,
          aprRefinement.value.rewrite,
        ),
      );
      setUndo(resume);
      resetApr();
      setNotice({
        kind: "success",
        text: "Refined APR rewrite applied to one accomplishment. You can undo this until your next edit.",
      });
    } catch (error) {
      report(error);
    }
  }

  function removeResume() {
    if (!workspace || !deleteId) return;
    const remaining = workspace.resumes.filter((item) => item.id !== deleteId);
    if (!remaining.length) remaining.push(createResume());
    update({
      ...workspace,
      resumes: remaining,
      activeResumeId:
        workspace.activeResumeId === deleteId
          ? remaining[0].id
          : workspace.activeResumeId,
    });
    setDeleteId(null);
    setSuggestion(null);
    setConsent(false);
    resetApr();
    setUndo(null);
  }

  if (!workspace || !resume) {
    return (
      <main className="loading-screen">
        <img src="/hireloom.svg" width="60" height="60" alt="" />
        <h1>Hireloom</h1>
        {loadError ? (
          <div className="load-error" role="alert">
            <h2>We couldn't open your workspace.</h2>
            <p>{loadError}</p>
            <p>
              Your saved data has not been changed. Restore or repair your
              backup before continuing.
            </p>
            <button className="button primary" onClick={() => void reload()}>
              Try again
            </button>
          </div>
        ) : (
          <p>
            <LoaderCircle size={18} className="spin" /> Opening your next
            chapter…
          </p>
        )}
      </main>
    );
  }

  const readiness = resumeReadiness(resume);
  const completed = readiness.filter((item) => item.complete).length;
  const allBusy = blocked || exporting;

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Workspace navigation">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setLibrary(false);
          }}
        >
          <img src="/hireloom.svg" alt="" />
          <span>
            hireloom<span className="brand-period">.</span>
          </span>
        </a>
        <p className="brand-caption">YOUR NEXT CHAPTER</p>
        <button
          className="button primary new-resume"
          disabled={allBusy}
          onClick={() => addResume()}
        >
          <Plus size={17} /> New resume
        </button>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          <button
            className={`nav-item ${!library ? "active" : ""}`}
            disabled={blocked}
            onClick={() => setLibrary(false)}
          >
            <FileText size={18} /> Resume studio <ChevronRight size={14} />
          </button>
          <button
            className={`nav-item ${library ? "active" : ""}`}
            disabled={blocked}
            onClick={() => setLibrary(true)}
          >
            <FolderOpen size={18} /> My resumes{" "}
            <span className="count">{workspace.resumes.length}</span>
          </button>
        </nav>
        <div className="sidebar-resumes">
          <span className="nav-label">YOUR DOCUMENTS</span>
          {workspace.resumes
            .slice(-5)
            .reverse()
            .map((item) => (
              <button
                key={item.id}
                disabled={blocked}
                className={`resume-link ${item.id === resume.id ? "selected" : ""}`}
                onClick={() => selectResume(item.id)}
              >
                <span className="document-dot" />
                <span>{item.title}</span>
              </button>
            ))}
        </div>
        <div className="sidebar-bottom">
          <div className="copilot-promo">
            <div className="promo-top">
              <Github size={23} />
              <span className="tiny-badge">YOUR AI CO-PILOT</span>
            </div>
            <h3>
              A stronger story.
              <br />
              Still entirely yours.
            </h3>
            <p>
              Bring your experience.
              <br />
              Let Copilot help with the words.
            </p>
            <button
              disabled={blocked}
              onClick={() => {
                setTab("copilot");
                setLibrary(false);
              }}
            >
              Meet your writing partner <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="local-status">
            <LockKeyhole size={15} />
            <span>
              {desktop
                ? "Local-first. Yours to keep."
                : "Browser preview · local storage"}
            </span>
          </div>
          <p className="sidebar-version">
            HIRELOOM <span>v0.1</span>
          </p>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>{library ? "My resumes" : "Resume studio"}</strong>
          </div>
          <div className="topbar-right">
            <span className="private-badge">
              <ShieldCheck size={14} /> Private by default
            </span>
            <div className="avatar" aria-label="Local workspace">
              {resume.basics.name.slice(0, 1).toUpperCase() || "H"}
            </div>
          </div>
        </header>
        {notice && (
          <div
            className={`notice ${notice.kind}`}
            role={notice.kind === "error" ? "alert" : "status"}
          >
            <span>
              {notice.kind === "success" && <CheckCircle2 size={16} />}
              {notice.text}
            </span>
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setNotice(null)}
            >
              <X size={15} />
            </button>
          </div>
        )}
        {saveError && (
          <div className="save-error" role="alert">
            <strong>Your latest changes are not saved.</strong>
            <span>{saveError}</span>
            <button
              className="text-button"
              onClick={() => void flush().catch(report)}
            >
              Retry save
            </button>
            <button className="text-button" onClick={() => void exportBackup()}>
              Export recovery backup
            </button>
          </div>
        )}
        <section className="workspace-heading">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" /> A LITTLE CLARITY. A LOT OF
              POSSIBILITY.
            </div>
            <h1>
              {library
                ? "A story for every opportunity."
                : "Make your next move."}
            </h1>
            <p>
              {library
                ? "Keep a thoughtful version for each role. Your work stays on this device."
                : "Your experience, beautifully told. Let's make a resume that feels like you."}
            </p>
          </div>
          <div className="heading-detail">
            <span className="decorative-sparkle">✧</span>
            <span>
              Made for
              <br />
              <strong>what's next.</strong>
            </span>
          </div>
        </section>
        {library ? (
          <section className="library">
            <div className="library-toolbar">
              <span>
                {workspace.resumes.length} local document
                {workspace.resumes.length === 1 ? "" : "s"}
              </span>
              <div className="button-row">
                <button
                  className="button secondary small"
                  onClick={() => importInput.current?.click()}
                >
                  <Upload size={14} /> Import backup
                </button>
                <button
                  className="button secondary small"
                  onClick={() => void exportBackup()}
                >
                  <ArrowDownToLine size={14} /> Back up all
                </button>
              </div>
            </div>
            <div className="resume-grid">
              {workspace.resumes.map((item) => (
                <div className="library-card" key={item.id}>
                  <button
                    className="library-card-open"
                    onClick={() => selectResume(item.id)}
                  >
                    <div
                      className={`library-thumbnail template-${item.template}`}
                    >
                      <FileText size={24} />
                      <h3>{item.basics.name || "Your name"}</h3>
                      <p>{item.basics.headline || "Your next chapter"}</p>
                      <div />
                      <div />
                      <div />
                    </div>
                    <strong>{item.title}</strong>
                    <span>
                      Edited{" "}
                      {new Date(item.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </button>
                  <div className="library-card-actions">
                    <button
                      className="text-button"
                      onClick={() =>
                        addResume({
                          ...structuredClone(item),
                          id: crypto.randomUUID(),
                          title: `${item.title.slice(0, 110)} (copy)`,
                          updatedAt: new Date().toISOString(),
                        })
                      }
                    >
                      <Copy size={13} /> Duplicate
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label={`Delete ${item.title}`}
                      onClick={() => setDeleteId(item.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
              <button className="new-document-card" onClick={() => addResume()}>
                <span>
                  <Plus size={23} />
                </span>
                <strong>A fresh start</strong>
                <p>Create a resume for your next opportunity.</p>
              </button>
            </div>
          </section>
        ) : (
          <section className="studio-frame" aria-label="Resume studio">
            <div className="document-toolbar">
              <div className="document-title">
                <span className="document-icon">
                  <FileText size={20} />
                </span>
                <div>
                  <input
                    aria-label="Resume title"
                    maxLength={120}
                    value={resume.title}
                    disabled={blocked}
                    onChange={(event) =>
                      changeResume({ ...resume, title: event.target.value })
                    }
                    onBlur={() => {
                      if (!resume.title.trim())
                        changeResume({ ...resume, title: "Untitled resume" });
                    }}
                  />
                  <span
                    className={saveError ? "unsaved-label" : "saved-label"}
                    aria-live="polite"
                  >
                    {saving || dirty ? (
                      <LoaderCircle size={11} className="spin" />
                    ) : saveError ? (
                      <Circle size={10} />
                    ) : (
                      <Check size={12} />
                    )}
                    {saveError
                      ? "Not saved"
                      : saving || dirty
                        ? "Saving…"
                        : desktop
                          ? "Autosaved on this device"
                          : "Autosaved in this browser"}
                  </span>
                </div>
              </div>
              <div className="document-actions">
                {undo && (
                  <button
                    className="icon-button"
                    aria-label="Undo AI changes"
                    onClick={() => {
                      changeResume(undo);
                      setNotice({
                        kind: "success",
                        text: "Previous wording restored.",
                      });
                    }}
                  >
                    <RotateCcw size={17} />
                  </button>
                )}
                <div className="more-container">
                  <button
                    className="icon-button"
                    aria-label="Document actions"
                    aria-expanded={showTools}
                    onClick={() => setShowTools(!showTools)}
                    disabled={blocked}
                  >
                    <MoreHorizontal size={21} />
                  </button>
                  {showTools && (
                    <div className="tools-menu">
                      <button
                        onClick={() => {
                          addResume({
                            ...structuredClone(resume),
                            id: crypto.randomUUID(),
                            title: `${resume.title.slice(0, 110)} (copy)`,
                            updatedAt: new Date().toISOString(),
                          });
                          setShowTools(false);
                        }}
                      >
                        <Copy size={14} /> Duplicate resume
                      </button>
                      <button
                        onClick={() => {
                          void exportBackup();
                          setShowTools(false);
                        }}
                      >
                        <ArrowDownToLine size={14} /> Back up workspace
                      </button>
                      <button
                        onClick={() => {
                          importInput.current?.click();
                          setShowTools(false);
                        }}
                      >
                        <Upload size={14} /> Import JSON backup
                      </button>
                      <button
                        onClick={() => {
                          setDeleteId(resume.id);
                          setShowTools(false);
                        }}
                      >
                        <Trash2 size={14} /> Delete resume
                      </button>
                    </div>
                  )}
                </div>
                <button
                  className="button primary export-button"
                  disabled={allBusy}
                  onClick={() => void exportPdf()}
                >
                  {exporting ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <ArrowDownToLine size={16} />
                  )}
                  {exporting ? "Creating PDF…" : "Export PDF"}
                </button>
              </div>
            </div>
            <div className="studio">
              <div className="edit-pane">
                <div
                  className="editor-tabs"
                  role="tablist"
                  aria-label="Resume tools"
                >
                  {(
                    [
                      { id: "content", label: "Content", Icon: FileText },
                      { id: "copilot", label: "Copilot", Icon: Sparkles },
                      { id: "style", label: "Design", Icon: LayoutTemplate },
                    ] as const
                  ).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      id={`tab-${id}`}
                      role="tab"
                      aria-controls={`panel-${id}`}
                      aria-selected={tab === id}
                      tabIndex={tab === id ? 0 : -1}
                      disabled={blocked}
                      onClick={() => setTab(id)}
                      onKeyDown={(event) => {
                        const tabs: Tab[] = ["content", "copilot", "style"];
                        const direction =
                          event.key === "ArrowRight"
                            ? 1
                            : event.key === "ArrowLeft"
                              ? -1
                              : 0;
                        if (direction) {
                          event.preventDefault();
                          const next =
                            tabs[
                              (tabs.indexOf(tab) + direction + tabs.length) %
                                tabs.length
                            ];
                          setTab(next);
                          document.getElementById(`tab-${next}`)?.focus();
                        }
                      }}
                    >
                      <Icon size={15} />
                      {label}
                    </button>
                  ))}
                </div>
                <div className="editor-scroll">
                  {tab === "content" && (
                    <div
                      role="tabpanel"
                      id="panel-content"
                      aria-labelledby="tab-content"
                    >
                      <Editor
                        resume={resume}
                        onChange={changeResume}
                        onAi={() => setTab("copilot")}
                        onExample={() => addResume(exampleResume())}
                      />
                    </div>
                  )}
                  {tab === "copilot" && (
                    <div
                      role="tabpanel"
                      id="panel-copilot"
                      aria-labelledby="tab-copilot"
                    >
                      <fieldset
                        className="assistant-fieldset"
                        disabled={
                          busy === "generate" ||
                          busy === "analyze" ||
                          busy === "refine"
                        }
                      >
                        <CopilotPanel
                          resume={resume}
                          onChange={changeResume}
                          status={copilot}
                          busy={busy}
                          consent={consent}
                          onConsent={setConsent}
                          onRefresh={() => void refreshCopilot()}
                          onLogin={() => void login()}
                          onGenerate={() => void generate()}
                          proposal={suggestion?.value ?? null}
                          stale={
                            suggestion !== null &&
                            suggestion.source !== JSON.stringify(resume)
                          }
                          onApply={applySuggestions}
                          onDiscard={() => setSuggestion(null)}
                          aprTarget={aprTarget}
                          onSelectApr={selectAccomplishment}
                          aprConsent={aprConsent}
                          onAprConsent={setAprConsent}
                          onAnalyzeApr={() => void analyzeApr()}
                          aprAnalysis={aprSuggestion?.value ?? null}
                          aprStale={
                            aprSuggestion !== null &&
                            !aprSourceIsCurrent(aprSuggestion.source)
                          }
                          onApplyApr={applyAprSuggestion}
                          onDiscardApr={resetApr}
                          aprAnswers={aprAnswers}
                          onAprAnswer={changeAprAnswer}
                          aprRefinementConsent={aprRefinementConsent}
                          onAprRefinementConsent={setAprRefinementConsent}
                          onRefineApr={() => void refineApr()}
                          aprRefinement={aprRefinement?.value ?? null}
                          aprRefinementStale={
                            aprRefinement !== null &&
                            !aprRefinementIsCurrent(aprRefinement)
                          }
                          onApplyAprRefinement={applyAprRefinement}
                        />
                      </fieldset>
                    </div>
                  )}
                  {tab === "style" && (
                    <div
                      role="tabpanel"
                      id="panel-style"
                      aria-labelledby="tab-style"
                    >
                      <StylePanel resume={resume} onChange={changeResume} />
                    </div>
                  )}
                </div>
                <div className="editor-footer">
                  <LockKeyhole size={12} /> No account needed to create, save,
                  or export.
                </div>
              </div>
              <div className="preview-pane">
                <div className="preview-toolbar">
                  <span>
                    <span className="live-dot" /> LIVE PREVIEW
                  </span>
                  <span>
                    A4 <span className="toolbar-divider">/</span>{" "}
                    {resume.template === "editorial" ? "Editorial" : "Modern"}{" "}
                    <button
                      className="text-button"
                      disabled={blocked}
                      onClick={() => setTab("style")}
                    >
                      Change
                    </button>
                  </span>
                </div>
                <div className="paper-scroll">
                  <ResumePreview resume={resume} />
                  <p className="preview-caption">
                    <ShieldCheck size={13} /> Selectable text. Clean layout. No
                    watermarks.
                  </p>
                </div>
                <div className="readiness-bar">
                  <div className="readiness-heading">
                    <span>
                      <CheckCircle2 size={17} />
                      <strong>Resume essentials</strong>
                    </span>
                    <span>
                      {completed} of {readiness.length} ready
                    </span>
                  </div>
                  <div className="readiness-track">
                    <span
                      style={{
                        width: `${(completed / readiness.length) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="readiness-items">
                    {readiness.map((item) => (
                      <span
                        key={item.label}
                        className={item.complete ? "complete" : ""}
                        title={item.label}
                      >
                        {item.complete ? (
                          <Check size={11} />
                        ) : (
                          <Circle size={9} />
                        )}
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
        <footer className="page-footer">
          <span>Thoughtfully crafted. Authentically you.</span>
          <button className="text-button" onClick={() => setShowLicense(true)}>
            Font licenses
          </button>
          <span>HIRING IS HUMAN. YOUR RESUME SHOULD BE, TOO.</span>
        </footer>
      </main>
      <input
        className="visually-hidden"
        ref={importInput}
        type="file"
        accept=".json,application/json"
        aria-label="Import Hireloom backup"
        onChange={(event) => void importBackup(event)}
        tabIndex={-1}
      />
      {deleteId && (
        <DeleteDialog
          title={
            workspace.resumes.find((item) => item.id === deleteId)?.title ??
            "this resume"
          }
          onCancel={() => setDeleteId(null)}
          onDelete={removeResume}
        />
      )}
      {showLicense && <LicenseDialog onClose={() => setShowLicense(false)} />}
    </div>
  );
}

function LicenseDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog license-dialog"
      onCancel={onClose}
      aria-labelledby="license-title"
    >
      <div className="card-heading">
        <h2 id="license-title">Noto font licenses</h2>
        <button
          autoFocus
          className="icon-button"
          aria-label="Close font licenses"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <p>
        Noto Sans and Noto Serif are bundled locally and used in your exported
        PDFs.
      </p>
      <pre>{fontLicense}</pre>
    </dialog>
  );
}

function DeleteDialog({
  title,
  onCancel,
  onDelete,
}: {
  title: string;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      onCancel={onCancel}
      aria-labelledby="delete-title"
    >
      <span className="dialog-icon">
        <Trash2 size={23} />
      </span>
      <h2 id="delete-title">Delete this chapter?</h2>
      <p>
        “{title}” will be removed from this device. This cannot be undone.
        Export a backup first if you want to keep a copy.
      </p>
      <div className="button-row">
        <button autoFocus className="button secondary" onClick={onCancel}>
          <ArrowLeft size={15} /> Keep resume
        </button>
        <button className="button destructive" onClick={onDelete}>
          Delete resume
        </button>
      </div>
    </dialog>
  );
}

export default App;

use crate::providers::{AiSettings, ProviderCredentialStatus, ProviderKind};
use serde::{Deserialize, Serialize};
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};

pub const AI_CANCELLED_MESSAGE: &str = "AI request cancelled.";

#[derive(Clone, Default, Debug)]
pub struct AiCancelFlag(Arc<AtomicBool>);

impl AiCancelFlag {
    pub fn new() -> Self {
        Self(Arc::new(AtomicBool::new(false)))
    }

    pub fn cancel(&self) {
        self.0.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }

    pub fn ensure_not_cancelled(&self) -> CommandResult<()> {
        if self.is_cancelled() {
            Err(AI_CANCELLED_MESSAGE.to_string())
        } else {
            Ok(())
        }
    }

    pub(crate) fn ptr_eq(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.0, &other.0)
    }
}

pub(crate) const WORKSPACE_VERSION: u32 = 2;
pub(crate) const WORKSPACE_FILE: &str = "workspace.json";
pub(crate) const MAX_WORKSPACE_BYTES: usize = 2 * 1024 * 1024;
pub(crate) const MAX_EXPORT_BYTES: usize = 20 * 1024 * 1024;
pub(crate) const MAX_GENERATION_OUTPUT_BYTES: usize = 128 * 1024;
pub(crate) const MAX_PROMPT_BYTES: usize = 256 * 1024;
pub(crate) const MAX_RESUMES: usize = 50;
pub(crate) const MAX_EXPERIENCE: usize = 30;
pub(crate) const MAX_PROJECTS: usize = 20;
pub(crate) const MAX_EDUCATION: usize = 20;
pub(crate) const MAX_CERTIFICATIONS: usize = 20;
pub(crate) const MAX_CUSTOM_SECTIONS: usize = 10;
pub(crate) const MAX_CUSTOM_ENTRIES: usize = 20;
pub(crate) const MAX_SKILL_GROUPS: usize = 20;
pub(crate) const MAX_SKILLS_PER_GROUP: usize = 50;
pub(crate) const MAX_SKIPPED_KEYWORDS: usize = 200;
pub(crate) const MAX_LIBRARY_EXPERIENCES: usize = 50;
pub(crate) const MAX_LIBRARY_PROJECTS: usize = 40;
pub(crate) const MAX_LIBRARY_EDUCATION: usize = 30;
pub(crate) const MAX_LIBRARY_CERTIFICATIONS: usize = 30;
pub(crate) const MAX_LIBRARY_SKILL_GROUPS: usize = 30;
pub(crate) const MAX_BULLETS: usize = 30;
pub(crate) const MAX_SKILLS: usize = 100;
pub(crate) const MAX_ID_BYTES: usize = 100;
pub(crate) const MAX_TITLE_BYTES: usize = 120;
pub(crate) const MAX_SHORT_TEXT_BYTES: usize = 500;
pub(crate) const MAX_SUMMARY_BYTES: usize = 10_000;
pub(crate) const MAX_JOB_DESCRIPTION_BYTES: usize = 20_000;
pub(crate) const MAX_BULLET_BYTES: usize = 2_000;
pub(crate) const MAX_PROPOSAL_NOTES: usize = 20;
pub(crate) const MAX_APR_QUESTIONS: usize = 5;
pub(crate) const MAX_SUMMARY_OPTIONS: usize = 3;
pub(crate) const MAX_IMPORT_LINES: usize = 600;
pub(crate) const MAX_IMPORT_PROMPT_BYTES: usize = 60_000;
pub(crate) const SECTION_COUNT: usize = 7;
#[cfg(test)]
pub(crate) const COPILOT_MODEL: &str = crate::providers::DEFAULT_COPILOT_MODEL;
pub(crate) const COPILOT_TIMEOUT: Duration = Duration::from_secs(180);
pub(crate) const COPILOT_VERSION_TIMEOUT: Duration = Duration::from_secs(5);

pub(crate) type CommandResult<T> = Result<T, String>;

pub(crate) fn default_section_order() -> Vec<SectionKey> {
    vec![
        SectionKey::Summary,
        SectionKey::Experience,
        SectionKey::Projects,
        SectionKey::Education,
        SectionKey::Certifications,
        SectionKey::Skills,
        SectionKey::Custom,
    ]
}

pub(crate) fn default_page_size() -> PageSize {
    PageSize::A4
}

pub(crate) fn default_density() -> Density {
    Density::Standard
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Resume {
    pub id: String,
    pub title: String,
    pub updated_at: String,
    pub basics: Basics,
    pub summary: String,
    pub experience: Vec<Experience>,
    #[serde(default)]
    pub projects: Vec<Project>,
    pub education: Vec<Education>,
    #[serde(default)]
    pub certifications: Vec<Certification>,
    #[serde(default)]
    pub custom_sections: Vec<CustomSection>,
    pub skills: Vec<String>,
    #[serde(default)]
    pub skill_groups: Vec<SkillGroup>,
    #[serde(default = "default_section_order")]
    pub section_order: Vec<SectionKey>,
    #[serde(default)]
    pub skipped_keywords: Vec<String>,
    pub job_description: String,
    pub template: Template,
    pub accent: Accent,
    #[serde(default = "default_page_size")]
    pub page_size: PageSize,
    #[serde(default = "default_density")]
    pub density: Density,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Basics {
    pub name: String,
    pub headline: String,
    pub email: String,
    pub phone: String,
    pub location: String,
    pub website: String,
    #[serde(default)]
    pub github: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Experience {
    pub id: String,
    pub role: String,
    pub company: String,
    pub location: String,
    pub start_date: String,
    pub end_date: String,
    pub bullets: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub library_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub subtitle: String,
    pub url: String,
    pub start_date: String,
    pub end_date: String,
    pub bullets: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub library_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Education {
    pub id: String,
    pub school: String,
    pub degree: String,
    pub graduation: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub library_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Certification {
    pub id: String,
    pub name: String,
    pub issuer: String,
    pub date: String,
    pub url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub library_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SkillGroup {
    pub id: String,
    pub category: String,
    pub items: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub library_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CustomEntry {
    pub id: String,
    pub heading: String,
    pub subheading: String,
    pub date: String,
    pub bullets: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CustomSection {
    pub id: String,
    pub title: String,
    pub entries: Vec<CustomEntry>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SectionKey {
    Summary,
    Experience,
    Projects,
    Education,
    Certifications,
    Skills,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Template {
    Editorial,
    Modern,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Accent {
    Teal,
    Indigo,
    Charcoal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PageSize {
    A4,
    Letter,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Density {
    Compact,
    Standard,
    Spacious,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CareerLibrary {
    #[serde(default)]
    pub experiences: Vec<Experience>,
    #[serde(default)]
    pub projects: Vec<Project>,
    #[serde(default)]
    pub education: Vec<Education>,
    #[serde(default)]
    pub certifications: Vec<Certification>,
    #[serde(default)]
    pub skill_groups: Vec<SkillGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Workspace {
    pub version: u32,
    pub active_resume_id: String,
    pub resumes: Vec<Resume>,
    #[serde(default)]
    pub career_library: CareerLibrary,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct WorkspaceV1 {
    pub(crate) version: u32,
    pub(crate) active_resume_id: String,
    pub(crate) resumes: Vec<Resume>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GroundingStatus {
    Supported,
    Inferred,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GroundingItem {
    pub key: String,
    pub status: GroundingStatus,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GroundingReport {
    pub provider: ProviderKind,
    pub model: String,
    pub items: Vec<GroundingItem>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct GroundingVerifierResponse {
    pub(crate) items: Vec<GroundingItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AiProposal {
    pub summary: String,
    pub experience: Vec<ProposalExperience>,
    #[serde(default)]
    pub projects: Vec<ProposalExperience>,
    pub notes: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verification: Option<GroundingReport>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verification_warning: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProposalExperience {
    pub id: String,
    pub bullets: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SummaryOption {
    pub label: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SummaryOptionsProposal {
    pub options: Vec<SummaryOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RoleTailorProposal {
    pub entry_id: String,
    pub bullets: Vec<String>,
    pub notes: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verification: Option<GroundingReport>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verification_warning: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct RoleTailorRawResponse {
    pub(crate) entry_id: String,
    pub(crate) bullets: Vec<String>,
    pub(crate) notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportedExperienceDraft {
    pub role: String,
    pub company: String,
    pub location: String,
    pub start_date: String,
    pub end_date: String,
    pub bullets: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportedProjectDraft {
    pub name: String,
    pub subtitle: String,
    pub start_date: String,
    pub end_date: String,
    pub bullets: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportedEducationDraft {
    pub school: String,
    pub degree: String,
    pub graduation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportedCertificationDraft {
    pub name: String,
    pub issuer: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportedSkillGroupDraft {
    pub category: String,
    pub items: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportedStructureProposal {
    pub headline: String,
    pub summary: String,
    #[serde(default)]
    pub experience: Vec<ImportedExperienceDraft>,
    #[serde(default)]
    pub projects: Vec<ImportedProjectDraft>,
    #[serde(default)]
    pub education: Vec<ImportedEducationDraft>,
    #[serde(default)]
    pub certifications: Vec<ImportedCertificationDraft>,
    #[serde(default)]
    pub skills: Vec<String>,
    #[serde(default)]
    pub skill_groups: Vec<ImportedSkillGroupDraft>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AprTarget {
    pub resume_id: String,
    pub experience_id: String,
    pub bullet_index: usize,
    pub role: String,
    pub bullet: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub focus_keyword: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AprStatus {
    Clear,
    Partial,
    Missing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AprDimension {
    pub status: AprStatus,
    pub feedback: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AprAnalysis {
    pub target: AprTarget,
    pub action: AprDimension,
    pub project: AprDimension,
    pub result: AprDimension,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rewrite: Option<String>,
    pub questions: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verification: Option<GroundingReport>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verification_warning: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AprQuestionAnswer {
    pub question: String,
    pub answer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AprRefinement {
    pub target: AprTarget,
    pub answers: Vec<AprQuestionAnswer>,
    pub rewrite: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verification: Option<GroundingReport>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verification_warning: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderStatusResponse {
    pub settings: AiSettings,
    pub copilot: CopilotStatus,
    pub providers: Vec<ProviderCredentialStatus>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AprCopilotResponse {
    pub(crate) action: AprDimension,
    pub(crate) project: AprDimension,
    pub(crate) result: AprDimension,
    pub(crate) rewrite: Option<String>,
    pub(crate) questions: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AprRefinementCopilotResponse {
    pub(crate) rewrite: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CopilotStatus {
    pub available: bool,
    pub version: Option<String>,
    pub detail: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportKind {
    Pdf,
    Docx,
    Json,
}

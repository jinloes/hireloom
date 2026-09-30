//! Shared persistence and IPC contract: limits, model routes, and DTOs mirrored by `src/model.ts`.

use serde::{Deserialize, Serialize};
use std::time::Duration;

pub(crate) const WORKSPACE_VERSION: u32 = 2;
pub(crate) const WORKSPACE_FILE: &str = "workspace.json";
pub(crate) const MAX_WORKSPACE_BYTES: usize = 2 * 1024 * 1024;
pub(crate) const MAX_EXPORT_BYTES: usize = 20 * 1024 * 1024;
pub(crate) const MAX_GENERATION_OUTPUT_BYTES: usize = 128 * 1024;
pub(crate) const MAX_PROMPT_BYTES: usize = 256 * 1024;
pub(crate) const MAX_RESUMES: usize = 50;
pub(crate) const MAX_EXPERIENCE: usize = 30;
pub(crate) const MAX_EDUCATION: usize = 20;
pub(crate) const MAX_ADDITIONAL_ENTRIES: usize = 20;
pub(crate) const MAX_BULLETS: usize = 30;
pub(crate) const MAX_SKILLS: usize = 100;
pub(crate) const MAX_ID_BYTES: usize = 100;
pub(crate) const MAX_TITLE_BYTES: usize = 120;
pub(crate) const MAX_SHORT_TEXT_BYTES: usize = 500;
pub(crate) const MAX_SUMMARY_BYTES: usize = 10_000;
pub(crate) const MAX_JOB_DESCRIPTION_BYTES: usize = 20_000;
pub(crate) const MAX_BULLET_BYTES: usize = 2_000;
pub(crate) const MAX_PROPOSAL_NOTES: usize = 20;
pub(crate) const MAX_APR_OPTIONS: usize = 3;
pub(crate) const GENERATE_RESUME_MODEL: &str = "gpt-5.6-luna";
pub(crate) const INLINE_APR_MODEL: &str = "gemini-3.8-flash";
pub(crate) const COPILOT_TIMEOUT: Duration = Duration::from_secs(180);
pub(crate) const COPILOT_VERSION_TIMEOUT: Duration = Duration::from_secs(5);

pub(crate) type CommandResult<T> = Result<T, String>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Resume {
    pub id: String,
    pub title: String,
    pub updated_at: String,
    pub basics: Basics,
    pub summary: String,
    pub experience: Vec<Experience>,
    pub education: Vec<Education>,
    pub skills: Vec<String>,
    #[serde(default)]
    pub target_job: TargetJob,
    #[serde(default)]
    pub projects: Vec<Project>,
    #[serde(default)]
    pub certifications: Vec<Certification>,
    #[serde(default)]
    pub awards: Vec<Award>,
    #[serde(default)]
    pub volunteer: Vec<Volunteer>,
    #[serde(default)]
    pub publications: Vec<Publication>,
    #[serde(default)]
    pub languages: Vec<Language>,
    #[serde(default = "default_additional_section_order")]
    pub additional_section_order: Vec<AdditionalSection>,
    #[serde(default, rename = "jobDescription", skip_serializing)]
    pub(crate) legacy_job_description: Option<String>,
    pub template: Template,
    pub accent: Accent,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Education {
    pub id: String,
    pub school: String,
    pub degree: String,
    pub graduation: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TargetJob {
    pub title: String,
    pub company: String,
    pub source_url: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub role: String,
    pub url: String,
    pub start_date: String,
    pub end_date: String,
    pub bullets: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Certification {
    pub id: String,
    pub name: String,
    pub issuer: String,
    pub date: String,
    pub credential_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Award {
    pub id: String,
    pub title: String,
    pub issuer: String,
    pub date: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Volunteer {
    pub id: String,
    pub organization: String,
    pub role: String,
    pub start_date: String,
    pub end_date: String,
    pub bullets: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Publication {
    pub id: String,
    pub title: String,
    pub publisher: String,
    pub date: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Language {
    pub id: String,
    pub name: String,
    pub proficiency: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AdditionalSection {
    Projects,
    Certifications,
    Awards,
    Volunteer,
    Publications,
    Languages,
}

pub(crate) fn default_additional_section_order() -> Vec<AdditionalSection> {
    vec![
        AdditionalSection::Projects,
        AdditionalSection::Certifications,
        AdditionalSection::Awards,
        AdditionalSection::Volunteer,
        AdditionalSection::Publications,
        AdditionalSection::Languages,
    ]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Workspace {
    pub version: u32,
    pub active_resume_id: String,
    pub resumes: Vec<Resume>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AiProposal {
    pub summary: String,
    pub experience: Vec<ProposalExperience>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProposalExperience {
    pub id: String,
    pub bullets: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AprTarget {
    pub resume_id: String,
    pub experience_id: String,
    pub bullet_index: usize,
    pub role: String,
    pub bullet: String,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AprOptionId {
    Concise,
    DetailForward,
    Split,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AprOption {
    pub id: AprOptionId,
    pub bullets: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AprAnalysis {
    pub target: AprTarget,
    pub action: AprDimension,
    pub project: AprDimension,
    pub result: AprDimension,
    pub options: Vec<AprOption>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AprCopilotResponse {
    pub(crate) action: AprDimension,
    pub(crate) project: AprDimension,
    pub(crate) result: AprDimension,
    pub(crate) options: Vec<AprOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HighlightReview {
    pub target: AprTarget,
    pub action: AprStatus,
    pub project: AprStatus,
    pub result: AprStatus,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct HighlightReviewVerdict {
    pub(crate) index: usize,
    pub(crate) action: AprStatus,
    pub(crate) project: AprStatus,
    pub(crate) result: AprStatus,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct HighlightReviewResponse {
    pub(crate) reviews: Vec<HighlightReviewVerdict>,
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
    Json,
}

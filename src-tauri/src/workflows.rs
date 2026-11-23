use crate::{
    apr_responses::*,
    contract::*,
    copilot::{run_copilot_prompt, ReasoningEffort},
    prompts::*,
    providers::{
        resolve_api_key, run_http_provider_prompt_cancellable, validate_model_id, AiSettings,
        HttpEndpoints, OsKeyringStore, ProviderKind,
    },
    responses::*,
    storage::load_ai_settings_for_app,
};
use serde_json::json;
use std::collections::HashSet;
use tauri::AppHandle;

pub(crate) fn run_ai_prompt(
    app: &AppHandle,
    settings: &AiSettings,
    provider: ProviderKind,
    model: &str,
    prompt: &str,
    effort: ReasoningEffort,
    cancel: &AiCancelFlag,
) -> CommandResult<Vec<u8>> {
    cancel.ensure_not_cancelled()?;
    if prompt.len() > MAX_PROMPT_BYTES {
        return Err("AI request exceeds the 256 KB limit".to_string());
    }
    validate_model_id(provider, model)?;
    match provider {
        ProviderKind::Copilot => run_copilot_prompt(app, model, prompt, effort, cancel),
        ProviderKind::Openai
        | ProviderKind::Anthropic
        | ProviderKind::Gemini
        | ProviderKind::Ollama => {
            let api_key = resolve_api_key(&OsKeyringStore, provider)?;
            run_http_provider_prompt_cancellable(
                provider,
                model,
                prompt,
                api_key.as_deref(),
                &settings.ollama_base_url,
                &HttpEndpoints::default(),
                COPILOT_TIMEOUT,
                MAX_GENERATION_OUTPUT_BYTES,
                Some(cancel),
            )
        }
    }
}

fn maybe_verify_grounding(
    app: &AppHandle,
    settings: &AiSettings,
    source_facts: &serde_json::Value,
    candidate_items: &[(String, String)],
    cancel: &AiCancelFlag,
) -> CommandResult<(Option<GroundingReport>, Option<String>)> {
    cancel.ensure_not_cancelled()?;
    if !settings.verifier_enabled || candidate_items.is_empty() {
        return Ok((None, None));
    }
    let non_empty: Vec<&(String, String)> = candidate_items
        .iter()
        .filter(|(_, text)| !text.trim().is_empty())
        .collect();
    if non_empty.is_empty() {
        return Ok((None, None));
    }
    let prompt = match build_grounding_prompt(source_facts, &non_empty) {
        Ok(prompt) => prompt,
        Err(error) => return Ok((None, Some(error))),
    };
    let expected_keys: HashSet<&str> = non_empty.iter().map(|(k, _)| k.as_str()).collect();
    match run_ai_prompt(
        app,
        settings,
        settings.verifier_provider,
        &settings.verifier_model,
        &prompt,
        ReasoningEffort::Low,
        cancel,
    )
    .and_then(|output| parse_grounding_response(&output, &expected_keys))
    {
        Ok(items) => Ok((
            Some(GroundingReport {
                provider: settings.verifier_provider,
                model: settings.verifier_model.clone(),
                items,
            }),
            None,
        )),
        Err(error) if error == AI_CANCELLED_MESSAGE => Err(error),
        Err(error) => Ok((
            None,
            Some(format!(
                "Second-model grounding check could not run ({error}); review claims manually."
            )),
        )),
    }
}

pub(crate) fn generate_resume_with_provider(
    app: &AppHandle,
    resume: &Resume,
    cancel: &AiCancelFlag,
) -> CommandResult<AiProposal> {
    let settings = load_ai_settings_for_app(app)?;
    let prompt = build_generation_prompt(resume)?;
    let output = run_ai_prompt(
        app,
        &settings,
        settings.primary_provider,
        &settings.primary_model,
        &prompt,
        ReasoningEffort::Low,
        cancel,
    )?;
    let mut proposal = parse_ai_proposal_with_projects(
        &output,
        resume.experience.iter().map(|entry| entry.id.as_str()),
        resume.projects.iter().map(|entry| entry.id.as_str()),
    )?;

    if settings.verifier_enabled {
        let mut candidates: Vec<(String, String)> = Vec::new();
        if !proposal.summary.trim().is_empty() {
            candidates.push(("summary".to_string(), proposal.summary.clone()));
        }
        for exp in &proposal.experience {
            for (idx, b) in exp.bullets.iter().enumerate() {
                candidates.push((format!("experience:{}:{idx}", exp.id), b.clone()));
            }
        }
        for proj in &proposal.projects {
            for (idx, b) in proj.bullets.iter().enumerate() {
                candidates.push((format!("project:{}:{idx}", proj.id), b.clone()));
            }
        }
        let source_facts = redacted_resume_facts_json(resume);
        let (verification, warning) =
            maybe_verify_grounding(app, &settings, &source_facts, &candidates, cancel)?;
        proposal.verification = verification;
        proposal.verification_warning = warning;
    }
    Ok(proposal)
}

pub(crate) fn generate_summary_options_with_provider(
    app: &AppHandle,
    resume: &Resume,
    cancel: &AiCancelFlag,
) -> CommandResult<SummaryOptionsProposal> {
    let settings = load_ai_settings_for_app(app)?;
    let prompt = build_summary_options_prompt(resume)?;
    let output = run_ai_prompt(
        app,
        &settings,
        settings.primary_provider,
        &settings.primary_model,
        &prompt,
        ReasoningEffort::Low,
        cancel,
    )?;
    parse_summary_options_response(&output)
}

pub(crate) fn tailor_experience_role_with_provider(
    app: &AppHandle,
    resume: &Resume,
    entry_id: &str,
    cancel: &AiCancelFlag,
) -> CommandResult<RoleTailorProposal> {
    let settings = load_ai_settings_for_app(app)?;
    let (prompt, source_facts) = build_role_tailor_prompt(resume, entry_id)?;
    let output = run_ai_prompt(
        app,
        &settings,
        settings.primary_provider,
        &settings.primary_model,
        &prompt,
        ReasoningEffort::Low,
        cancel,
    )?;
    let mut proposal = parse_role_tailor_response(&output, entry_id)?;
    if settings.verifier_enabled {
        let candidates: Vec<(String, String)> = proposal
            .bullets
            .iter()
            .enumerate()
            .map(|(idx, b)| (format!("bullet:{idx}"), b.clone()))
            .collect();
        let (verification, warning) =
            maybe_verify_grounding(app, &settings, &source_facts, &candidates, cancel)?;
        proposal.verification = verification;
        proposal.verification_warning = warning;
    }
    Ok(proposal)
}

pub(crate) fn structure_imported_resume_with_provider(
    app: &AppHandle,
    redacted_lines: &[String],
    cancel: &AiCancelFlag,
) -> CommandResult<ImportedStructureProposal> {
    let settings = load_ai_settings_for_app(app)?;
    let prompt = build_import_structure_prompt(redacted_lines)?;
    let output = run_ai_prompt(
        app,
        &settings,
        settings.primary_provider,
        &settings.primary_model,
        &prompt,
        ReasoningEffort::Low,
        cancel,
    )?;
    parse_imported_structure_response(&output)
}

pub(crate) fn analyze_accomplishment_with_provider(
    app: &AppHandle,
    target: &AprTarget,
    cancel: &AiCancelFlag,
) -> CommandResult<AprAnalysis> {
    validate_apr_target(target)?;
    let settings = load_ai_settings_for_app(app)?;
    let prompt = build_apr_prompt(
        &target.role,
        &target.bullet,
        target.focus_keyword.as_deref(),
    )?;
    let response = parse_apr_response(&run_ai_prompt(
        app,
        &settings,
        settings.primary_provider,
        &settings.primary_model,
        &prompt,
        ReasoningEffort::Medium,
        cancel,
    )?)?;
    let rewrite = normalize_optional_apr_rewrite(response.rewrite, &target.bullet);
    let mut verification = None;
    let mut verification_warning = None;
    if settings.verifier_enabled {
        if let Some(rewrite_text) = &rewrite {
            let source = json!({ "role": target.role, "bullet": target.bullet });
            let candidates = vec![("rewrite".to_string(), rewrite_text.clone())];
            let (rep, warn) = maybe_verify_grounding(app, &settings, &source, &candidates, cancel)?;
            verification = rep;
            verification_warning = warn;
        }
    }
    let analysis = AprAnalysis {
        target: target.clone(),
        action: response.action,
        project: response.project,
        result: response.result,
        rewrite,
        questions: response.questions,
        verification,
        verification_warning,
    };
    validate_apr_analysis(&analysis, target)?;
    Ok(analysis)
}

pub(crate) fn refine_accomplishment_with_provider(
    app: &AppHandle,
    target: &AprTarget,
    questions: &[String],
    answers: &[AprQuestionAnswer],
    cancel: &AiCancelFlag,
) -> CommandResult<AprRefinement> {
    validate_apr_target(target)?;
    validate_apr_question_answers(questions, answers)?;
    let settings = load_ai_settings_for_app(app)?;
    let prompt = build_apr_refinement_prompt(&target.role, &target.bullet, answers)?;
    let response = parse_apr_refinement_response(&run_ai_prompt(
        app,
        &settings,
        settings.primary_provider,
        &settings.primary_model,
        &prompt,
        ReasoningEffort::Low,
        cancel,
    )?)?;
    let mut verification = None;
    let mut verification_warning = None;
    if settings.verifier_enabled {
        let source = json!({
            "role": target.role,
            "bullet": target.bullet,
            "answers": answers,
        });
        let candidates = vec![("rewrite".to_string(), response.rewrite.clone())];
        let (rep, warn) = maybe_verify_grounding(app, &settings, &source, &candidates, cancel)?;
        verification = rep;
        verification_warning = warn;
    }
    let refinement = AprRefinement {
        target: target.clone(),
        answers: answers.to_vec(),
        rewrite: response.rewrite,
        verification,
        verification_warning,
    };
    validate_apr_refinement(&refinement, target, answers)?;
    Ok(refinement)
}

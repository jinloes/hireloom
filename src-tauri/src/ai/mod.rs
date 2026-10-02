//! AI request orchestration: prompt, model route, response parsing, and local target binding.

mod drafts;
mod prompts;
mod responses;

pub(crate) use drafts::validate_highlight_draft_target;
pub(crate) use responses::{validate_apr_options, validate_apr_options_changed};

#[cfg(all(test, unix))]
pub(crate) use responses::parse_ai_proposal;
#[cfg(test)]
pub(crate) use responses::parse_apr_response;

use crate::{contract::*, copilot::run_copilot_prompt, validation::*};
use drafts::*;
use prompts::*;
use responses::*;
use tauri::AppHandle;

pub(crate) async fn generate_resume_with_copilot(
    app: &AppHandle,
    resume: &Resume,
) -> CommandResult<AiProposal> {
    let prompt = build_generation_prompt(resume)?;
    let output = run_copilot_prompt(app, &prompt, GENERATE_RESUME_MODEL).await?;
    parse_ai_proposal(
        &output,
        resume.experience.iter().map(|entry| entry.id.as_str()),
    )
}

pub(crate) async fn analyze_accomplishment_with_copilot(
    app: &AppHandle,
    target: &AprTarget,
    review: Option<&HighlightReview>,
) -> CommandResult<AprAnalysis> {
    validate_apr_target(target)?;
    validate_apr_review(target, review)?;
    let prompt = build_apr_prompt(&target.role, &target.bullet, review)?;
    let response = parse_apr_response(&run_copilot_prompt(app, &prompt, INLINE_APR_MODEL).await?)?;
    let analysis = AprAnalysis {
        target: target.clone(),
        action: response.action,
        project: response.project,
        result: response.result,
        options: response.options,
    };
    validate_apr_analysis(&analysis, target)?;
    Ok(analysis)
}

pub(crate) async fn refine_accomplishment_with_copilot(
    app: &AppHandle,
    target: &AprTarget,
    options: &[AprOption],
    feedback: &str,
) -> CommandResult<AprAnalysis> {
    let prompt = build_apr_refinement_prompt(target, options, feedback)?;
    let response = parse_apr_response(&run_copilot_prompt(app, &prompt, INLINE_APR_MODEL).await?)?;
    let analysis = AprAnalysis {
        target: target.clone(),
        action: response.action,
        project: response.project,
        result: response.result,
        options: response.options,
    };
    validate_apr_analysis(&analysis, target)?;
    Ok(analysis)
}

pub(crate) async fn review_highlights_with_copilot(
    app: &AppHandle,
    targets: &[AprTarget],
) -> CommandResult<Vec<HighlightReview>> {
    let prompt = build_highlight_review_prompt(targets)?;
    let verdicts = parse_highlight_review_response(
        &run_copilot_prompt(app, &prompt, INLINE_APR_MODEL).await?,
        targets.len(),
    )?;
    bind_highlight_reviews(targets, verdicts)
}

pub(crate) async fn draft_highlights_with_copilot(
    app: &AppHandle,
    target: &HighlightDraftTarget,
) -> CommandResult<HighlightDraft> {
    let prompt = build_highlight_draft_prompt(target)?;
    let bullets = parse_highlight_draft_response(
        &run_copilot_prompt(app, &prompt, INLINE_APR_MODEL).await?,
        &target.notes,
    )?;
    Ok(HighlightDraft {
        target: target.clone(),
        bullets,
    })
}

pub(crate) fn bind_highlight_reviews(
    targets: &[AprTarget],
    verdicts: Vec<HighlightReviewVerdict>,
) -> CommandResult<Vec<HighlightReview>> {
    let mut reviews: Vec<Option<HighlightReview>> = vec![None; targets.len()];
    for verdict in verdicts {
        // Rebind every verdict to the unchanged local target at that index;
        // the model never supplies highlight text or identifiers.
        let slot = reviews
            .get_mut(verdict.index)
            .ok_or_else(|| "Copilot returned a review for an unknown highlight".to_string())?;
        if slot.is_some() {
            return Err("Copilot returned duplicate reviews for one highlight".to_string());
        }
        *slot = Some(HighlightReview {
            target: targets[verdict.index].clone(),
            action: verdict.action,
            project: verdict.project,
            result: verdict.result,
        });
    }
    reviews
        .into_iter()
        .map(|review| review.ok_or_else(|| "Copilot did not review every highlight".to_string()))
        .collect()
}

#[cfg(test)]
mod tests {
    #[test]
    fn copilot_model_call_sites_route_generation_and_apr_requests() {
        let source = include_str!("mod.rs");
        let generation = source
            .split_once("async fn generate_resume_with_copilot")
            .expect("generation function")
            .1
            .split_once("async fn analyze_accomplishment_with_copilot")
            .expect("analysis function boundary")
            .0;
        let analysis = source
            .split_once("async fn analyze_accomplishment_with_copilot")
            .expect("analysis function")
            .1
            .split_once("fn bind_highlight_reviews")
            .expect("request function boundary")
            .0;

        assert!(generation.contains("run_copilot_prompt(app, &prompt, GENERATE_RESUME_MODEL)"));
        assert!(!generation.contains("INLINE_APR_MODEL"));
        assert!(analysis.contains("run_copilot_prompt(app, &prompt, INLINE_APR_MODEL)"));
        assert!(!analysis.contains("GENERATE_RESUME_MODEL"));
        let drafts = source
            .split_once("async fn draft_highlights_with_copilot")
            .expect("draft function")
            .1
            .split_once("fn bind_highlight_reviews")
            .expect("draft function boundary")
            .0;
        assert!(drafts.contains("run_copilot_prompt(app, &prompt, INLINE_APR_MODEL)"));
        assert!(!drafts.contains("GENERATE_RESUME_MODEL"));
    }
}

use crate::{
    contract::*,
    validation::{validate_nonempty_text, validate_text},
};
use std::collections::HashSet;

pub(crate) fn normalize_optional_apr_rewrite(
    rewrite: Option<String>,
    original_bullet: &str,
) -> Option<String> {
    rewrite.filter(|candidate| {
        let trimmed = candidate.trim();
        !trimmed.is_empty() && candidate != original_bullet && trimmed != original_bullet.trim()
    })
}

pub(crate) fn parse_apr_response(output: &[u8]) -> CommandResult<AprCopilotResponse> {
    let mut last_error = None;
    for candidate in crate::responses::copilot_json_candidates(output)? {
        match serde_json::from_str::<AprCopilotResponse>(&candidate) {
            Ok(response) => match validate_apr_response(&response) {
                Ok(()) => return Ok(response),
                Err(error) => last_error = Some(error),
            },
            Err(error) => {
                last_error = Some(format!("Copilot response is not valid APR JSON: {error}"))
            }
        }
    }
    Err(last_error.unwrap_or_else(|| "Copilot response was empty".to_string()))
}

pub(crate) fn parse_apr_refinement_response(
    output: &[u8],
) -> CommandResult<AprRefinementCopilotResponse> {
    let mut last_error = None;
    for candidate in crate::responses::copilot_json_candidates(output)? {
        match serde_json::from_str::<AprRefinementCopilotResponse>(&candidate) {
            Ok(response) => match validate_nonempty_text(
                "APR refined rewrite",
                &response.rewrite,
                MAX_BULLET_BYTES,
            ) {
                Ok(()) => return Ok(response),
                Err(error) => last_error = Some(error),
            },
            Err(error) => {
                last_error = Some(format!(
                    "Copilot response is not valid APR refinement JSON: {error}"
                ))
            }
        }
    }
    Err(last_error.unwrap_or_else(|| "Copilot response was empty".to_string()))
}

pub(crate) fn validate_apr_target(target: &AprTarget) -> CommandResult<()> {
    validate_nonempty_text("resume id", &target.resume_id, MAX_ID_BYTES)?;
    validate_nonempty_text("experience id", &target.experience_id, MAX_ID_BYTES)?;
    if target.bullet_index >= MAX_BULLETS {
        return Err(format!(
            "Accomplishment index must be less than {MAX_BULLETS}"
        ));
    }
    validate_text("role", &target.role, MAX_SHORT_TEXT_BYTES)?;
    if let Some(keyword) = &target.focus_keyword {
        validate_nonempty_text("focusKeyword", keyword, 100)?;
        if keyword.trim() != keyword {
            return Err("focusKeyword must be trimmed".to_string());
        }
    }
    validate_nonempty_text("accomplishment", &target.bullet, MAX_BULLET_BYTES)
}

pub(crate) fn validate_apr_question_answers(
    questions: &[String],
    answers: &[AprQuestionAnswer],
) -> CommandResult<()> {
    if questions.len() > MAX_APR_QUESTIONS {
        return Err(format!(
            "APR analysis may contain at most {MAX_APR_QUESTIONS} questions"
        ));
    }
    let mut source_questions = HashSet::with_capacity(questions.len());
    for question in questions {
        validate_nonempty_text("APR question", question, MAX_BULLET_BYTES)?;
        if !source_questions.insert(question.as_str()) {
            return Err("APR questions must be unique".to_string());
        }
    }
    if answers.is_empty() || answers.len() > MAX_APR_QUESTIONS {
        return Err(format!(
            "APR refinement requires between 1 and {MAX_APR_QUESTIONS} answers"
        ));
    }
    let mut answered_questions = HashSet::with_capacity(answers.len());
    let mut previous_index = None;
    for pair in answers {
        validate_nonempty_text("APR answered question", &pair.question, MAX_BULLET_BYTES)?;
        validate_nonempty_text("APR answer", &pair.answer, MAX_BULLET_BYTES)?;
        if pair.answer.trim() != pair.answer {
            return Err("APR answers must be trimmed".to_string());
        }
        if !answered_questions.insert(pair.question.as_str()) {
            return Err("APR answer questions must not be duplicated".to_string());
        }
        let index = questions
            .iter()
            .position(|question| question == &pair.question)
            .ok_or_else(|| "APR answer contains an unknown question".to_string())?;
        if previous_index.is_some_and(|previous| index <= previous) {
            return Err("APR answers must follow question display order".to_string());
        }
        previous_index = Some(index);
    }
    Ok(())
}

fn validate_apr_dimension(name: &str, dimension: &AprDimension) -> CommandResult<()> {
    validate_nonempty_text(
        &format!("{name} feedback"),
        &dimension.feedback,
        MAX_BULLET_BYTES,
    )
}

pub(crate) fn validate_apr_response(response: &AprCopilotResponse) -> CommandResult<()> {
    validate_apr_dimension("action", &response.action)?;
    validate_apr_dimension("project", &response.project)?;
    validate_apr_dimension("result", &response.result)?;
    if let Some(rewrite) = &response.rewrite {
        validate_text("APR rewrite", rewrite, MAX_BULLET_BYTES)?;
    }
    if response.questions.len() > MAX_APR_QUESTIONS {
        return Err(format!(
            "APR analysis may contain at most {MAX_APR_QUESTIONS} questions"
        ));
    }
    let mut questions = HashSet::with_capacity(response.questions.len());
    for question in &response.questions {
        validate_nonempty_text("APR question", question, MAX_BULLET_BYTES)?;
        if !questions.insert(question.as_str()) {
            return Err("APR questions must be unique".to_string());
        }
    }
    Ok(())
}

pub(crate) fn validate_apr_analysis(
    analysis: &AprAnalysis,
    expected_target: &AprTarget,
) -> CommandResult<()> {
    validate_apr_target(&analysis.target)?;
    if &analysis.target != expected_target {
        return Err("Copilot returned an analysis for a different accomplishment".to_string());
    }
    validate_apr_response(&AprCopilotResponse {
        action: analysis.action.clone(),
        project: analysis.project.clone(),
        result: analysis.result.clone(),
        rewrite: analysis.rewrite.clone(),
        questions: analysis.questions.clone(),
    })
}

pub(crate) fn validate_apr_refinement(
    refinement: &AprRefinement,
    expected_target: &AprTarget,
    expected_answers: &[AprQuestionAnswer],
) -> CommandResult<()> {
    validate_apr_target(&refinement.target)?;
    if &refinement.target != expected_target {
        return Err("Copilot returned a refinement for a different accomplishment".to_string());
    }
    if refinement.answers != expected_answers {
        return Err("Copilot returned a refinement for different answers".to_string());
    }
    validate_nonempty_text("APR refined rewrite", &refinement.rewrite, MAX_BULLET_BYTES)?;
    if refinement.rewrite == expected_target.bullet {
        return Err("Copilot did not provide a changed refinement".to_string());
    }
    Ok(())
}

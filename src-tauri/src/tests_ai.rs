use super::*;
use crate::tests_workspace::sample_resume;

fn sample_apr_target() -> AprTarget {
    AprTarget {
        resume_id: "resume-1".to_string(),
        experience_id: "experience-1".to_string(),
        bullet_index: 0,
        role: "Engineer".to_string(),
        bullet: "Built a useful system.".to_string(),
        focus_keyword: None,
    }
}

#[test]
fn apr_prompt_contains_only_role_and_bullet_as_untrusted_data() {
    let target = sample_apr_target();
    let prompt = build_apr_prompt(&target.role, &target.bullet, None).expect("APR prompt");
    assert!(prompt.contains("untrusted data"));
    assert!(prompt.contains("Engineer"));
    assert!(prompt.contains("Built a useful system."));
    assert!(!prompt.contains("resume-1"));
    assert!(!prompt.contains("experience-1"));
    assert!(!prompt.contains("PRIVATE NAME"));

    let keyword_prompt = build_apr_prompt(&target.role, &target.bullet, Some("opentelemetry"))
        .expect("keyword APR prompt");
    assert!(keyword_prompt.contains("opentelemetry"));
    assert!(keyword_prompt.contains("never insert focusKeyword into rewrite"));
}

#[test]
fn apr_response_is_strict_bounded_and_bound_to_the_local_target() {
    let valid = br#"{"action":{"status":"clear","feedback":"Specific action."},"project":{"status":"partial","feedback":"Add context."},"result":{"status":"missing","feedback":"Add supported impact."},"rewrite":"Built a useful system.","questions":["What changed?"]}"#;
    let response = parse_apr_response(valid).expect("valid APR response");
    let target = sample_apr_target();
    let analysis = AprAnalysis {
        target: target.clone(),
        action: response.action,
        project: response.project,
        result: response.result,
        rewrite: response.rewrite,
        questions: response.questions,
        verification: None,
        verification_warning: None,
    };
    validate_apr_analysis(&analysis, &target).expect("matching target");

    let extra = br#"{"action":{"status":"clear","feedback":""},"project":{"status":"clear","feedback":""},"result":{"status":"clear","feedback":""},"questions":[],"extra":true}"#;
    assert!(parse_apr_response(extra).is_err());
    let invalid_status = br#"{"action":{"status":"strong","feedback":""},"project":{"status":"clear","feedback":""},"result":{"status":"clear","feedback":""},"questions":[]}"#;
    assert!(parse_apr_response(invalid_status).is_err());
    let too_many_questions = format!(
        "{{\"action\":{{\"status\":\"clear\",\"feedback\":\"\"}},\"project\":{{\"status\":\"clear\",\"feedback\":\"\"}},\"result\":{{\"status\":\"clear\",\"feedback\":\"\"}},\"questions\":{}}}",
        serde_json::to_string(&vec!["Question?"; MAX_APR_QUESTIONS + 1]).expect("questions")
    );
    assert!(parse_apr_response(too_many_questions.as_bytes()).is_err());
    let duplicate_questions = br#"{"action":{"status":"clear","feedback":"Action."},"project":{"status":"clear","feedback":"Project."},"result":{"status":"clear","feedback":"Result."},"questions":["Duplicate?","Duplicate?"]}"#;
    assert!(parse_apr_response(duplicate_questions).is_err());

    let mut mismatched = target.clone();
    mismatched.bullet_index = 1;
    assert!(validate_apr_analysis(&analysis, &mismatched).is_err());
}

fn sample_apr_answers() -> Vec<AprQuestionAnswer> {
    vec![
        AprQuestionAnswer {
            question: "What changed?".to_string(),
            answer: "Onboarding became faster.".to_string(),
        },
        AprQuestionAnswer {
            question: "How did you validate it?".to_string(),
            answer: "With usability testing.".to_string(),
        },
    ]
}

#[test]
fn apr_refinement_prompt_contains_only_fact_bound_untrusted_data() {
    let target = sample_apr_target();
    let answers = sample_apr_answers();
    let prompt = build_apr_refinement_prompt(&target.role, &target.bullet, &answers)
        .expect("APR refinement prompt");
    assert!(prompt.contains("untrusted data"));
    assert!(prompt.contains("Engineer"));
    assert!(prompt.contains("Built a useful system."));
    assert!(prompt.contains("What changed?"));
    assert!(prompt.contains("Onboarding became faster."));
    assert!(!prompt.contains("resume-1"));
    assert!(!prompt.contains("experience-1"));
    assert!(!prompt.contains("bullet_index"));
    assert!(!prompt.contains("feedback"));
    assert!(!prompt.contains("contact"));
}

#[test]
fn bullet_prompts_enforce_alignment_audit_style_and_fallbacks() {
    let resume = sample_resume();
    let gen_prompt = build_generation_prompt(&resume).expect("generation prompt");
    assert!(gen_prompt.contains("1-to-1 bullet order and count"));
    assert!(gen_prompt.contains("rewriting bullets[i] in place"));
    assert!(gen_prompt.contains("when jobDescription is empty"));
    assert!(gen_prompt.contains("Responsible for"));
    assert!(gen_prompt.contains("without pronouns"));
    assert!(gen_prompt.contains("no \"•\""));
    assert!(gen_prompt.contains("50–200 characters"));

    let (role_prompt, _) =
        build_role_tailor_prompt(&resume, "experience-1").expect("role tailor prompt");
    assert!(role_prompt.contains("untrusted data"));
    assert!(role_prompt.contains("1-to-1 bullet order and count"));
    assert!(role_prompt.contains("when jobDescription is empty"));
    assert!(role_prompt.contains("50–200 characters"));
    assert!(!role_prompt.contains("PRIVATE NAME"));
    assert!(!role_prompt.contains("private@example.com"));

    let (project_prompt, _) =
        build_role_tailor_prompt(&resume, "project-1").expect("project tailor prompt");
    assert!(project_prompt.contains("project-1"));
    assert!(!project_prompt.contains("private-project.example"));

    let target = sample_apr_target();
    let apr_prompt = build_apr_prompt(&target.role, &target.bullet, None).expect("APR prompt");
    assert!(apr_prompt.contains("\"rewrite\":\"string or null\""));
    assert!(apr_prompt.contains("Set rewrite to null (or omit rewrite)"));
    assert!(apr_prompt.contains("50–200 characters"));

    let answers = sample_apr_answers();
    let refine_prompt = build_apr_refinement_prompt(&target.role, &target.bullet, &answers)
        .expect("APR refinement prompt");
    assert!(refine_prompt.contains("Action"));
    assert!(refine_prompt.contains("Project"));
    assert!(refine_prompt.contains("Result"));
    assert!(refine_prompt.contains("not measured"));
    assert!(refine_prompt.contains("omit that unconfirmed"));
    assert!(refine_prompt.contains("50–200 characters"));
}

#[test]
fn apr_optional_rewrite_accepts_null_and_normalizes_blank_or_unchanged() {
    let with_null = br#"{"action":{"status":"clear","feedback":"Specific action."},"project":{"status":"clear","feedback":"Specific project."},"result":{"status":"missing","feedback":"No metric stated."},"rewrite":null,"questions":["How was impact measured?"]}"#;
    let parsed = parse_apr_response(with_null).expect("null rewrite is valid");
    assert_eq!(parsed.rewrite, None);

    let target = sample_apr_target();
    let analysis = AprAnalysis {
        target: target.clone(),
        action: parsed.action,
        project: parsed.project,
        result: parsed.result,
        rewrite: normalize_optional_apr_rewrite(parsed.rewrite, &target.bullet),
        questions: parsed.questions,
        verification: None,
        verification_warning: None,
    };
    validate_apr_analysis(&analysis, &target).expect("valid analysis with omitted rewrite");
    let serialized = serde_json::to_string(&analysis).expect("serialize analysis");
    assert!(!serialized.contains("\"rewrite\""));

    assert_eq!(normalize_optional_apr_rewrite(None, &target.bullet), None);
    assert_eq!(
        normalize_optional_apr_rewrite(Some(String::new()), &target.bullet),
        None
    );
    assert_eq!(
        normalize_optional_apr_rewrite(Some("   ".to_string()), &target.bullet),
        None
    );
    assert_eq!(
        normalize_optional_apr_rewrite(Some(target.bullet.clone()), &target.bullet),
        None
    );
    assert_eq!(
        normalize_optional_apr_rewrite(Some(format!("  {}  ", target.bullet)), &target.bullet),
        None
    );
    assert_eq!(
        normalize_optional_apr_rewrite(
            Some("Engineered a low-latency build pipeline.".to_string()),
            &target.bullet
        ),
        Some("Engineered a low-latency build pipeline.".to_string())
    );
}

#[test]
fn apr_refinement_contract_rejects_bad_binding_and_output() {
    let questions = vec![
        "What changed?".to_string(),
        "How did you validate it?".to_string(),
    ];
    let answers = sample_apr_answers();
    validate_apr_question_answers(&questions, &answers).expect("valid answers");

    let reversed = answers.iter().cloned().rev().collect::<Vec<_>>();
    assert!(validate_apr_question_answers(&questions, &reversed).is_err());
    let duplicate = vec![answers[0].clone(), answers[0].clone()];
    assert!(validate_apr_question_answers(&questions, &duplicate).is_err());
    let unknown = vec![AprQuestionAnswer {
        question: "Unknown?".to_string(),
        answer: "No.".to_string(),
    }];
    assert!(validate_apr_question_answers(&questions, &unknown).is_err());
    let untrimmed = vec![AprQuestionAnswer {
        question: questions[0].clone(),
        answer: " padded ".to_string(),
    }];
    assert!(validate_apr_question_answers(&questions, &untrimmed).is_err());
    assert!(validate_apr_question_answers(&questions, &[]).is_err());
    assert!(validate_apr_question_answers(
        &["Duplicate?".to_string(), "Duplicate?".to_string()],
        &answers[..1],
    )
    .is_err());

    let parsed = parse_apr_refinement_response(br#"{"rewrite":"A changed rewrite."}"#)
        .expect("valid refinement response");
    let target = sample_apr_target();
    let refinement = AprRefinement {
        target: target.clone(),
        answers: answers.clone(),
        rewrite: parsed.rewrite,
        verification: None,
        verification_warning: None,
    };
    validate_apr_refinement(&refinement, &target, &answers).expect("valid refinement");
    assert!(
        parse_apr_refinement_response(br#"{"rewrite":"A changed rewrite.","extra":true}"#).is_err()
    );
    assert!(parse_apr_refinement_response(br#"{"rewrite":""}"#).is_err());
    let unchanged = AprRefinement {
        target: target.clone(),
        answers: answers.clone(),
        rewrite: target.bullet.clone(),
        verification: None,
        verification_warning: None,
    };
    assert!(validate_apr_refinement(&unchanged, &target, &answers).is_err());
    let mut mismatched = refinement;
    mismatched.answers[0].answer = "Different.".to_string();
    assert!(validate_apr_refinement(&mismatched, &target, &answers).is_err());
}

#[test]
fn consent_is_required_before_generation() {
    assert!(ensure_consent(false).is_err());
    assert!(ensure_consent(true).is_ok());
}

//! Isolated GitHub Copilot CLI boundary. See ARCHITECTURE.md "Copilot boundary".

mod cli;
mod profile;
mod sdk;

pub(crate) use cli::{login_to_copilot, probe_copilot};
pub(crate) use sdk::run_copilot_prompt;

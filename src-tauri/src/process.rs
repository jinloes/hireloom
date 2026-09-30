//! Bounded direct subprocess execution with capped output and timeouts.

use crate::contract::*;
use std::{
    io::{self, Read, Write},
    process::{Command, ExitStatus, Stdio},
    thread,
    time::{Duration, Instant},
};

pub(crate) struct ProcessOutput {
    pub(crate) status: ExitStatus,
    pub(crate) stdout: Vec<u8>,
    pub(crate) stderr: Vec<u8>,
    pub(crate) timed_out: bool,
    pub(crate) output_truncated: bool,
}

pub(crate) struct CappedRead {
    pub(crate) bytes: Vec<u8>,
    pub(crate) truncated: bool,
}

pub(crate) fn run_process(
    mut command: Command,
    input: Option<&[u8]>,
    timeout: Duration,
    output_limit: usize,
) -> CommandResult<ProcessOutput> {
    if input.is_some() {
        command.stdin(Stdio::piped());
    }
    let mut child = command
        .spawn()
        .map_err(|error| format!("unable to launch process: {error}"))?;
    let input_writer = child.stdin.take().map(|mut stdin| {
        let input = input.map(ToOwned::to_owned);
        thread::spawn(move || {
            if let Some(input) = input {
                let _ = stdin.write_all(&input);
            }
        })
    });

    let stdout_reader = child
        .stdout
        .take()
        .map(|stdout| thread::spawn(move || read_capped(stdout, output_limit)));
    let stderr_reader = child
        .stderr
        .take()
        .map(|stderr| thread::spawn(move || read_capped(stderr, 32 * 1024)));

    let deadline = Instant::now() + timeout;
    let mut timed_out = false;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() >= deadline => {
                timed_out = true;
                let _ = child.kill();
                break child
                    .wait()
                    .map_err(|error| format!("unable to reap timed-out process: {error}"))?;
            }
            Ok(None) => thread::sleep(Duration::from_millis(20)),
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("unable to inspect process: {error}"));
            }
        }
    };

    if let Some(writer) = input_writer {
        let _ = writer.join();
    }
    let stdout = join_reader(stdout_reader, output_limit)?;
    let stderr = join_reader(stderr_reader, 32 * 1024)?;
    Ok(ProcessOutput {
        status,
        stdout: stdout.bytes,
        stderr: stderr.bytes,
        timed_out,
        output_truncated: stdout.truncated,
    })
}

pub(crate) fn read_capped<R: Read>(mut reader: R, limit: usize) -> io::Result<CappedRead> {
    let mut bytes = Vec::with_capacity(limit.min(16 * 1024));
    let mut buffer = [0_u8; 8 * 1024];
    let mut truncated = false;
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        if bytes.len() < limit {
            let remaining = limit - bytes.len();
            let copied = remaining.min(read);
            bytes.extend_from_slice(&buffer[..copied]);
            if copied < read {
                truncated = true;
            }
        } else {
            truncated = true;
        }
    }
    Ok(CappedRead { bytes, truncated })
}

pub(crate) fn join_reader(
    reader: Option<thread::JoinHandle<io::Result<CappedRead>>>,
    limit: usize,
) -> CommandResult<CappedRead> {
    match reader {
        Some(reader) => reader
            .join()
            .map_err(|_| "process output reader panicked".to_string())?
            .map_err(|error| format!("unable to read process output (limit {limit}): {error}")),
        None => Ok(CappedRead {
            bytes: Vec::new(),
            truncated: false,
        }),
    }
}

pub(crate) fn first_nonempty_line(bytes: &[u8]) -> Option<String> {
    std::str::from_utf8(bytes)
        .ok()?
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(|line| line.chars().take(200).collect())
}

pub(crate) fn summarize_process_error(output: &ProcessOutput) -> String {
    let stderr =
        first_nonempty_line(&output.stderr).unwrap_or_else(|| "no diagnostic output".to_string());
    format!("{} ({stderr})", output.status)
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use crate::{ai::parse_ai_proposal, test_support::*};
    use std::fs;

    #[test]
    fn fake_copilot_nonzero_and_timeout_are_reported() {
        let directory = test_directory("copilot-errors");
        let failing = fake_executable(&directory, "failing", "printf 'bad news' >&2; exit 7");
        let mut command = Command::new(failing);
        command.stdout(Stdio::piped()).stderr(Stdio::piped());
        let output =
            run_process(command, None, FAKE_EXECUTABLE_TIMEOUT, 4096).expect("run failing");
        assert!(!output.status.success());
        assert!(summarize_process_error(&output).contains("bad news"));

        let slow = fake_executable(&directory, "slow", "exec sleep 2");
        let mut command = Command::new(slow);
        command.stdout(Stdio::piped()).stderr(Stdio::piped());
        let output =
            run_process(command, None, Duration::from_millis(100), 4096).expect("run slow");
        assert!(output.timed_out);
        fs::remove_dir_all(directory).expect("cleanup");
    }

    #[test]
    fn fake_copilot_malformed_response_is_rejected() {
        let directory = test_directory("copilot-malformed");
        let malformed = fake_executable(&directory, "malformed", "printf 'not json'");
        let mut command = Command::new(malformed);
        command.stdout(Stdio::piped()).stderr(Stdio::piped());
        let output = run_process(command, None, FAKE_EXECUTABLE_TIMEOUT, 4096)
            .expect("run malformed copilot");
        assert!(parse_ai_proposal(&output.stdout, ["experience-1"]).is_err());
        fs::remove_dir_all(directory).expect("cleanup");
    }
}

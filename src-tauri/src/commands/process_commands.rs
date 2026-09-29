//! App-owned processes (D-012): fixed argv only. The UI passes a job kind and a project folder,
//! never a command string. Currently: `pnpm install` for a project (T1.15).

use crate::commands::fs_commands::{get_active_workspace_internal, resolve_and_verify_workspace_path};
use crate::process::{self, base_command, resolve_command, RunOptions};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

const INSTALL_TIMEOUT: Duration = Duration::from_secs(15 * 60);

/// Everything the UI may ask the backend to run. Add a variant (with its argv) to allow more.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum OwnedJob {
    ProjectDeps,
}

impl OwnedJob {
    pub fn program(self) -> &'static str {
        match self {
            OwnedJob::ProjectDeps => "pnpm",
        }
    }
    pub fn argv(self) -> &'static [&'static str] {
        match self {
            OwnedJob::ProjectDeps => &["install", "--reporter=append-only"],
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum InstallEvent {
    Started { program: String, argv: Vec<String> },
    Log { stream: &'static str, line: String },
    #[serde(rename_all = "camelCase")]
    Done { exit_code: Option<i32> },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InstallError {
    NoPackageJson,
    NotFound(String),
    Spawn(String),
    Cancelled,
    Timeout,
}

impl std::fmt::Display for InstallError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            InstallError::NoPackageJson => write!(f, "no-package-json"),
            InstallError::NotFound(c) => write!(f, "not-found:{c}"),
            InstallError::Spawn(e) => write!(f, "spawn:{e}"),
            InstallError::Cancelled => write!(f, "cancelled"),
            InstallError::Timeout => write!(f, "timeout"),
        }
    }
}

type Emit = Arc<dyn Fn(InstallEvent) + Send + Sync>;

fn pump<R: Read + Send + 'static>(r: Option<R>, stream: &'static str, emit: Emit) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        if let Some(r) = r {
            for line in BufReader::new(r).split(b'\n').map_while(Result::ok) {
                let line = String::from_utf8_lossy(&line).trim_end_matches('\r').to_string();
                if !line.is_empty() {
                    emit(InstallEvent::Log { stream, line });
                }
            }
        }
    })
}

/// Run `job` in `cwd`, streaming output lines. Returns the exit code.
pub fn run_job(job: OwnedJob, cwd: &Path, path_env: &str, cancel: &AtomicBool, timeout: Duration, emit: Emit) -> Result<Option<i32>, InstallError> {
    if !cwd.join("package.json").is_file() {
        return Err(InstallError::NoPackageJson);
    }
    let exe = resolve_command(job.program(), path_env).ok_or_else(|| InstallError::NotFound(job.program().into()))?;
    let opts = RunOptions { cwd: Some(cwd.to_path_buf()), ..RunOptions::new(timeout).path(path_env) };
    emit(InstallEvent::Started { program: job.program().into(), argv: job.argv().iter().map(|s| s.to_string()).collect() });
    let mut child = base_command(&exe, job.argv(), &opts).spawn().map_err(|e| InstallError::Spawn(e.to_string()))?;
    #[cfg(windows)]
    let jobobj = process::JobObject::new().ok().filter(|j| j.assign(&child).is_ok());
    let readers = [pump(child.stdout.take(), "stdout", emit.clone()), pump(child.stderr.take(), "stderr", emit.clone())];

    let started = Instant::now();
    let outcome = loop {
        match child.try_wait() {
            Ok(Some(s)) => break Ok(s.code()),
            Ok(None) if cancel.load(Ordering::SeqCst) => break Err(InstallError::Cancelled),
            Ok(None) if started.elapsed() >= timeout => break Err(InstallError::Timeout),
            Ok(None) => std::thread::sleep(Duration::from_millis(20)),
            Err(e) => break Err(InstallError::Spawn(e.to_string())),
        }
    };
    if outcome.is_err() {
        #[cfg(windows)]
        if let Some(j) = &jobobj {
            j.terminate();
        }
        let _ = child.kill();
        let _ = child.wait();
    }
    for r in readers {
        let _ = r.join();
    }
    let code = outcome?;
    emit(InstallEvent::Done { exit_code: code });
    Ok(code)
}

static INSTALL_RUNNING: AtomicBool = AtomicBool::new(false);
static INSTALL_CANCEL: AtomicBool = AtomicBool::new(false);

/// Validate the project folder: must exist inside the active workspace (AGENTS.md section 7).
fn project_dir(dir: &str) -> Result<PathBuf, String> {
    if get_active_workspace_internal().is_none() {
        return Err("no-workspace".into());
    }
    resolve_and_verify_workspace_path(dir, None, true)
}

/// `pnpm install` in `project_dir`. The caller must have obtained user consent (wizard, once per
/// `package.json` content). Logs stream over `on_event`; errors are short codes.
#[tauri::command]
pub async fn install_project_deps(project_dir: String, on_event: tauri::ipc::Channel<InstallEvent>) -> Result<Option<i32>, String> {
    let dir = self::project_dir(&project_dir)?;
    if INSTALL_RUNNING.swap(true, Ordering::SeqCst) {
        return Err("already-running".into());
    }
    INSTALL_CANCEL.store(false, Ordering::SeqCst);
    let result = tauri::async_runtime::spawn_blocking(move || {
        let emit: Emit = Arc::new(move |e| {
            let _ = on_event.send(e);
        });
        run_job(OwnedJob::ProjectDeps, &dir, &process::fresh_path(), &INSTALL_CANCEL, INSTALL_TIMEOUT, emit).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|r| r);
    INSTALL_RUNNING.store(false, Ordering::SeqCst);
    result
}

#[tauri::command]
pub fn install_project_deps_cancel() {
    INSTALL_CANCEL.store(true, Ordering::SeqCst);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn noop() -> Emit {
        Arc::new(|_| {})
    }

    #[test]
    fn argv_is_fixed_and_allowlisted() {
        assert_eq!(OwnedJob::ProjectDeps.program(), "pnpm");
        assert_eq!(OwnedJob::ProjectDeps.argv(), ["install", "--reporter=append-only"]);
    }

    #[test]
    fn job_kind_rejects_arbitrary_strings() {
        assert!(serde_json::from_str::<OwnedJob>("\"projectDeps\"").is_ok());
        assert!(serde_json::from_str::<OwnedJob>("\"pnpm install && calc\"").is_err());
        assert!(serde_json::from_str::<OwnedJob>("[\"install\"]").is_err());
    }

    #[test]
    fn requires_package_json() {
        let d = tempfile::tempdir().unwrap();
        let r = run_job(OwnedJob::ProjectDeps, d.path(), "", &AtomicBool::new(false), Duration::from_secs(5), noop());
        assert_eq!(r, Err(InstallError::NoPackageJson));
    }

    #[test]
    fn missing_pnpm_is_reported() {
        let d = tempfile::tempdir().unwrap();
        std::fs::write(d.path().join("package.json"), "{}").unwrap();
        let r = run_job(OwnedJob::ProjectDeps, d.path(), "", &AtomicBool::new(false), Duration::from_secs(5), noop());
        assert_eq!(r, Err(InstallError::NotFound("pnpm".into())));
    }

    #[test]
    fn events_serialize_camel_case() {
        let v = serde_json::to_value(InstallEvent::Done { exit_code: Some(0) }).unwrap();
        assert_eq!(v, serde_json::json!({ "kind": "done", "exitCode": 0 }));
    }

    #[cfg(windows)]
    fn fake_pnpm(script: &str) -> (tempfile::TempDir, tempfile::TempDir, String) {
        let bin = tempfile::tempdir().unwrap();
        std::fs::write(bin.path().join("pnpm.cmd"), script).unwrap();
        let proj = tempfile::tempdir().unwrap();
        std::fs::write(proj.path().join("package.json"), "{}").unwrap();
        let path = format!("{};{}\\System32", bin.path().display(), std::env::var("SystemRoot").unwrap());
        (bin, proj, path)
    }

    #[cfg(windows)]
    #[test]
    fn streams_logs_from_fake_pnpm() {
        use std::sync::Mutex;
        let (_bin, proj, path) = fake_pnpm("@echo off\r\necho args=%*\r\necho oops 1>&2\r\nexit /b 3\r\n");
        let events = Arc::new(Mutex::new(Vec::new()));
        let sink = events.clone();
        let emit: Emit = Arc::new(move |e| sink.lock().unwrap().push(e));
        let code = run_job(OwnedJob::ProjectDeps, proj.path(), &path, &AtomicBool::new(false), Duration::from_secs(20), emit).unwrap();
        assert_eq!(code, Some(3));
        let ev = events.lock().unwrap();
        assert!(matches!(ev.first(), Some(InstallEvent::Started { .. })));
        assert!(ev.contains(&InstallEvent::Log { stream: "stdout", line: "args=install \"--reporter=append-only\"".into() }));
        assert!(ev.contains(&InstallEvent::Log { stream: "stderr", line: "oops ".into() }));
        assert_eq!(ev.last(), Some(&InstallEvent::Done { exit_code: Some(3) }));
    }

    #[cfg(windows)]
    #[test]
    fn cancel_stops_the_process() {
        let (_bin, proj, path) = fake_pnpm("@echo off\r\nping -n 30 127.0.0.1 >nul\r\n");
        let t = Instant::now();
        let r = run_job(OwnedJob::ProjectDeps, proj.path(), &path, &AtomicBool::new(true), Duration::from_secs(60), noop());
        assert_eq!(r, Err(InstallError::Cancelled));
        assert!(t.elapsed() < Duration::from_secs(10));
    }
}

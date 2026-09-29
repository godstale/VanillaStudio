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
    /// `npm install` of the pinned Claude Code ACP adapter into `<appData>/adapters/<dir>`.
    ClaudeAdapter,
}

/// Pinned adapter (PoC S3 verified). Keep in sync with `CLAUDE_ADAPTER_VERSION` in `src/lib/agents/registry.ts`.
pub const CLAUDE_ADAPTER_PACKAGE: &str = "@agentclientprotocol/claude-agent-acp";
pub const CLAUDE_ADAPTER_VERSION: &str = "0.83.0";
/// Folder name under `<appData>/adapters`.
pub const CLAUDE_ADAPTER_DIR: &str = "claude-agent-acp@0.83.0";

impl OwnedJob {
    pub fn program(self) -> &'static str {
        match self {
            OwnedJob::ProjectDeps => "pnpm",
            OwnedJob::ClaudeAdapter => "npm",
        }
    }
    pub fn argv(self) -> &'static [&'static str] {
        match self {
            OwnedJob::ProjectDeps => &["install", "--reporter=append-only"],
            // --ignore-scripts: the adapter needs no install scripts (verified in T2.2), so a
            // compromised transitive package cannot run code at install time.
            OwnedJob::ClaudeAdapter => &[
                "install",
                "--no-audit",
                "--no-fund",
                "--ignore-scripts",
                "--save-exact",
                "@agentclientprotocol/claude-agent-acp@0.83.0",
            ],
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

/// `<appData>/adapters/<CLAUDE_ADAPTER_DIR>`.
pub fn claude_adapter_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("adapters").join(CLAUDE_ADAPTER_DIR)
}

/// Entry script of an installed adapter, relative to its install dir.
pub const CLAUDE_ADAPTER_ENTRY: &str = "node_modules/@agentclientprotocol/claude-agent-acp/dist/index.js";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AdapterStatus {
    pub installed: bool,
    /// Version read from the installed package.json.
    pub version: Option<String>,
    /// True when `version` equals the pinned version.
    pub pinned: bool,
    pub entry: Option<String>,
}

/// Inspect an install dir: entry script present and package version read from disk.
pub fn verify_claude_adapter(dir: &Path) -> AdapterStatus {
    let entry = dir.join(CLAUDE_ADAPTER_ENTRY);
    let pkg = dir.join("node_modules").join(CLAUDE_ADAPTER_PACKAGE).join("package.json");
    let version = std::fs::read_to_string(pkg)
        .ok()
        .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
        .and_then(|v| v.get("version").and_then(|x| x.as_str().map(str::to_string)));
    let installed = entry.is_file() && version.is_some();
    AdapterStatus {
        installed,
        pinned: version.as_deref() == Some(CLAUDE_ADAPTER_VERSION),
        entry: installed.then(|| entry.to_string_lossy().into_owned()),
        version,
    }
}

/// Create the install dir with a minimal package.json so `npm install` stays inside it.
fn prepare_adapter_dir(dir: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let pkg = dir.join("package.json");
    if !pkg.is_file() {
        std::fs::write(pkg, "{\"private\":true}").map_err(|e| e.to_string())?;
    }
    Ok(())
}

static ADAPTER_RUNNING: AtomicBool = AtomicBool::new(false);
static ADAPTER_CANCEL: AtomicBool = AtomicBool::new(false);

/// Install the pinned Claude Code adapter into the app data dir. Idempotent: an already verified
/// install is reported without running npm. The caller must have obtained user consent.
#[tauri::command]
pub async fn install_claude_adapter<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    on_event: tauri::ipc::Channel<InstallEvent>,
) -> Result<AdapterStatus, String> {
    use tauri::Manager;
    let dir = claude_adapter_dir(&app.path().app_data_dir().map_err(|e| e.to_string())?);
    let status = verify_claude_adapter(&dir);
    if status.installed && status.pinned {
        return Ok(status);
    }
    if ADAPTER_RUNNING.swap(true, Ordering::SeqCst) {
        return Err("already-running".into());
    }
    ADAPTER_CANCEL.store(false, Ordering::SeqCst);
    let result = tauri::async_runtime::spawn_blocking(move || {
        prepare_adapter_dir(&dir)?;
        let emit: Emit = Arc::new(move |e| {
            let _ = on_event.send(e);
        });
        let code = run_job(OwnedJob::ClaudeAdapter, &dir, &process::fresh_path(), &ADAPTER_CANCEL, INSTALL_TIMEOUT, emit).map_err(|e| e.to_string())?;
        if code != Some(0) {
            return Err(format!("exit:{}", code.map_or("none".to_string(), |c| c.to_string())));
        }
        let status = verify_claude_adapter(&dir);
        if status.installed && status.pinned { Ok(status) } else { Err("verify-failed".into()) }
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|r| r);
    ADAPTER_RUNNING.store(false, Ordering::SeqCst);
    result
}

#[tauri::command]
pub fn install_claude_adapter_cancel() {
    ADAPTER_CANCEL.store(true, Ordering::SeqCst);
}

/// Read-only status check for the settings screen and the session start guard.
#[tauri::command]
pub fn claude_adapter_status<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<AdapterStatus, String> {
    use tauri::Manager;
    Ok(verify_claude_adapter(&claude_adapter_dir(&app.path().app_data_dir().map_err(|e| e.to_string())?)))
}

// ---- preview server (T4.10, D-012) -----------------------------------------------------------------
// `node <app>/workers/vite-runner.mjs --root <project>`: fixed argv, the UI only names the project.
// One supervisor thread per project restarts the runner after a crash; every runner lives in a Job Object
// so it (and Vite's children) die with the app even when the app is killed.

use std::collections::HashMap;
use std::sync::atomic::AtomicU16;
use std::sync::mpsc::{channel, Sender};
use std::sync::{LazyLock, Mutex};

const PREVIEW_START_TIMEOUT: Duration = Duration::from_secs(60);
const PREVIEW_MAX_RESTARTS: u32 = 3;
/// A runner that stayed up this long counts as healthy: the crash counter starts over.
const PREVIEW_HEALTHY_AFTER: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PreviewEvent {
    /// Sent on the first start and again after every restart (the port may change).
    Listening { port: u16, url: String },
    Log { stream: &'static str, line: String },
    #[serde(rename_all = "camelCase")]
    Exited { exit_code: Option<i32>, will_restart: bool },
    Failed { message: String },
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct PreviewInfo {
    pub port: u16,
    pub url: String,
}

type PreviewEmit = Arc<dyn Fn(PreviewEvent) + Send + Sync>;
/// Swappable so a second `start_preview_server` call (e.g. after a webview reload) takes over the events.
type SharedEmit = Arc<Mutex<PreviewEmit>>;
type FirstPort = Arc<Mutex<Option<Sender<Result<u16, String>>>>>;

#[derive(Debug, Clone)]
pub struct PreviewSpec {
    pub node: PathBuf,
    pub runner: PathBuf,
    pub root: PathBuf,
    pub path_env: String,
    pub max_restarts: u32,
    pub backoff: Duration,
}

/// The only argv the preview job ever gets (after the node executable).
pub fn preview_argv(runner: &Path, root: &Path) -> Vec<String> {
    vec![runner.to_string_lossy().into_owned(), "--root".into(), root.to_string_lossy().into_owned()]
}

/// `\\?\C:\x` breaks some Node tooling; hand Node the plain form.
fn plain_path(p: &Path) -> PathBuf {
    let s = p.to_string_lossy();
    match s.strip_prefix(r"\\?\") {
        Some(rest) if !rest.starts_with(r"UNC\") => PathBuf::from(rest),
        _ => p.to_path_buf(),
    }
}

fn send_first(first: &FirstPort, r: Result<u16, String>) {
    if let Some(tx) = first.lock().unwrap().take() {
        let _ = tx.send(r);
    }
}

fn emit_shared(emit: &SharedEmit, e: PreviewEvent) {
    let f = emit.lock().unwrap().clone();
    f(e);
}

/// Handle one line of runner stdout. Only the runner's own `listening` report is trusted as an event.
fn handle_runner_line(line: &str, emit: &SharedEmit, port: &AtomicU16, first: &FirstPort) {
    let parsed = serde_json::from_str::<serde_json::Value>(line).ok();
    match parsed.as_ref().and_then(|v| v.get("type")).and_then(|t| t.as_str()) {
        Some("listening") => {
            let p = parsed.as_ref().and_then(|v| v.get("port")).and_then(|p| p.as_u64()).and_then(|p| u16::try_from(p).ok());
            if let Some(p) = p.filter(|p| *p > 0) {
                port.store(p, Ordering::SeqCst);
                emit_shared(emit, PreviewEvent::Listening { port: p, url: format!("http://127.0.0.1:{p}") });
                send_first(first, Ok(p));
                return;
            }
        }
        Some("error") => {
            let msg = parsed.as_ref().and_then(|v| v.get("message")).and_then(|m| m.as_str()).unwrap_or("runner error").to_string();
            emit_shared(emit, PreviewEvent::Log { stream: "stderr", line: msg });
            return;
        }
        _ => {}
    }
    emit_shared(emit, PreviewEvent::Log { stream: "stdout", line: line.to_string() });
}

fn pump_lines<R: Read + Send + 'static>(r: Option<R>, mut on_line: impl FnMut(String) + Send + 'static) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        if let Some(r) = r {
            for line in BufReader::new(r).split(b'\n').map_while(Result::ok) {
                let line = String::from_utf8_lossy(&line).trim_end_matches('\r').to_string();
                if !line.is_empty() {
                    on_line(line);
                }
            }
        }
    })
}

fn supervise(spec: PreviewSpec, stop: Arc<AtomicBool>, emit: SharedEmit, port: Arc<AtomicU16>, first: FirstPort) {
    let mut crashes = 0u32;
    let argv = preview_argv(&spec.runner, &spec.root);
    loop {
        let started = Instant::now();
        let args: Vec<&str> = argv.iter().map(String::as_str).collect();
        let opts = RunOptions { cwd: Some(spec.root.clone()), ..RunOptions::new(Duration::ZERO).path(&spec.path_env) };
        let mut child = match base_command(&spec.node, &args, &opts).spawn() {
            Ok(c) => c,
            Err(e) => {
                let msg = format!("spawn:{e}");
                send_first(&first, Err(msg.clone()));
                emit_shared(&emit, PreviewEvent::Failed { message: msg });
                return;
            }
        };
        #[cfg(windows)]
        let jobobj = process::JobObject::new().ok().filter(|j| j.assign(&child).is_ok());
        port.store(0, Ordering::SeqCst);
        let readers = {
            let (e1, p1, f1) = (emit.clone(), port.clone(), first.clone());
            let e2 = emit.clone();
            [
                pump_lines(child.stdout.take(), move |l| handle_runner_line(&l, &e1, &p1, &f1)),
                pump_lines(child.stderr.take(), move |l| emit_shared(&e2, PreviewEvent::Log { stream: "stderr", line: l })),
            ]
        };
        let status = loop {
            if stop.load(Ordering::SeqCst) {
                #[cfg(windows)]
                if let Some(j) = &jobobj {
                    j.terminate();
                }
                let _ = child.kill();
                let _ = child.wait();
                break None;
            }
            match child.try_wait() {
                Ok(Some(s)) => break Some(s.code()),
                Ok(None) => std::thread::sleep(Duration::from_millis(30)),
                Err(_) => break Some(None),
            }
        };
        // Vite's own children may outlive the runner and hold the pipes open.
        #[cfg(windows)]
        if let Some(j) = &jobobj {
            j.terminate();
        }
        for r in readers {
            let _ = r.join();
        }
        port.store(0, Ordering::SeqCst);
        let Some(code) = status else { return };

        crashes = if started.elapsed() >= PREVIEW_HEALTHY_AFTER { 1 } else { crashes + 1 };
        let will_restart = crashes <= spec.max_restarts;
        emit_shared(&emit, PreviewEvent::Exited { exit_code: code, will_restart });
        if !will_restart {
            let msg = format!("exited:{}", code.map_or("none".to_string(), |c| c.to_string()));
            send_first(&first, Err(msg.clone()));
            emit_shared(&emit, PreviewEvent::Failed { message: msg });
            return;
        }
        let wait_until = Instant::now() + spec.backoff * crashes;
        while Instant::now() < wait_until {
            if stop.load(Ordering::SeqCst) {
                return;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
    }
}

pub struct PreviewHandle {
    stop: Arc<AtomicBool>,
    port: Arc<AtomicU16>,
    emit: SharedEmit,
    thread: Option<std::thread::JoinHandle<()>>,
}

impl PreviewHandle {
    /// Start the runner and block until it reports a port (or fails / times out).
    pub fn start(spec: PreviewSpec, emit: PreviewEmit, timeout: Duration) -> Result<(PreviewHandle, u16), String> {
        let stop = Arc::new(AtomicBool::new(false));
        let port = Arc::new(AtomicU16::new(0));
        let shared: SharedEmit = Arc::new(Mutex::new(emit));
        let (tx, rx) = channel();
        let first: FirstPort = Arc::new(Mutex::new(Some(tx)));
        let thread = {
            let (stop, port, shared) = (stop.clone(), port.clone(), shared.clone());
            std::thread::spawn(move || supervise(spec, stop, shared, port, first))
        };
        let mut handle = PreviewHandle { stop, port, emit: shared, thread: Some(thread) };
        match rx.recv_timeout(timeout) {
            Ok(Ok(p)) => Ok((handle, p)),
            Ok(Err(e)) => {
                handle.shutdown();
                Err(e)
            }
            Err(_) => {
                handle.shutdown();
                Err("timeout".into())
            }
        }
    }

    pub fn port(&self) -> Option<u16> {
        Some(self.port.load(Ordering::SeqCst)).filter(|p| *p > 0)
    }

    pub fn set_emit(&self, emit: PreviewEmit) {
        *self.emit.lock().unwrap() = emit;
    }

    /// Stop the runner tree and join the supervisor. Returns after the process is gone.
    pub fn shutdown(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

impl Drop for PreviewHandle {
    fn drop(&mut self) {
        self.shutdown();
    }
}

static PREVIEWS: LazyLock<Mutex<HashMap<PathBuf, PreviewHandle>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

fn resolve_worker_script<R: tauri::Runtime>(app: &tauri::AppHandle<R>, name: &str) -> Result<PathBuf, String> {
    use tauri::Manager;
    if let Ok(res) = app.path().resource_dir() {
        let p = res.join("resources").join("workers").join(name);
        if p.is_file() {
            return Ok(plain_path(&p));
        }
    }
    let dev = Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("resources").join("workers").join(name);
    dev.canonicalize().map(|p| plain_path(&p)).map_err(|_| format!("worker-not-found:{name}"))
}

/// Start (or re-attach to) the preview server of a project. Errors are short codes:
/// `no-workspace`, `not-installed`, `not-found:node`, `worker-not-found:*`, `timeout`, `exited:<code>`.
#[tauri::command]
pub async fn start_preview_server<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    project_dir: String,
    on_event: tauri::ipc::Channel<PreviewEvent>,
) -> Result<PreviewInfo, String> {
    let dir = plain_path(&self::project_dir(&project_dir)?);
    let runner = resolve_worker_script(&app, "vite-runner.mjs")?;
    tauri::async_runtime::spawn_blocking(move || {
        let emit: PreviewEmit = Arc::new(move |e| {
            let _ = on_event.send(e);
        });
        {
            let map = PREVIEWS.lock().unwrap();
            if let Some(h) = map.get(&dir) {
                if let Some(port) = h.port() {
                    h.set_emit(emit);
                    return Ok(PreviewInfo { port, url: format!("http://127.0.0.1:{port}") });
                }
            }
        }
        if !dir.join("node_modules").join("vite").is_dir() {
            return Err("not-installed".into());
        }
        let path_env = process::fresh_path();
        let node = resolve_command("node", &path_env).ok_or_else(|| "not-found:node".to_string())?;
        // A handle without a port is a dead or restarting server: replace it.
        let old = PREVIEWS.lock().unwrap().remove(&dir);
        drop(old);
        let spec = PreviewSpec { node, runner, root: dir.clone(), path_env, max_restarts: PREVIEW_MAX_RESTARTS, backoff: Duration::from_millis(500) };
        let (handle, port) = PreviewHandle::start(spec, emit, PREVIEW_START_TIMEOUT)?;
        PREVIEWS.lock().unwrap().insert(dir, handle);
        Ok(PreviewInfo { port, url: format!("http://127.0.0.1:{port}") })
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|r| r)
}

/// Stop the preview server of a project (project switch or close). Unknown projects are a no-op.
#[tauri::command]
pub async fn stop_preview_server(project_dir: String) -> Result<(), String> {
    let dir = plain_path(&self::project_dir(&project_dir)?);
    tauri::async_runtime::spawn_blocking(move || {
        let handle = PREVIEWS.lock().unwrap().remove(&dir);
        drop(handle);
    })
    .await
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod preview_tests {
    use super::*;

    fn node() -> PathBuf {
        resolve_command("node", &process::fresh_path()).expect("node on PATH")
    }

    fn collect() -> (PreviewEmit, Arc<Mutex<Vec<PreviewEvent>>>) {
        let events = Arc::new(Mutex::new(Vec::new()));
        let sink = events.clone();
        (Arc::new(move |e| sink.lock().unwrap().push(e)), events)
    }

    fn spec(dir: &Path, script: &str) -> PreviewSpec {
        let runner = dir.join("fake-runner.mjs");
        std::fs::write(&runner, script).unwrap();
        PreviewSpec { node: node(), runner, root: dir.to_path_buf(), path_env: process::fresh_path(), max_restarts: 2, backoff: Duration::from_millis(20) }
    }

    const STAY_UP: &str = "console.log('vite noise');\nconsole.log(JSON.stringify({type:'listening',port:5111}));\nsetInterval(()=>{},1000);\n";

    #[test]
    fn argv_is_fixed_shape() {
        let a = preview_argv(Path::new("C:/app/vite-runner.mjs"), Path::new("C:/p"));
        assert_eq!(a, ["C:/app/vite-runner.mjs", "--root", "C:/p"]);
    }

    #[test]
    fn events_serialize_camel_case() {
        let v = serde_json::to_value(PreviewEvent::Exited { exit_code: Some(1), will_restart: true }).unwrap();
        assert_eq!(v, serde_json::json!({ "kind": "exited", "exitCode": 1, "willRestart": true }));
        let v = serde_json::to_value(PreviewEvent::Listening { port: 1, url: "u".into() }).unwrap();
        assert_eq!(v, serde_json::json!({ "kind": "listening", "port": 1, "url": "u" }));
    }

    #[test]
    fn plain_path_strips_verbatim_prefix() {
        assert_eq!(plain_path(Path::new(r"\\?\C:\a\b")), PathBuf::from(r"C:\a\b"));
        assert_eq!(plain_path(Path::new(r"\\?\UNC\srv\share")), PathBuf::from(r"\\?\UNC\srv\share"));
    }

    #[test]
    fn reports_port_and_forwards_other_lines_as_logs() {
        let d = tempfile::tempdir().unwrap();
        let (emit, events) = collect();
        let (mut h, port) = PreviewHandle::start(spec(d.path(), STAY_UP), emit, Duration::from_secs(20)).unwrap();
        assert_eq!(port, 5111);
        assert_eq!(h.port(), Some(5111));
        h.shutdown();
        let ev = events.lock().unwrap();
        assert!(ev.contains(&PreviewEvent::Listening { port: 5111, url: "http://127.0.0.1:5111".into() }));
        assert!(ev.contains(&PreviewEvent::Log { stream: "stdout", line: "vite noise".into() }));
    }

    #[test]
    fn restarts_after_a_crash_and_reports_the_new_port() {
        let d = tempfile::tempdir().unwrap();
        let marker = d.path().join("ran-once").to_string_lossy().replace('\\', "/");
        let script = format!(
            "import fs from 'node:fs';\nconst m='{marker}';\nif(!fs.existsSync(m)){{fs.writeFileSync(m,'1');console.log(JSON.stringify({{type:'listening',port:5201}}));setTimeout(()=>process.exit(3),150);}}\nelse{{console.log(JSON.stringify({{type:'listening',port:5202}}));setInterval(()=>{{}},1000);}}\n"
        );
        let (emit, events) = collect();
        let (mut h, first) = PreviewHandle::start(spec(d.path(), &script), emit, Duration::from_secs(20)).unwrap();
        assert_eq!(first, 5201);
        let deadline = Instant::now() + Duration::from_secs(20);
        while h.port() != Some(5202) && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(30));
        }
        assert_eq!(h.port(), Some(5202));
        h.shutdown();
        let ev = events.lock().unwrap();
        assert!(ev.contains(&PreviewEvent::Exited { exit_code: Some(3), will_restart: true }));
        assert!(ev.iter().any(|e| matches!(e, PreviewEvent::Listening { port: 5202, .. })));
    }

    #[test]
    fn gives_up_after_max_restarts() {
        let d = tempfile::tempdir().unwrap();
        let (emit, events) = collect();
        let r = PreviewHandle::start(spec(d.path(), "process.exit(7);"), emit, Duration::from_secs(20));
        assert_eq!(r.err().as_deref(), Some("exited:7"));
        let ev = events.lock().unwrap();
        assert!(ev.contains(&PreviewEvent::Exited { exit_code: Some(7), will_restart: false }));
        assert!(ev.iter().any(|e| matches!(e, PreviewEvent::Failed { .. })));
    }

    #[test]
    fn start_times_out_without_a_report() {
        let d = tempfile::tempdir().unwrap();
        let (emit, _) = collect();
        let r = PreviewHandle::start(spec(d.path(), "setInterval(()=>{},1000);"), emit, Duration::from_millis(600));
        assert_eq!(r.err().as_deref(), Some("timeout"));
    }

    #[cfg(windows)]
    fn alive(pid: u32) -> bool {
        let out = std::process::Command::new("tasklist").args(["/FI", &format!("PID eq {pid}"), "/NH"]).output().unwrap();
        String::from_utf8_lossy(&out.stdout).contains(&pid.to_string())
    }

    #[cfg(windows)]
    #[test]
    fn shutdown_kills_the_runner_and_its_children() {
        let d = tempfile::tempdir().unwrap();
        let pids = d.path().join("pids.txt").to_string_lossy().replace('\\', "/");
        // The runner spawns a grandchild (like Vite's esbuild service) and records both pids.
        let script = format!(
            "import fs from 'node:fs';import cp from 'node:child_process';\nconst c=cp.spawn(process.execPath,['-e','setInterval(()=>{{}},1000)'],{{stdio:'ignore'}});\nfs.writeFileSync('{pids}',process.pid+' '+c.pid);\nconsole.log(JSON.stringify({{type:'listening',port:5301}}));setInterval(()=>{{}},1000);\n"
        );
        let (emit, _) = collect();
        let (mut h, _) = PreviewHandle::start(spec(d.path(), &script), emit, Duration::from_secs(20)).unwrap();
        let text = std::fs::read_to_string(&pids).unwrap();
        let ids: Vec<u32> = text.split(' ').map(|s| s.trim().parse().unwrap()).collect();
        assert!(ids.iter().all(|p| alive(*p)));
        h.shutdown();
        std::thread::sleep(Duration::from_millis(300));
        assert!(ids.iter().all(|p| !alive(*p)), "runner tree still alive: {ids:?}");
    }

    /// Real Vite on a scaffolded project (template + runtime copied to `vanilla/runtime`, deps installed).
    /// `VANILLA_TEST_PROJECT=<dir> cargo test real_vite_preview -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn real_vite_preview() {
        use std::io::Write;
        let root = PathBuf::from(std::env::var("VANILLA_TEST_PROJECT").expect("VANILLA_TEST_PROJECT"));
        let runner = Path::new(env!("CARGO_MANIFEST_DIR")).join("../resources/workers/vite-runner.mjs").canonicalize().unwrap();
        let spec = PreviewSpec { node: node(), runner: plain_path(&runner), root, path_env: process::fresh_path(), max_restarts: 1, backoff: Duration::from_millis(200) };
        let (emit, _) = collect();
        let (mut h, port) = PreviewHandle::start(spec, emit, Duration::from_secs(90)).unwrap();
        let get = |path: &str| {
            let mut s = std::net::TcpStream::connect(("127.0.0.1", port)).unwrap();
            write!(s, "GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n").unwrap();
            let mut body = String::new();
            s.read_to_string(&mut body).unwrap();
            body
        };
        assert!(get("/").starts_with("HTTP/1.1 200"));
        assert!(get("/src/main.tsx").starts_with("HTTP/1.1 200"));
        h.shutdown();
        assert!(std::net::TcpStream::connect(("127.0.0.1", port)).is_err(), "server still listening after shutdown");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adapter_job_is_fixed_and_pinned() {
        assert_eq!(OwnedJob::ClaudeAdapter.program(), "npm");
        let argv = OwnedJob::ClaudeAdapter.argv();
        assert_eq!(argv.first(), Some(&"install"));
        assert!(argv.contains(&"--ignore-scripts"));
        assert_eq!(argv.last().copied(), Some(format!("{CLAUDE_ADAPTER_PACKAGE}@{CLAUDE_ADAPTER_VERSION}").as_str()));
        assert_eq!(CLAUDE_ADAPTER_DIR, format!("claude-agent-acp@{CLAUDE_ADAPTER_VERSION}"));
        assert!(serde_json::from_str::<OwnedJob>("\"claudeAdapter\"").is_ok());
    }

    #[test]
    fn verify_adapter_reads_version_from_disk() {
        let d = tempfile::tempdir().unwrap();
        assert!(!verify_claude_adapter(d.path()).installed);
        let pkg_dir = d.path().join("node_modules").join(CLAUDE_ADAPTER_PACKAGE);
        std::fs::create_dir_all(pkg_dir.join("dist")).unwrap();
        std::fs::write(pkg_dir.join("dist/index.js"), "").unwrap();
        std::fs::write(pkg_dir.join("package.json"), "{\"version\":\"0.83.0\"}").unwrap();
        let s = verify_claude_adapter(d.path());
        assert!(s.installed && s.pinned);
        assert_eq!(s.version.as_deref(), Some("0.83.0"));
        std::fs::write(pkg_dir.join("package.json"), "{\"version\":\"0.1.0\"}").unwrap();
        let s = verify_claude_adapter(d.path());
        assert!(s.installed && !s.pinned);
    }

    #[test]
    fn prepare_adapter_dir_writes_minimal_package_json() {
        let d = tempfile::tempdir().unwrap();
        let dir = claude_adapter_dir(d.path());
        prepare_adapter_dir(&dir).unwrap();
        assert_eq!(std::fs::read_to_string(dir.join("package.json")).unwrap(), "{\"private\":true}");
    }

    /// Real network install into a temp dir (never the app data dir). Run manually:
    /// `cargo test real_adapter_install -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn real_adapter_install() {
        let d = tempfile::tempdir().unwrap();
        let dir = claude_adapter_dir(d.path());
        prepare_adapter_dir(&dir).unwrap();
        let noop: Emit = Arc::new(|_| {});
        let code = run_job(OwnedJob::ClaudeAdapter, &dir, &process::fresh_path(), &AtomicBool::new(false), Duration::from_secs(600), noop).unwrap();
        assert_eq!(code, Some(0));
        let s = verify_claude_adapter(&dir);
        assert!(s.installed && s.pinned, "{s:?}");
    }

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

//! PTY fallback (T2.11, Technical-Design §3.3, F-AGT-04).
//!
//! The UI can only ask for one of the known agent ids; the executable is resolved from PATH and
//! launched with fixed argv in the active workspace (D-012). No command string ever comes from
//! the frontend. Shell permissions inside the agent follow that CLI's own permission system.

use crate::process::{self, resolve_command};
use base64::Engine;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};

/// agent id (Doctor ids) -> executable name looked up on PATH.
const AGENT_EXECUTABLES: [(&str, &str); 5] = [
    ("claude-code", "claude"),
    ("codex", "codex"),
    ("opencode", "opencode"),
    ("hermes", "hermes"),
    ("agy", "agy"),
];

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum PtyEvent {
    /// Base64 of the raw output bytes (terminal streams are not always valid UTF-8).
    Output { data: String },
    Exit { code: Option<u32> },
}

type SharedMaster = Arc<Mutex<Option<Box<dyn MasterPty + Send>>>>;

pub struct PtySession {
    master: SharedMaster,
    writer: Box<dyn Write + Send>,
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
}

fn size(cols: u16, rows: u16) -> PtySize {
    PtySize { rows: rows.max(1), cols: cols.max(1), pixel_width: 0, pixel_height: 0 }
}

/// `.cmd`/`.bat` shims (npm-installed agent CLIs) cannot be started directly by CreateProcess.
fn launch_argv(exe: &Path) -> Vec<String> {
    let ext = exe.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase);
    if cfg!(windows) && matches!(ext.as_deref(), Some("cmd") | Some("bat")) {
        vec!["cmd.exe".into(), "/c".into(), exe.to_string_lossy().into_owned()]
    } else {
        vec![exe.to_string_lossy().into_owned()]
    }
}

impl PtySession {
    /// Start `exe` (fixed argv `args`) in `cwd`. `on_event` receives output chunks and one final Exit.
    pub fn spawn(
        exe: &Path,
        args: &[&str],
        cwd: &Path,
        cols: u16,
        rows: u16,
        on_event: impl Fn(PtyEvent) + Send + 'static,
    ) -> Result<PtySession, String> {
        let pair = native_pty_system().openpty(size(cols, rows)).map_err(|e| e.to_string())?;
        let mut argv = launch_argv(exe);
        argv.extend(args.iter().map(|s| s.to_string()));
        let mut cmd = CommandBuilder::new(&argv[0]);
        cmd.args(&argv[1..]);
        cmd.cwd(crate::commands::process_commands::plain_path(cwd));
        let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
        drop(pair.slave);
        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
        let child = Arc::new(Mutex::new(child));
        let master: SharedMaster = Arc::new(Mutex::new(Some(pair.master)));

        // ConPTY keeps the output pipe open until the pseudo console is closed, so the master is
        // dropped once the child has exited (after a short drain window for trailing output).
        let (code_tx, code_rx) = std::sync::mpsc::channel::<Option<u32>>();
        let (waiter, owner) = (child.clone(), master.clone());
        std::thread::spawn(move || {
            let code = loop {
                match waiter.lock().map(|mut c| c.try_wait()) {
                    Ok(Ok(Some(status))) => break Some(status.exit_code()),
                    Ok(Ok(None)) => {}
                    _ => break None,
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
            };
            std::thread::sleep(std::time::Duration::from_millis(200));
            if let Ok(mut m) = owner.lock() {
                m.take();
            }
            let _ = code_tx.send(code);
        });

        std::thread::spawn(move || {
            let b64 = base64::engine::general_purpose::STANDARD;
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => on_event(PtyEvent::Output { data: b64.encode(&buf[..n]) }),
                }
            }
            on_event(PtyEvent::Exit { code: code_rx.recv().unwrap_or(None) });
        });
        Ok(PtySession { master, writer, child })
    }

    pub fn write(&mut self, data: &[u8]) -> Result<(), String> {
        self.writer.write_all(data).and_then(|_| self.writer.flush()).map_err(|e| e.to_string())
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        match self.master.lock().map_err(|e| e.to_string())?.as_ref() {
            Some(m) => m.resize(size(cols, rows)).map_err(|e| e.to_string()),
            None => Err("terminal closed".to_string()),
        }
    }

    pub fn kill(&self) {
        if let Ok(mut c) = self.child.lock() {
            let _ = c.kill();
        }
    }
}

static NEXT_ID: AtomicU32 = AtomicU32::new(1);
static SESSIONS: Mutex<Option<HashMap<u32, PtySession>>> = Mutex::new(None);

fn with_sessions<T>(f: impl FnOnce(&mut HashMap<u32, PtySession>) -> T) -> T {
    let mut guard = SESSIONS.lock().unwrap_or_else(|p| p.into_inner());
    f(guard.get_or_insert_with(HashMap::new))
}

fn executable_for(agent_id: &str, path_env: &str) -> Result<PathBuf, String> {
    let (_, name) = AGENT_EXECUTABLES
        .iter()
        .find(|(id, _)| *id == agent_id)
        .ok_or_else(|| format!("unknown agent: {agent_id}"))?;
    resolve_command(name, path_env).ok_or_else(|| format!("agent executable not found: {name}"))
}

/// Everything `pty_start` decided before spawning: the executable, the fixed argv tail and the working folder.
#[derive(Debug, PartialEq)]
pub struct Launch {
    pub exe: PathBuf,
    pub args: Vec<String>,
    pub cwd: PathBuf,
}

const MAX_EXTRA_ARGS: usize = 20;
const MAX_ARG_LEN: usize = 500;

/// Extra arguments come from the agent registry (edited behind a confirm dialog). No shell is involved, but
/// control characters and absurd sizes are still refused.
pub fn validate_args(args: &[String]) -> Result<(), String> {
    if args.len() > MAX_EXTRA_ARGS {
        return Err(format!("too many arguments (max {MAX_EXTRA_ARGS})"));
    }
    for a in args {
        if a.is_empty() || a.len() > MAX_ARG_LEN || a.chars().any(|c| c.is_control()) {
            return Err("invalid agent argument".into());
        }
    }
    Ok(())
}

/// Scene folder name as created by `scene_commands` (lowercase letters, digits, dashes).
fn valid_scene_slug(slug: &str) -> bool {
    !slug.is_empty()
        && slug.len() <= 80
        && slug.chars().next().is_some_and(|c| c.is_ascii_alphanumeric())
        && slug.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Working folder: the scene folder `scenes/<slug>` (must exist) or the workspace root. Always inside the workspace.
pub fn resolve_cwd(workspace: &Path, scene_slug: Option<&str>) -> Result<PathBuf, String> {
    let root = workspace.canonicalize().map_err(|e| format!("workspace: {e}"))?;
    let target = match scene_slug {
        None => root.clone(),
        Some(slug) => {
            if !valid_scene_slug(slug) {
                return Err(format!("invalid scene: {slug}"));
            }
            let dir = root.join("scenes").join(slug);
            if !dir.is_dir() {
                return Err(format!("scene folder not found: {slug}"));
            }
            dir.canonicalize().map_err(|e| e.to_string())?
        }
    };
    if !target.starts_with(&root) {
        return Err("Access denied: scene folder is outside the workspace".into());
    }
    Ok(target)
}

/// The security checks of an agent launch, without spawning anything: trusted workspace, known agent id,
/// executable found on PATH, validated extra args, cwd inside the workspace (D-012, AGENTS.md section 7).
pub fn prepare_launch(
    workspace: &str,
    trusted: bool,
    agent_id: &str,
    scene_slug: Option<&str>,
    args: Vec<String>,
    path_env: &str,
) -> Result<Launch, String> {
    if !trusted {
        return Err("untrusted-workspace".into());
    }
    validate_args(&args)?;
    let exe = executable_for(agent_id, path_env)?;
    let cwd = resolve_cwd(Path::new(workspace), scene_slug)?;
    Ok(Launch { exe, args, cwd })
}

/// Start an agent CLI in a PTY inside the scene folder (or the workspace root). The executable is chosen by the
/// backend from the agent id; the frontend only supplies the registry's extra arguments. The workspace must be trusted.
/// Returns the terminal id used by the other commands.
#[tauri::command]
pub fn pty_start(
    agent_id: String,
    scene_slug: Option<String>,
    args: Option<Vec<String>>,
    cols: u16,
    rows: u16,
    on_event: tauri::ipc::Channel<PtyEvent>,
) -> Result<u32, String> {
    let ws = crate::commands::fs_commands::get_active_workspace_internal().ok_or_else(|| "no active workspace".to_string())?;
    let launch = prepare_launch(
        &ws,
        crate::commands::trust_commands::is_trusted(&ws),
        &agent_id,
        scene_slug.as_deref(),
        args.unwrap_or_default(),
        &process::fresh_path(),
    )?;
    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    let arg_refs: Vec<&str> = launch.args.iter().map(String::as_str).collect();
    let session = PtySession::spawn(&launch.exe, &arg_refs, &launch.cwd, cols, rows, move |ev| {
        let exited = matches!(ev, PtyEvent::Exit { .. });
        let _ = on_event.send(ev);
        if exited {
            with_sessions(|m| m.remove(&id));
        }
    })?;
    with_sessions(|m| m.insert(id, session));
    Ok(id)
}

#[tauri::command]
pub fn pty_write(id: u32, data: String) -> Result<(), String> {
    with_sessions(|m| m.get_mut(&id).ok_or_else(|| "terminal closed".to_string())?.write(data.as_bytes()))
}

#[tauri::command]
pub fn pty_resize(id: u32, cols: u16, rows: u16) -> Result<(), String> {
    with_sessions(|m| m.get(&id).ok_or_else(|| "terminal closed".to_string())?.resize(cols, rows))
}

#[tauri::command]
pub fn pty_kill(id: u32) {
    with_sessions(|m| {
        if let Some(s) = m.get(&id) {
            s.kill();
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::mpsc;
    use std::time::{Duration, Instant};

    /// Stands in for an agent CLI: a shell we can drive with input and read a computed result from.
    #[cfg(windows)]
    fn fake_agent() -> (PathBuf, Vec<&'static str>, &'static str) {
        (PathBuf::from("cmd.exe"), vec!["/Q"], "set /a 40+2\r\nexit 7\r\n")
    }
    #[cfg(not(windows))]
    fn fake_agent() -> (PathBuf, Vec<&'static str>, &'static str) {
        (PathBuf::from("/bin/sh"), vec![], "echo $((40+2))\nexit 7\n")
    }

    #[test]
    fn roundtrip_input_output_and_exit_code() {
        let (exe, args, input) = fake_agent();
        let (tx, rx) = mpsc::channel();
        let dir = tempfile::tempdir().unwrap();
        let mut s = PtySession::spawn(&exe, &args, dir.path(), 80, 24, move |ev| {
            let _ = tx.send(ev);
        })
        .expect("spawn");
        s.resize(100, 30).expect("resize");
        s.write(input.as_bytes()).expect("write");

        let b64 = base64::engine::general_purpose::STANDARD;
        let mut out = Vec::new();
        let mut exit = None;
        let deadline = Instant::now() + Duration::from_secs(20);
        while Instant::now() < deadline {
            match rx.recv_timeout(Duration::from_millis(200)) {
                Ok(PtyEvent::Output { data }) => {
                    let bytes = b64.decode(data).unwrap();
                    // ConPTY asks for the cursor position at startup; xterm.js answers in the app.
                    if bytes.windows(4).any(|w| w == b"[6n") {
                        s.write(b"[1;1R").expect("dsr reply");
                    }
                    out.extend(bytes);
                }
                Ok(PtyEvent::Exit { code }) => {
                    exit = Some(code);
                    break;
                }
                Err(_) => {}
            }
        }
        let text = String::from_utf8_lossy(&out);
        assert!(text.contains("42"), "output was: {text:?}");
        assert_eq!(exit, Some(Some(7)), "output was: {text:?}");
    }

    #[test]
    fn kill_ends_session() {
        let (exe, args, _) = fake_agent();
        let (tx, rx) = mpsc::channel();
        let dir = tempfile::tempdir().unwrap();
        let s = PtySession::spawn(&exe, &args, dir.path(), 80, 24, move |ev| {
            let _ = tx.send(ev);
        })
        .expect("spawn");
        s.kill();
        let deadline = Instant::now() + Duration::from_secs(20);
        let mut exited = false;
        while Instant::now() < deadline && !exited {
            exited = matches!(rx.recv_timeout(Duration::from_millis(200)), Ok(PtyEvent::Exit { .. }));
        }
        assert!(exited);
    }

    #[test]
    fn only_known_agent_ids_resolve() {
        assert!(executable_for("rm -rf /", "").is_err());
        assert!(executable_for("claude-code", "").unwrap_err().contains("not found"));
    }

    #[test]
    fn untrusted_workspaces_never_launch() {
        let d = tempfile::tempdir().unwrap();
        let ws = d.path().to_string_lossy().to_string();
        let err = prepare_launch(&ws, false, "claude-code", None, vec![], "").unwrap_err();
        assert_eq!(err, "untrusted-workspace");
    }

    #[test]
    fn unknown_agents_and_arbitrary_commands_are_refused() {
        let d = tempfile::tempdir().unwrap();
        let ws = d.path().to_string_lossy().to_string();
        for bad in ["rm -rf /", "bash", "calc.exe", "claude-code; calc", ""] {
            let err = prepare_launch(&ws, true, bad, None, vec![], "").unwrap_err();
            assert!(err.contains("unknown agent"), "{bad}: {err}");
        }
    }

    #[test]
    fn a_missing_executable_is_reported() {
        let d = tempfile::tempdir().unwrap();
        let ws = d.path().to_string_lossy().to_string();
        let err = prepare_launch(&ws, true, "claude-code", None, vec![], "").unwrap_err();
        assert!(err.contains("not found"), "{err}");
    }

    #[test]
    fn extra_args_are_validated() {
        assert!(validate_args(&["--model".into(), "opus".into()]).is_ok());
        assert!(validate_args(&["a\nb".into()]).is_err());
        assert!(validate_args(&["a\u{0}b".into()]).is_err());
        assert!(validate_args(&["".into()]).is_err());
        assert!(validate_args(&["x".repeat(MAX_ARG_LEN + 1)]).is_err());
        assert!(validate_args(&vec!["x".to_string(); MAX_EXTRA_ARGS + 1]).is_err());
    }

    #[test]
    fn cwd_is_the_scene_folder_inside_the_workspace() {
        let d = tempfile::tempdir().unwrap();
        fs::create_dir_all(d.path().join("scenes/intro")).unwrap();
        let root = d.path().canonicalize().unwrap();
        assert_eq!(resolve_cwd(d.path(), None).unwrap(), root);
        assert_eq!(resolve_cwd(d.path(), Some("intro")).unwrap(), root.join("scenes").join("intro"));
    }

    #[test]
    fn cwd_rejects_bad_slugs_missing_scenes_and_escapes() {
        let d = tempfile::tempdir().unwrap();
        fs::create_dir_all(d.path().join("scenes/intro")).unwrap();
        for bad in ["../intro", "intro/../..", "a/b", "..", "Intro", "in tro", "", "C:\\x", "/etc"] {
            assert!(resolve_cwd(d.path(), Some(bad)).is_err(), "{bad}");
        }
        assert!(resolve_cwd(d.path(), Some("missing")).unwrap_err().contains("not found"));
    }

    #[test]
    fn a_scene_symlink_pointing_outside_is_rejected() {
        let d = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        fs::create_dir_all(d.path().join("scenes")).unwrap();
        let link = d.path().join("scenes/evil");
        #[cfg(windows)]
        let made = std::os::windows::fs::symlink_dir(outside.path(), &link).is_ok();
        #[cfg(unix)]
        let made = std::os::unix::fs::symlink(outside.path(), &link).is_ok();
        if !made {
            return; // no symlink privilege
        }
        assert!(resolve_cwd(d.path(), Some("evil")).unwrap_err().contains("outside"));
    }

    #[test]
    fn launch_succeeds_for_a_trusted_workspace_with_a_found_executable() {
        let d = tempfile::tempdir().unwrap();
        fs::create_dir_all(d.path().join("scenes/intro")).unwrap();
        let bin = tempfile::tempdir().unwrap();
        let exe_name = if cfg!(windows) { "claude.exe" } else { "claude" };
        fs::write(bin.path().join(exe_name), "").unwrap();
        let ws = d.path().to_string_lossy().to_string();
        let l = prepare_launch(&ws, true, "claude-code", Some("intro"), vec!["--x".into()], &bin.path().to_string_lossy()).unwrap();
        assert!(l.exe.ends_with(exe_name));
        assert_eq!(l.args, vec!["--x".to_string()]);
        assert!(l.cwd.ends_with("intro"));
    }

    #[test]
    fn cmd_shims_are_wrapped_on_windows() {
        let argv = launch_argv(Path::new("C:/x/agy.cmd"));
        if cfg!(windows) {
            assert_eq!(&argv[..2], ["cmd.exe", "/c"]);
        } else {
            assert_eq!(argv.len(), 1);
        }
    }
}

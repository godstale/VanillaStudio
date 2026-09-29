//! PTY fallback (T2.11, Technical-Design §3.3, F-AGT-04).
//!
//! The UI can only ask for one of the known agent ids; the executable is resolved from PATH and
//! launched with fixed argv in the active workspace (D-012). No command string ever comes from
//! the frontend. Shell permissions inside the agent follow that CLI's own permission system.

use crate::commands::fs_commands::verify_path_in_workspace;
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
        cmd.cwd(cwd);
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

/// Start an agent CLI in a PTY. `cwd` must be inside the active workspace (defaults to its root).
/// Returns the terminal id used by the other commands.
#[tauri::command]
pub fn pty_start(
    agent_id: String,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
    on_event: tauri::ipc::Channel<PtyEvent>,
) -> Result<u32, String> {
    let exe = executable_for(&agent_id, &process::fresh_path())?;
    let cwd = match cwd {
        Some(c) => verify_path_in_workspace(Path::new(&c), None)?,
        None => {
            let ws = crate::commands::fs_commands::get_active_workspace_internal()
                .ok_or_else(|| "no active workspace".to_string())?;
            verify_path_in_workspace(Path::new(&ws), None)?
        }
    };
    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    let session = PtySession::spawn(&exe, &[], &cwd, cols, rows, move |ev| {
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
    fn cmd_shims_are_wrapped_on_windows() {
        let argv = launch_argv(Path::new("C:/x/agy.cmd"));
        if cfg!(windows) {
            assert_eq!(&argv[..2], ["cmd.exe", "/c"]);
        } else {
            assert_eq!(argv.len(), 1);
        }
    }
}

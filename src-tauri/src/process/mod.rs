//! Common external-process helpers (Technical-Design §2.4 Doctor rules, §6 process rules).
//!
//! - commands are resolved PATH order x executable extensions (`.ps1` shims are skipped)
//! - callers pass a PATH read fresh from the registry (the app's own PATH is frozen at launch)
//! - stdin is closed, no console window, hard timeout, whole process tree is killed on timeout
//!
//! Only fixed-argv execution is offered; nothing here parses a command string (D-012).

use std::ffi::OsString;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

#[cfg(windows)]
const EXTS: [&str; 4] = [".exe", ".cmd", ".bat", ".com"];
#[cfg(not(windows))]
const EXTS: [&str; 1] = [""];

/// Resolve a command the way cmd.exe would. `path_env` is a `;`/`:` separated PATH value.
pub fn resolve_command(cmd: &str, path_env: &str) -> Option<PathBuf> {
    for dir in std::env::split_paths(path_env) {
        for ext in EXTS {
            let p = dir.join(format!("{cmd}{ext}"));
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

/// Expand `%VAR%` references (registry PATH values are REG_EXPAND_SZ). Unknown names are kept as-is.
pub fn expand_env_refs(s: &str, lookup: impl Fn(&str) -> Option<String>) -> String {
    let mut out = String::new();
    let mut parts = s.split('%');
    out.push_str(parts.next().unwrap_or_default());
    let mut inside = true;
    for p in parts {
        if inside {
            match lookup(p) {
                Some(v) if !p.is_empty() => out.push_str(&v),
                _ => {
                    out.push('%');
                    out.push_str(p);
                    out.push('%');
                }
            }
        } else {
            out.push_str(p);
        }
        inside = !inside;
    }
    out
}

/// Join non-empty PATH segments.
pub fn join_path_values(system: &str, user: &str) -> String {
    let sep = if cfg!(windows) { ";" } else { ":" };
    [system, user].iter().filter(|s| !s.trim().is_empty()).cloned().collect::<Vec<_>>().join(sep)
}

/// PATH as a freshly started process would see it. Windows: HKLM + HKCU `Environment`.
#[cfg(windows)]
pub fn fresh_path() -> String {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;
    let read = |hive, sub: &str| {
        RegKey::predef(hive).open_subkey(sub).and_then(|k| k.get_value::<String, _>("Path")).unwrap_or_default()
    };
    let lookup = |name: &str| std::env::var(name).ok();
    let system = expand_env_refs(&read(HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment"), lookup);
    let user = expand_env_refs(&read(HKEY_CURRENT_USER, "Environment"), lookup);
    join_path_values(&system, &user)
}

#[cfg(not(windows))]
pub fn fresh_path() -> String {
    std::env::var("PATH").unwrap_or_default()
}

#[derive(Debug, Clone)]
pub struct RunOptions {
    pub timeout: Duration,
    pub path_env: Option<String>,
    pub cwd: Option<PathBuf>,
    pub env: Vec<(OsString, OsString)>,
}

impl RunOptions {
    pub fn new(timeout: Duration) -> Self {
        RunOptions { timeout, path_env: None, cwd: None, env: vec![] }
    }
    pub fn path(mut self, path_env: &str) -> Self {
        self.path_env = Some(path_env.to_string());
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Captured {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RunError {
    Spawn(String),
    Timeout(Duration),
    Io(String),
}

impl std::fmt::Display for RunError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RunError::Spawn(e) => write!(f, "spawn failed: {e}"),
            RunError::Timeout(d) => write!(f, "timed out after {}s", d.as_secs()),
            RunError::Io(e) => write!(f, "{e}"),
        }
    }
}

/// Windows Job Object that kills every assigned process when terminated or dropped.
#[cfg(windows)]
pub struct JobObject(windows_sys::Win32::Foundation::HANDLE);

// The handle is an opaque kernel handle usable from any thread.
#[cfg(windows)]
unsafe impl Send for JobObject {}
#[cfg(windows)]
unsafe impl Sync for JobObject {}

#[cfg(windows)]
impl JobObject {
    pub fn new() -> Result<Self, String> {
        use windows_sys::Win32::System::JobObjects::*;
        unsafe {
            let h = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if h.is_null() {
                return Err("CreateJobObject failed".into());
            }
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            let ok = SetInformationJobObject(
                h,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );
            if ok == 0 {
                windows_sys::Win32::Foundation::CloseHandle(h);
                return Err("SetInformationJobObject failed".into());
            }
            Ok(JobObject(h))
        }
    }

    pub fn assign(&self, child: &Child) -> Result<(), String> {
        use std::os::windows::io::AsRawHandle;
        let ok = unsafe { windows_sys::Win32::System::JobObjects::AssignProcessToJobObject(self.0, child.as_raw_handle() as _) };
        if ok == 0 { Err("AssignProcessToJobObject failed".into()) } else { Ok(()) }
    }

    pub fn terminate(&self) {
        unsafe {
            windows_sys::Win32::System::JobObjects::TerminateJobObject(self.0, 1);
        }
    }
}

#[cfg(windows)]
impl Drop for JobObject {
    fn drop(&mut self) {
        // KILL_ON_JOB_CLOSE: closing the last handle kills the remaining tree.
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.0);
        }
    }
}

/// Build a command with the shared launch rules: stdin closed, no console window.
pub fn base_command(exe: &Path, args: &[&str], opts: &RunOptions) -> Command {
    let mut cmd = Command::new(exe);
    cmd.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    if let Some(p) = &opts.path_env {
        cmd.env("PATH", p);
    }
    if let Some(d) = &opts.cwd {
        cmd.current_dir(d);
    }
    for (k, v) in &opts.env {
        cmd.env(k, v);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    cmd
}

fn drain<R: Read + Send + 'static>(r: Option<R>) -> std::thread::JoinHandle<String> {
    std::thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut r) = r {
            let _ = r.read_to_end(&mut buf);
        }
        String::from_utf8_lossy(&buf).into_owned()
    })
}

/// Run to completion with a timeout. On timeout the whole process tree is terminated.
pub fn run_capture(exe: &Path, args: &[&str], opts: &RunOptions) -> Result<Captured, RunError> {
    let mut child = base_command(exe, args, opts).spawn().map_err(|e| RunError::Spawn(e.to_string()))?;
    #[cfg(windows)]
    let job = JobObject::new().ok().filter(|j| j.assign(&child).is_ok());

    // Pipes are drained on threads so a chatty child cannot block on a full pipe.
    let out = drain(child.stdout.take());
    let err = drain(child.stderr.take());

    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(s)) => break Some(s),
            Ok(None) if started.elapsed() >= opts.timeout => break None,
            Ok(None) => std::thread::sleep(Duration::from_millis(10)),
            Err(e) => return Err(RunError::Io(e.to_string())),
        }
    };

    let Some(status) = status else {
        #[cfg(windows)]
        if let Some(j) = &job {
            j.terminate();
        }
        let _ = child.kill();
        let _ = child.wait();
        // Grandchildren holding the pipes are gone once the tree is killed, so this returns.
        let _ = out.join();
        let _ = err.join();
        return Err(RunError::Timeout(opts.timeout));
    };
    Ok(Captured {
        stdout: out.join().unwrap_or_default(),
        stderr: err.join().unwrap_or_default(),
        exit_code: status.code(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expand_known_and_unknown_refs() {
        let lookup = |n: &str| (n == "SystemRoot").then(|| r"C:\Windows".to_string());
        assert_eq!(expand_env_refs(r"%SystemRoot%\system32;%NOPE%\x", lookup), r"C:\Windows\system32;%NOPE%\x");
        assert_eq!(expand_env_refs("a%%b", |_| None), "a%%b");
        assert_eq!(expand_env_refs("plain", |_| None), "plain");
    }

    #[test]
    fn join_skips_empty() {
        let sep = if cfg!(windows) { ";" } else { ":" };
        assert_eq!(join_path_values("a", ""), "a");
        assert_eq!(join_path_values("a", "b"), format!("a{sep}b"));
    }

    #[cfg(windows)]
    mod windows {
        use super::*;

        fn dir_with(files: &[&str]) -> tempfile::TempDir {
            let d = tempfile::tempdir().unwrap();
            for f in files {
                std::fs::write(d.path().join(f), "@echo off\r\necho v1.2.3\r\n").unwrap();
            }
            d
        }

        #[test]
        fn resolves_pathext_order_and_skips_ps1() {
            let d = dir_with(&["tool.ps1", "tool.cmd", "only-ps.ps1", "both.exe", "both.cmd"]);
            let p = d.path().to_string_lossy().into_owned();
            assert_eq!(resolve_command("tool", &p).unwrap().file_name().unwrap(), "tool.cmd");
            assert!(resolve_command("only-ps", &p).is_none());
            assert_eq!(resolve_command("both", &p).unwrap().file_name().unwrap(), "both.exe");
            assert!(resolve_command("tool", "").is_none());
        }

        #[test]
        fn resolves_first_dir_in_path_order() {
            let a = dir_with(&["x.cmd"]);
            let b = dir_with(&["x.cmd"]);
            let path = std::env::join_paths([a.path(), b.path()]).unwrap().to_string_lossy().into_owned();
            assert!(resolve_command("x", &path).unwrap().starts_with(a.path()));
        }

        #[test]
        fn runs_cmd_shim_with_custom_path() {
            let d = dir_with(&["tool.cmd"]);
            let p = d.path().to_string_lossy().into_owned();
            let exe = resolve_command("tool", &p).unwrap();
            let r = run_capture(&exe, &[], &RunOptions::new(Duration::from_secs(10)).path(&p)).unwrap();
            assert_eq!(r.stdout.trim(), "v1.2.3");
            assert_eq!(r.exit_code, Some(0));
        }

        #[test]
        fn stdin_is_closed() {
            // findstr blocks forever on an open stdin; with a closed one it exits 1 (no match).
            let r = run_capture(Path::new("findstr"), &["x"], &RunOptions::new(Duration::from_secs(10))).unwrap();
            assert_eq!(r.exit_code, Some(1));
        }

        #[test]
        fn timeout_kills_whole_tree() {
            // cmd spawns ping (grandchild) that keeps the stdout pipe open for ~30s.
            let started = Instant::now();
            let r = run_capture(
                Path::new("cmd"),
                &["/c", "ping -n 30 127.0.0.1"],
                &RunOptions::new(Duration::from_millis(500)),
            );
            assert_eq!(r, Err(RunError::Timeout(Duration::from_millis(500))));
            assert!(started.elapsed() < Duration::from_secs(10), "tree not killed: {:?}", started.elapsed());
        }

        #[test]
        fn spawn_failure_is_reported() {
            let r = run_capture(Path::new(r"C:\definitely\missing.exe"), &[], &RunOptions::new(Duration::from_secs(1)));
            assert!(matches!(r, Err(RunError::Spawn(_))));
        }

        #[test]
        fn fresh_path_reads_registry() {
            let p = fresh_path();
            assert!(p.to_lowercase().contains("system32"), "{p}");
        }
    }
}

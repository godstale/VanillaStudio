//! Doctor: detect the external dependencies Vanilla Studio needs (Technical-Design §2.4, F-ENV-01).
//!
//! The report carries language-neutral data only. `fix_key` names the guidance the UI shows
//! (i18n `doctor.fix.<key>`), `fix_command` is a literal command or URL to display.

use crate::process::ffmpeg::{self, FfmpegEvent, InstallRecord};
use crate::process::{self, resolve_command, run_capture, RunOptions};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

const AGENT_IDS: [&str; 5] = ["claude-code", "codex", "opencode", "hermes", "agy"];
const NODE_MIN_MAJOR: u32 = 22;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Check {
    pub id: &'static str,
    pub required: bool,
    /// ok | missing | outdated | unsupported | not-logged-in | info
    pub status: &'static str,
    pub version: Option<String>,
    pub path: Option<String>,
    pub detail: Option<String>,
    pub fix_key: Option<&'static str>,
    pub fix_command: Option<&'static str>,
}

impl Check {
    fn new(id: &'static str, required: bool) -> Self {
        Check { id, required, status: "missing", version: None, path: None, detail: None, fix_key: None, fix_command: None }
    }
    fn fix(&mut self, key: &'static str, command: Option<&'static str>) {
        self.fix_key = Some(key);
        self.fix_command = command;
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct DoctorReport {
    /// The 13 dependency checks, in display order.
    pub checks: Vec<Check>,
    /// At least one agent CLI must work (D-005).
    pub any_agent_ok: bool,
    /// Every `required` check is ok and an agent is available.
    pub ready: bool,
    pub took_ms: u64,
}

pub fn first_line(s: &str) -> String {
    s.lines().find(|l| !l.trim().is_empty()).unwrap_or_default().trim().to_string()
}

/// Major number of strings like `v22.13.0` or `git version 2.45.2` (first digit run).
pub fn major(version: &str) -> Option<u32> {
    version.trim_start_matches(|c: char| !c.is_ascii_digit()).split('.').next()?.parse().ok()
}

/// True when `-encoders` output lists the encoder as its own entry (not just a substring).
pub fn has_encoder(encoders_output: &str, name: &str) -> bool {
    encoders_output.lines().any(|l| l.split_whitespace().nth(1) == Some(name))
}

/// FFmpeg is usable for export only with libx264 AND a passing `-colorspace bt709` probe.
/// Returns (status, needs_managed_copy).
pub fn judge_ffmpeg(has_x264: bool, colorspace_ok: bool) -> &'static str {
    match (has_x264, colorspace_ok) {
        (true, true) => "ok",
        (_, true) => "unsupported", // modern build without libx264 (LGPL)
        _ => "outdated",
    }
}

/// `claude auth status` prints account details; only the `loggedIn` boolean is read.
pub fn parse_logged_in(output: &str) -> Option<bool> {
    serde_json::from_str::<serde_json::Value>(output).ok()?.get("loggedIn")?.as_bool()
}

fn run_ok(exe: &Path, args: &[&str], path_env: &str, secs: u64) -> Result<String, String> {
    let cap = run_capture(exe, args, &RunOptions::new(Duration::from_secs(secs)).path(path_env)).map_err(|e| e.to_string())?;
    if cap.exit_code != Some(0) && cap.stdout.trim().is_empty() {
        return Err(format!("exit {:?}: {}", cap.exit_code, cap.stderr.trim()));
    }
    Ok(if cap.stdout.trim().is_empty() { cap.stderr } else { cap.stdout })
}

fn tool(id: &'static str, cmd: &str, required: bool, path_env: &str, fix_key: &'static str, fix_command: Option<&'static str>) -> Check {
    let mut c = Check::new(id, required);
    match resolve_command(cmd, path_env) {
        None => c.fix(fix_key, fix_command),
        Some(p) => {
            c.path = Some(p.display().to_string());
            match run_ok(&p, &["--version"], path_env, 15) {
                Ok(v) => {
                    c.status = "ok";
                    c.version = Some(first_line(&v));
                }
                Err(e) => {
                    c.status = "unsupported";
                    c.detail = Some(e);
                }
            }
        }
    }
    c
}

fn check_node(path_env: &str) -> Check {
    let mut c = tool("node", "node", true, path_env, "install-node", Some("winget install OpenJS.NodeJS.LTS"));
    if c.version.as_deref().and_then(major).is_some_and(|m| m < NODE_MIN_MAJOR) {
        c.status = "outdated";
        c.fix("upgrade-node", Some("winget install OpenJS.NodeJS.LTS"));
    }
    c
}

fn check_pnpm(path_env: &str) -> Check {
    let mut c = tool("pnpm", "pnpm", true, path_env, "enable-pnpm", Some("corepack enable pnpm"));
    if c.status == "missing" && resolve_command("corepack", path_env).is_none() {
        c.fix("install-node-then-pnpm", Some("corepack enable pnpm"));
    }
    c
}

/// App-managed FFmpeg wins over PATH: PATH builds are often old or lack libx264 (S1).
pub fn check_ffmpeg(path_env: &str, managed_dir: Option<&Path>) -> Check {
    let mut c = Check::new("ffmpeg", false);
    let exe_name = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };
    let exe = managed_dir
        .map(|d| d.join(exe_name))
        .filter(|p| p.is_file())
        .or_else(|| resolve_command("ffmpeg", path_env));
    let Some(exe) = exe else {
        c.fix("download-ffmpeg", None);
        return c;
    };
    c.path = Some(exe.display().to_string());
    c.version = run_ok(&exe, &["-hide_banner", "-version"], path_env, 15).ok().map(|v| first_line(&v));
    let encoders = run_ok(&exe, &["-hide_banner", "-encoders"], path_env, 15).unwrap_or_default();
    let (x264, vp9) = (has_encoder(&encoders, "libx264"), has_encoder(&encoders, "libvpx-vp9"));
    c.detail = Some(format!("libx264={x264} libvpx-vp9={vp9}"));
    // The exact option HyperFrames passes; the 2013 build in S1 rejected it.
    let probe = ["-hide_banner", "-f", "lavfi", "-i", "color=c=black:s=16x16:d=0.1", "-colorspace", "bt709", "-f", "null", "-"];
    let colorspace_ok = run_ok(&exe, &probe, path_env, 20).is_ok();
    c.status = judge_ffmpeg(x264, colorspace_ok);
    if c.status != "ok" {
        c.fix("download-ffmpeg", None);
    }
    c
}

#[cfg(windows)]
fn check_webview2() -> Check {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;
    let mut c = Check::new("webview2", true);
    let key = r"Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
    let candidates = [
        (HKEY_LOCAL_MACHINE, format!(r"SOFTWARE\WOW6432Node\{key}")),
        (HKEY_LOCAL_MACHINE, format!(r"SOFTWARE\{key}")),
        (HKEY_CURRENT_USER, format!(r"Software\{key}")),
    ];
    for (hive, sub) in candidates {
        if let Ok(v) = RegKey::predef(hive).open_subkey(&sub).and_then(|k| k.get_value::<String, _>("pv")) {
            if v != "0.0.0.0" {
                c.status = "ok";
                c.version = Some(v);
                return c;
            }
        }
    }
    c.fix("install-webview2", Some("https://developer.microsoft.com/microsoft-edge/webview2/"));
    c
}

#[cfg(not(windows))]
fn check_webview2() -> Check {
    let mut c = Check::new("webview2", true);
    c.status = "ok";
    c.detail = Some("not applicable on this platform".into());
    c
}

/// Newest cached `chrome-headless-shell` build, as HyperFrames launches. The cache ignores PATH.
fn newest_headless_shell(shell_root: &Path) -> Option<(String, PathBuf)> {
    let exe_rel = "chrome-headless-shell-win64/chrome-headless-shell.exe";
    let version_key = |name: &str| -> Vec<u32> { name.trim_start_matches("win64-").split('.').filter_map(|x| x.parse().ok()).collect() };
    std::fs::read_dir(shell_root)
        .ok()?
        .flatten()
        .filter(|e| e.path().join(exe_rel).is_file())
        .max_by_key(|e| version_key(&e.file_name().to_string_lossy()))
        .map(|e| (e.file_name().to_string_lossy().into_owned(), e.path().join(exe_rel)))
}

fn check_render_browser(home: &str) -> Check {
    let mut c = Check::new("render-browser", false);
    let shell_root = Path::new(home).join(".cache/puppeteer/chrome-headless-shell");
    if let Some((version, exe)) = newest_headless_shell(&shell_root) {
        c.status = "ok";
        c.version = Some(version);
        c.path = Some(exe.display().to_string());
        return c;
    }
    for p in [r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"] {
        if Path::new(p).is_file() {
            c.status = "info";
            c.path = Some(p.into());
            c.detail = Some("system-browser-only".into());
        }
    }
    c.fix("install-render-browser", Some("hyperframes browser"));
    c
}

fn check_claude_login(path_env: &str, claude: &Check) -> Check {
    let mut c = Check::new("claude-login", false);
    let Some(p) = claude.path.as_deref().filter(|_| claude.status == "ok") else {
        c.status = "info";
        c.detail = Some("claude-code-missing".into());
        return c;
    };
    match run_ok(Path::new(p), &["auth", "status"], path_env, 20) {
        Ok(out) => match parse_logged_in(&out) {
            Some(true) => c.status = "ok",
            Some(false) => {
                c.status = "not-logged-in";
                c.fix("claude-login", Some("claude auth login"));
            }
            None => {
                c.status = "info";
                c.detail = Some("login-state-unparsed".into());
            }
        },
        Err(e) => {
            c.status = "info";
            c.detail = Some(e);
        }
    }
    c
}

/// Run all 13 checks. Each external command has its own timeout, so the total stays bounded.
pub fn run_checks(path_env: &str, ffmpeg_dir: Option<&Path>, home: &str) -> DoctorReport {
    let started = Instant::now();
    let claude = tool("claude-code", "claude", false, path_env, "install-claude-code", Some("https://docs.claude.com/claude-code"));
    let login = check_claude_login(path_env, &claude);
    let checks = vec![
        check_node(path_env),
        check_pnpm(path_env),
        tool("git", "git", false, path_env, "install-git", Some("winget install Git.Git")),
        claude,
        login,
        tool("codex", "codex", false, path_env, "install-codex", Some("npm i -g @openai/codex")),
        tool("opencode", "opencode", false, path_env, "install-opencode", None),
        tool("hermes", "hermes", false, path_env, "install-hermes", None),
        tool("agy", "agy", false, path_env, "install-agy", None),
        check_ffmpeg(path_env, ffmpeg_dir),
        check_render_browser(home),
        check_webview2(),
        tool("winget", "winget", false, path_env, "winget-manual", None),
    ];
    let any_agent_ok = checks.iter().any(|c| AGENT_IDS.contains(&c.id) && c.status == "ok");
    let ready = any_agent_ok && checks.iter().filter(|c| c.required).all(|c| c.status == "ok");
    DoctorReport { checks, any_agent_ok, ready, took_ms: started.elapsed().as_millis() as u64 }
}

/// Managed FFmpeg location: `<app data>/tools/ffmpeg`.
pub fn managed_ffmpeg_dir<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    use tauri::Manager;
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("tools").join("ffmpeg"))
}

/// `fresh_path` (default true) re-reads PATH from the registry so tools installed while the app
/// is open are recognised (S6 pitfall 1).
#[tauri::command]
pub async fn doctor_check<R: tauri::Runtime>(app: tauri::AppHandle<R>, fresh_path: Option<bool>) -> Result<DoctorReport, String> {
    let ffmpeg_dir = managed_ffmpeg_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let path_env = if fresh_path.unwrap_or(true) { process::fresh_path() } else { std::env::var("PATH").unwrap_or_default() };
        let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).unwrap_or_default();
        run_checks(&path_env, Some(&ffmpeg_dir), &home)
    })
    .await
    .map_err(|e| e.to_string())
}

static FFMPEG_CANCEL: AtomicBool = AtomicBool::new(false);
static FFMPEG_RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegInstallResult {
    pub record: InstallRecord,
    /// Post-install Doctor check of the managed copy (`status == "ok"` means libx264 works).
    pub check: Check,
}

/// Download the pinned FFmpeg GPL build into `<app data>/tools/ffmpeg/` (needs prior user consent
/// in the UI). Progress is streamed over `on_event`; a failed or cancelled run leaves no partial file.
#[tauri::command]
pub async fn ffmpeg_download<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    on_event: tauri::ipc::Channel<FfmpegEvent>,
) -> Result<FfmpegInstallResult, String> {
    let dest = managed_ffmpeg_dir(&app)?;
    if FFMPEG_RUNNING.swap(true, Ordering::SeqCst) {
        return Err("already-running".into());
    }
    FFMPEG_CANCEL.store(false, Ordering::SeqCst);
    let result = tauri::async_runtime::spawn_blocking(move || {
        let record = ffmpeg::install(&dest, ffmpeg::PINNED_MAJOR, &FFMPEG_CANCEL, &mut |e| {
            let _ = on_event.send(e);
        })
        .map_err(|e| e.to_string())?;
        let check = check_ffmpeg(&process::fresh_path(), Some(&dest));
        Ok(FfmpegInstallResult { record, check })
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|r| r);
    FFMPEG_RUNNING.store(false, Ordering::SeqCst);
    result
}

#[tauri::command]
pub fn ffmpeg_download_cancel() {
    FFMPEG_CANCEL.store(true, Ordering::SeqCst);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn major_parses_common_shapes() {
        assert_eq!(major("v22.13.0"), Some(22));
        assert_eq!(major("git version 2.45.2.windows.1"), Some(2));
        assert_eq!(major("21.9.1"), Some(21));
        assert_eq!(major("unknown"), None);
    }

    #[test]
    fn first_line_skips_blank() {
        assert_eq!(first_line("\n\n  ffmpeg version 9.0  \nmore"), "ffmpeg version 9.0");
        assert_eq!(first_line(""), "");
    }

    #[test]
    fn encoder_match_is_exact_entry() {
        let out = " V....D libx264              libx264 H.264\n V....D libx264rgb           libx264 H.264 RGB\n V....D libvpx-vp9  libvpx VP9\n";
        assert!(has_encoder(out, "libx264"));
        assert!(has_encoder(out, "libx264rgb"));
        assert!(has_encoder(out, "libvpx-vp9"));
        assert!(!has_encoder(out, "libx265"));
        assert!(!has_encoder(" V....D h264_nvenc libx264 alias", "libx264"));
    }

    #[test]
    fn ffmpeg_judgement_matrix() {
        assert_eq!(judge_ffmpeg(true, true), "ok");
        assert_eq!(judge_ffmpeg(false, true), "unsupported");
        assert_eq!(judge_ffmpeg(true, false), "outdated");
        assert_eq!(judge_ffmpeg(false, false), "outdated");
    }

    #[test]
    fn login_reads_only_boolean() {
        assert_eq!(parse_logged_in(r#"{"loggedIn":true,"email":"a@b.c"}"#), Some(true));
        assert_eq!(parse_logged_in(r#"{"loggedIn":false}"#), Some(false));
        assert_eq!(parse_logged_in(r#"{"other":1}"#), None);
        assert_eq!(parse_logged_in("not json"), None);
    }

    #[test]
    fn headless_shell_picks_newest_numerically() {
        let d = tempfile::tempdir().unwrap();
        for v in ["win64-9.0.1.0", "win64-152.0.7.1", "win64-100.0.0.0"] {
            let dir = d.path().join(v).join("chrome-headless-shell-win64");
            std::fs::create_dir_all(&dir).unwrap();
            std::fs::write(dir.join("chrome-headless-shell.exe"), "").unwrap();
        }
        std::fs::create_dir_all(d.path().join("win64-999.0.0.0")).unwrap(); // no exe: ignored
        assert_eq!(newest_headless_shell(d.path()).unwrap().0, "win64-152.0.7.1");
        assert!(newest_headless_shell(&d.path().join("missing")).is_none());
    }

    #[cfg(windows)]
    mod windows {
        use super::*;

        /// A PATH dir containing fake `.cmd` tools, plus System32 so cmd.exe internals work.
        fn fake_path(tools: &[(&str, &str)]) -> (tempfile::TempDir, String) {
            let d = tempfile::tempdir().unwrap();
            for (name, out) in tools {
                std::fs::write(d.path().join(format!("{name}.cmd")), format!("@echo off\r\necho {out}\r\n")).unwrap();
            }
            let sys32 = format!(r"{}\System32", std::env::var("SystemRoot").unwrap());
            let path = format!("{};{}", d.path().display(), sys32);
            (d, path)
        }

        fn find<'a>(r: &'a DoctorReport, id: &str) -> &'a Check {
            r.checks.iter().find(|c| c.id == id).unwrap()
        }

        #[test]
        fn empty_path_reports_fixes_for_every_missing_tool() {
            let d = tempfile::tempdir().unwrap();
            let r = run_checks("", None, d.path().to_str().unwrap());
            assert_eq!(r.checks.len(), 13);
            for id in ["node", "pnpm", "git", "claude-code", "codex", "opencode", "hermes", "agy", "ffmpeg", "winget"] {
                let c = find(&r, id);
                assert_eq!(c.status, "missing", "{id}");
                assert!(c.fix_key.is_some(), "{id} has no fix");
            }
            assert_eq!(find(&r, "claude-login").status, "info");
            assert!(!r.any_agent_ok);
            assert!(!r.ready);
        }

        #[test]
        fn node_version_gate() {
            let (_d, path) = fake_path(&[("node", "v20.11.0")]);
            let r = run_checks(&path, None, "");
            let n = find(&r, "node");
            assert_eq!((n.status, n.fix_key), ("outdated", Some("upgrade-node")));
            let (_d2, path2) = fake_path(&[("node", "v22.13.0")]);
            assert_eq!(find(&run_checks(&path2, None, ""), "node").status, "ok");
        }

        #[test]
        fn pnpm_shim_resolved_and_agent_makes_ready_state() {
            let (_d, path) = fake_path(&[("node", "v22.1.0"), ("pnpm", "10.0.0"), ("codex", "codex 1.0")]);
            let r = run_checks(&path, None, "");
            assert_eq!(find(&r, "pnpm").status, "ok");
            assert_eq!(find(&r, "pnpm").version.as_deref(), Some("10.0.0"));
            assert!(r.any_agent_ok);
        }

        #[test]
        fn broken_ffmpeg_is_outdated_not_ok() {
            // Fake ffmpeg prints a version but has no libx264 and the probe "passes": unsupported.
            let (_d, path) = fake_path(&[("ffmpeg", "ffmpeg version 2.0")]);
            let c = check_ffmpeg(&path, None);
            assert_eq!(c.status, "unsupported");
            assert_eq!(c.fix_key, Some("download-ffmpeg"));
            assert_eq!(c.detail.as_deref(), Some("libx264=false libvpx-vp9=false"));
        }

        #[test]
        fn real_environment_smoke() {
            let r = run_checks(&process::fresh_path(), None, &std::env::var("USERPROFILE").unwrap_or_default());
            for c in &r.checks { println!("{} {} {:?}", c.id, c.status, c.version); }
            assert_eq!(r.checks.len(), 13);
            assert_eq!(find(&r, "webview2").status, "ok");
        }
    }
}

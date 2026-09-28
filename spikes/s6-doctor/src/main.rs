//! S6 doctor probe: detect Vanilla Studio's external dependencies on Windows and download FFmpeg.
//!
//! doctor-probe check [--path <PATH>] [--ffmpeg-dir <dir>]   → JSON report on stdout
//! doctor-probe download-ffmpeg <dest-dir>                    → NDJSON progress, then JSON result

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
use wait_timeout::ChildExt;

#[derive(Serialize)]
struct Check {
    id: &'static str,
    required: bool,
    status: &'static str, // ok | missing | outdated | unsupported | not-logged-in | info
    version: Option<String>,
    path: Option<String>,
    detail: Option<String>,
    fix: Option<String>,
}

impl Check {
    fn new(id: &'static str, required: bool) -> Self {
        Check { id, required, status: "missing", version: None, path: None, detail: None, fix: None }
    }
}

/// Resolve a command the way cmd.exe would: PATH order × executable extensions.
/// `.ps1` shims are skipped (they need PowerShell); npm-style installs also ship a `.cmd`.
fn resolve(cmd: &str, path_env: &str) -> Option<PathBuf> {
    const EXTS: [&str; 4] = [".exe", ".cmd", ".bat", ".com"];
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

/// Run with a timeout, stdin closed (some CLIs wait for input otherwise), no console window.
fn run(exe: &Path, args: &[&str], path_env: &str, timeout: Duration) -> Result<String, String> {
    let mut cmd = Command::new(exe);
    cmd.args(args).env("PATH", path_env).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let mut child = cmd.spawn().map_err(|e| format!("spawn failed: {e}"))?;
    let status = match child.wait_timeout(timeout).map_err(|e| e.to_string())? {
        Some(s) => s,
        None => {
            let _ = child.kill();
            return Err(format!("timed out after {}s", timeout.as_secs()));
        }
    };
    let mut out = String::new();
    child.stdout.take().map(|mut s| s.read_to_string(&mut out));
    let mut err = String::new();
    child.stderr.take().map(|mut s| s.read_to_string(&mut err));
    if !status.success() && out.trim().is_empty() {
        return Err(format!("exit {:?}: {}", status.code(), err.trim()));
    }
    Ok(if out.trim().is_empty() { err } else { out })
}

fn first_line(s: &str) -> String {
    s.lines().find(|l| !l.trim().is_empty()).unwrap_or_default().trim().to_string()
}

fn major(version: &str) -> Option<u32> {
    version.trim_start_matches(|c: char| !c.is_ascii_digit()).split('.').next()?.parse().ok()
}

fn tool(id: &'static str, cmd: &str, required: bool, path_env: &str, fix: &str) -> Check {
    let mut c = Check::new(id, required);
    match resolve(cmd, path_env) {
        None => c.fix = Some(fix.into()),
        Some(p) => {
            c.path = Some(p.display().to_string());
            match run(&p, &["--version"], path_env, Duration::from_secs(15)) {
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

fn check_ffmpeg(path_env: &str, app_dir: Option<&Path>) -> Check {
    let mut c = Check::new("ffmpeg", false);
    // App-managed copy wins over PATH: PATH builds are often old or lack libx264 (S1).
    let exe = app_dir.map(|d| d.join("ffmpeg.exe")).filter(|p| p.is_file()).or_else(|| resolve("ffmpeg", path_env));
    let Some(exe) = exe else {
        c.fix = Some("앱에서 FFmpeg 다운로드(동의 후, 약 185MB)".into());
        return c;
    };
    c.path = Some(exe.display().to_string());
    c.version = run(&exe, &["-hide_banner", "-version"], path_env, Duration::from_secs(15)).ok().map(|v| first_line(&v));
    let encoders = run(&exe, &["-hide_banner", "-encoders"], path_env, Duration::from_secs(15)).unwrap_or_default();
    let has = |name: &str| encoders.lines().any(|l| l.split_whitespace().nth(1) == Some(name));
    let (x264, vp9) = (has("libx264"), has("libvpx-vp9"));
    c.detail = Some(format!("libx264={x264} libvpx-vp9={vp9}"));
    // Probe the exact option HyperFrames passes; the 2013 build in S1 rejected it.
    let colorspace_ok = run(&exe, &["-hide_banner", "-f", "lavfi", "-i", "color=c=black:s=16x16:d=0.1", "-colorspace", "bt709", "-f", "null", "-"], path_env, Duration::from_secs(20)).is_ok();
    if x264 && colorspace_ok {
        c.status = "ok";
    } else {
        c.status = if colorspace_ok { "unsupported" } else { "outdated" };
        c.fix = Some("앱이 관리하는 FFmpeg(GPL, libx264 포함)를 다운로드".into());
    }
    c
}

fn check_webview2() -> Check {
    use winreg::RegKey;
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
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
    c.fix = Some("Microsoft Edge WebView2 Runtime 설치(인스톨러가 부트스트래퍼 포함)".into());
    c
}

fn check_render_browser() -> Check {
    let mut c = Check::new("render-browser", false);
    let home = std::env::var("USERPROFILE").unwrap_or_default();
    let shell_root = Path::new(&home).join(".cache/puppeteer/chrome-headless-shell");
    // Several builds may be cached; pick the newest, which is what HyperFrames launches.
    let version_key = |name: &str| -> Vec<u32> { name.trim_start_matches("win64-").split('.').filter_map(|x| x.parse().ok()).collect() };
    let newest = std::fs::read_dir(&shell_root).ok().and_then(|entries| {
        entries
            .flatten()
            .filter(|e| e.path().join("chrome-headless-shell-win64/chrome-headless-shell.exe").is_file())
            .max_by_key(|e| version_key(&e.file_name().to_string_lossy()))
    });
    if let Some(e) = newest {
        c.status = "ok";
        c.version = Some(e.file_name().to_string_lossy().into_owned());
        c.path = Some(e.path().join("chrome-headless-shell-win64/chrome-headless-shell.exe").display().to_string());
        return c;
    }
    for p in [r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"] {
        if Path::new(p).is_file() {
            c.status = "info";
            c.path = Some(p.into());
            c.detail = Some("시스템 브라우저만 있음: 렌더는 HyperFrames 관리 브라우저 권장".into());
        }
    }
    c.fix = Some("`hyperframes browser`로 렌더용 Chrome 설치(앱이 대신 실행)".into());
    c
}

fn check_claude_login(path_env: &str, claude: &Check) -> Check {
    let mut c = Check::new("claude-login", false);
    let Some(p) = claude.path.as_deref() else {
        c.status = "info";
        c.detail = Some("Claude Code 미설치".into());
        return c;
    };
    match run(Path::new(p), &["auth", "status"], path_env, Duration::from_secs(20)) {
        // Only the boolean is kept; the command also prints account details we do not store.
        Ok(out) => match serde_json::from_str::<serde_json::Value>(&out).ok().and_then(|v| v.get("loggedIn")?.as_bool()) {
            Some(true) => c.status = "ok",
            Some(false) => {
                c.status = "not-logged-in";
                c.fix = Some("터미널에서 `claude auth login`".into());
            }
            None => {
                c.status = "info";
                c.detail = Some("로그인 상태를 해석하지 못함".into());
            }
        },
        Err(e) => {
            c.status = "info";
            c.detail = Some(e);
        }
    }
    c
}

fn check(path_env: &str, ffmpeg_dir: Option<&Path>) -> Vec<Check> {
    let started = Instant::now();
    let mut node = tool("node", "node", true, path_env, "Node.js 22 LTS 설치: `winget install OpenJS.NodeJS.LTS`");
    if let Some(v) = node.version.as_deref() {
        if major(v).is_some_and(|m| m < 22) {
            node.status = "outdated";
            node.fix = Some("Node.js 22 이상 필요: `winget install OpenJS.NodeJS.LTS`".into());
        }
    }
    let mut pnpm = tool("pnpm", "pnpm", true, path_env, "`corepack enable pnpm` (Node 포함 corepack)");
    if pnpm.status == "missing" && resolve("corepack", path_env).is_none() {
        pnpm.fix = Some("Node.js 설치 후 `corepack enable pnpm`".into());
    }
    let git = tool("git", "git", false, path_env, "`winget install Git.Git` (없으면 폴더 스냅샷으로 체크포인트)");
    let claude = tool("claude-code", "claude", false, path_env, "Claude Code 설치: https://docs.claude.com/claude-code");
    let login = check_claude_login(path_env, &claude);
    let mut checks = vec![
        node, pnpm, git, claude, login,
        tool("codex", "codex", false, path_env, "Codex CLI 설치: `npm i -g @openai/codex`"),
        tool("opencode", "opencode", false, path_env, "OpenCode 설치(실험적)"),
        tool("hermes", "hermes", false, path_env, "Hermes Agent 설치(실험적)"),
        tool("agy", "agy", false, path_env, "Antigravity CLI 설치(실험적, 터미널 모드)"),
        check_ffmpeg(path_env, ffmpeg_dir),
        check_render_browser(),
        check_webview2(),
        tool("winget", "winget", false, path_env, "설치 안내는 수동 링크로 대체"),
    ];
    // At least one agent CLI is required (D-005).
    let any_agent = checks.iter().any(|c| ["claude-code", "codex", "opencode", "hermes", "agy"].contains(&c.id) && c.status == "ok");
    let mut summary = Check::new("summary", true);
    summary.status = if any_agent { "ok" } else { "missing" };
    summary.detail = Some(format!("agents ok: {any_agent}; took {} ms", started.elapsed().as_millis()));
    checks.push(summary);
    checks
}

/// PATH as a freshly started process would see it. The app's own PATH is frozen at launch, so a
/// Node/Git install done while the app is open stays invisible unless we re-read the registry.
fn fresh_path() -> String {
    use winreg::RegKey;
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    let read = |hive, sub: &str| RegKey::predef(hive).open_subkey(sub).and_then(|k| k.get_value::<String, _>("Path")).unwrap_or_default();
    let system = read(HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment");
    let user = read(HKEY_CURRENT_USER, "Environment");
    // Values are REG_EXPAND_SZ: expand %VAR% references against the current environment.
    let expand = |s: &str| {
        let mut out = String::new();
        let mut parts = s.split('%');
        out.push_str(parts.next().unwrap_or_default());
        let mut inside = true;
        for p in parts {
            if inside {
                match std::env::var(p) {
                    Ok(v) if !p.is_empty() => out.push_str(&v),
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
    };
    format!("{};{}", expand(&system), expand(&user))
}

fn progress(v: serde_json::Value) {
    println!("{v}");
    let _ = std::io::stdout().flush();
}

fn download_ffmpeg(dest: &Path) -> Result<serde_json::Value, String> {
    let started = Instant::now();
    let client = reqwest::blocking::Client::builder()
        .user_agent("vanilla-studio-doctor-spike")
        .timeout(Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;
    let release: serde_json::Value = client
        .get("https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest")
        .send()
        .and_then(|r| r.error_for_status())
        .and_then(|r| r.json())
        .map_err(|e| format!("release lookup: {e}"))?;
    let assets = release["assets"].as_array().ok_or("no assets")?;
    // Highest numbered release branch, win64 GPL (libx264 is GPL; LGPL builds cannot make MP4 via HyperFrames).
    let pick = assets
        .iter()
        .filter_map(|a| {
            let name = a["name"].as_str()?;
            let rest = name.strip_prefix("ffmpeg-n")?.strip_suffix(".zip")?;
            if !rest.contains("-latest-win64-gpl-") || rest.contains("shared") {
                return None;
            }
            let ver: Vec<u32> = rest.split('-').next()?.split('.').filter_map(|x| x.parse().ok()).collect();
            Some((ver, name.to_string(), a["browser_download_url"].as_str()?.to_string(), a["size"].as_u64().unwrap_or(0)))
        })
        .max_by(|a, b| a.0.cmp(&b.0))
        .ok_or("no win64 gpl asset")?;
    let (_, name, url, size) = pick;
    progress(serde_json::json!({ "stage": "selected", "asset": name, "bytes": size }));

    let sums_url = assets.iter().find(|a| a["name"] == "checksums.sha256").and_then(|a| a["browser_download_url"].as_str()).ok_or("no checksums.sha256")?;
    let sums = client.get(sums_url).send().and_then(|r| r.text()).map_err(|e| e.to_string())?;
    let expected = sums.lines().find(|l| l.ends_with(&name)).and_then(|l| l.split_whitespace().next()).ok_or("checksum missing for asset")?.to_lowercase();

    std::fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    let zip_path = dest.join(&name);
    let mut resp = client.get(&url).send().and_then(|r| r.error_for_status()).map_err(|e| e.to_string())?;
    let mut file = std::fs::File::create(&zip_path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    let (mut done, mut last) = (0u64, Instant::now());
    loop {
        let n = resp.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        done += n as u64;
        if last.elapsed() > Duration::from_millis(500) {
            progress(serde_json::json!({ "stage": "download", "done": done, "total": size }));
            last = Instant::now();
        }
    }
    drop(file);
    let actual = hex::encode(hasher.finalize());
    if actual != expected {
        let _ = std::fs::remove_file(&zip_path);
        return Err(format!("sha256 mismatch: expected {expected}, got {actual}"));
    }
    progress(serde_json::json!({ "stage": "verified", "sha256": actual }));

    // Extract only bin/*.exe (ffmpeg, ffprobe) flat into dest; keep the license text for attribution.
    let mut archive = zip::ZipArchive::new(std::fs::File::open(&zip_path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let mut extracted = vec![];
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let Some(rel) = entry.enclosed_name() else { continue };
        let fname = rel.file_name().map(|f| f.to_string_lossy().into_owned()).unwrap_or_default();
        let wanted = (rel.to_string_lossy().contains("bin") && (fname == "ffmpeg.exe" || fname == "ffprobe.exe")) || fname == "LICENSE.txt";
        if !wanted {
            continue;
        }
        let mut out = std::fs::File::create(dest.join(&fname)).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
        extracted.push(fname);
    }
    let _ = std::fs::remove_file(&zip_path);
    progress(serde_json::json!({ "stage": "extracted", "files": extracted }));
    let verify = check_ffmpeg("", Some(dest));
    Ok(serde_json::json!({ "asset": name, "bytes": size, "seconds": started.elapsed().as_secs_f32(), "verify": verify }))
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let opt = |flag: &str| args.iter().position(|a| a == flag).and_then(|i| args.get(i + 1)).cloned();
    match args.get(1).map(String::as_str) {
        Some("download-ffmpeg") => {
            let dest = PathBuf::from(args.get(2).cloned().unwrap_or_else(|| "tools/ffmpeg".into()));
            match download_ffmpeg(&dest) {
                Ok(v) => println!("{}", serde_json::json!({ "result": v })),
                Err(e) => {
                    println!("{}", serde_json::json!({ "error": e }));
                    std::process::exit(1);
                }
            }
        }
        _ => {
            let path_env = match opt("--path").as_deref() {
                Some("fresh") => fresh_path(),
                Some(p) => p.to_string(),
                None => std::env::var("PATH").unwrap_or_default(),
            };
            let ffmpeg_dir = opt("--ffmpeg-dir").map(PathBuf::from);
            let report = check(&path_env, ffmpeg_dir.as_deref());
            println!("{}", serde_json::to_string_pretty(&report).unwrap());
        }
    }
}

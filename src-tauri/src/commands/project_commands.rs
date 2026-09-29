use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

/// Directories every new project gets, even when empty (Product-Spec §6).
const PROJECT_DIRS: &[&str] = &[
    "brief/materials",
    "plan",
    "prompts",
    "src/scenes",
    "src/assets",
    "src/shared",
    "public",
    "assets",
    "params",
    "reviews",
];

const CREDITS_MD: &str = "# Credits\n\nRecord every external resource (fonts, textures, icons) with its source URL and license.\n";

const SKIP_DIRS: &[&str] = &["node_modules", ".git", "dist"];

#[derive(Debug, Serialize)]
pub struct ScaffoldResult {
    pub path: String,
    pub files: Vec<String>,
}

/// A project folder name is a single, plain path component.
fn validate_folder_name(name: &str) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed != name {
        return Err("Folder name is empty or has surrounding whitespace".into());
    }
    if name.len() > 100 || name.ends_with('.') {
        return Err(format!("Invalid folder name: {name}"));
    }
    if name
        .chars()
        .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
    {
        return Err(format!("Folder name contains invalid characters: {name}"));
    }
    let mut comps = Path::new(name).components();
    match (comps.next(), comps.next()) {
        (Some(Component::Normal(_)), None) => {}
        _ => return Err(format!("Folder name must be a single path component: {name}")),
    }
    let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
    const RESERVED: &[&str] = &[
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    if RESERVED.contains(&stem.as_str()) {
        return Err(format!("Reserved folder name: {name}"));
    }
    Ok(())
}

fn package_slug(name: &str) -> String {
    let mut slug = String::new();
    for c in name.chars().flat_map(|c| c.to_lowercase()) {
        if c.is_ascii_alphanumeric() {
            slug.push(c);
        } else if !slug.ends_with('-') && !slug.is_empty() {
            slug.push('-');
        }
    }
    let slug = slug.trim_end_matches('-').to_string();
    if slug.is_empty() {
        "vanilla-project".into()
    } else {
        slug
    }
}

fn substitute(text: &str, vars: &[(&str, &str)]) -> String {
    let mut out = text.to_string();
    for (k, v) in vars {
        out = out.replace(&format!("{{{{{k}}}}}"), v);
    }
    out
}

fn set_package_name(text: &str, slug: &str) -> Result<String, String> {
    let mut v: serde_json::Value =
        serde_json::from_str(text).map_err(|e| format!("template package.json: {e}"))?;
    v["name"] = serde_json::Value::String(slug.to_string());
    let mut s = serde_json::to_string_pretty(&v).map_err(|e| e.to_string())?;
    s.push('\n');
    Ok(s)
}

fn copy_template(
    src: &Path,
    dst: &Path,
    rel: &Path,
    vars: &[(&str, &str)],
    slug: &str,
    files: &mut Vec<String>,
) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("mkdir {}: {e}", dst.display()))?;
    for entry in fs::read_dir(src).map_err(|e| format!("read {}: {e}", src.display()))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name();
        let name_s = name.to_string_lossy().to_string();
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        if ft.is_symlink() {
            return Err(format!("Template contains a symlink: {}", entry.path().display()));
        }
        let rel_child = rel.join(&name);
        if ft.is_dir() {
            if SKIP_DIRS.contains(&name_s.as_str()) {
                continue;
            }
            copy_template(&entry.path(), &dst.join(&name), &rel_child, vars, slug, files)?;
        } else {
            let bytes = fs::read(entry.path()).map_err(|e| e.to_string())?;
            let out = match String::from_utf8(bytes) {
                Ok(text) => {
                    let mut text = substitute(&text, vars);
                    if rel_child == Path::new("package.json") {
                        text = set_package_name(&text, slug)?;
                    }
                    text.into_bytes()
                }
                Err(e) => e.into_bytes(),
            };
            fs::write(dst.join(&name), out).map_err(|e| format!("write {name_s}: {e}"))?;
            files.push(rel_child.to_string_lossy().replace('\\', "/"));
        }
    }
    Ok(())
}

/// Byte-for-byte copy (no placeholder substitution, no package.json rename) of the runtime package.
fn copy_dir_plain(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("mkdir {}: {e}", dst.display()))?;
    for entry in fs::read_dir(src).map_err(|e| format!("read {}: {e}", src.display()))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        if ft.is_symlink() {
            return Err(format!("Runtime contains a symlink: {}", entry.path().display()));
        }
        let name = entry.file_name();
        if ft.is_dir() {
            if SKIP_DIRS.contains(&name.to_string_lossy().as_ref()) {
                continue;
            }
            copy_dir_plain(&entry.path(), &dst.join(&name))?;
        } else {
            fs::copy(entry.path(), dst.join(&name))
                .map_err(|e| format!("copy {}: {e}", name.to_string_lossy()))?;
        }
    }
    Ok(())
}

/// The project's package.json links `@vanilla/runtime` to `./vanilla/runtime`, so scaffolding must
/// place the runtime there or `pnpm install` fails.
pub fn install_runtime(runtime_dir: &Path, project_dir: &Path) -> Result<(), String> {
    if !runtime_dir.is_dir() {
        return Err(format!("Runtime not found: {}", runtime_dir.display()));
    }
    copy_dir_plain(runtime_dir, &project_dir.join("vanilla").join("runtime"))
}

/// Copy `template_dir` into `<parent_dir>/<folder_name>`.
/// The new folder must not exist (or be an empty directory) and must stay inside `parent_dir`
/// after symlinks are resolved. `manifest_json` (validated by the frontend) replaces vanilla.json.
pub fn scaffold_from_template(
    template_dir: &Path,
    parent_dir: &Path,
    folder_name: &str,
    project_name: &str,
    manifest_json: &str,
    created_at: &str,
) -> Result<ScaffoldResult, String> {
    validate_folder_name(folder_name)?;
    let manifest: serde_json::Value =
        serde_json::from_str(manifest_json).map_err(|e| format!("Invalid manifest JSON: {e}"))?;
    if !manifest.is_object() {
        return Err("Manifest must be a JSON object".into());
    }
    if !template_dir.is_dir() {
        return Err(format!("Template not found: {}", template_dir.display()));
    }
    if !parent_dir.is_absolute() {
        return Err("Parent folder must be an absolute path".into());
    }
    let parent = parent_dir
        .canonicalize()
        .map_err(|e| format!("Parent folder error '{}': {e}", parent_dir.display()))?;
    if !parent.is_dir() {
        return Err(format!("Not a directory: {}", parent.display()));
    }

    let target = parent.join(folder_name);
    let mut created = false;
    match fs::symlink_metadata(&target) {
        Ok(meta) => {
            if meta.file_type().is_symlink() {
                return Err(format!("Target is a symlink: {}", target.display()));
            }
            if !meta.is_dir() {
                return Err(format!("Target exists and is not a folder: {}", target.display()));
            }
            let empty = fs::read_dir(&target)
                .map_err(|e| e.to_string())?
                .next()
                .is_none();
            if !empty {
                return Err(format!("Target folder is not empty: {}", target.display()));
            }
        }
        Err(_) => {
            fs::create_dir(&target).map_err(|e| format!("mkdir {}: {e}", target.display()))?;
            created = true;
        }
    }

    let run = || -> Result<ScaffoldResult, String> {
        let canonical = target.canonicalize().map_err(|e| e.to_string())?;
        if !canonical.starts_with(&parent) || canonical == parent {
            return Err(format!(
                "Access denied: '{}' is outside '{}'",
                canonical.display(),
                parent.display()
            ));
        }
        let vars = [("projectName", project_name), ("createdAt", created_at)];
        let mut files = Vec::new();
        copy_template(
            template_dir,
            &canonical,
            Path::new(""),
            &vars,
            &package_slug(project_name),
            &mut files,
        )?;
        for d in PROJECT_DIRS {
            fs::create_dir_all(canonical.join(d)).map_err(|e| e.to_string())?;
        }
        fs::write(canonical.join("assets").join("CREDITS.md"), CREDITS_MD)
            .map_err(|e| e.to_string())?;
        files.push("assets/CREDITS.md".into());
        let mut pretty = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
        pretty.push('\n');
        fs::write(canonical.join("vanilla.json"), pretty).map_err(|e| e.to_string())?;
        if !files.iter().any(|f| f == "vanilla.json") {
            files.push("vanilla.json".into());
        }
        files.sort();
        Ok(ScaffoldResult {
            path: display_path(&canonical),
            files,
        })
    };

    match run() {
        Ok(r) => Ok(r),
        Err(e) => {
            if created {
                let _ = fs::remove_dir_all(&target);
            }
            Err(e)
        }
    }
}

fn resolve_resource_dir<R: Runtime>(app: &AppHandle<R>, name: &str) -> Result<PathBuf, String> {
    if let Ok(res) = app.path().resource_dir() {
        let p = res.join("resources").join(name);
        if p.is_dir() {
            return Ok(p);
        }
    }
    // dev fallback: repo checkout
    let dev = Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("resources").join(name);
    if dev.is_dir() {
        return dev.canonicalize().map_err(|e| e.to_string());
    }
    Err(format!("Resources not found: {name}"))
}

/// `canonicalize` yields `\\?\C:\...` on Windows; the frontend uses this path as the workspace
/// root (DB path, recent list, scope checks), so hand it back in the plain form.
fn display_path(p: &Path) -> String {
    let s = p.to_string_lossy();
    match s.strip_prefix(r"\\?\") {
        Some(rest) if !rest.starts_with(r"UNC\") => rest.to_string(),
        _ => s.to_string(),
    }
}

/// Canonical directory to open in the asset protocol scope, or None when `path` is not a directory.
pub fn asset_scope_dir(path: &str) -> Option<PathBuf> {
    Path::new(path).canonicalize().ok().filter(|p| p.is_dir())
}

/// Allow the asset protocol (ImageViewerTab) to read the active project folder (Technical-Design §10).
/// tauri offers no way to revoke an allowed directory (`forbid_directory` is permanent and would block
/// reopening the project), so folders opened earlier in this session stay readable until restart.
pub fn allow_project_assets<R: Runtime>(app: &AppHandle<R>, path: &str) -> Result<(), String> {
    let dir = asset_scope_dir(path).ok_or_else(|| format!("Not a directory: {path}"))?;
    app.asset_protocol_scope()
        .allow_directory(dir, true)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scaffold_project<R: Runtime>(
    app: AppHandle<R>,
    parent_dir: String,
    folder_name: String,
    project_name: String,
    manifest_json: String,
) -> Result<ScaffoldResult, String> {
    let template = resolve_resource_dir(&app, "project-template")?;
    let runtime = resolve_resource_dir(&app, "runtime")?;
    let created_at = serde_json::from_str::<serde_json::Value>(&manifest_json)
        .ok()
        .and_then(|v| v.get("createdAt").and_then(|c| c.as_str().map(String::from)))
        .unwrap_or_default();
    let mut result = scaffold_from_template(
        &template,
        Path::new(&parent_dir),
        &folder_name,
        &project_name,
        &manifest_json,
        &created_at,
    )?;
    if let Err(e) = install_runtime(&runtime, Path::new(&result.path)) {
        let _ = fs::remove_dir_all(&result.path);
        return Err(e);
    }
    result.files.push("vanilla/runtime/".into());
    Ok(result)
}

// ---------------------------------------------------------------------------
// Checkpoints (T3.10, D-013): git auto-commit + history, folder snapshot fallback.
// ---------------------------------------------------------------------------

use crate::process::{self, run_capture, RunOptions};

/// Snapshot payload: folders git would ignore or the app owns are skipped,
/// so a snapshot holds the user's project content, not caches or history.
const SNAPSHOT_SKIP_DIRS: &[&str] = &[
    ".git",
    ".vanilla",
    "node_modules",
    "dist",
    "target",
    "exports",
];

/// Checkpoint message limit: one short line the history list can show.
const MAX_MESSAGE_LEN: usize = 200;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointStatus {
    pub backend: String,
    pub git_available: bool,
    pub is_repo: bool,
    pub head: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointCommit {
    pub id: String,
    pub backend: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointEntry {
    pub id: String,
    pub message: String,
    pub at: String,
}

/// Canonical project dir, workspace-scoped like every other Tauri file command
/// (AGENTS.md §7). Fails for missing folders and paths outside the workspace.
fn verified_project_dir(project_path: &str) -> Result<PathBuf, String> {
    let dir = super::fs_commands::resolve_and_verify_workspace_path(project_path, None, true)?;
    if !dir.is_dir() {
        return Err(format!("Not a directory: {project_path}"));
    }
    Ok(dir)
}

/// `git` the way cmd.exe would find it, with a fresh registry PATH first
/// (Technical-Design §2.4). `None` means the snapshot backend is used.
fn checkpoint_git() -> Option<PathBuf> {
    let fresh = process::fresh_path();
    if !fresh.trim().is_empty() {
        if let Some(p) = process::resolve_command("git", &fresh) {
            return Some(p);
        }
    }
    let env_path = std::env::var("PATH").unwrap_or_default();
    if env_path.trim().is_empty() {
        return None;
    }
    process::resolve_command("git", &env_path)
}

fn run_git(dir: &Path, git: &Path, args: &[&str]) -> Result<String, String> {
    let opts = RunOptions {
        cwd: Some(dir.to_path_buf()),
        ..RunOptions::new(std::time::Duration::from_secs(30))
    };
    let cap = run_capture(git, args, &opts).map_err(|e| e.to_string())?;
    if cap.exit_code != Some(0) {
        let detail = if cap.stderr.trim().is_empty() {
            format!("git {} failed with exit {:?}", args.join(" "), cap.exit_code)
        } else {
            cap.stderr.trim().to_string()
        };
        return Err(detail);
    }
    Ok(cap.stdout)
}

fn is_repo(dir: &Path) -> bool {
    // A worktree checkout keeps a `.git` file instead of a directory.
    dir.join(".git").is_dir() || dir.join(".git").is_file()
}

fn head_commit(dir: &Path, git: &Path) -> Result<Option<String>, String> {
    let opts = RunOptions {
        cwd: Some(dir.to_path_buf()),
        ..RunOptions::new(std::time::Duration::from_secs(30))
    };
    let cap = run_capture(git, &["rev-parse", "HEAD"], &opts).map_err(|e| e.to_string())?;
    if cap.exit_code != Some(0) {
        return Ok(None);
    }
    let head = cap.stdout.trim().to_string();
    Ok(if head.is_empty() { None } else { Some(head) })
}

/// Auto commits need an identity; only a missing local value is filled in so
/// a user's global config always wins.
fn ensure_git_identity(dir: &Path, git: &Path) -> Result<(), String> {
    for (key, value) in [
        ("user.name", "Vanilla Studio"),
        ("user.email", "vanilla-studio@local"),
    ] {
        let current = run_git(dir, git, &["config", key]).unwrap_or_default();
        if current.trim().is_empty() {
            run_git(dir, git, &["config", key, value])?;
        }
    }
    Ok(())
}

/// `.vanilla/` holds the app DB, logs and snapshots: never committed.
/// The scaffold template already ignores it; older folders are repaired here.
fn ensure_vanilla_ignored(dir: &Path) -> Result<(), String> {
    let ignore = dir.join(".gitignore");
    match fs::read_to_string(&ignore) {
        Ok(text) => {
            if text.lines().any(|l| l.trim() == ".vanilla/") {
                return Ok(());
            }
            let mut out = text;
            if !out.ends_with('\n') {
                out.push('\n');
            }
            out.push_str(".vanilla/\n");
            fs::write(&ignore, out).map_err(|e| e.to_string())
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            fs::write(&ignore, ".vanilla/\n").map_err(|e| e.to_string())
        }
        Err(e) => Err(e.to_string()),
    }
}

fn ensure_repo(dir: &Path, git: &Path) -> Result<(), String> {
    if !is_repo(dir) {
        run_git(dir, git, &["init"])?;
    }
    ensure_git_identity(dir, git)?;
    ensure_vanilla_ignored(dir)?;
    Ok(())
}

fn snapshots_dir(dir: &Path) -> PathBuf {
    dir.join(".vanilla").join("snapshots")
}

fn checkpoint_status_inner(dir: &Path, git: Option<&Path>) -> Result<CheckpointStatus, String> {
    match git {
        Some(g) if is_repo(dir) => Ok(CheckpointStatus {
            backend: "git".into(),
            git_available: true,
            is_repo: true,
            head: head_commit(dir, g)?,
        }),
        Some(_) => Ok(CheckpointStatus {
            backend: "git".into(),
            git_available: true,
            is_repo: false,
            head: None,
        }),
        None => Ok(CheckpointStatus {
            backend: "snapshot".into(),
            git_available: false,
            is_repo: false,
            head: latest_snapshot_id(dir),
        }),
    }
}

/// Seconds since the Unix epoch, zero-padded so snapshot ids sort by time.
fn snapshot_millis() -> String {
    let ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{ms:013}")
}

/// Minimal UTC date formatter (`YYYY-MM-DDTHH:MM:SSZ`) so snapshot history
/// needs no extra date crate.
fn format_iso(secs: u64) -> String {
    let days = (secs / 86_400) as i64;
    let time = secs % 86_400;
    // Howard Hinnant's civil-from-days algorithm.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u64;
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u64;
    let year = (if m <= 2 { y + 1 } else { y }) as u64;
    format!(
        "{year:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        m,
        d,
        time / 3_600,
        (time % 3_600) / 60,
        time % 60
    )
}

fn utc_now_iso() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format_iso(secs)
}

fn copy_snapshot_tree(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if SNAPSHOT_SKIP_DIRS.contains(&name.as_str()) {
            continue;
        }
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        // Symlinks are skipped: following them could escape the project.
        if ft.is_symlink() {
            continue;
        }
        if ft.is_dir() {
            copy_snapshot_tree(&entry.path(), &dst.join(&name))?;
        } else if ft.is_file() {
            fs::copy(entry.path(), dst.join(&name)).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn unique_snapshot_dir(base: &Path) -> Result<PathBuf, String> {
    for attempt in 0..100 {
        let id = if attempt == 0 {
            snapshot_millis()
        } else {
            format!("{}-{attempt}", snapshot_millis())
        };
        let dir = base.join(&id);
        if fs::symlink_metadata(&dir).is_err() {
            return Ok(dir);
        }
    }
    Err("Could not pick a snapshot name".into())
}

fn write_snapshot_meta(dir: &Path, id: &str, message: &str) -> Result<(), String> {
    let mut meta = serde_json::Map::new();
    meta.insert("id".into(), serde_json::Value::String(id.into()));
    meta.insert("message".into(), serde_json::Value::String(message.into()));
    meta.insert("at".into(), serde_json::Value::String(utc_now_iso()));
    let mut text = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    text.push('\n');
    fs::write(dir.join("checkpoint.json"), text).map_err(|e| e.to_string())
}

fn snapshot_commit(dir: &Path, message: &str) -> Result<CheckpointCommit, String> {
    let base = snapshots_dir(dir);
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let dst = unique_snapshot_dir(&base)?;
    copy_snapshot_tree(dir, &dst)?;
    let id = dst
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .ok_or_else(|| "Snapshot name error".to_string())?;
    write_snapshot_meta(&dst, &id, message)?;
    Ok(CheckpointCommit { id, backend: "snapshot".into() })
}

fn latest_snapshot_id(dir: &Path) -> Option<String> {
    let mut ids: Vec<String> = fs::read_dir(snapshots_dir(dir))
        .ok()?
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    ids.sort();
    ids.pop()
}

fn snapshot_history(dir: &Path, limit: usize) -> Result<Vec<CheckpointEntry>, String> {
    let mut entries = Vec::new();
    let Ok(listing) = fs::read_dir(snapshots_dir(dir)) else {
        return Ok(entries);
    };
    for entry in listing {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let id = entry.file_name().to_string_lossy().into_owned();
        let (message, at) = match fs::read_to_string(entry.path().join("checkpoint.json")) {
            Ok(text) => {
                let v: serde_json::Value =
                    serde_json::from_str(&text).map_err(|e| e.to_string())?;
                (
                    v.get("message").and_then(|m| m.as_str()).unwrap_or("").to_string(),
                    v.get("at").and_then(|m| m.as_str()).unwrap_or("").to_string(),
                )
            }
            Err(_) => (String::new(), String::new()),
        };
        entries.push(CheckpointEntry { id, message, at });
    }
    entries.sort_by(|a, b| b.id.cmp(&a.id));
    entries.truncate(limit);
    Ok(entries)
}

fn git_history(dir: &Path, git: &Path, limit: usize) -> Result<Vec<CheckpointEntry>, String> {
    let out = run_git(
        dir,
        git,
        &[
            "log",
            &format!("-n{limit}"),
            "--format=%H%x1f%s%x1f%cI%x1e",
        ],
    )?;
    let mut entries = Vec::new();
    for record in out.split('\x1e') {
        let record = record.trim().trim_start_matches('\n');
        if record.is_empty() {
            continue;
        }
        let mut parts = record.splitn(3, '\x1f');
        let (Some(id), Some(message), Some(at)) = (parts.next(), parts.next(), parts.next()) else {
            continue;
        };
        entries.push(CheckpointEntry {
            id: id.trim().to_string(),
            message: message.to_string(),
            at: at.trim().to_string(),
        });
    }
    Ok(entries)
}

fn check_message(message: &str) -> Result<String, String> {
    let msg = message.trim().to_string();
    if msg.is_empty() {
        return Err("Checkpoint message is empty".into());
    }
    if msg.len() > MAX_MESSAGE_LEN {
        return Err(format!("Checkpoint message is too long (max {MAX_MESSAGE_LEN} chars)"));
    }
    Ok(msg)
}

/// Stage everything and commit. With no changes the approval still gets the
/// current HEAD back instead of piling up empty commits.
fn git_commit(dir: &Path, git: &Path, msg: &str) -> Result<CheckpointCommit, String> {
    run_git(dir, git, &["add", "-A"])?;
    if run_git(dir, git, &["status", "--porcelain"])?.trim().is_empty() {
        if let Some(head) = head_commit(dir, git)? {
            return Ok(CheckpointCommit { id: head, backend: "git".into() });
        }
        run_git(dir, git, &["commit", "--allow-empty", "-m", msg])?;
    } else {
        run_git(dir, git, &["commit", "-m", msg])?;
    }
    let head = head_commit(dir, git)?.ok_or_else(|| "Commit created no HEAD".to_string())?;
    Ok(CheckpointCommit { id: head, backend: "git".into() })
}

#[tauri::command]
pub fn checkpoint_status(project_path: String) -> Result<CheckpointStatus, String> {
    let dir = verified_project_dir(&project_path)?;
    let git = checkpoint_git();
    checkpoint_status_inner(&dir, git.as_deref())
}

#[tauri::command]
pub fn checkpoint_init(project_path: String) -> Result<CheckpointStatus, String> {
    let dir = verified_project_dir(&project_path)?;
    match checkpoint_git() {
        Some(git) => {
            ensure_repo(&dir, &git)?;
            if head_commit(&dir, &git)?.is_none() {
                run_git(&dir, &git, &["add", "-A"])?;
                let status = run_git(&dir, &git, &["status", "--porcelain"])?;
                if status.trim().is_empty() {
                    run_git(&dir, &git, &["commit", "--allow-empty", "-m", "chore: initial checkpoint"])?;
                } else {
                    run_git(&dir, &git, &["commit", "-m", "chore: initial checkpoint"])?;
                }
            }
            checkpoint_status_inner(&dir, Some(&git))
        }
        None => {
            fs::create_dir_all(snapshots_dir(&dir)).map_err(|e| e.to_string())?;
            Ok(CheckpointStatus {
                backend: "snapshot".into(),
                git_available: false,
                is_repo: false,
                head: latest_snapshot_id(&dir),
            })
        }
    }
}

#[tauri::command]
pub fn checkpoint_commit(project_path: String, message: String) -> Result<CheckpointCommit, String> {
    let msg = check_message(&message)?;
    let dir = verified_project_dir(&project_path)?;
    match checkpoint_git() {
        Some(git) => {
            ensure_repo(&dir, &git)?;
            git_commit(&dir, &git, &msg)
        }
        None => snapshot_commit(&dir, &msg),
    }
}

#[tauri::command]
pub fn checkpoint_history(project_path: String, limit: Option<u16>) -> Result<Vec<CheckpointEntry>, String> {
    let dir = verified_project_dir(&project_path)?;
    let limit = limit.unwrap_or(20).clamp(1, 100) as usize;
    match checkpoint_git() {
        Some(git) if is_repo(&dir) => git_history(&dir, &git, limit),
        Some(_) => Ok(Vec::new()),
        None => snapshot_history(&dir, limit),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_path_strips_verbatim_prefix_only_for_drive_paths() {
        assert_eq!(display_path(Path::new(r"\\?\C:\a\b")), r"C:\a\b");
        assert_eq!(display_path(Path::new(r"\\?\UNC\srv\share")), r"\\?\UNC\srv\share");
        assert_eq!(display_path(Path::new(r"C:\a")), r"C:\a");
    }

    fn template() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../resources/project-template")
    }

    fn manifest(name: &str) -> String {
        format!(r#"{{"version":1,"name":"{name}","createdAt":"2026-01-01T00:00:00.000Z"}}"#)
    }

    #[test]
    fn install_runtime_copies_package_verbatim_without_rename() {
        let runtime = Path::new(env!("CARGO_MANIFEST_DIR")).join("../resources/runtime");
        let tmp = tempfile::tempdir().unwrap();
        install_runtime(&runtime, tmp.path()).unwrap();
        let pkg = fs::read_to_string(tmp.path().join("vanilla/runtime/package.json")).unwrap();
        assert!(pkg.contains("\"@vanilla/runtime\""), "package name must stay @vanilla/runtime");
        assert!(tmp.path().join("vanilla/runtime/vite.js").is_file());
        assert!(!tmp.path().join("vanilla/runtime/node_modules").exists());
    }

    #[test]
    fn install_runtime_rejects_missing_source() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(install_runtime(&tmp.path().join("nope"), tmp.path()).is_err());
    }

    #[test]
    fn scaffolds_expected_tree() {
        let tmp = tempfile::tempdir().unwrap();
        let r = scaffold_from_template(
            &template(),
            tmp.path(),
            "demo",
            "My Demo",
            &manifest("My Demo"),
            "2026-01-01T00:00:00.000Z",
        )
        .unwrap();
        let root = PathBuf::from(&r.path);
        for f in [
            "vanilla.json",
            "AGENTS.md",
            "CLAUDE.md",
            "DESIGN.md",
            "package.json",
            "index.html",
            "src/main.tsx",
            ".gitignore",
            "assets/CREDITS.md",
        ] {
            assert!(root.join(f).is_file(), "{f}");
        }
        for d in PROJECT_DIRS {
            assert!(root.join(d).is_dir(), "{d}");
        }
        let agents = fs::read_to_string(root.join("AGENTS.md")).unwrap();
        assert!(agents.contains("# AGENTS.md — My Demo"));
        assert!(!agents.contains("{{"));
        let pkg: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(root.join("package.json")).unwrap()).unwrap();
        assert_eq!(pkg["name"], "my-demo");
        let m: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(root.join("vanilla.json")).unwrap()).unwrap();
        assert_eq!(m["name"], "My Demo");
        assert!(r.files.contains(&"vanilla.json".to_string()));
    }

    #[test]
    fn rejects_bad_folder_names() {
        let tmp = tempfile::tempdir().unwrap();
        for bad in ["..", ".", "", "a/b", "a\\b", "../x", "CON", "a:b", " x", "x."] {
            let r = scaffold_from_template(&template(), tmp.path(), bad, "n", &manifest("n"), "");
            assert!(r.is_err(), "{bad:?} should be rejected");
        }
        assert_eq!(fs::read_dir(tmp.path()).unwrap().count(), 0);
    }

    #[test]
    fn rejects_non_empty_target_and_keeps_it() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir(tmp.path().join("p")).unwrap();
        fs::write(tmp.path().join("p/keep.txt"), "x").unwrap();
        assert!(
            scaffold_from_template(&template(), tmp.path(), "p", "n", &manifest("n"), "").is_err()
        );
        assert!(tmp.path().join("p/keep.txt").is_file());
        assert!(!tmp.path().join("p/vanilla.json").exists());
    }

    #[test]
    fn allows_existing_empty_target() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir(tmp.path().join("p")).unwrap();
        assert!(
            scaffold_from_template(&template(), tmp.path(), "p", "n", &manifest("n"), "").is_ok()
        );
    }

    #[test]
    fn rejects_relative_parent_and_bad_manifest() {
        assert!(scaffold_from_template(
            &template(),
            Path::new("relative"),
            "p",
            "n",
            &manifest("n"),
            ""
        )
        .is_err());
        let tmp = tempfile::tempdir().unwrap();
        assert!(scaffold_from_template(&template(), tmp.path(), "p", "n", "not json", "").is_err());
        assert!(scaffold_from_template(&template(), tmp.path(), "p", "n", "[]", "").is_err());
        assert!(!tmp.path().join("p").exists());
    }

    #[test]
    fn rejects_symlink_target_escaping_parent() {
        let tmp = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let link = tmp.path().join("link");
        #[cfg(unix)]
        let ok = std::os::unix::fs::symlink(outside.path(), &link).is_ok();
        #[cfg(windows)]
        let ok = std::os::windows::fs::symlink_dir(outside.path(), &link).is_ok();
        if !ok {
            eprintln!("symlink creation unavailable; skipping");
            return;
        }
        assert!(
            scaffold_from_template(&template(), tmp.path(), "link", "n", &manifest("n"), "")
                .is_err()
        );
        assert_eq!(fs::read_dir(outside.path()).unwrap().count(), 0);
    }

    #[test]
    fn asset_scope_dir_accepts_only_directories() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(asset_scope_dir(tmp.path().to_str().unwrap()).is_some());
        let file = tmp.path().join("f.txt");
        fs::write(&file, "x").unwrap();
        assert!(asset_scope_dir(file.to_str().unwrap()).is_none());
        assert!(asset_scope_dir(tmp.path().join("missing").to_str().unwrap()).is_none());
    }

    #[test]
    fn slug_is_kebab_case() {
        assert_eq!(package_slug("My Demo!"), "my-demo");
        assert_eq!(package_slug("한글"), "vanilla-project");
    }

    #[test]
    fn format_iso_matches_known_timestamps() {
        assert_eq!(format_iso(0), "1970-01-01T00:00:00Z");
        assert_eq!(format_iso(1_767_225_600), "2026-01-01T00:00:00Z");
        assert_eq!(format_iso(1_767_225_600 + 3_661), "2026-01-01T01:01:01Z");
        // Leap day: 2024-02-29T12:00:00Z.
        assert_eq!(format_iso(1_709_208_000), "2024-02-29T12:00:00Z");
    }

    #[test]
    fn check_message_trims_and_limits() {
        assert_eq!(check_message("  plan approved  ").unwrap(), "plan approved");
        assert!(check_message("   ").is_err());
        assert!(check_message(&"x".repeat(201)).is_err());
        assert!(check_message(&"x".repeat(200)).is_ok());
    }

    #[test]
    fn snapshot_roundtrip_skips_caches_and_reports_history() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        fs::write(root.join("brief.md"), "hello").unwrap();
        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(root.join("src/app.ts"), "x").unwrap();
        // Skipped content: caches, build output, symlinks, app state.
        fs::create_dir_all(root.join("node_modules")).unwrap();
        fs::write(root.join("node_modules/big.js"), "x").unwrap();
        fs::create_dir_all(root.join(".vanilla/logs")).unwrap();
        fs::write(root.join(".vanilla/app.db"), "db").unwrap();
        #[cfg(unix)]
        let _ = std::os::unix::fs::symlink(root.join("brief.md"), root.join("link.md"));
        #[cfg(windows)]
        let _ = std::os::windows::fs::symlink_file(root.join("brief.md"), root.join("link.md"));

        let c1 = snapshot_commit(root, "first").unwrap();
        assert_eq!(c1.backend, "snapshot");
        // A later commit sorts after the earlier one.
        std::thread::sleep(std::time::Duration::from_millis(2));
        let c2 = snapshot_commit(root, "second").unwrap();
        assert_ne!(c1.id, c2.id);

        let snap = root.join(".vanilla/snapshots").join(&c2.id);
        assert!(snap.join("brief.md").is_file());
        assert!(snap.join("src/app.ts").is_file());
        assert!(!snap.join("node_modules").exists());
        assert!(!snap.join("app.db").exists());
        assert!(!snap.join("link.md").exists());
        let meta: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(snap.join("checkpoint.json")).unwrap()).unwrap();
        assert_eq!(meta["message"], "second");

        let history = snapshot_history(root, 10).unwrap();
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].id, c2.id);
        assert_eq!(history[1].id, c1.id);
        assert_eq!(latest_snapshot_id(root).as_deref(), Some(c2.id.as_str()));
    }

    #[test]
    fn git_checkpoint_init_commit_history() {
        // Inner helpers are used directly: the Tauri commands add only the
        // workspace-scope check, which the global test workspace would make racy.
        let Some(git) = checkpoint_git() else {
            eprintln!("git unavailable; skipping");
            return;
        };
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        fs::write(root.join("plan.md"), "v1").unwrap();

        let status = checkpoint_status_inner(root, Some(&git)).unwrap();
        assert_eq!(status.backend, "git");
        assert!(!status.is_repo);
        assert!(status.head.is_none());

        ensure_repo(root, &git).unwrap();
        assert!(is_repo(root));
        // .vanilla/ is ignored, the app DB never lands in a checkpoint.
        let ignore = fs::read_to_string(root.join(".gitignore")).unwrap();
        assert!(ignore.lines().any(|l| l.trim() == ".vanilla/"));
        assert!(head_commit(root, &git).unwrap().is_none());

        run_git(root, &git, &["add", "-A"]).unwrap();
        run_git(root, &git, &["commit", "-m", "chore: initial checkpoint"]).unwrap();
        let head = head_commit(root, &git).unwrap().expect("init commits");
        assert_eq!(head.len(), 40);

        // No changes: the same HEAD comes back, no empty commit pile-up.
        let again = git_commit(root, &git, "no-op").unwrap();
        assert_eq!(again.id, head);

        fs::write(root.join("plan.md"), "v2").unwrap();
        let c = git_commit(root, &git, "plan approved").unwrap();
        assert_ne!(c.id, head);

        let history = git_history(root, &git, 10).unwrap();
        assert!(history.len() >= 2);
        assert_eq!(history[0].message, "plan approved");
        assert!(history[0].at.contains('T'));
        assert_eq!(history[0].id.len(), 40);

        let status = checkpoint_status_inner(root, Some(&git)).unwrap();
        assert!(status.is_repo);
        assert_eq!(status.head.as_deref(), Some(history[0].id.as_str()));
    }

    #[test]
    fn checkpoint_rejects_bad_input() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().to_string_lossy().into_owned();
        assert!(checkpoint_commit(root.clone(), "   ".into()).is_err());
        assert!(checkpoint_history(tmp.path().join("missing").to_string_lossy().into(), None).is_err());
    }
}

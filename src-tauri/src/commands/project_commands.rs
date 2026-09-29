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
}

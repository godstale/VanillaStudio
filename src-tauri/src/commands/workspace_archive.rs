//! 워크스페이스 폴더째 zip 압축·복원(D-045). `pnpm dist`(`pack-workspace.mjs`)와 같은 제외 규칙으로 압축하고,
//! 복원은 검사를 통과한 항목만 빈 폴더에 푼다. zip 내용은 신뢰할 수 없는 외부 데이터다(AGENTS.md §7).
//! `.vsx`(신·시퀀스 공유 패키지, `package_commands.rs`)와는 별개다: 이쪽은 `package.json`·`pnpm-lock.yaml` 등 폴더 전체를 담는다.

use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, DateTime, ZipArchive, ZipWriter};

use super::fs_commands::resolve_and_verify_workspace_path;
use super::package_commands::safe_entry_name;

const MAX_ENTRIES: usize = 50_000;
const MAX_ENTRY_BYTES: u64 = 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 4 * 1024 * 1024 * 1024;

/// `pnpm dist`와 같은 정책: 받는 PC에서 평범한 `pnpm install`이 되도록 항상 담는다(D-041).
const RELEASE_AGE_POLICY: &str = "# pnpm v11+ supply-chain policy for class-distribution workspaces (D-041).\nminimumReleaseAge: 0\n";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveReport {
    pub path: String,
    pub files: usize,
    pub bytes: u64,
}

fn excluded_dir(name: &str, at_root: bool) -> bool {
    matches!(name, "node_modules" | ".vanilla" | ".git") || (at_root && name == "dist")
}

fn excluded_file(name: &str) -> bool {
    matches!(name, ".DS_Store" | "Thumbs.db" | "desktop.ini" | ".env") || name.ends_with(".log") || name.starts_with(".env.")
}

fn collect(dir: &Path, rel: &str, skip: &Path, out: &mut Vec<(String, PathBuf, u64)>) -> Result<(), String> {
    let mut entries: Vec<_> = fs::read_dir(dir).map_err(|e| format!("read_dir '{}': {e}", dir.display()))?.filter_map(Result::ok).collect();
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        if ft.is_symlink() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        let child = if rel.is_empty() { name.clone() } else { format!("{rel}/{name}") };
        let path = entry.path();
        if ft.is_dir() {
            if !excluded_dir(&name, rel.is_empty()) {
                collect(&path, &child, skip, out)?;
            }
        } else if ft.is_file() && !excluded_file(&name) && path != skip {
            let len = entry.metadata().map_err(|e| e.to_string())?.len();
            out.push((child, path, len));
        }
    }
    Ok(())
}

/// zip 최상위 폴더 이름: `package.json`의 `name`(경로에 안전하게 정리), 없으면 폴더 이름.
fn top_folder_name(root: &Path) -> String {
    let from_pkg = fs::read_to_string(root.join("package.json"))
        .ok()
        .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
        .and_then(|v| v.get("name").and_then(|n| n.as_str()).map(str::to_string))
        .unwrap_or_default();
    let clean = |s: &str| -> String {
        let mapped: String = s.chars().map(|c| if c.is_ascii_alphanumeric() || "._-".contains(c) { c } else { '-' }).collect();
        mapped.trim_matches('-').to_string()
    };
    let name = clean(&from_pkg);
    if !name.is_empty() {
        return name;
    }
    let dir = clean(&root.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default());
    if dir.is_empty() { "workspace".into() } else { dir }
}

fn file_options() -> SimpleFileOptions {
    SimpleFileOptions::default().compression_method(CompressionMethod::Deflated).last_modified_time(DateTime::default()).unix_permissions(0o644)
}

pub fn pack_workspace(root: &Path, out: &Path) -> Result<ArchiveReport, String> {
    if !root.join("workspace.json").is_file() {
        return Err("not-a-workspace".into());
    }
    if out.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase).as_deref() != Some("zip") {
        return Err("output-must-be-zip".into());
    }
    if out.exists() {
        return Err("output-exists".into());
    }
    let tmp = out.with_extension("zip.part");
    let mut files = Vec::new();
    collect(root, "", &tmp, &mut files)?;
    if files.is_empty() {
        return Err("nothing-to-package".into());
    }
    if files.len() > MAX_ENTRIES {
        return Err("too-many-files".into());
    }
    let total: u64 = files.iter().map(|f| f.2).sum();
    if total > MAX_TOTAL_BYTES || files.iter().any(|f| f.2 > MAX_ENTRY_BYTES) {
        return Err("package-too-large".into());
    }

    let top = top_folder_name(root);
    let has_policy = files.iter().any(|f| f.0 == "pnpm-workspace.yaml");
    let result = (|| -> Result<(), String> {
        let mut zip = ZipWriter::new(fs::File::create(&tmp).map_err(|e| e.to_string())?);
        for (rel, path, _) in &files {
            zip.start_file(format!("{top}/{rel}"), file_options()).map_err(|e| e.to_string())?;
            let mut f = fs::File::open(path).map_err(|e| format!("read '{rel}': {e}"))?;
            io::copy(&mut f, &mut zip).map_err(|e| e.to_string())?;
        }
        if !has_policy {
            zip.start_file(format!("{top}/pnpm-workspace.yaml"), file_options()).map_err(|e| e.to_string())?;
            zip.write_all(RELEASE_AGE_POLICY.as_bytes()).map_err(|e| e.to_string())?;
        }
        zip.finish().map_err(|e| e.to_string())?;
        Ok(())
    })();
    if let Err(e) = result {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    fs::rename(&tmp, out).map_err(|e| e.to_string())?;
    Ok(ArchiveReport { path: out.to_string_lossy().into_owned(), files: files.len() + usize::from(!has_policy), bytes: total })
}

fn is_symlink_mode(mode: Option<u32>) -> bool {
    mode.is_some_and(|m| m & 0o170000 == 0o120000)
}

/// 압축 파일 안 `workspace.json`의 위치로 최상위 폴더 접두사(`""` 또는 `"name/"`)를 정한다.
fn workspace_prefix(names: &[String]) -> Result<String, String> {
    let mut found: Vec<&str> = names.iter().map(String::as_str).filter(|n| *n == "workspace.json" || (n.ends_with("/workspace.json") && n.matches('/').count() == 1)).collect();
    found.sort_by_key(|n| n.len());
    match found.first() {
        Some(n) => Ok(n.strip_suffix("workspace.json").unwrap_or("").to_string()),
        None => Err("not-a-workspace-zip".into()),
    }
}

fn clear_children_except_git(dir: &Path) {
    let Ok(rd) = fs::read_dir(dir) else { return };
    for e in rd.filter_map(Result::ok) {
        if e.file_name() == ".git" {
            continue;
        }
        let p = e.path();
        let _ = if p.is_dir() { fs::remove_dir_all(&p) } else { fs::remove_file(&p) };
    }
}

pub fn unpack_workspace(zip_path: &Path, dest: &Path) -> Result<ArchiveReport, String> {
    if dest.exists() {
        let mut rd = fs::read_dir(dest).map_err(|e| e.to_string())?;
        if rd.any(|e| e.map(|e| e.file_name() != ".git").unwrap_or(true)) {
            return Err("destination-not-empty".into());
        }
    }
    let mut zip = ZipArchive::new(fs::File::open(zip_path).map_err(|e| format!("open: {e}"))?).map_err(|_| "not-a-zip".to_string())?;
    if zip.len() > MAX_ENTRIES {
        return Err("too-many-files".into());
    }
    // 1) 이름·종류를 전부 검사한다(아무것도 쓰기 전).
    let mut names = Vec::with_capacity(zip.len());
    for i in 0..zip.len() {
        let entry = zip.by_index(i).map_err(|e| e.to_string())?;
        if entry.encrypted() {
            return Err("encrypted-entry".into());
        }
        let name = safe_entry_name(entry.name())?;
        if is_symlink_mode(entry.unix_mode()) {
            return Err(format!("symlink-entry: {name}"));
        }
        if !entry.is_dir() && entry.size() > MAX_ENTRY_BYTES {
            return Err(format!("entry-too-large: {name}"));
        }
        names.push(name);
    }
    let prefix = workspace_prefix(&names)?;

    // 2) 쓴다. 실패하면 이 명령이 만든 것만 치운다.
    let created_dest = !dest.exists();
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    let dest_canon = dest.canonicalize().map_err(|e| e.to_string())?;
    let mut files = 0usize;
    let mut total = 0u64;
    let result = (|| -> Result<(), String> {
        for i in 0..zip.len() {
            let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
            let Some(rel) = names[i].strip_prefix(prefix.as_str()).filter(|r| !r.is_empty()) else { continue };
            let target = dest_canon.join(rel);
            if !target.starts_with(&dest_canon) {
                return Err(format!("unsafe-entry-name: escapes destination: {rel}"));
            }
            if entry.is_dir() {
                fs::create_dir_all(&target).map_err(|e| e.to_string())?;
                continue;
            }
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            // 기존 파일은 덮어쓰지 않는다(같은 이름 항목이 두 번 나오는 경우 포함).
            let mut out = fs::OpenOptions::new().write(true).create_new(true).open(&target).map_err(|e| format!("would-overwrite: {rel}: {e}"))?;
            // 선언된 크기를 믿지 않는다: 상한까지만 읽는다(zip bomb).
            let n = io::copy(&mut entry.by_ref().take(MAX_ENTRY_BYTES + 1), &mut out).map_err(|e| e.to_string())?;
            if n > MAX_ENTRY_BYTES {
                return Err(format!("entry-too-large: {rel}"));
            }
            total += n;
            if total > MAX_TOTAL_BYTES {
                return Err("package-too-large".into());
            }
            files += 1;
        }
        Ok(())
    })();
    if let Err(e) = result {
        if created_dest {
            let _ = fs::remove_dir_all(dest);
        } else {
            clear_children_except_git(dest);
        }
        return Err(e);
    }
    // 압축 파일에 담긴 workspace.json이 유효한지 풀린 결과로 확인한다.
    let valid = fs::read_to_string(dest_canon.join("workspace.json"))
        .ok()
        .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
        .is_some_and(|v| v.get("workspaceId").is_some_and(|x| x.is_string()) && v.get("name").is_some_and(|x| x.is_string()));
    if !valid {
        if created_dest {
            let _ = fs::remove_dir_all(dest);
        } else {
            clear_children_except_git(dest);
        }
        return Err("not-a-workspace-zip".into());
    }
    Ok(ArchiveReport { path: dest.to_string_lossy().into_owned(), files, bytes: total })
}

/// 활성 워크스페이스를 폴더째 `.zip`으로 압축한다. `out_path`는 사용자가 저장 대화상자에서 고른 경로.
#[tauri::command]
pub fn pack_workspace_zip(workspace_root: String, out_path: String) -> Result<ArchiveReport, String> {
    let root = resolve_and_verify_workspace_path(&workspace_root, Some(&workspace_root), true)?;
    pack_workspace(&root, Path::new(&out_path))
}

/// 워크스페이스 zip을 사용자가 고른 빈 폴더에 푼다. 풀린 폴더를 여는 것은 호출한 쪽이 한다(신뢰 확인은 열 때 받는다).
#[tauri::command]
pub fn unpack_workspace_zip(zip_path: String, dest_dir: String) -> Result<ArchiveReport, String> {
    unpack_workspace(Path::new(&zip_path), Path::new(&dest_dir))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn w(root: &Path, rel: &str, text: &str) {
        let p = root.join(rel);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, text).unwrap();
    }

    fn workspace() -> tempfile::TempDir {
        let d = tempfile::tempdir().unwrap();
        let r = d.path();
        w(r, "workspace.json", r#"{"version":1,"workspaceId":"ws_a","name":"Demo","canvas":{}}"#);
        w(r, "package.json", r#"{"name":"my demo"}"#);
        w(r, "scenes/intro/src/index.html", "<html>");
        w(r, "scenes/intro/.vanilla/thumb.png", "png");
        w(r, "node_modules/x/index.js", "x");
        w(r, ".vanilla/app.db", "secret");
        w(r, "dist/play.html", "built");
        w(r, "scenes/intro/dist/keep.txt", "nested dist is user data");
        w(r, ".env", "KEY=1");
        w(r, "run.log", "log");
        d
    }

    fn names(zip: &Path) -> Vec<String> {
        let mut z = ZipArchive::new(fs::File::open(zip).unwrap()).unwrap();
        (0..z.len()).map(|i| z.by_index(i).unwrap().name().to_string()).collect()
    }

    #[test]
    fn pack_uses_dist_rules_and_top_folder() {
        let d = workspace();
        let out = tempfile::tempdir().unwrap().keep().join("o.zip");
        let rep = pack_workspace(d.path(), &out).unwrap();
        let got = names(&out);
        assert!(got.contains(&"my-demo/workspace.json".to_string()));
        assert!(got.contains(&"my-demo/scenes/intro/src/index.html".to_string()));
        assert!(got.contains(&"my-demo/scenes/intro/dist/keep.txt".to_string()));
        assert!(got.contains(&"my-demo/pnpm-workspace.yaml".to_string()));
        for banned in ["node_modules", ".vanilla", "dist/play.html", ".env", ".log"] {
            assert!(!got.iter().any(|n| n.contains(banned)), "{banned}");
        }
        assert_eq!(rep.files, got.len());
        assert_eq!(pack_workspace(d.path(), &out).unwrap_err(), "output-exists");
    }

    #[test]
    fn roundtrip_strips_top_folder_and_refuses_non_empty_dest() {
        let d = workspace();
        let out = tempfile::tempdir().unwrap().keep().join("o.zip");
        pack_workspace(d.path(), &out).unwrap();
        let dest = tempfile::tempdir().unwrap();
        let rep = unpack_workspace(&out, dest.path()).unwrap();
        assert!(dest.path().join("workspace.json").is_file());
        assert!(dest.path().join("scenes/intro/src/index.html").is_file());
        assert_eq!(rep.files, 5);
        assert_eq!(unpack_workspace(&out, dest.path()).unwrap_err(), "destination-not-empty");
    }

    fn zip_with(entries: &[(&str, &str)]) -> PathBuf {
        let path = tempfile::tempdir().unwrap().keep().join("z.zip");
        let mut z = ZipWriter::new(fs::File::create(&path).unwrap());
        for (n, c) in entries {
            z.start_file(*n, file_options()).unwrap();
            z.write_all(c.as_bytes()).unwrap();
        }
        z.finish().unwrap();
        path
    }

    #[test]
    fn unpack_rejects_unsafe_and_non_workspace_archives() {
        let ws = r#"{"workspaceId":"ws_1","name":"N"}"#;
        let bad = zip_with(&[("a/workspace.json", ws), ("a/../../evil.txt", "x")]);
        let dest = tempfile::tempdir().unwrap();
        assert!(unpack_workspace(&bad, dest.path()).unwrap_err().starts_with("unsafe-entry-name"));
        assert_eq!(fs::read_dir(dest.path()).unwrap().count(), 0);

        let none = zip_with(&[("readme.txt", "hi")]);
        assert_eq!(unpack_workspace(&none, dest.path()).unwrap_err(), "not-a-workspace-zip");

        let broken = zip_with(&[("workspace.json", "{}")]);
        let fresh = tempfile::tempdir().unwrap().keep().join("new");
        assert_eq!(unpack_workspace(&broken, &fresh).unwrap_err(), "not-a-workspace-zip");
        assert!(!fresh.exists());
    }

    #[test]
    fn unpack_accepts_flat_archive() {
        let flat = zip_with(&[("workspace.json", r#"{"workspaceId":"ws_1","name":"N"}"#), ("scenes/a/scene.json", "{}")]);
        let dest = tempfile::tempdir().unwrap();
        assert_eq!(unpack_workspace(&flat, dest.path()).unwrap().files, 2);
        assert!(dest.path().join("scenes/a/scene.json").is_file());
    }
}

//! `.vsx` 패키지(T7.1·T7.2, D-027, Technical-Design §8.4): 신 또는 시퀀스 전체를 정규화된 zip으로 만들고, 열기 전에 검사하고, 안전하게 풀어낸다.
//!
//! - 생성: 허용 목록(allowlist)에 있는 파일만 담는다. 같은 입력 → 같은 바이트(정렬된 항목, 고정 시각, 고정 권한, 타임스탬프 없는 manifest).
//! - 검사: 항목 이름(zip-slip·절대 경로·역슬래시·드라이브·`..`)·심링크·암호화·중복·개수·크기·manifest 해시를 모두 확인한다. 패키지 내용은 신뢰할 수 없는 외부 데이터다(AGENTS.md §7).
//! - 추출: 검사를 통과한 항목만, 대상 폴더 밖으로 나가지 않게, 기존 파일을 덮어쓰지 않고 쓴다.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, DateTime, ZipArchive, ZipWriter};

use super::fs_commands::resolve_and_verify_workspace_path;

pub const FORMAT_VERSION: u32 = 1;
pub const MANIFEST_NAME: &str = "manifest.json";
const MAX_ENTRIES: usize = 20_000;
const MAX_ENTRY_BYTES: u64 = 512 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const MAX_NAME_LEN: usize = 240;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileEntry {
    pub path: String,
    pub size: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Schemas {
    pub workspace: u32,
    pub scene: u32,
    pub sequence: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorkspaceRef {
    pub id: String,
    pub name: String,
}

/// 필드 선언 순서 = manifest.json 키 순서. 스키마: src/lib/package/manifest.ts
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub format_version: u32,
    /// `sequence`(워크스페이스 전체) | `scene`(신 하나)
    pub kind: String,
    pub app: AppInfo,
    pub schemas: Schemas,
    pub workspace: WorkspaceRef,
    /// `kind == "scene"`이면 신 폴더 이름.
    pub scene: Option<String>,
    /// 동봉한 사용자 정의 템플릿 폴더(`guide-templates/<id>@<ver>`).
    pub templates: Vec<String>,
    pub files: Vec<FileEntry>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PackOptions {
    /// 신 하나만 담을 때 그 폴더 이름. 없으면 시퀀스 전체.
    pub scene: Option<String>,
    /// 레퍼런스 원본(영상·이미지)을 담을지(기본 제외, 분석 결과·`references.json`은 항상 담는다).
    #[serde(default)]
    pub include_reference_media: bool,
    /// 사용 중인 사용자 정의 템플릿 폴더(워크스페이스 기준 `guide-templates/…`).
    #[serde(default)]
    pub template_dirs: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackReport {
    pub path: String,
    pub files: usize,
    pub bytes: u64,
    pub manifest: Manifest,
}

// ---- 경로 안전 -------------------------------------------------------------------------------

/// 패키지 항목 이름 검사. 통과하면 정규화된(`/` 구분) 이름. zip-slip·절대 경로·역슬래시·드라이브 문자·`..`·빈 요소·NUL·너무 긴 이름 거부.
pub fn safe_entry_name(name: &str) -> Result<String, String> {
    let bad = |why: &str| Err(format!("unsafe-entry-name: {why}: {name:?}"));
    if name.is_empty() || name.len() > MAX_NAME_LEN {
        return bad("empty or too long");
    }
    if name.contains('\0') || name.contains('\\') {
        return bad("NUL or backslash");
    }
    if name.starts_with('/') || name.chars().nth(1) == Some(':') {
        return bad("absolute path");
    }
    let trimmed = name.strip_suffix('/').unwrap_or(name);
    for part in trimmed.split('/') {
        if part.is_empty() || part == "." || part == ".." {
            return bad("path traversal");
        }
        if part.ends_with('.') || part.ends_with(' ') {
            return bad("trailing dot or space");
        }
    }
    Ok(trimmed.to_string())
}

fn is_hidden_or_noise(part: &str) -> bool {
    part.starts_with('.') || part == "node_modules" || part == "dist"
}

/// 워크스페이스 기준 상대 경로가 패키지에 들어가도 되는가(허용 목록).
pub fn included(rel: &str, opts: &PackOptions) -> bool {
    let parts: Vec<&str> = rel.split('/').collect();
    if parts.iter().any(|p| is_hidden_or_noise(p)) {
        return false;
    }
    let scene_scope = opts.scene.as_deref();
    match parts.as_slice() {
        [file] => scene_scope.is_none() && matches!(*file, "workspace.json" | "sequence.json" | "DESIGN.md" | "AGENTS.md" | "CLAUDE.md" | "CREDITS.md"),
        ["transitions", file] => scene_scope.is_none() && file.ends_with(".json"),
        ["guide-templates", ..] => {
            let dir = parts.iter().take(2).copied().collect::<Vec<_>>().join("/");
            scene_scope.is_none() && opts.template_dirs.iter().any(|d| d == &dir)
        }
        ["scenes", slug, rest @ ..] => {
            if scene_scope.is_some_and(|s| s != *slug) || rest.is_empty() {
                return false;
            }
            match rest {
                [f] => matches!(*f, "scene.json" | "GUIDE.md" | "AGENTS.md" | "CLAUDE.md" | "DESIGN.md" | "CREDITS.md"),
                ["prompts" | "src" | "params", ..] => true,
                ["references", "references.json"] => true,
                ["references", "analysis", ..] => true,
                ["references", _, ..] => opts.include_reference_media,
                _ => false,
            }
        }
        _ => false,
    }
}

fn walk(dir: &Path, base: &Path, out: &mut Vec<String>) -> Result<(), String> {
    let rd = fs::read_dir(dir).map_err(|e| format!("read_dir '{}': {e}", dir.display()))?;
    for entry in rd {
        let entry = entry.map_err(|e| e.to_string())?;
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        // 심링크는 따라가지 않는다(담지 않는다).
        if ft.is_symlink() {
            continue;
        }
        let path = entry.path();
        if ft.is_dir() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if is_hidden_or_noise(&name) {
                continue;
            }
            walk(&path, base, out)?;
        } else if ft.is_file() {
            let rel = path.strip_prefix(base).map_err(|e| e.to_string())?;
            let parts: Vec<String> = rel.components().filter_map(|c| match c {
                Component::Normal(s) => Some(s.to_string_lossy().into_owned()),
                _ => None,
            }).collect();
            out.push(parts.join("/"));
        }
    }
    Ok(())
}

/// 패키지에 담을 파일(정렬된 상대 경로).
pub fn collect_files(root: &Path, opts: &PackOptions) -> Result<Vec<String>, String> {
    let mut all = Vec::new();
    walk(root, root, &mut all)?;
    let mut files: Vec<String> = all.into_iter().filter(|rel| included(rel, opts)).collect();
    files.sort();
    Ok(files)
}

fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

fn valid_slug(s: &str) -> bool {
    !s.is_empty() && s.len() <= 80 && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// `guide-templates/<id>@<ver>` 형태만(다른 경로로 템플릿 폴더 밖을 담지 못하게).
fn valid_template_dir(d: &str) -> bool {
    let mut it = d.split('/');
    matches!((it.next(), it.next(), it.next()), (Some("guide-templates"), Some(name), None) if !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '@' || c == '.' || c == '_'))
}

#[derive(Deserialize)]
struct WorkspaceHead {
    #[serde(rename = "workspaceId")]
    workspace_id: String,
    name: String,
}

fn options() -> SimpleFileOptions {
    // 같은 입력 → 같은 바이트: 고정 시각(1980-01-01), 고정 권한, 고정 압축.
    SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .compression_level(Some(6))
        .last_modified_time(DateTime::default())
        .unix_permissions(0o644)
}

pub fn manifest_json(m: &Manifest) -> Result<String, String> {
    let mut s = serde_json::to_string_pretty(m).map_err(|e| e.to_string())?;
    s.push('\n');
    Ok(s)
}

/// 패키지를 만든다. `root`는 워크스페이스 루트, `out`은 만들 `.vsx` 경로(이미 있으면 거부).
pub fn create_package(root: &Path, out: &Path, opts: &PackOptions) -> Result<PackReport, String> {
    if let Some(s) = &opts.scene {
        if !valid_slug(s) || !root.join("scenes").join(s).join("scene.json").is_file() {
            return Err("scene-not-found".into());
        }
    }
    if let Some(bad) = opts.template_dirs.iter().find(|d| !valid_template_dir(d)) {
        return Err(format!("invalid-template-dir: {bad}"));
    }
    if out.extension().and_then(|e| e.to_str()) != Some("vsx") {
        return Err("output-must-be-vsx".into());
    }
    if out.exists() {
        return Err("output-exists".into());
    }
    let head: WorkspaceHead = serde_json::from_str(&fs::read_to_string(root.join("workspace.json")).map_err(|_| "not-a-workspace".to_string())?).map_err(|_| "not-a-workspace".to_string())?;

    let rels = collect_files(root, opts)?;
    if rels.is_empty() {
        return Err("nothing-to-package".into());
    }
    if rels.len() > MAX_ENTRIES {
        return Err("too-many-files".into());
    }
    let mut entries = Vec::new();
    let mut blobs: Vec<(String, Vec<u8>)> = Vec::new();
    let mut total: u64 = 0;
    for rel in rels {
        let bytes = fs::read(root.join(&rel)).map_err(|e| format!("read '{rel}': {e}"))?;
        if bytes.len() as u64 > MAX_ENTRY_BYTES {
            return Err(format!("file-too-large: {rel}"));
        }
        total += bytes.len() as u64;
        if total > MAX_TOTAL_BYTES {
            return Err("package-too-large".into());
        }
        entries.push(FileEntry { path: rel.clone(), size: bytes.len() as u64, sha256: sha256_hex(&bytes) });
        blobs.push((rel, bytes));
    }
    let manifest = Manifest {
        format_version: FORMAT_VERSION,
        kind: if opts.scene.is_some() { "scene".into() } else { "sequence".into() },
        app: AppInfo { name: "vanilla-studio".into(), version: env!("CARGO_PKG_VERSION").into() },
        schemas: Schemas { workspace: 1, scene: 1, sequence: 1 },
        workspace: WorkspaceRef { id: head.workspace_id, name: head.name },
        scene: opts.scene.clone(),
        templates: { let mut t = opts.template_dirs.clone(); t.sort(); t.dedup(); t },
        files: entries,
    };

    let tmp = out.with_extension("vsx.part");
    let result = (|| -> Result<(), String> {
        let file = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        let mut zip = ZipWriter::new(file);
        zip.start_file(MANIFEST_NAME, options()).map_err(|e| e.to_string())?;
        zip.write_all(manifest_json(&manifest)?.as_bytes()).map_err(|e| e.to_string())?;
        for (rel, bytes) in &blobs {
            zip.start_file(rel.as_str(), options()).map_err(|e| e.to_string())?;
            zip.write_all(bytes).map_err(|e| e.to_string())?;
        }
        zip.finish().map_err(|e| e.to_string())?;
        Ok(())
    })();
    if let Err(e) = result {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    fs::rename(&tmp, out).map_err(|e| e.to_string())?;
    Ok(PackReport { path: out.to_string_lossy().into_owned(), files: blobs.len(), bytes: total, manifest })
}

// ---- 검사·추출 -------------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageInfo {
    pub manifest: Manifest,
    /// 열기 전에 사용자가 확인해야 하는 외부 콘텐츠(규칙·프롬프트·템플릿 파일 경로).
    pub review_files: Vec<String>,
    pub total_bytes: u64,
}

fn is_symlink_mode(mode: Option<u32>) -> bool {
    mode.is_some_and(|m| m & 0o170000 == 0o120000)
}

/// 읽은 항목: 이름 → 바이트. 검사를 통과한 파일 항목만 담긴다.
fn read_all(path: &Path) -> Result<(Manifest, BTreeMap<String, Vec<u8>>), String> {
    let file = fs::File::open(path).map_err(|e| format!("open: {e}"))?;
    let mut zip = ZipArchive::new(file).map_err(|_| "not-a-zip".to_string())?;
    if zip.len() > MAX_ENTRIES + 1 {
        return Err("too-many-files".into());
    }
    let mut files: BTreeMap<String, Vec<u8>> = BTreeMap::new();
    let mut total: u64 = 0;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        if entry.encrypted() {
            return Err("encrypted-entry".into());
        }
        let raw = entry.name().to_string();
        let name = safe_entry_name(&raw)?;
        if is_symlink_mode(entry.unix_mode()) {
            return Err(format!("symlink-entry: {name}"));
        }
        if entry.is_dir() {
            continue;
        }
        if entry.size() > MAX_ENTRY_BYTES {
            return Err(format!("entry-too-large: {name}"));
        }
        // 선언된 크기를 믿지 않는다: 상한까지만 읽고 넘으면 거부한다(zip bomb).
        let mut buf = Vec::new();
        entry.by_ref().take(MAX_ENTRY_BYTES + 1).read_to_end(&mut buf).map_err(|e| e.to_string())?;
        if buf.len() as u64 > MAX_ENTRY_BYTES {
            return Err(format!("entry-too-large: {name}"));
        }
        total += buf.len() as u64;
        if total > MAX_TOTAL_BYTES {
            return Err("package-too-large".into());
        }
        if files.insert(name.clone(), buf).is_some() {
            return Err(format!("duplicate-entry: {name}"));
        }
    }
    let manifest_bytes = files.remove(MANIFEST_NAME).ok_or_else(|| "manifest-missing".to_string())?;
    let manifest: Manifest = serde_json::from_slice(&manifest_bytes).map_err(|_| "manifest-invalid".to_string())?;
    if manifest.format_version != FORMAT_VERSION {
        return Err(format!("unsupported-format-version: {}", manifest.format_version));
    }
    if manifest.kind != "sequence" && manifest.kind != "scene" {
        return Err("manifest-invalid".into());
    }
    // manifest와 실제 항목이 정확히 일치하고 해시가 같아야 한다.
    let listed: BTreeSet<&str> = manifest.files.iter().map(|f| f.path.as_str()).collect();
    if listed.len() != manifest.files.len() {
        return Err("manifest-duplicate-path".into());
    }
    for f in &manifest.files {
        safe_entry_name(&f.path)?;
        let bytes = files.get(&f.path).ok_or_else(|| format!("missing-file: {}", f.path))?;
        if bytes.len() as u64 != f.size || sha256_hex(bytes) != f.sha256 {
            return Err(format!("hash-mismatch: {}", f.path));
        }
    }
    if let Some(extra) = files.keys().find(|k| !listed.contains(k.as_str())) {
        return Err(format!("unlisted-file: {extra}"));
    }
    Ok((manifest, files))
}

/// 열기 전에 사용자에게 보여 줄 외부 콘텐츠: 규칙·프롬프트·템플릿·AGENTS.md(에이전트가 읽는 지시 파일).
fn review_files(manifest: &Manifest) -> Vec<String> {
    let mut v: Vec<String> = manifest
        .files
        .iter()
        .filter(|f| {
            let p = f.path.as_str();
            p.starts_with("guide-templates/") || p.ends_with("/AGENTS.md") || p == "AGENTS.md" || p.ends_with("/CLAUDE.md") || p == "CLAUDE.md" || p.contains("/prompts/") || p.ends_with("/DESIGN.md") || p == "DESIGN.md"
        })
        .map(|f| f.path.clone())
        .collect();
    v.sort();
    v
}

pub fn inspect_package(path: &Path) -> Result<PackageInfo, String> {
    let (manifest, files) = read_all(path)?;
    let total_bytes = files.values().map(|b| b.len() as u64).sum();
    let review_files = review_files(&manifest);
    Ok(PackageInfo { manifest, review_files, total_bytes })
}

/// 풀 때 거르는 조건. `prefix`는 패키지 안 경로 접두사(예: `scenes/intro/`), `strip`은 대상 경로에서 뺄 접두사.
#[derive(Debug, Clone, Default)]
pub struct ExtractFilter {
    pub prefix: Option<String>,
    pub strip: Option<String>,
}

/// 검사를 통과한 항목을 `dest` 아래에 쓴다. 기존 파일은 덮어쓰지 않고(있으면 중단), `dest` 밖으로 나가는 경로는 없다.
pub fn extract_package(path: &Path, dest: &Path, filter: &ExtractFilter) -> Result<Vec<String>, String> {
    let (_manifest, files) = read_all(path)?;
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    let dest_canon = dest.canonicalize().map_err(|e| e.to_string())?;
    let mut written = Vec::new();
    // 먼저 전부 검증한 뒤 쓴다(중간에 실패해 반쯤 풀린 상태를 줄인다).
    let mut plan: Vec<(PathBuf, &Vec<u8>, String)> = Vec::new();
    for (name, bytes) in &files {
        if filter.prefix.as_deref().is_some_and(|p| !name.starts_with(p)) {
            continue;
        }
        let rel = match &filter.strip {
            Some(s) => name.strip_prefix(s.as_str()).unwrap_or(name).to_string(),
            None => name.clone(),
        };
        let rel = safe_entry_name(&rel)?;
        let target = dest_canon.join(&rel);
        if !target.starts_with(&dest_canon) {
            return Err(format!("unsafe-entry-name: escapes destination: {rel}"));
        }
        if target.exists() {
            return Err(format!("would-overwrite: {rel}"));
        }
        plan.push((target, bytes, rel));
    }
    for (target, bytes, rel) in plan {
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            // 부모를 만든 뒤 실제 경로가 대상 안인지 다시 확인한다(기존 심링크 폴더를 지나는 경우).
            if !parent.canonicalize().map_err(|e| e.to_string())?.starts_with(&dest_canon) {
                return Err(format!("unsafe-entry-name: escapes destination: {rel}"));
            }
        }
        fs::write(&target, bytes).map_err(|e| format!("write '{rel}': {e}"))?;
        written.push(rel);
    }
    Ok(written)
}

// ---- Tauri 명령 ------------------------------------------------------------------------------

/// 패키지를 만든다. `workspace_root`는 활성 워크스페이스, `out_path`는 사용자가 저장 대화상자에서 고른 `.vsx` 경로.
#[tauri::command]
pub fn create_vsx(workspace_root: String, out_path: String, options: PackOptions) -> Result<PackReport, String> {
    let root = resolve_and_verify_workspace_path(&workspace_root, Some(&workspace_root), true)?;
    create_package(&root, Path::new(&out_path), &options)
}

/// 열기 전 검사. 내용을 어디에도 쓰지 않는다.
#[tauri::command]
pub fn inspect_vsx(path: String) -> Result<PackageInfo, String> {
    inspect_package(Path::new(&path))
}

/// 신 패키지의 신 폴더를 현재 워크스페이스의 `scenes/<slug>/`로 푼다(없는 폴더여야 한다).
#[tauri::command]
pub fn extract_vsx_scene(workspace_root: String, path: String, source_slug: String, target_slug: String) -> Result<Vec<String>, String> {
    if !valid_slug(&source_slug) || !valid_slug(&target_slug) {
        return Err("invalid-slug".into());
    }
    let dest = resolve_and_verify_workspace_path(&format!("{workspace_root}/scenes/{target_slug}"), Some(&workspace_root), false)?;
    if dest.exists() {
        return Err("scene-exists".into());
    }
    let filter = ExtractFilter { prefix: Some(format!("scenes/{source_slug}/")), strip: Some(format!("scenes/{source_slug}/")) };
    let r = extract_package(Path::new(&path), &dest, &filter);
    if r.is_err() {
        let _ = fs::remove_dir_all(&dest); // 반쯤 풀린 폴더를 남기지 않는다
    }
    r
}

/// 시퀀스 패키지를 새(비어 있는) 폴더에 푼다. 폴더는 사용자가 고른 것이며 비어 있어야 한다.
#[tauri::command]
pub fn extract_vsx_workspace(path: String, dest_dir: String) -> Result<Vec<String>, String> {
    let dest = Path::new(&dest_dir);
    if dest.exists() {
        let mut rd = fs::read_dir(dest).map_err(|e| e.to_string())?;
        if rd.any(|e| e.map(|e| e.file_name() != ".git").unwrap_or(true)) {
            return Err("destination-not-empty".into());
        }
    }
    extract_package(Path::new(&path), dest, &ExtractFilter::default())
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
        w(r, "workspace.json", r#"{"version":1,"workspaceId":"ws_a","name":"Demo","canvas":{"aspect":"16:9","width":1280,"height":720,"fps":30}}"#);
        w(r, "sequence.json", "{}");
        w(r, "DESIGN.md", "# d");
        w(r, "AGENTS.md", "# a");
        w(r, "package.json", "{}"); // 담지 않는다
        w(r, "node_modules/x/index.js", "x");
        w(r, ".vanilla/app.db", "secret");
        w(r, "transitions/iris.json", "{}");
        w(r, "transitions/notes.txt", "x");
        for slug in ["intro", "page"] {
            let s = format!("scenes/{slug}");
            w(r, &format!("{s}/scene.json"), "{}");
            w(r, &format!("{s}/GUIDE.md"), "g");
            w(r, &format!("{s}/src/index.html"), "<html>");
            w(r, &format!("{s}/params/a.values.json"), "{}");
            w(r, &format!("{s}/prompts/generate.md"), "p");
            w(r, &format!("{s}/references/references.json"), "{}");
            w(r, &format!("{s}/references/analysis/ref-1.md"), "a");
            w(r, &format!("{s}/references/analysis/ref-1/frames/frame-001.jpg"), "j");
            w(r, &format!("{s}/references/ref-1-ad.mp4"), "video bytes");
            w(r, &format!("{s}/.vanilla/thumb.png"), "png");
            w(r, &format!("{s}/notes.tmp"), "x");
        }
        w(r, "guide-templates/mine@1/template.json", "{}");
        w(r, "guide-templates/other@1/template.json", "{}");
        d
    }

    fn opts() -> PackOptions {
        PackOptions::default()
    }

    #[test]
    fn entry_names_are_validated() {
        for ok in ["a.txt", "scenes/a/src/x.ts", "a/b/"] {
            assert!(safe_entry_name(ok).is_ok(), "{ok}");
        }
        for bad in ["", "/etc/passwd", "../x", "a/../../x", "a\\b", "C:/x", "C:x", "a//b", "./a", "a/./b", "x\0y", "dots./a", "sp /a", &"a".repeat(300)] {
            assert!(safe_entry_name(bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn allowlist_picks_the_right_files() {
        let d = workspace();
        let files = collect_files(d.path(), &opts()).unwrap();
        assert!(files.contains(&"workspace.json".to_string()) && files.contains(&"scenes/intro/scene.json".to_string()));
        assert!(files.contains(&"scenes/intro/references/analysis/ref-1/frames/frame-001.jpg".to_string()));
        assert!(files.contains(&"transitions/iris.json".to_string()));
        for no in ["package.json", "node_modules/x/index.js", ".vanilla/app.db", "scenes/intro/.vanilla/thumb.png", "scenes/intro/notes.tmp", "scenes/intro/references/ref-1-ad.mp4", "transitions/notes.txt", "guide-templates/mine@1/template.json"] {
            assert!(!files.contains(&no.to_string()), "{no}");
        }
        let mut sorted = files.clone();
        sorted.sort();
        assert_eq!(files, sorted);
    }

    #[test]
    fn options_add_media_templates_and_limit_to_a_scene() {
        let d = workspace();
        let with = collect_files(d.path(), &PackOptions { include_reference_media: true, template_dirs: vec!["guide-templates/mine@1".into()], ..opts() }).unwrap();
        assert!(with.contains(&"scenes/intro/references/ref-1-ad.mp4".to_string()));
        assert!(with.contains(&"guide-templates/mine@1/template.json".to_string()));
        assert!(!with.iter().any(|f| f.starts_with("guide-templates/other")));
        let one = collect_files(d.path(), &PackOptions { scene: Some("intro".into()), ..opts() }).unwrap();
        assert!(one.iter().all(|f| f.starts_with("scenes/intro/")), "{one:?}");
        assert!(!one.contains(&"workspace.json".to_string()));
    }

    #[test]
    fn create_is_deterministic_and_the_manifest_matches() {
        let d = workspace();
        let out1 = d.path().join("../a.vsx");
        let out2 = d.path().join("../b.vsx");
        let r1 = create_package(d.path(), &out1, &opts()).unwrap();
        // 파일 수정 시각이 달라도 같은 바이트여야 한다.
        std::thread::sleep(std::time::Duration::from_millis(1100));
        let f = d.path().join("scenes/intro/scene.json");
        fs::write(&f, "{}").unwrap();
        create_package(d.path(), &out2, &opts()).unwrap();
        assert_eq!(fs::read(&out1).unwrap(), fs::read(&out2).unwrap());
        assert_eq!(r1.manifest.workspace, WorkspaceRef { id: "ws_a".into(), name: "Demo".into() });
        assert_eq!(r1.manifest.kind, "sequence");
        assert!(r1.manifest.files.windows(2).all(|w| w[0].path < w[1].path));
        let info = inspect_package(&out1).unwrap();
        assert_eq!(info.manifest, r1.manifest);
        assert!(info.review_files.contains(&"scenes/intro/prompts/generate.md".to_string()));
        assert!(info.review_files.contains(&"AGENTS.md".to_string()));
        let _ = fs::remove_file(out1);
        let _ = fs::remove_file(out2);
    }

    #[test]
    fn create_refuses_bad_requests() {
        let d = workspace();
        let out = d.path().join("../x.vsx");
        assert_eq!(create_package(d.path(), &d.path().join("../x.zip"), &opts()).unwrap_err(), "output-must-be-vsx");
        assert_eq!(create_package(d.path(), &out, &PackOptions { scene: Some("../x".into()), ..opts() }).unwrap_err(), "scene-not-found");
        assert_eq!(create_package(d.path(), &out, &PackOptions { scene: Some("nope".into()), ..opts() }).unwrap_err(), "scene-not-found");
        assert!(create_package(d.path(), &out, &PackOptions { template_dirs: vec!["scenes/intro".into()], ..opts() }).unwrap_err().starts_with("invalid-template-dir"));
        assert!(create_package(d.path(), &out, &PackOptions { template_dirs: vec!["guide-templates/../x".into()], ..opts() }).unwrap_err().starts_with("invalid-template-dir"));
        let empty = tempfile::tempdir().unwrap();
        assert_eq!(create_package(empty.path(), &out, &opts()).unwrap_err(), "not-a-workspace");
        create_package(d.path(), &out, &opts()).unwrap();
        assert_eq!(create_package(d.path(), &out, &opts()).unwrap_err(), "output-exists");
        let _ = fs::remove_file(out);
    }

    fn pack(d: &tempfile::TempDir, name: &str) -> PathBuf {
        let out = d.path().join(format!("../{name}.vsx"));
        create_package(d.path(), &out, &opts()).unwrap();
        out
    }

    /// 손으로 만든 zip(악성 항목 포함). `entries`: (이름, 내용, unix 모드).
    fn evil_zip(path: &Path, manifest: Option<&str>, entries: &[(&str, &[u8], Option<u32>)]) {
        let f = fs::File::create(path).unwrap();
        let mut z = ZipWriter::new(f);
        if let Some(m) = manifest {
            z.start_file(MANIFEST_NAME, SimpleFileOptions::default()).unwrap();
            z.write_all(m.as_bytes()).unwrap();
        }
        for (name, bytes, mode) in entries {
            if *mode == Some(0o120777) {
                // 심링크 항목: 내용은 가리키는 경로다.
                z.add_symlink(*name, String::from_utf8_lossy(bytes).into_owned(), SimpleFileOptions::default()).unwrap();
                continue;
            }
            z.start_file(*name, SimpleFileOptions::default()).unwrap();
            z.write_all(bytes).unwrap();
        }
        z.finish().unwrap();
    }

    fn manifest_for(files: &[(&str, &[u8])]) -> String {
        let m = Manifest {
            format_version: 1,
            kind: "sequence".into(),
            app: AppInfo { name: "vanilla-studio".into(), version: "0".into() },
            schemas: Schemas { workspace: 1, scene: 1, sequence: 1 },
            workspace: WorkspaceRef { id: "ws_x".into(), name: "X".into() },
            scene: None,
            templates: vec![],
            files: files.iter().map(|(p, b)| FileEntry { path: (*p).into(), size: b.len() as u64, sha256: sha256_hex(b) }).collect(),
        };
        manifest_json(&m).unwrap()
    }

    #[test]
    fn malicious_archives_are_rejected() {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path().join("evil.vsx");
        let good: &[u8] = b"hello";
        let m_ok = manifest_for(&[("a.txt", good)]);

        // zip-slip / absolute / backslash / drive entries
        for bad in ["../evil.txt", "a/../../evil.txt", "/abs.txt", "C:/win.txt", "dir\\file.txt"] {
            evil_zip(&p, Some(&m_ok), &[(bad, b"x", None), ("a.txt", good, None)]);
            let e = inspect_package(&p).unwrap_err();
            assert!(e.starts_with("unsafe-entry-name"), "{bad}: {e}");
        }
        // symlink entry
        evil_zip(&p, Some(&m_ok), &[("link", b"/etc/passwd", Some(0o120777)), ("a.txt", good, None)]);
        assert!(inspect_package(&p).unwrap_err().starts_with("symlink-entry"));
        // manifest missing / invalid / wrong version
        evil_zip(&p, None, &[("a.txt", good, None)]);
        assert_eq!(inspect_package(&p).unwrap_err(), "manifest-missing");
        evil_zip(&p, Some("{ nope"), &[("a.txt", good, None)]);
        assert_eq!(inspect_package(&p).unwrap_err(), "manifest-invalid");
        evil_zip(&p, Some(&m_ok.replace("\"formatVersion\": 1", "\"formatVersion\": 99")), &[("a.txt", good, None)]);
        assert!(inspect_package(&p).unwrap_err().starts_with("unsupported-format-version"));
        // content differs from the manifest hash
        evil_zip(&p, Some(&m_ok), &[("a.txt", b"tampered", None)]);
        assert!(inspect_package(&p).unwrap_err().starts_with("hash-mismatch"));
        // a file the manifest does not list
        evil_zip(&p, Some(&m_ok), &[("a.txt", good, None), ("extra.txt", b"x", None)]);
        assert!(inspect_package(&p).unwrap_err().starts_with("unlisted-file"));
        // a listed file that is missing
        evil_zip(&p, Some(&m_ok), &[]);
        assert!(inspect_package(&p).unwrap_err().starts_with("missing-file"));
        // manifest lists an unsafe path
        let m_bad = manifest_for(&[("../x.txt", good)]);
        evil_zip(&p, Some(&m_bad), &[("a.txt", good, None)]);
        assert!(inspect_package(&p).unwrap_err().starts_with("unsafe-entry-name"));
        // not a zip at all
        fs::write(&p, b"this is not a zip").unwrap();
        assert_eq!(inspect_package(&p).unwrap_err(), "not-a-zip");
    }

    /// Rust와 TS(`src/lib/package/manifest.ts`)가 같은 manifest 계약을 쓰는지: 같은 골든 파일을 양쪽이 읽는다.
    #[test]
    fn manifest_matches_the_shared_golden_file() {
        let golden = fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("../tests/fixtures/manifest.sample.json")).unwrap().replace("
", "
");
        let m: Manifest = serde_json::from_str(&golden).unwrap();
        assert_eq!(manifest_json(&m).unwrap(), golden, "serialising the golden manifest reproduces it byte for byte (key order)");
    }

    #[test]
    fn duplicate_manifest_paths_are_rejected() {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path().join("dup.vsx");
        let good: &[u8] = b"hello";
        let m = manifest_for(&[("a.txt", good), ("a.txt", good)]);
        evil_zip(&p, Some(&m), &[("a.txt", good, None)]);
        assert_eq!(inspect_package(&p).unwrap_err(), "manifest-duplicate-path");
    }

    #[test]
    fn round_trip_extracts_byte_identical_files() {
        let d = workspace();
        let vsx = pack(&d, "rt");
        let dest = tempfile::tempdir().unwrap();
        let written = extract_package(&vsx, &dest.path().join("out"), &ExtractFilter::default()).unwrap();
        assert!(written.contains(&"scenes/intro/src/index.html".to_string()));
        for rel in &written {
            assert_eq!(fs::read(dest.path().join("out").join(rel)).unwrap(), fs::read(d.path().join(rel)).unwrap(), "{rel}");
        }
        assert!(!dest.path().join("out/node_modules").exists());
        // packing the extracted copy gives the same files list and hashes
        let again = tempfile::tempdir().unwrap();
        let out2 = again.path().join("out");
        extract_package(&vsx, &out2, &ExtractFilter::default()).unwrap();
        let v2 = again.path().join("../rt2.vsx");
        create_package(&out2, &v2, &opts()).unwrap();
        assert_eq!(fs::read(&vsx).unwrap(), fs::read(&v2).unwrap(), "pack → extract → pack is byte-identical");
        let _ = fs::remove_file(vsx);
        let _ = fs::remove_file(v2);
    }

    #[test]
    fn extract_one_scene_with_a_new_name_and_never_overwrites() {
        let d = workspace();
        let vsx = pack(&d, "one");
        let dest = tempfile::tempdir().unwrap();
        let target = dest.path().join("scenes/copy");
        let filter = ExtractFilter { prefix: Some("scenes/intro/".into()), strip: Some("scenes/intro/".into()) };
        let written = extract_package(&vsx, &target, &filter).unwrap();
        assert!(written.contains(&"scene.json".to_string()) && written.iter().all(|w| !w.starts_with("scenes/")));
        assert!(!target.join("../intro").exists());
        // second time: the files exist → refuse, nothing is overwritten
        fs::write(target.join("scene.json"), "mine").unwrap();
        assert!(extract_package(&vsx, &target, &filter).unwrap_err().starts_with("would-overwrite"));
        assert_eq!(fs::read_to_string(target.join("scene.json")).unwrap(), "mine");
        let _ = fs::remove_file(vsx);
    }

    #[test]
    fn extract_command_helpers_validate_slugs_and_destination() {
        let d = workspace();
        let vsx = pack(&d, "cmd");
        let root = d.path().to_string_lossy().into_owned();
        assert_eq!(extract_vsx_scene(root.clone(), vsx.to_string_lossy().into_owned(), "../x".into(), "ok".into()).unwrap_err(), "invalid-slug");
        assert_eq!(extract_vsx_scene(root.clone(), vsx.to_string_lossy().into_owned(), "intro".into(), "intro".into()).unwrap_err(), "scene-exists");
        let imported = extract_vsx_scene(root.clone(), vsx.to_string_lossy().into_owned(), "intro".into(), "intro-copy".into()).unwrap();
        assert!(imported.contains(&"scene.json".to_string()));
        assert!(d.path().join("scenes/intro-copy/src/index.html").is_file());
        // a workspace package only goes into an empty folder
        let full = tempfile::tempdir().unwrap();
        fs::write(full.path().join("keep.txt"), "x").unwrap();
        assert_eq!(extract_vsx_workspace(vsx.to_string_lossy().into_owned(), full.path().to_string_lossy().into_owned()).unwrap_err(), "destination-not-empty");
        let empty = tempfile::tempdir().unwrap();
        assert!(extract_vsx_workspace(vsx.to_string_lossy().into_owned(), empty.path().to_string_lossy().into_owned()).unwrap().contains(&"workspace.json".to_string()));
        let _ = fs::remove_file(vsx);
    }

    #[test]
    fn symlinks_in_the_workspace_are_not_packaged() {
        let d = workspace();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("secret.txt"), "top secret").unwrap();
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(outside.path().join("secret.txt"), d.path().join("scenes/intro/src/leak.txt")).unwrap();
            let files = collect_files(d.path(), &opts()).unwrap();
            assert!(!files.contains(&"scenes/intro/src/leak.txt".to_string()));
        }
        #[cfg(not(unix))]
        {
            // Creating symlinks needs privileges on Windows; the walker skips them by file type (covered on unix CI).
            let _ = &d;
        }
    }
}

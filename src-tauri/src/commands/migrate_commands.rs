//! v1 프로젝트 읽기(T7.5, D-033): v1 폴더를 **읽기 전용**으로 훑어 변환에 필요한 파일만 돌려준다. 원본은 어떤 경우에도 쓰거나 지우지 않는다.
//! v1 폴더는 사용자의 이전 결과물이지만 앱 입장에서는 외부 콘텐츠다(AGENTS.md §7): 파일 수·크기·깊이를 제한하고 심링크는 따라가지 않는다.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Component, Path};

use serde::Serialize;

const MAX_FILES: usize = 3000;
const MAX_TEXT_BYTES: u64 = 1024 * 1024;
const MAX_DEPTH: usize = 12;
const TEXT_EXT: &[&str] = &["ts", "tsx", "js", "jsx", "mjs", "css", "html", "json", "md", "svg", "glsl", "vert", "frag", "txt", "csv"];
/// 변환이 보는 v1 최상위 항목. 그 밖(`reviews/`·`exports/`·`prompts/`·`.claude/` …)은 읽지 않고 `skipped`에 이름만 남긴다.
const WANTED_TOP: &[&str] = &["vanilla.json", "DESIGN.md", "frame.md", "index.html", "brief", "plan", "assets", "src", "params", "public"];

#[derive(Debug, Clone, Serialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct V1Bundle {
    /// 프로젝트 루트(정규 경로). 바이너리 복사의 출발점이다.
    pub root: String,
    /// 상대 경로(`/` 구분) → 텍스트 내용.
    pub texts: BTreeMap<String, String>,
    /// 텍스트가 아니거나 너무 커서 내용을 읽지 않은 파일(복사 대상).
    pub binaries: Vec<String>,
    /// 변환하지 않는 최상위 항목(이름).
    pub skipped: Vec<String>,
}

fn is_text(name: &str) -> bool {
    Path::new(name).extension().and_then(|e| e.to_str()).is_some_and(|e| TEXT_EXT.contains(&e.to_ascii_lowercase().as_str()))
}

fn noise(part: &str) -> bool {
    part.starts_with('.') || part == "node_modules" || part == "dist"
}

fn walk(root: &Path, dir: &Path, depth: usize, out: &mut V1Bundle, count: &mut usize) -> Result<(), String> {
    if depth > MAX_DEPTH {
        return Ok(());
    }
    let mut entries: Vec<_> = fs::read_dir(dir).map_err(|e| format!("read_dir '{}': {e}", dir.display()))?.filter_map(|e| e.ok()).collect();
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if ft.is_symlink() || noise(&name) {
            continue;
        }
        let path = entry.path();
        if ft.is_dir() {
            walk(root, &path, depth + 1, out, count)?;
            continue;
        }
        if !ft.is_file() {
            continue;
        }
        *count += 1;
        if *count > MAX_FILES {
            return Err("too-many-files".into());
        }
        let rel: Vec<String> = path.strip_prefix(root).map_err(|e| e.to_string())?.components().filter_map(|c| match c {
            Component::Normal(s) => Some(s.to_string_lossy().into_owned()),
            _ => None,
        }).collect();
        let rel = rel.join("/");
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        if is_text(&name) && size <= MAX_TEXT_BYTES {
            // 텍스트로 읽지 못하면(깨진 인코딩) 바이너리로 취급해 그대로 복사한다.
            match fs::read_to_string(&path) {
                Ok(text) => {
                    out.texts.insert(rel, text);
                }
                Err(_) => out.binaries.push(rel),
            }
        } else {
            out.binaries.push(rel);
        }
    }
    Ok(())
}

pub fn read_v1(root: &Path) -> Result<V1Bundle, String> {
    let canon = root.canonicalize().map_err(|e| format!("not-a-folder: {e}"))?;
    if !canon.is_dir() || !canon.join("vanilla.json").is_file() {
        return Err("not-a-v1-project".into());
    }
    let mut out = V1Bundle { root: canon.to_string_lossy().into_owned(), ..Default::default() };
    let mut count = 0usize;
    for entry in fs::read_dir(&canon).map_err(|e| e.to_string())?.filter_map(|e| e.ok()) {
        let name = entry.file_name().to_string_lossy().into_owned();
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        if ft.is_symlink() || name == ".git" {
            continue;
        }
        if !WANTED_TOP.contains(&name.as_str()) {
            if !noise(&name) {
                out.skipped.push(name);
            }
            continue;
        }
        let path = entry.path();
        if ft.is_dir() {
            walk(&canon, &path, 1, &mut out, &mut count)?;
        } else if ft.is_file() {
            count += 1;
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            if size <= MAX_TEXT_BYTES {
                if let Ok(text) = fs::read_to_string(&path) {
                    out.texts.insert(name, text);
                    continue;
                }
            }
            out.binaries.push(name);
        }
    }
    out.skipped.sort();
    out.binaries.sort();
    Ok(out)
}

#[tauri::command]
pub fn read_v1_project(path: String) -> Result<V1Bundle, String> {
    read_v1(Path::new(&path))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn w(root: &Path, rel: &str, bytes: &[u8]) {
        let p = root.join(rel);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, bytes).unwrap();
    }

    fn project() -> tempfile::TempDir {
        let d = tempfile::tempdir().unwrap();
        let r = d.path();
        w(r, "vanilla.json", b"{}");
        w(r, "DESIGN.md", b"# d");
        w(r, "index.html", b"<html>");
        w(r, "src/main.tsx", b"main");
        w(r, "src/scenes/hello.tsx", b"hello");
        w(r, "src/assets/logo.png", &[0x89, b'P', b'N', b'G', 0, 1, 2]);
        w(r, "params/hello.values.json", b"{}");
        w(r, "public/font.woff2", &[0, 1, 2, 3]);
        w(r, "brief/brief.md", b"# brief");
        w(r, "brief/materials/photo.jpg", &[0xff, 0xd8, 0xff]);
        w(r, "plan/plan.json", b"{}");
        w(r, "reviews/R-001.md", b"x");
        w(r, "exports/20260101-web/index.html", b"x");
        w(r, "prompts/00-master.md", b"x");
        w(r, ".vanilla/app.db", b"secret");
        w(r, "node_modules/x/index.js", b"x");
        d
    }

    #[test]
    fn reads_only_what_the_conversion_needs_and_never_touches_the_source() {
        let d = project();
        let before: Vec<_> = walkdir_names(d.path());
        let b = read_v1(d.path()).unwrap();
        assert_eq!(walkdir_names(d.path()), before, "the project is unchanged");
        for rel in ["vanilla.json", "DESIGN.md", "index.html", "src/main.tsx", "src/scenes/hello.tsx", "params/hello.values.json", "brief/brief.md", "plan/plan.json"] {
            assert!(b.texts.contains_key(rel), "{rel}");
        }
        assert_eq!(b.binaries, ["brief/materials/photo.jpg", "public/font.woff2", "src/assets/logo.png"]);
        assert_eq!(b.skipped, ["exports", "prompts", "reviews"]);
        assert!(!b.texts.keys().any(|k| k.contains(".vanilla") || k.contains("node_modules") || k.starts_with("reviews")));
    }

    fn walkdir_names(root: &Path) -> Vec<String> {
        fn go(dir: &Path, base: &Path, out: &mut Vec<String>) {
            for e in fs::read_dir(dir).unwrap().flatten() {
                let p = e.path();
                out.push(format!("{}:{}", p.strip_prefix(base).unwrap().display(), e.metadata().unwrap().len()));
                if p.is_dir() {
                    go(&p, base, out);
                }
            }
        }
        let mut v = Vec::new();
        go(root, root, &mut v);
        v.sort();
        v
    }

    #[test]
    fn a_folder_without_vanilla_json_is_not_a_v1_project() {
        let d = tempfile::tempdir().unwrap();
        assert_eq!(read_v1(d.path()).unwrap_err(), "not-a-v1-project");
        w(d.path(), "workspace.json", b"{}"); // a v2 workspace is not a v1 project either
        assert_eq!(read_v1(d.path()).unwrap_err(), "not-a-v1-project");
        assert!(read_v1(&d.path().join("missing")).unwrap_err().starts_with("not-a-folder"));
    }

    #[test]
    fn large_text_and_bad_encodings_become_binary_copies() {
        let d = project();
        w(d.path(), "src/big.json", &vec![b'a'; (MAX_TEXT_BYTES + 1) as usize]);
        w(d.path(), "src/latin1.txt", &[0xff, 0xfe, 0x41]);
        let b = read_v1(d.path()).unwrap();
        assert!(b.binaries.contains(&"src/big.json".to_string()));
        assert!(b.binaries.contains(&"src/latin1.txt".to_string()));
    }

    #[test]
    fn too_many_files_is_refused() {
        let d = project();
        for i in 0..(MAX_FILES + 5) {
            w(d.path(), &format!("src/many/f{i}.ts"), b"x");
        }
        assert_eq!(read_v1(d.path()).unwrap_err(), "too-many-files");
    }
}

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use serde::Serialize;

// 가이드 템플릿 폴더 읽기(D-031). 템플릿은 외부 콘텐츠(신뢰할 수 없는 데이터)라 읽기 전용·텍스트 파일만·크기 상한·심링크 거부로 제한한다.
// 폴더 위치는 워크스페이스 `guide-templates/`와 설정의 `templatesDir`(워크스페이스 밖일 수 있음)다.

const MAX_FILES_PER_TEMPLATE: usize = 64;
const MAX_FILE_BYTES: u64 = 256 * 1024;
const MAX_TEMPLATES: usize = 200;
const MAX_DEPTH: usize = 3;
const TEXT_EXTENSIONS: &[&str] = &["json", "md"];

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TemplateFolder {
    /// `<id>@<ver>` 폴더 이름.
    pub dir_name: String,
    /// 폴더 안 상대 경로(`/` 구분) → 내용.
    pub files: BTreeMap<String, String>,
    /// 건너뛴 항목(너무 큼·심링크·읽기 실패)의 이유. 사용자에게 보여 준다.
    pub skipped: Vec<String>,
}

fn is_template_dir_name(name: &str) -> bool {
    let Some((id, ver)) = name.split_once('@') else { return false };
    !id.is_empty()
        && id.chars().next().is_some_and(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        && !ver.is_empty()
        && ver.chars().all(|c| c.is_ascii_digit())
}

fn collect(base: &Path, dir: &Path, depth: usize, out: &mut TemplateFolder) {
    let Ok(rd) = fs::read_dir(dir) else {
        out.skipped.push(format!("{}: cannot read folder", dir.display()));
        return;
    };
    let mut entries: Vec<_> = rd.filter_map(Result::ok).collect();
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        let path = entry.path();
        let rel = path.strip_prefix(base).unwrap_or(&path).to_string_lossy().replace('\\', "/");
        let Ok(ft) = entry.file_type() else { continue };
        if ft.is_symlink() {
            out.skipped.push(format!("{rel}: symlink"));
        } else if ft.is_dir() {
            if depth < MAX_DEPTH {
                collect(base, &path, depth + 1, out);
            } else {
                out.skipped.push(format!("{rel}: too deep"));
            }
        } else {
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
            if !TEXT_EXTENSIONS.contains(&ext.as_str()) {
                continue; // 템플릿 형식이 아닌 파일은 조용히 무시한다.
            }
            if out.files.len() >= MAX_FILES_PER_TEMPLATE {
                out.skipped.push(format!("{rel}: too many files"));
                continue;
            }
            match entry.metadata() {
                Ok(m) if m.len() > MAX_FILE_BYTES => out.skipped.push(format!("{rel}: larger than {MAX_FILE_BYTES} bytes")),
                Ok(_) => match fs::read_to_string(&path) {
                    Ok(text) => {
                        out.files.insert(rel, text);
                    }
                    Err(e) => out.skipped.push(format!("{rel}: {e}")),
                },
                Err(e) => out.skipped.push(format!("{rel}: {e}")),
            }
        }
    }
}

/// `dir` 아래의 `<id>@<ver>` 템플릿 폴더들을 읽는다. 폴더가 없으면 빈 목록(템플릿이 아직 없는 것은 오류가 아니다).
pub fn read_folders(dir: &Path) -> Result<Vec<TemplateFolder>, String> {
    if !dir.is_absolute() {
        return Err("Template folder must be an absolute path".into());
    }
    if !dir.exists() {
        return Ok(Vec::new());
    }
    if !dir.is_dir() {
        return Err(format!("Not a directory: {}", dir.display()));
    }
    let mut names: Vec<_> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .filter(|e| e.file_type().map(|t| t.is_dir() && !t.is_symlink()).unwrap_or(false))
        .filter_map(|e| e.file_name().to_str().map(str::to_string))
        .filter(|n| is_template_dir_name(n))
        .collect();
    names.sort();
    names.truncate(MAX_TEMPLATES);
    Ok(names
        .into_iter()
        .map(|name| {
            let mut folder = TemplateFolder { dir_name: name.clone(), files: BTreeMap::new(), skipped: Vec::new() };
            let base = dir.join(&name);
            collect(&base, &base, 0, &mut folder);
            folder
        })
        .collect())
}

#[tauri::command]
pub fn read_template_folders(dir: String) -> Result<Vec<TemplateFolder>, String> {
    read_folders(Path::new(&dir))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(p: &Path, text: &str) {
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, text).unwrap();
    }

    #[test]
    fn folder_name_rules() {
        for ok in ["mine@1", "my-template@12", "a1@3"] {
            assert!(is_template_dir_name(ok), "{ok}");
        }
        for bad in ["mine", "@1", "Mine@1", "mine@", "mine@x", "my template@1", "../x@1", "a@1@2"] {
            assert!(!is_template_dir_name(bad), "{bad}");
        }
    }

    #[test]
    fn reads_text_files_of_template_folders_only() {
        let d = tempfile::tempdir().unwrap();
        write(&d.path().join("mine@1/template.json"), "{}");
        write(&d.path().join("mine@1/prompts/generate.md"), "g");
        write(&d.path().join("mine@1/photo.png"), "binary");
        write(&d.path().join("not-a-template/template.json"), "{}");
        write(&d.path().join("loose.json"), "{}");
        let list = read_folders(d.path()).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].dir_name, "mine@1");
        assert_eq!(list[0].files.keys().cloned().collect::<Vec<_>>(), vec!["prompts/generate.md", "template.json"]);
        assert!(list[0].skipped.is_empty());
    }

    #[test]
    fn missing_folder_is_empty_not_an_error() {
        let d = tempfile::tempdir().unwrap();
        assert!(read_folders(&d.path().join("nope")).unwrap().is_empty());
    }

    #[test]
    fn rejects_relative_paths_and_files() {
        assert!(read_folders(Path::new("relative/dir")).is_err());
        let d = tempfile::tempdir().unwrap();
        let f = d.path().join("f.txt");
        fs::write(&f, "x").unwrap();
        assert!(read_folders(&f).is_err());
    }

    #[test]
    fn skips_oversized_files_and_reports_them() {
        let d = tempfile::tempdir().unwrap();
        write(&d.path().join("big@1/template.json"), "{}");
        write(&d.path().join("big@1/rules.md"), &"x".repeat(MAX_FILE_BYTES as usize + 1));
        let list = read_folders(d.path()).unwrap();
        assert!(list[0].files.contains_key("template.json"));
        assert!(!list[0].files.contains_key("rules.md"));
        assert!(list[0].skipped.iter().any(|s| s.starts_with("rules.md")));
    }

    #[test]
    fn caps_the_number_of_files_and_depth() {
        let d = tempfile::tempdir().unwrap();
        for i in 0..(MAX_FILES_PER_TEMPLATE + 5) {
            write(&d.path().join(format!("many@1/f{i:03}.md")), "x");
        }
        write(&d.path().join("deep@1/a/b/c/d/e.md"), "x");
        let list = read_folders(d.path()).unwrap();
        let many = list.iter().find(|t| t.dir_name == "many@1").unwrap();
        assert_eq!(many.files.len(), MAX_FILES_PER_TEMPLATE);
        assert_eq!(many.skipped.len(), 5);
        let deep = list.iter().find(|t| t.dir_name == "deep@1").unwrap();
        assert!(deep.files.is_empty());
        assert!(deep.skipped.iter().any(|s| s.contains("too deep")));
    }

    #[test]
    fn symlinked_entries_are_not_followed() {
        let d = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        write(&outside.path().join("secret.md"), "secret");
        write(&d.path().join("sym@1/template.json"), "{}");
        let link = d.path().join("sym@1/linked");
        #[cfg(windows)]
        let made = std::os::windows::fs::symlink_dir(outside.path(), &link).is_ok();
        #[cfg(unix)]
        let made = std::os::unix::fs::symlink(outside.path(), &link).is_ok();
        if !made {
            return; // 심링크 권한 없음
        }
        let list = read_folders(d.path()).unwrap();
        assert!(!list[0].files.keys().any(|k| k.contains("secret")));
        assert!(list[0].skipped.iter().any(|s| s.contains("symlink")));
    }
}

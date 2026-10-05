use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

use super::fs_commands::{resolve_and_verify_workspace_path, set_active_workspace_internal};

const WORKSPACE_FILE: &str = "workspace.json";

// 필드 선언 순서 = workspace.json 키 순서(Technical-Design §8.3). 스키마: src/lib/workspace/schema.ts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Canvas {
    pub aspect: String,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct WorkspaceFile {
    version: u32,
    #[serde(rename = "workspaceId")]
    workspace_id: String,
    name: String,
    canvas: Canvas,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum FolderKind {
    /// 비어 있음(`.git`만 있는 경우 포함) — 새 워크스페이스를 만들 수 있다.
    Empty,
    /// 유효한 workspace.json이 있음 — 열 수 있다.
    Workspace {
        #[serde(rename = "workspaceId")]
        workspace_id: String,
        name: String,
    },
    /// 그 외 — 자동으로 만들거나 열지 않는다.
    Other,
}

fn new_workspace_id() -> String {
    format!("ws_{:016x}", rand::random::<u64>())
}

fn is_empty_folder(dir: &Path) -> Result<bool, String> {
    let rd = fs::read_dir(dir).map_err(|e| format!("read_dir '{}': {}", dir.display(), e))?;
    for entry in rd {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.file_name() != ".git" {
            return Ok(false);
        }
    }
    Ok(true)
}

fn read_workspace_file(dir: &Path) -> Option<WorkspaceFile> {
    let text = fs::read_to_string(dir.join(WORKSPACE_FILE)).ok()?;
    let ws: WorkspaceFile = serde_json::from_str(&text).ok()?;
    (ws.version == 1 && !ws.workspace_id.is_empty()).then_some(ws)
}

fn inspect(dir: &Path) -> Result<FolderKind, String> {
    if !dir.is_dir() {
        return Err(format!("Not a directory: {}", dir.display()));
    }
    if let Some(ws) = read_workspace_file(dir) {
        return Ok(FolderKind::Workspace { workspace_id: ws.workspace_id, name: ws.name });
    }
    Ok(if is_empty_folder(dir)? { FolderKind::Empty } else { FolderKind::Other })
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
    dev.canonicalize().map_err(|_| format!("Resources not found: {name}"))
}

fn slug(name: &str) -> String {
    let mut s = String::new();
    for c in name.chars().flat_map(|c| c.to_lowercase()) {
        if c.is_ascii_alphanumeric() {
            s.push(c);
        } else if !s.ends_with('-') && !s.is_empty() {
            s.push('-');
        }
    }
    let s = s.trim_end_matches('-').to_string();
    if s.is_empty() { "vanilla-workspace".into() } else { s }
}

/// 템플릿을 `{{키}}` 치환하며 복사한다. 심링크 엔트리는 거부한다.
fn copy_template(src: &Path, dst: &Path, vars: &[(&str, &str)]) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| format!("read '{}': {}", src.display(), e))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        if ft.is_symlink() {
            return Err(format!("Template contains a symlink: {}", entry.path().display()));
        }
        let target = dst.join(entry.file_name());
        if ft.is_dir() {
            copy_template(&entry.path(), &target, vars)?;
            continue;
        }
        let bytes = fs::read(entry.path()).map_err(|e| e.to_string())?;
        let out = match String::from_utf8(bytes) {
            Ok(mut text) => {
                for (k, v) in vars {
                    text = text.replace(&format!("{{{{{k}}}}}"), v);
                }
                text.into_bytes()
            }
            Err(e) => e.into_bytes(),
        };
        fs::write(&target, out).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn create(dir: &Path, name: &str, canvas: Canvas, template: &Path) -> Result<String, String> {
    if name.trim().is_empty() {
        return Err("Workspace name must not be empty".into());
    }
    if inspect(dir)? != FolderKind::Empty {
        return Err("Folder is not empty; refusing to create a workspace here".into());
    }
    let id = new_workspace_id();
    let name = name.trim();
    copy_template(template, dir, &[("workspaceName", name), ("workspaceId", &id), ("workspaceSlug", &slug(name))])?;
    let file = WorkspaceFile { version: 1, workspace_id: id.clone(), name: name.to_string(), canvas };
    let mut json = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
    json.push('\n');
    fs::write(dir.join(WORKSPACE_FILE), json).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn inspect_workspace_folder(path: String) -> Result<FolderKind, String> {
    inspect(Path::new(&path))
}

#[tauri::command]
pub fn create_workspace<R: Runtime>(app: AppHandle<R>, path: String, name: String, canvas: Canvas) -> Result<String, String> {
    let template = resolve_resource_dir(&app, "workspace-template")?;
    create(Path::new(&path), &name, canvas, &template)
}

/// 유효한 워크스페이스 폴더를 열고 파일 명령의 활성 스코프로 설정한다.
#[tauri::command]
pub fn open_workspace(path: String) -> Result<FolderKind, String> {
    let canonical = Path::new(&path).canonicalize().map_err(|e| e.to_string())?;
    let kind = inspect(&canonical)?;
    if !matches!(kind, FolderKind::Workspace { .. }) {
        return Err("Folder is not a Vanilla Studio workspace".into());
    }
    set_active_workspace_internal(Some(canonical.to_string_lossy().to_string()));
    Ok(kind)
}

/// 워크스페이스 스코프 검사(스코프 밖·`..`·심링크 탈출 거부). 통과한 정규 경로를 돌려준다.
#[tauri::command]
pub fn verify_workspace_path(path: String, workspace_root: String) -> Result<String, String> {
    resolve_and_verify_workspace_path(&path, Some(&workspace_root), false).map(|p| p.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tpl() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../resources/workspace-template")
    }

    fn canvas() -> Canvas {
        Canvas { aspect: "16:9".into(), width: 1920, height: 1080, fps: 30 }
    }

    #[test]
    fn empty_folder_is_empty_even_with_git() {
        let d = tempfile::tempdir().unwrap();
        assert_eq!(inspect(d.path()).unwrap(), FolderKind::Empty);
        fs::create_dir(d.path().join(".git")).unwrap();
        assert_eq!(inspect(d.path()).unwrap(), FolderKind::Empty);
    }

    #[test]
    fn create_then_inspect_and_key_order() {
        let d = tempfile::tempdir().unwrap();
        let id = create(d.path(), " Demo ", canvas(), &tpl()).unwrap();
        assert!(id.starts_with("ws_"));
        assert_eq!(
            inspect(d.path()).unwrap(),
            FolderKind::Workspace { workspace_id: id.clone(), name: "Demo".into() }
        );
        let text = fs::read_to_string(d.path().join(WORKSPACE_FILE)).unwrap();
        assert!(text.ends_with("}\n"));
        let pos = |k: &str| text.find(k).unwrap();
        assert!(pos("\"version\"") < pos("\"workspaceId\"") && pos("\"workspaceId\"") < pos("\"name\"") && pos("\"name\"") < pos("\"canvas\""));
    }

    #[test]
    fn scaffold_renders_identity_header() {
        let d = tempfile::tempdir().unwrap();
        let id = create(d.path(), "My Reel", canvas(), &tpl()).unwrap();
        let agents = fs::read_to_string(d.path().join("AGENTS.md")).unwrap();
        assert!(agents.contains("My Reel") && agents.contains(&format!("workspaceId: {id}")));
        assert!(!agents.contains("{{"));
        let pkg = fs::read_to_string(d.path().join("package.json")).unwrap();
        assert!(pkg.contains("\"name\": \"my-reel\""));
        for f in ["CLAUDE.md", "DESIGN.md", "vite.config.ts", ".gitignore", "CREDITS.md", "workspace.json"] {
            assert!(d.path().join(f).is_file(), "{f}");
        }
    }

    #[test]
    fn refuses_nonempty_and_existing_workspace() {
        let d = tempfile::tempdir().unwrap();
        fs::write(d.path().join("a.txt"), "x").unwrap();
        assert_eq!(inspect(d.path()).unwrap(), FolderKind::Other);
        assert!(create(d.path(), "n", canvas(), &tpl()).is_err());

        let w = tempfile::tempdir().unwrap();
        create(w.path(), "n", canvas(), &tpl()).unwrap();
        assert!(create(w.path(), "n", canvas(), &tpl()).is_err());
    }

    #[test]
    fn malformed_workspace_json_is_other() {
        let d = tempfile::tempdir().unwrap();
        fs::write(d.path().join(WORKSPACE_FILE), "{ nope").unwrap();
        assert_eq!(inspect(d.path()).unwrap(), FolderKind::Other);
    }

    #[test]
    fn scope_rejects_outside_and_traversal() {
        let root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let r = root.path().to_string_lossy().to_string();
        assert!(verify_workspace_path("scenes/a/scene.json".into(), r.clone()).is_ok());
        assert!(verify_workspace_path(outside.path().to_string_lossy().to_string(), r.clone()).is_err());
        assert!(verify_workspace_path("../escape.txt".into(), r.clone()).is_err());
        assert!(verify_workspace_path("a/../../escape.txt".into(), r).is_err());
    }

    #[test]
    fn symlink_escape_is_rejected() {
        let root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let link = root.path().join("link");
        #[cfg(windows)]
        let made = std::os::windows::fs::symlink_dir(outside.path(), &link).is_ok();
        #[cfg(unix)]
        let made = std::os::unix::fs::symlink(outside.path(), &link).is_ok();
        if !made {
            return; // Windows without symlink privilege
        }
        let r = root.path().to_string_lossy().to_string();
        assert!(verify_workspace_path("link/x.txt".into(), r).is_err());
    }
}

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

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

fn create(dir: &Path, name: &str, canvas: Canvas) -> Result<String, String> {
    if name.trim().is_empty() {
        return Err("Workspace name must not be empty".into());
    }
    if inspect(dir)? != FolderKind::Empty {
        return Err("Folder is not empty; refusing to create a workspace here".into());
    }
    let id = new_workspace_id();
    let file = WorkspaceFile { version: 1, workspace_id: id.clone(), name: name.trim().to_string(), canvas };
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
pub fn create_workspace(path: String, name: String, canvas: Canvas) -> Result<String, String> {
    create(Path::new(&path), &name, canvas)
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
        let id = create(d.path(), " Demo ", canvas()).unwrap();
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
    fn refuses_nonempty_and_existing_workspace() {
        let d = tempfile::tempdir().unwrap();
        fs::write(d.path().join("a.txt"), "x").unwrap();
        assert_eq!(inspect(d.path()).unwrap(), FolderKind::Other);
        assert!(create(d.path(), "n", canvas()).is_err());

        let w = tempfile::tempdir().unwrap();
        create(w.path(), "n", canvas()).unwrap();
        assert!(create(w.path(), "n", canvas()).is_err());
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

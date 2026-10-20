//! 워크스페이스 신뢰 저장소(AGENTS.md §7): 신뢰 확인을 받지 않은 폴더에서는 에이전트·프리뷰 서버를 시작하지 않는다.
//!
//! 앱 화면(WorkspaceContext)이 사용자의 신뢰 결정을 보관하고, 폴더를 열 때와 결정이 바뀔 때마다 이 저장소에 **다시 알린다**.
//! 저장소는 메모리에만 있다: 앱이 다시 시작하면 비어 있고, 화면이 폴더를 열면서 신뢰된 것만 다시 채운다.

use std::collections::HashSet;
use std::path::Path;
use std::sync::Mutex;

static TRUSTED: Mutex<Option<HashSet<String>>> = Mutex::new(None);

/// 비교용 정규 경로: canonicalize + Windows 확장 접두사 제거 + Windows에서는 대소문자 무시.
pub fn normalize(path: &str) -> Option<String> {
    let canonical = Path::new(path).canonicalize().ok()?;
    let s = canonical.to_string_lossy().to_string();
    let s = match s.strip_prefix(r"\\?\") {
        Some(rest) if !rest.starts_with(r"UNC\") => rest.to_string(),
        _ => s,
    };
    Some(if cfg!(windows) { s.to_lowercase() } else { s })
}

fn with_set<T>(f: impl FnOnce(&mut HashSet<String>) -> T) -> T {
    let mut guard = TRUSTED.lock().unwrap_or_else(|p| p.into_inner());
    f(guard.get_or_insert_with(HashSet::new))
}

pub fn set_trusted_internal(path: &str, trusted: bool) -> Result<(), String> {
    let key = normalize(path).ok_or_else(|| format!("Workspace path not found: {path}"))?;
    with_set(|s| {
        if trusted {
            s.insert(key);
        } else {
            s.remove(&key);
        }
    });
    Ok(())
}

pub fn is_trusted(path: &str) -> bool {
    normalize(path).is_some_and(|key| with_set(|s| s.contains(&key)))
}

/// 사용자가 이 워크스페이스를 신뢰(또는 신뢰 해제)했음을 알린다. 존재하지 않는 경로는 오류.
#[tauri::command]
pub fn set_workspace_trusted(path: String, trusted: bool) -> Result<(), String> {
    set_trusted_internal(&path, trusted)
}

#[tauri::command]
pub fn is_workspace_trusted(path: String) -> bool {
    is_trusted(&path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn untrusted_by_default_and_toggles() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().to_string_lossy().to_string();
        assert!(!is_trusted(&p));
        set_trusted_internal(&p, true).unwrap();
        assert!(is_trusted(&p));
        set_trusted_internal(&p, false).unwrap();
        assert!(!is_trusted(&p));
    }

    #[test]
    fn different_spellings_of_one_folder_match() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().to_string_lossy().to_string();
        set_trusted_internal(&format!("{p}{}.", std::path::MAIN_SEPARATOR), true).unwrap();
        assert!(is_trusted(&p));
        set_trusted_internal(&p, false).unwrap();
    }

    #[test]
    fn a_child_folder_is_not_trusted_by_its_parent() {
        let d = tempfile::tempdir().unwrap();
        let child = d.path().join("child");
        std::fs::create_dir(&child).unwrap();
        let parent = d.path().to_string_lossy().to_string();
        set_trusted_internal(&parent, true).unwrap();
        assert!(!is_trusted(&child.to_string_lossy()));
        set_trusted_internal(&parent, false).unwrap();
    }

    #[test]
    fn missing_paths_are_errors_and_never_trusted() {
        assert!(set_trusted_internal("/definitely/not/here", true).is_err());
        assert!(!is_trusted("/definitely/not/here"));
    }
}

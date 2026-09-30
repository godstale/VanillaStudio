//! Project file watcher for HMR miss detection (T4.12, Technical-Design section 5).
//!
//! Vite can drop the last change when the same module is written ~30ms apart (S4). The backend
//! watches the project directly with `notify`; the frontend compares quiet-period changes against
//! the preview's `hmr` reports and sends `reload` when something is missing (the next `ready`
//! restores params/design/playhead through `init`, see T4.11).

use crate::commands::fs_commands::{get_active_workspace_internal, resolve_and_verify_workspace_path};
use notify::{EventKind, RecursiveMode, Watcher, recommended_watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, LazyLock, Mutex};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum WatchEvent {
    /// Root-relative (`/`-separated) source paths that changed. Bursts arrive as one batch.
    Changed { paths: Vec<String> },
}

/// Burst window: rapid saves (an agent writes ~30ms apart) arrive as one batch.
const BURST_WINDOW: Duration = Duration::from_millis(100);

/// Top-level entries the preview never serves: deps, build output, VCS, app state.
const IGNORED_TOP: &[&str] = &["node_modules", "dist", ".git", ".vanilla"];

/// Validate the project folder: must exist inside the active workspace (AGENTS.md section 7).
fn verified_project_dir(dir: &str) -> Result<PathBuf, String> {
    if get_active_workspace_internal().is_none() {
        return Err("no-workspace".into());
    }
    resolve_and_verify_workspace_path(dir, None, true)
}

/// `path` under `root` as a `/`-separated relative path, or `None` for ignored/outside paths.
/// Only existing files are reported: deletions make Vite full-reload on its own (followed by a
/// fresh `ready`), so the HMR-miss guard has nothing to compare them against.
pub fn relative_source_path(root: &Path, raw_root: &Path, path: &Path) -> Option<String> {
    if !path.is_file() {
        return None;
    }
    let rel = path
        .strip_prefix(root)
        .ok()
        .and_then(|r| if r.as_os_str().is_empty() { None } else { Some(r.to_path_buf()) })
        .or_else(|| {
            path.canonicalize()
                .ok()
                .and_then(|c| c.strip_prefix(root).ok().map(Path::to_path_buf))
        })
        .or_else(|| path.strip_prefix(raw_root).ok().map(Path::to_path_buf))?;
    let mut parts = Vec::new();
    for c in rel.components() {
        match c {
            std::path::Component::Normal(s) => parts.push(s.to_string_lossy().into_owned()),
            _ => return None,
        }
    }
    if parts.is_empty() {
        return None;
    }
    if IGNORED_TOP.contains(&parts[0].as_str()) {
        return None;
    }
    Some(parts.join("/"))
}

fn is_reportable(kind: &EventKind) -> bool {
    matches!(kind, EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_))
}

type WatchEmit = Arc<dyn Fn(WatchEvent) + Send + Sync>;
/// Swappable so a second `start_preview_watch` call (e.g. after a webview reload) takes over the events.
type SharedEmit = Arc<Mutex<WatchEmit>>;

struct WatchEntry {
    emit: Arc<Mutex<WatchEmit>>,
    stop: Arc<AtomicBool>,
    thread: Option<std::thread::JoinHandle<()>>,
}

static WATCHERS: LazyLock<Mutex<HashMap<PathBuf, WatchEntry>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

fn spawn_watcher(root: PathBuf, raw_root: PathBuf, emit: SharedEmit) -> Result<(Arc<AtomicBool>, std::thread::JoinHandle<()>), String> {
    let (tx, rx) = mpsc::channel::<notify::Result<notify::Event>>();
    let mut watcher = recommended_watcher(move |res| {
        let _ = tx.send(res);
    })
    .map_err(|e| format!("watch:{e}"))?;
    watcher.watch(&root, RecursiveMode::Recursive).map_err(|e| format!("watch:{e}"))?;
    let stop = Arc::new(AtomicBool::new(false));
    let thread = {
        let (stop, emit) = (stop.clone(), emit);
        std::thread::spawn(move || {
            let _watcher = watcher;
            let mut pending: Vec<String> = Vec::new();
            loop {
                if stop.load(Ordering::SeqCst) {
                    return;
                }
                match rx.recv_timeout(BURST_WINDOW) {
                    Ok(Ok(ev)) => {
                        if is_reportable(&ev.kind) {
                            for p in &ev.paths {
                                if let Some(rel) = relative_source_path(&root, &raw_root, p) {
                                    if !pending.contains(&rel) {
                                        pending.push(rel);
                                    }
                                }
                            }
                        }
                    }
                    Ok(Err(_)) | Err(mpsc::RecvTimeoutError::Disconnected) => return,
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        if !pending.is_empty() {
                            let paths = std::mem::take(&mut pending);
                            emit.lock().unwrap()(WatchEvent::Changed { paths });
                        }
                    }
                }
            }
        })
    };
    Ok((stop, thread))
}

/// Start (or re-attach to) the file watcher of a project. Watching only reports; it never modifies.
#[tauri::command]
pub async fn start_preview_watch(
    project_dir: String,
    on_event: tauri::ipc::Channel<WatchEvent>,
) -> Result<(), String> {
    let raw = project_dir.clone();
    let dir = verified_project_dir(&project_dir)?;
    tauri::async_runtime::spawn_blocking(move || {
        let emit: WatchEmit = Arc::new(move |e| {
            let _ = on_event.send(e);
        });
        {
            let map = WATCHERS.lock().unwrap();
            if let Some(entry) = map.get(&dir) {
                *entry.emit.lock().unwrap() = emit;
                return Ok(());
            }
        }
        let raw_root = PathBuf::from(raw);
        // Canonicalize for stable prefix stripping; fall back to the verified path.
        let root = dir.canonicalize().unwrap_or_else(|_| dir.clone());
        let shared: SharedEmit = Arc::new(Mutex::new(emit));
        let (stop, thread) = spawn_watcher(root, raw_root, shared.clone())?;
        WATCHERS.lock().unwrap().insert(dir, WatchEntry { emit: shared, thread: Some(thread), stop });
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|r| r)
}

/// Stop the file watcher of a project (project switch or close). Unknown projects are a no-op.
#[tauri::command]
pub async fn stop_preview_watch(project_dir: String) -> Result<(), String> {
    let dir = verified_project_dir(&project_dir)?;
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(mut entry) = WATCHERS.lock().unwrap().remove(&dir) {
            entry.stop.store(true, Ordering::SeqCst);
            if let Some(t) = entry.thread.take() {
                let _ = t.join();
            }
        }
    })
    .await
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod watch_tests {
    use super::*;
    use std::io::Write;

    fn roots(dir: &Path) -> (PathBuf, PathBuf) {
        let root = dir.canonicalize().unwrap_or_else(|_| dir.to_path_buf());
        (root, dir.to_path_buf())
    }

    #[test]
    fn reports_files_with_forward_slashes() {
        let tmp = tempfile::tempdir().unwrap();
        let (root, raw) = roots(tmp.path());
        let src = tmp.path().join("src").join("scene.tsx");
        std::fs::create_dir_all(src.parent().unwrap()).unwrap();
        std::fs::write(&src, "x").unwrap();
        assert_eq!(relative_source_path(&root, &raw, &src).as_deref(), Some("src/scene.tsx"));
    }

    #[test]
    fn ignores_deps_build_output_vcs_app_state_dirs_and_outsiders() {
        let tmp = tempfile::tempdir().unwrap();
        let (root, raw) = roots(tmp.path());
        for rel in ["node_modules/a.js", "dist/b.js", ".git/c", ".vanilla/d.json"] {
            let p = tmp.path().join(rel);
            std::fs::create_dir_all(p.parent().unwrap()).unwrap();
            std::fs::write(&p, "x").unwrap();
            assert_eq!(relative_source_path(&root, &raw, &p), None, "{rel}");
        }
        let outside = tmp.path().join("..").join("outside.js");
        assert_eq!(relative_source_path(&root, &raw, &outside), None);
    }

    #[test]
    fn skips_directories_and_missing_files() {
        let tmp = tempfile::tempdir().unwrap();
        let (root, raw) = roots(tmp.path());
        let dir = tmp.path().join("src");
        std::fs::create_dir_all(&dir).unwrap();
        assert_eq!(relative_source_path(&root, &raw, &dir), None);
        assert_eq!(relative_source_path(&root, &raw, &tmp.path().join("gone.tsx")), None);
    }

    #[test]
    fn batches_rapid_writes_into_changed_events() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap_or_else(|_| tmp.path().to_path_buf());
        let raw = tmp.path().to_path_buf();
        let events = Arc::new(Mutex::new(Vec::<WatchEvent>::new()));
        let sink = events.clone();
        let shared: SharedEmit = Arc::new(Mutex::new(Arc::new(move |e| sink.lock().unwrap().push(e))));
        let (stop, thread) = spawn_watcher(root, raw, shared).unwrap();
        let target = tmp.path().join("src").join("app.tsx");
        std::fs::create_dir_all(target.parent().unwrap()).unwrap();
        // S4 pattern: the same module written ~30ms apart, several times in a row.
        for i in 0..5 {
            let mut f = std::fs::File::create(&target).unwrap();
            writeln!(f, "// rev {i}").unwrap();
            std::thread::sleep(Duration::from_millis(30));
        }
        let deadline = std::time::Instant::now() + Duration::from_secs(10);
        let seen = loop {
            {
                let evs = events.lock().unwrap();
                if evs.iter().any(|e| matches!(e, WatchEvent::Changed { paths } if paths.contains(&"src/app.tsx".to_string()))) {
                    break true;
                }
            }
            if std::time::Instant::now() > deadline {
                break false;
            }
            std::thread::sleep(Duration::from_millis(50));
        };
        stop.store(true, Ordering::SeqCst);
        let _ = thread.join();
        assert!(seen, "expected a Changed batch for src/app.tsx, got {:?}", events.lock().unwrap());
    }
}

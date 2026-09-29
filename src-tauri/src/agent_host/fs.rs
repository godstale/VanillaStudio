//! Handlers for the agent's `fs/read_text_file` and `fs/write_text_file` requests.
//!
//! Every path goes through `resolve_and_verify_workspace_path` (canonicalize, symlink safe) with
//! the session's project folder as the root. This is the defence line for agents that use the fs
//! capability; Claude Code uses its own tools instead (PoC S3), see `permission.rs`.

use crate::commands::fs_commands::resolve_and_verify_workspace_path;
use std::path::Path;

/// Largest file the agent may read through the fs capability.
pub const MAX_READ_BYTES: u64 = 8 * 1024 * 1024;

fn resolve(root: &Path, requested: &Path, must_exist: bool) -> Result<std::path::PathBuf, String> {
    let root_str = root.to_str().filter(|s| !s.trim().is_empty()).ok_or("invalid project root")?;
    resolve_and_verify_workspace_path(&requested.to_string_lossy(), Some(root_str), must_exist)
}

/// Read a text file. `line` is 1-based, `limit` is a number of lines.
pub fn read_text_file(root: &Path, requested: &Path, line: Option<u32>, limit: Option<u32>) -> Result<String, String> {
    let path = resolve(root, requested, true)?;
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if !meta.is_file() {
        return Err("not a file".into());
    }
    if meta.len() > MAX_READ_BYTES {
        return Err("file too large".into());
    }
    let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    if line.is_none() && limit.is_none() {
        return Ok(text);
    }
    let skip = line.unwrap_or(1).saturating_sub(1) as usize;
    let take = limit.map_or(usize::MAX, |l| l as usize);
    Ok(text.split_inclusive('\n').skip(skip).take(take).collect())
}

/// Write a text file inside the project. Parent folders are not created.
pub fn write_text_file(root: &Path, requested: &Path, content: &str) -> Result<(), String> {
    let path = resolve(root, requested, false)?;
    let protected = root.canonicalize().map_err(|e| e.to_string())?.join(crate::agent_host::permission::PROTECTED_DIR);
    if path.starts_with(&protected) {
        return Err("protected app folder".into());
    }
    if path.is_dir() {
        return Err("is a directory".into());
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Rig {
        _dir: tempfile::TempDir,
        root: std::path::PathBuf,
        outside_dir: std::path::PathBuf,
        outside_file: std::path::PathBuf,
    }

    fn rig() -> Rig {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().canonicalize().unwrap();
        let root = base.join("project");
        std::fs::create_dir_all(root.join("sub")).unwrap();
        std::fs::write(root.join("notes.txt"), "one\ntwo\nthree\n").unwrap();
        let outside_dir = base.join("elsewhere");
        std::fs::create_dir_all(&outside_dir).unwrap();
        let outside_file = outside_dir.join("secret.txt");
        std::fs::write(&outside_file, "secret").unwrap();
        Rig { _dir: dir, root, outside_dir, outside_file }
    }

    /// A directory link inside the project pointing outside (junction on Windows, symlink elsewhere).
    fn link_dir(link: &Path, target: &Path) -> bool {
        #[cfg(windows)]
        {
            std::process::Command::new("cmd").args(["/C", "mklink", "/J"]).arg(link).arg(target).output().map(|o| o.status.success()).unwrap_or(false)
        }
        #[cfg(not(windows))]
        {
            std::os::unix::fs::symlink(target, link).is_ok()
        }
    }

    #[test]
    fn reads_inside_the_project_absolute_and_relative() {
        let r = rig();
        assert_eq!(read_text_file(&r.root, &r.root.join("notes.txt"), None, None).unwrap(), "one\ntwo\nthree\n");
        assert_eq!(read_text_file(&r.root, Path::new("notes.txt"), None, None).unwrap(), "one\ntwo\nthree\n");
    }

    #[test]
    fn line_and_limit_select_a_window() {
        let r = rig();
        let p = r.root.join("notes.txt");
        assert_eq!(read_text_file(&r.root, &p, Some(2), None).unwrap(), "two\nthree\n");
        assert_eq!(read_text_file(&r.root, &p, Some(2), Some(1)).unwrap(), "two\n");
        assert_eq!(read_text_file(&r.root, &p, None, Some(1)).unwrap(), "one\n");
    }

    #[test]
    fn reads_outside_the_project_are_denied() {
        let r = rig();
        let err = read_text_file(&r.root, &r.outside_file, None, None).unwrap_err();
        assert!(err.contains("outside workspace"), "{err}");
        assert!(read_text_file(&r.root, Path::new("../elsewhere/secret.txt"), None, None).is_err());
        assert!(read_text_file(&r.root, Path::new("sub/../../elsewhere/secret.txt"), None, None).is_err());
    }

    #[test]
    fn writes_outside_the_project_are_denied_and_nothing_is_written() {
        let r = rig();
        assert!(write_text_file(&r.root, &r.outside_dir.join("new.txt"), "x").is_err());
        assert!(!r.outside_dir.join("new.txt").exists());
        assert!(write_text_file(&r.root, &r.outside_file, "overwritten").is_err());
        assert_eq!(std::fs::read_to_string(&r.outside_file).unwrap(), "secret");
        assert!(write_text_file(&r.root, Path::new("../escape.txt"), "x").is_err());
        assert!(write_text_file(&r.root, Path::new("new-dir/../../escape.txt"), "x").is_err());
        assert!(!r.root.parent().unwrap().join("escape.txt").exists());
        // a not-yet-existing outside directory is denied through its nearest existing ancestor
        assert!(write_text_file(&r.root, &r.outside_dir.join("a/b/c.txt"), "x").is_err());
    }

    #[test]
    fn writes_inside_the_project_work() {
        let r = rig();
        write_text_file(&r.root, &r.root.join("sub/out.txt"), "hello").unwrap();
        assert_eq!(std::fs::read_to_string(r.root.join("sub/out.txt")).unwrap(), "hello");
        write_text_file(&r.root, Path::new("rel.txt"), "rel").unwrap();
        assert_eq!(std::fs::read_to_string(r.root.join("rel.txt")).unwrap(), "rel");
        write_text_file(&r.root, Path::new("rel.txt"), "again").unwrap();
        assert_eq!(std::fs::read_to_string(r.root.join("rel.txt")).unwrap(), "again");
    }

    #[test]
    fn links_that_point_outside_are_followed_and_denied() {
        let r = rig();
        let link = r.root.join("escape");
        if !link_dir(&link, &r.outside_dir) {
            eprintln!("SKIP: cannot create a directory link here");
            return;
        }
        assert!(read_text_file(&r.root, Path::new("escape/secret.txt"), None, None).is_err());
        assert!(read_text_file(&r.root, &link.join("secret.txt"), None, None).is_err());
        assert!(write_text_file(&r.root, Path::new("escape/planted.txt"), "x").is_err());
        assert!(write_text_file(&r.root, Path::new("escape/new-dir/planted.txt"), "x").is_err());
        assert!(!r.outside_dir.join("planted.txt").exists());
    }

    #[test]
    fn app_state_folder_is_not_writable() {
        let r = rig();
        std::fs::create_dir_all(r.root.join(".vanilla")).unwrap();
        assert_eq!(write_text_file(&r.root, Path::new(".vanilla/app.db"), "x").unwrap_err(), "protected app folder");
        assert!(write_text_file(&r.root, Path::new(".vanilla/sessions/s.jsonl"), "x").is_err());
        assert!(!r.root.join(".vanilla/app.db").exists());
    }

    #[test]
    fn directories_and_oversized_files_are_rejected() {
        let r = rig();
        assert!(read_text_file(&r.root, &r.root.join("sub"), None, None).is_err());
        assert!(write_text_file(&r.root, &r.root.join("sub"), "x").is_err());
        let big = r.root.join("big.txt");
        let f = std::fs::File::create(&big).unwrap();
        f.set_len(MAX_READ_BYTES + 1).unwrap();
        assert_eq!(read_text_file(&r.root, &big, None, None).unwrap_err(), "file too large");
        assert!(read_text_file(&r.root, &r.root.join("missing.txt"), None, None).is_err());
    }

    #[test]
    fn an_empty_root_is_refused() {
        assert!(read_text_file(Path::new(""), Path::new("x"), None, None).is_err());
        assert!(write_text_file(Path::new(" "), Path::new("x"), "x").is_err());
    }
}

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
    if path.is_dir() {
        return Err("is a directory".into());
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

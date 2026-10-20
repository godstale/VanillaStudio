use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, Runtime};

/// Canonical directory to open in the asset protocol scope, or None when `path` is not a directory.
pub fn asset_scope_dir(path: &str) -> Option<PathBuf> {
    Path::new(path).canonicalize().ok().filter(|p| p.is_dir())
}

/// Allow the asset protocol (ImageViewerTab) to read the active workspace folder (Technical-Design §10).
/// tauri offers no way to revoke an allowed directory (`forbid_directory` is permanent and would block
/// reopening the workspace), so folders opened earlier in this session stay readable until restart.
pub fn allow_project_assets<R: Runtime>(app: &AppHandle<R>, path: &str) -> Result<(), String> {
    let dir = asset_scope_dir(path).ok_or_else(|| format!("Not a directory: {path}"))?;
    app.asset_protocol_scope()
        .allow_directory(dir, true)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn asset_scope_dir_accepts_only_directories() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(asset_scope_dir(tmp.path().to_str().unwrap()).is_some());
        let file = tmp.path().join("f.txt");
        fs::write(&file, "x").unwrap();
        assert!(asset_scope_dir(file.to_str().unwrap()).is_none());
        assert!(asset_scope_dir(tmp.path().join("missing").to_str().unwrap()).is_none());
    }
}

//! `snapshot_scene` logic: serve the latest Bridge capture the host saved under
//! `reviews/` (T4.18) so the agent can visually self-review (D-014).
//!
//! Headless Chrome capture itself belongs to the export worker (T5.4); the MCP
//! server has no browser. The flow is: host `capture()` → T4.18 saves
//! `reviews/R-NNN.png` → this tool reads the PNG back and hands the agent a
//! `data:image/png;base64` URL plus integrity metadata. When no capture exists
//! the tool says so instead of inventing pixels.

use std::path::{Path, PathBuf};

use serde::Serialize;

const PNG_MAGIC: &[u8] = b"\x89PNG\r\n\x1a\n";
const MAX_PNG_BYTES: u64 = 10 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CapturePayload {
    pub name: String,
    pub data_url: String,
    pub size_bytes: u64,
    pub sha256: String,
}

/// Capture PNGs under `<root>/reviews`, oldest first.
pub fn list_captures(root: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir(root.join("reviews")) else {
        return out;
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let p = entry.path();
        if p.is_file()
            && p.extension().and_then(|e| e.to_str()).is_some_and(|e| e.eq_ignore_ascii_case("png"))
        {
            out.push(p);
        }
    }
    out.sort();
    out
}

fn capture_name_valid(name: &str) -> bool {
    // One plain file name, PNG only: no directories, no escapes.
    !name.is_empty()
        && name.len() <= 100
        && name.to_ascii_lowercase().ends_with(".png")
        && !name.contains(['/', '\\'])
        && !name.contains("..")
        && Path::new(name).components().count() == 1
}

fn read_png(path: &Path) -> Result<(u64, String, String), String> {
    let meta = std::fs::metadata(path).map_err(|e| format!("Cannot read {}: {e}", path.display()))?;
    if meta.len() > MAX_PNG_BYTES {
        return Err(format!("Capture too large ({} bytes, max 10 MiB)", meta.len()));
    }
    let bytes = std::fs::read(path).map_err(|e| format!("Cannot read {}: {e}", path.display()))?;
    if bytes.len() < PNG_MAGIC.len() || &bytes[..PNG_MAGIC.len()] != PNG_MAGIC {
        return Err(format!("Not a PNG file: {}", path.display()));
    }
    let mut hasher = <sha2::Sha256 as sha2::Digest>::new();
    use sha2::Digest as _;
    hasher.update(&bytes);
    let sha256 = hex::encode(hasher.finalize());
    let data_url = format!("data:image/png;base64,{}", base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &bytes,
    ));
    Ok((bytes.len() as u64, data_url, sha256))
}

/// Read one capture. `name` selects `reviews/<name>`; without it the newest
/// capture is served. Errors name the recovery (`capture` in the review UI).
pub fn read_capture(root: &Path, name: Option<&str>) -> Result<CapturePayload, String> {
    let path = match name {
        Some(n) => {
            if !capture_name_valid(n) {
                return Err(format!("Invalid capture name: {n:?}"));
            }
            let p = root.join("reviews").join(n);
            if !p.is_file() {
                return Err(format!("No such capture: reviews/{n}"));
            }
            p
        }
        None => list_captures(root)
            .pop()
            .ok_or_else(|| {
                "No captures yet. Ask the host to take one (review UI capture), then call again.".to_string()
            })?,
    };
    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("capture.png").to_string();
    let (size_bytes, data_url, sha256) = read_png(&path)?;
    Ok(CapturePayload { name: file_name, data_url, size_bytes, sha256 })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Minimal 1x1 PNG (opaque red) for fixtures.
    const TINY_PNG: &[u8] = &[
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90,
        0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8,
        0xcf, 0xc0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ];

    fn root_with(captures: &[(&str, &[u8])]) -> tempfile::TempDir {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir_all(tmp.path().join("reviews")).unwrap();
        for (name, bytes) in captures {
            fs::write(tmp.path().join("reviews").join(name), bytes).unwrap();
        }
        tmp
    }

    #[test]
    fn serves_newest_capture_by_default() {
        let tmp = root_with(&[("R-001.png", TINY_PNG), ("R-002.png", TINY_PNG)]);
        let names: Vec<_> =
            list_captures(tmp.path()).iter().map(|p| p.file_name().unwrap().to_owned()).collect();
        assert_eq!(names.len(), 2);
        let cap = read_capture(tmp.path(), None).unwrap();
        assert_eq!(cap.name, "R-002.png");
        assert!(cap.data_url.starts_with("data:image/png;base64,"));
        assert_eq!(cap.size_bytes, TINY_PNG.len() as u64);
        assert_eq!(cap.sha256.len(), 64);
    }

    #[test]
    fn named_capture_and_rejections() {
        let tmp = root_with(&[("R-001.png", TINY_PNG)]);
        assert_eq!(read_capture(tmp.path(), Some("R-001.png")).unwrap().name, "R-001.png");
        assert!(read_capture(tmp.path(), Some("missing.png")).is_err());
        for bad in ["../x.png", "a/b.png", "x.jpg", ""] {
            assert!(read_capture(tmp.path(), Some(bad)).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn rejects_non_png_and_empty_reviews() {
        let tmp = root_with(&[("fake.png", b"not a png")]);
        assert!(read_capture(tmp.path(), Some("fake.png")).is_err());
        let empty = tempfile::tempdir().unwrap();
        fs::create_dir_all(empty.path().join("reviews")).unwrap();
        assert!(read_capture(empty.path(), None).is_err());
    }
}

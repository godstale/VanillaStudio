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

/// Capture PNGs under `<root>/reviews`, oldest first (`.png` binaries and the
/// host's `.png.b64` base64 sidecars).
pub fn list_captures(root: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir(root.join("reviews")) else {
        return out;
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let p = entry.path();
        let lower = p.file_name().and_then(|n| n.to_str()).map(str::to_ascii_lowercase).unwrap_or_default();
        if p.is_file() && (lower.ends_with(".png") || lower.ends_with(".png.b64")) {
            out.push(p);
        }
    }
    out.sort();
    out
}

fn capture_name_valid(name: &str) -> bool {
    // One plain file name, PNG only: no directories, no escapes. The `.png.b64`
    // suffix is the host's base64 sidecar (T4.18: the WebView cannot write
    // binary files, so the PNG bytes travel as base64 text).
    !name.is_empty()
        && name.len() <= 110
        && (name.to_ascii_lowercase().ends_with(".png")
            || name.to_ascii_lowercase().ends_with(".png.b64"))
        && !name.contains(['/', '\\'])
        && !name.contains("..")
        && Path::new(name).components().count() == 1
}

fn png_payload(file_name: &str, bytes: &[u8]) -> Result<CapturePayload, String> {
    if bytes.len() < PNG_MAGIC.len() || &bytes[..PNG_MAGIC.len()] != PNG_MAGIC {
        return Err(format!("Not a PNG file: {file_name}"));
    }
    let mut hasher = <sha2::Sha256 as sha2::Digest>::new();
    use sha2::Digest as _;
    hasher.update(bytes);
    let sha256 = hex::encode(hasher.finalize());
    let data_url = format!("data:image/png;base64,{}", base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        bytes,
    ));
    Ok(CapturePayload {
        name: file_name.to_string(),
        data_url,
        size_bytes: bytes.len() as u64,
        sha256,
    })
}

fn read_png_file(path: &Path) -> Result<CapturePayload, String> {
    let meta = std::fs::metadata(path).map_err(|e| format!("Cannot read {}: {e}", path.display()))?;
    if meta.len() > MAX_PNG_BYTES {
        return Err(format!("Capture too large ({} bytes, max 10 MiB)", meta.len()));
    }
    let bytes = std::fs::read(path).map_err(|e| format!("Cannot read {}: {e}", path.display()))?;
    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("capture.png");
    png_payload(file_name, &bytes)
}

fn read_b64_file(path: &Path, display_name: &str) -> Result<CapturePayload, String> {
    let meta = std::fs::metadata(path).map_err(|e| format!("Cannot read {}: {e}", path.display()))?;
    if meta.len() > MAX_PNG_BYTES {
        return Err(format!("Capture too large ({} bytes, max 10 MiB)", meta.len()));
    }
    let text = std::fs::read_to_string(path).map_err(|e| format!("Cannot read {}: {e}", path.display()))?;
    let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, text.trim())
        .map_err(|e| format!("Capture is not valid base64: {e}"))?;
    png_payload(display_name, &bytes)
}

/// Read one capture. `name` selects `reviews/<name>` (`R-001.png` also finds
/// the host's `R-001.png.b64` sidecar); without it the newest capture is
/// served. Errors name the recovery (`capture` in the review UI).
pub fn read_capture(root: &Path, name: Option<&str>) -> Result<CapturePayload, String> {
    let path = match name {
        Some(n) => {
            if !capture_name_valid(n) {
                return Err(format!("Invalid capture name: {n:?}"));
            }
            let p = root.join("reviews").join(n);
            if p.is_file() {
                p
            } else if n.to_ascii_lowercase().ends_with(".png") {
                // Prefer the binary, fall back to the host sidecar.
                let sidecar = root.join("reviews").join(format!("{n}.b64"));
                if sidecar.is_file() {
                    let display = sidecar
                        .file_name()
                        .and_then(|f| f.to_str())
                        .and_then(|f| f.strip_suffix(".b64"))
                        .unwrap_or(n)
                        .to_string();
                    return read_b64_file(&sidecar, &display);
                }
                return Err(format!("No such capture: reviews/{n}"));
            } else {
                return Err(format!("No such capture: reviews/{n}"));
            }
        }
        None => list_captures(root)
            .pop()
            .ok_or_else(|| {
                "No captures yet. Ask the host to take one (review UI capture), then call again.".to_string()
            })?,
    };
    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("capture.png.b64");
    let lower = file_name.to_ascii_lowercase();
    if lower.ends_with(".png.b64") {
        // Display the `.png` name the review file references (keep its case).
        let cut = file_name.len() - ".b64".len();
        return read_b64_file(&path, &file_name[..cut]);
    }
    read_png_file(&path)
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

    #[test]
    fn serves_host_base64_sidecar() {
        // T4.18 sidecar: the WebView stores PNG bytes as base64 text.
        use base64::Engine as _;
        let b64 = base64::engine::general_purpose::STANDARD.encode(TINY_PNG);
        let tmp = root_with(&[("R-001.png.b64", b64.as_bytes())]);
        // By the `.png` name (what the review file references)…
        let cap = read_capture(tmp.path(), Some("R-001.png")).unwrap();
        assert_eq!(cap.name, "R-001.png");
        assert!(cap.data_url.starts_with("data:image/png;base64,"));
        // …by the sidecar name, and as the newest capture.
        assert_eq!(read_capture(tmp.path(), Some("R-001.png.b64")).unwrap().name, "R-001.png");
        assert_eq!(read_capture(tmp.path(), None).unwrap().name, "R-001.png");
        let names: Vec<String> = list_captures(tmp.path())
            .iter()
            .map(|p| p.file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec!["R-001.png.b64".to_string()]);
    }
}

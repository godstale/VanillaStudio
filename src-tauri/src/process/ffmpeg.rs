//! Managed FFmpeg download (Technical-Design §2.4 "FFmpeg 다운로드", S6).
//!
//! BtbN GitHub release -> win64 GPL zip of the pinned major -> SHA-256 check -> extract only
//! `ffmpeg.exe`/`ffprobe.exe`/`LICENSE.txt` into `<app data>/tools/ffmpeg/` -> record asset + hash.
//! A hash mismatch or a cancel deletes the partial download.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

/// FFmpeg major line validated in S1. Output bytes differ between majors, so golden tests pin it.
pub const PINNED_MAJOR: u32 = 8;
pub const RELEASE_API: &str = "https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest";
pub const RECORD_FILE: &str = "ffmpeg.json";
const WANTED_BINS: [&str; 2] = ["ffmpeg.exe", "ffprobe.exe"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Asset {
    pub name: String,
    pub url: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "stage", rename_all = "camelCase")]
pub enum FfmpegEvent {
    Selected { asset: String, bytes: u64 },
    Download { done: u64, total: u64 },
    Verified { sha256: String },
    Extracted { files: Vec<String> },
}

/// What is stored next to the binaries so a later run can tell exactly what is installed.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstallRecord {
    pub asset: String,
    pub sha256: String,
    pub major: u32,
    pub installed_at_unix: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FfmpegError {
    Cancelled,
    HashMismatch { expected: String, actual: String },
    Other(String),
}

impl std::fmt::Display for FfmpegError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FfmpegError::Cancelled => write!(f, "cancelled"),
            FfmpegError::HashMismatch { expected, actual } => write!(f, "sha256 mismatch: expected {expected}, got {actual}"),
            FfmpegError::Other(e) => write!(f, "{e}"),
        }
    }
}

fn other<E: std::fmt::Display>(e: E) -> FfmpegError {
    FfmpegError::Other(e.to_string())
}

/// Pick the win64 GPL (libx264 is GPL) static zip of `major` from a GitHub release JSON.
pub fn pick_asset(release: &serde_json::Value, major: u32) -> Result<Asset, String> {
    let wanted = format!("ffmpeg-n{major}.");
    release["assets"]
        .as_array()
        .ok_or("release has no assets")?
        .iter()
        .filter_map(|a| {
            let name = a["name"].as_str()?;
            let rest = name.strip_prefix(&wanted)?.strip_suffix(".zip")?;
            if !rest.contains("-latest-win64-gpl-") || rest.contains("shared") {
                return None;
            }
            Some(Asset { name: name.into(), url: a["browser_download_url"].as_str()?.into(), size: a["size"].as_u64().unwrap_or(0) })
        })
        .max_by(|a, b| a.name.cmp(&b.name))
        .ok_or_else(|| format!("no win64 gpl asset for FFmpeg {major}.x"))
}

/// Find `<asset>` in a `checksums.sha256` body (`<hex>  <name>` lines, name may be `*`-prefixed).
pub fn expected_sha256(sums: &str, asset: &str) -> Option<String> {
    sums.lines().find_map(|l| {
        let mut it = l.split_whitespace();
        let (hash, name) = (it.next()?, it.next()?);
        (name.trim_start_matches('*') == asset && hash.len() == 64).then(|| hash.to_lowercase())
    })
}

fn client() -> Result<reqwest::blocking::Client, FfmpegError> {
    reqwest::blocking::Client::builder()
        .user_agent("vanilla-studio")
        .connect_timeout(Duration::from_secs(30))
        .timeout(Duration::from_secs(30 * 60))
        .build()
        .map_err(other)
}

/// Stream `url` to `dest`, hashing on the fly. On mismatch or cancel the file is deleted.
pub fn download_verified(
    client: &reqwest::blocking::Client,
    url: &str,
    expected: &str,
    dest: &Path,
    total: u64,
    cancel: &AtomicBool,
    emit: &mut dyn FnMut(FfmpegEvent),
) -> Result<String, FfmpegError> {
    let mut resp = client.get(url).send().and_then(|r| r.error_for_status()).map_err(other)?;
    let total = resp.content_length().unwrap_or(total);
    let mut file = std::fs::File::create(dest).map_err(other)?;
    let result = (|| {
        let mut hasher = Sha256::new();
        let mut buf = vec![0u8; 1 << 20];
        let (mut done, mut last) = (0u64, Instant::now());
        loop {
            if cancel.load(Ordering::SeqCst) {
                return Err(FfmpegError::Cancelled);
            }
            let n = resp.read(&mut buf).map_err(other)?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
            file.write_all(&buf[..n]).map_err(other)?;
            done += n as u64;
            if last.elapsed() > Duration::from_millis(250) {
                emit(FfmpegEvent::Download { done, total });
                last = Instant::now();
            }
        }
        emit(FfmpegEvent::Download { done, total });
        file.flush().map_err(other)?;
        let actual = hex::encode(hasher.finalize());
        if actual != expected.to_lowercase() {
            return Err(FfmpegError::HashMismatch { expected: expected.to_lowercase(), actual });
        }
        Ok(actual)
    })();
    drop(file);
    if result.is_err() {
        let _ = std::fs::remove_file(dest);
    }
    result
}

/// Extract only the wanted binaries and the license, flat into `dest`. Staged in a temp
/// subfolder first so a failed extraction never leaves a half-replaced install.
pub fn extract_tools(zip_path: &Path, dest: &Path) -> Result<Vec<String>, FfmpegError> {
    let stage = dest.join(".extract");
    let _ = std::fs::remove_dir_all(&stage);
    std::fs::create_dir_all(&stage).map_err(other)?;
    let run = || -> Result<Vec<String>, FfmpegError> {
        let mut archive = zip::ZipArchive::new(std::fs::File::open(zip_path).map_err(other)?).map_err(other)?;
        let mut files = vec![];
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i).map_err(other)?;
            // enclosed_name rejects `..` and absolute paths (zip-slip).
            let Some(rel) = entry.enclosed_name() else { continue };
            let fname = rel.file_name().map(|f| f.to_string_lossy().into_owned()).unwrap_or_default();
            let in_bin = rel.components().any(|c| c.as_os_str() == "bin");
            if !((in_bin && WANTED_BINS.contains(&fname.as_str())) || fname == "LICENSE.txt") {
                continue;
            }
            let mut out = std::fs::File::create(stage.join(&fname)).map_err(other)?;
            std::io::copy(&mut entry, &mut out).map_err(other)?;
            files.push(fname);
        }
        for bin in WANTED_BINS {
            if !files.iter().any(|f| f == bin) {
                return Err(FfmpegError::Other(format!("{bin} not found in archive")));
            }
        }
        for f in &files {
            let target = dest.join(f);
            let _ = std::fs::remove_file(&target);
            std::fs::rename(stage.join(f), &target).map_err(other)?;
        }
        Ok(files)
    };
    let result = run();
    let _ = std::fs::remove_dir_all(&stage);
    result
}

pub fn read_record(dest: &Path) -> Option<InstallRecord> {
    serde_json::from_str(&std::fs::read_to_string(dest.join(RECORD_FILE)).ok()?).ok()
}

/// Full install into `dest`. Returns the asset + hash record that was written.
pub fn install(dest: &Path, major: u32, cancel: &AtomicBool, emit: &mut dyn FnMut(FfmpegEvent)) -> Result<InstallRecord, FfmpegError> {
    let client = client()?;
    let release: serde_json::Value = client
        .get(RELEASE_API)
        .send()
        .and_then(|r| r.error_for_status())
        .and_then(|r| r.json())
        .map_err(|e| FfmpegError::Other(format!("release lookup: {e}")))?;
    let asset = pick_asset(&release, major).map_err(FfmpegError::Other)?;
    let sums_url = release["assets"]
        .as_array()
        .and_then(|a| a.iter().find(|a| a["name"] == "checksums.sha256"))
        .and_then(|a| a["browser_download_url"].as_str())
        .ok_or_else(|| FfmpegError::Other("no checksums.sha256 in release".into()))?;
    let sums = client.get(sums_url).send().and_then(|r| r.error_for_status()).and_then(|r| r.text()).map_err(other)?;
    let expected = expected_sha256(&sums, &asset.name).ok_or_else(|| FfmpegError::Other("checksum missing for asset".into()))?;
    emit(FfmpegEvent::Selected { asset: asset.name.clone(), bytes: asset.size });

    std::fs::create_dir_all(dest).map_err(other)?;
    let zip_path: PathBuf = dest.join(format!("{}.part", asset.name));
    let sha256 = download_verified(&client, &asset.url, &expected, &zip_path, asset.size, cancel, emit)?;
    emit(FfmpegEvent::Verified { sha256: sha256.clone() });

    let extracted = extract_tools(&zip_path, dest);
    let _ = std::fs::remove_file(&zip_path);
    emit(FfmpegEvent::Extracted { files: extracted? });

    let record = InstallRecord {
        asset: asset.name,
        sha256,
        major,
        installed_at_unix: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0),
    };
    std::fs::write(dest.join(RECORD_FILE), serde_json::to_string_pretty(&record).map_err(other)?).map_err(other)?;
    Ok(record)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;

    fn release_json() -> serde_json::Value {
        let a = |n: &str| serde_json::json!({ "name": n, "browser_download_url": format!("https://x/{n}"), "size": 10 });
        serde_json::json!({ "assets": [
            a("checksums.sha256"),
            a("ffmpeg-master-latest-win64-gpl.zip"),
            a("ffmpeg-n9.0-latest-win64-gpl-9.0.zip"),
            a("ffmpeg-n8.1-latest-win64-gpl-8.1.zip"),
            a("ffmpeg-n8.1-latest-win64-gpl-shared-8.1.zip"),
            a("ffmpeg-n8.1-latest-win64-lgpl-8.1.zip"),
            a("ffmpeg-n8.1-latest-linux64-gpl-8.1.tar.xz"),
        ]})
    }

    #[test]
    fn picks_pinned_major_gpl_static_only() {
        assert_eq!(pick_asset(&release_json(), 8).unwrap().name, "ffmpeg-n8.1-latest-win64-gpl-8.1.zip");
        assert_eq!(pick_asset(&release_json(), 9).unwrap().name, "ffmpeg-n9.0-latest-win64-gpl-9.0.zip");
        assert!(pick_asset(&release_json(), 7).is_err());
        assert!(pick_asset(&serde_json::json!({}), 8).is_err());
    }

    #[test]
    fn checksum_lookup() {
        let h = "a".repeat(64);
        let sums = format!("{h}  ffmpeg-n8.1-latest-win64-gpl-8.1.zip\n{}  *other.zip\nbad  short.zip\n", "B".repeat(64));
        assert_eq!(expected_sha256(&sums, "ffmpeg-n8.1-latest-win64-gpl-8.1.zip"), Some(h));
        assert_eq!(expected_sha256(&sums, "other.zip"), Some("b".repeat(64)));
        assert_eq!(expected_sha256(&sums, "short.zip"), None);
        assert_eq!(expected_sha256(&sums, "missing.zip"), None);
    }

    /// One-shot local HTTP server that serves `body` to every connection.
    fn serve(body: Vec<u8>) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let mut s = stream;
                let mut req = [0u8; 1024];
                let _ = s.read(&mut req);
                let _ = write!(s, "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len());
                let _ = s.write_all(&body);
            }
        });
        format!("http://{addr}/f.zip")
    }

    fn sha(bytes: &[u8]) -> String {
        hex::encode(Sha256::digest(bytes))
    }

    #[test]
    fn download_ok_reports_hash_and_progress() {
        let body = vec![7u8; 3 << 20];
        let url = serve(body.clone());
        let d = tempfile::tempdir().unwrap();
        let dest = d.path().join("f.zip");
        let mut events = vec![];
        let got = download_verified(&client().unwrap(), &url, &sha(&body), &dest, 0, &AtomicBool::new(false), &mut |e| events.push(e)).unwrap();
        assert_eq!(got, sha(&body));
        assert_eq!(std::fs::read(&dest).unwrap(), body);
        assert!(matches!(events.last(), Some(FfmpegEvent::Download { done, .. }) if *done == body.len() as u64));
    }

    #[test]
    fn hash_mismatch_deletes_download() {
        let body = vec![1u8; 4096];
        let url = serve(body);
        let d = tempfile::tempdir().unwrap();
        let dest = d.path().join("f.zip");
        let err = download_verified(&client().unwrap(), &url, &"0".repeat(64), &dest, 0, &AtomicBool::new(false), &mut |_| {}).unwrap_err();
        assert!(matches!(err, FfmpegError::HashMismatch { .. }), "{err:?}");
        assert!(!dest.exists(), "mismatching download must be deleted");
    }

    #[test]
    fn cancel_deletes_partial_download() {
        let body = vec![1u8; 4096];
        let url = serve(body.clone());
        let d = tempfile::tempdir().unwrap();
        let dest = d.path().join("f.zip");
        let err = download_verified(&client().unwrap(), &url, &sha(&body), &dest, 0, &AtomicBool::new(true), &mut |_| {}).unwrap_err();
        assert_eq!(err, FfmpegError::Cancelled);
        assert!(!dest.exists());
    }

    fn make_zip(path: &Path, entries: &[(&str, &[u8])]) {
        let mut w = zip::ZipWriter::new(std::fs::File::create(path).unwrap());
        for (name, data) in entries {
            w.start_file(*name, zip::write::SimpleFileOptions::default()).unwrap();
            w.write_all(data).unwrap();
        }
        w.finish().unwrap();
    }

    #[test]
    fn extracts_only_wanted_files_flat() {
        let d = tempfile::tempdir().unwrap();
        let zip_path = d.path().join("a.zip");
        make_zip(&zip_path, &[
            ("ffmpeg-n8.1/bin/ffmpeg.exe", b"F"),
            ("ffmpeg-n8.1/bin/ffprobe.exe", b"P"),
            ("ffmpeg-n8.1/bin/ffplay.exe", b"X"),
            ("ffmpeg-n8.1/LICENSE.txt", b"L"),
            ("ffmpeg-n8.1/doc/readme.txt", b"D"),
            ("../evil.exe", b"E"),
        ]);
        let dest = d.path().join("out");
        std::fs::create_dir_all(&dest).unwrap();
        std::fs::write(dest.join("ffmpeg.exe"), "old").unwrap();
        let mut files = extract_tools(&zip_path, &dest).unwrap();
        files.sort();
        assert_eq!(files, ["LICENSE.txt", "ffmpeg.exe", "ffprobe.exe"]);
        assert_eq!(std::fs::read(dest.join("ffmpeg.exe")).unwrap(), b"F");
        assert!(!dest.join("ffplay.exe").exists());
        assert!(!dest.join(".extract").exists());
        assert!(!d.path().join("evil.exe").exists());
    }

    #[test]
    fn extraction_without_binaries_keeps_existing_install() {
        let d = tempfile::tempdir().unwrap();
        let zip_path = d.path().join("a.zip");
        make_zip(&zip_path, &[("x/LICENSE.txt", b"L")]);
        let dest = d.path().join("out");
        std::fs::create_dir_all(&dest).unwrap();
        std::fs::write(dest.join("ffmpeg.exe"), "old").unwrap();
        assert!(extract_tools(&zip_path, &dest).is_err());
        assert_eq!(std::fs::read(dest.join("ffmpeg.exe")).unwrap(), b"old");
    }

    /// Real network + ~190MB download into a temp dir. Run manually:
    /// `cargo test real_ffmpeg_download -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn real_ffmpeg_download() {
        let d = tempfile::tempdir().unwrap();
        let dest = d.path().join("tools").join("ffmpeg");
        let mut last_stage = String::new();
        let rec = install(&dest, PINNED_MAJOR, &AtomicBool::new(false), &mut |e| {
            let s = format!("{e:?}");
            let stage = s.split(|c: char| !c.is_alphanumeric()).next().unwrap_or("").to_string();
            if stage != last_stage {
                println!("{s}");
                last_stage = stage;
            }
        })
        .unwrap();
        println!("{rec:?}");
        assert_eq!(read_record(&dest), Some(rec.clone()));
        assert!(rec.asset.starts_with(&format!("ffmpeg-n{PINNED_MAJOR}.")));
        let check = crate::commands::doctor_commands::check_ffmpeg("", Some(&dest));
        println!("{check:?}");
        assert_eq!(check.status, "ok");
        assert_eq!(check.detail.as_deref().map(|d| d.starts_with("libx264=true")), Some(true));
        assert!(!dest.join(format!("{}.part", rec.asset)).exists());
    }
}

//! Reference keyframe extraction (T5.2, D-026). The app only extracts frames and metadata with FFmpeg;
//! analysing them is an agent task. FFmpeg runs with a fixed argv built here — the UI sends no command
//! text (D-012). Output goes to `scenes/<slug>/references/analysis/<id>/{frames/*.jpg, meta.json}`.

use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::Serialize;

use super::doctor_commands::managed_ffmpeg_dir;
use super::fs_commands::resolve_and_verify_workspace_path;
use crate::process::{self, resolve_command, run_capture, RunOptions};

pub const DEFAULT_FRAME_COUNT: u32 = 8;
pub const MAX_FRAME_COUNT: u32 = 24;
const PROBE_TIMEOUT_SECS: u64 = 30;
const EXTRACT_TIMEOUT_SECS: u64 = 180;
const FRAME_MAX_WIDTH: u32 = 1280;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VideoMeta {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub has_audio: bool,
    pub video_codec: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExtractReport {
    /// Workspace-relative paths of the extracted frames, in time order.
    pub frames: Vec<String>,
    pub meta_path: String,
    pub meta: VideoMeta,
}

pub fn clamp_count(count: Option<u32>) -> u32 {
    count.unwrap_or(DEFAULT_FRAME_COUNT).clamp(1, MAX_FRAME_COUNT)
}

/// `ref-1`, `ref-12`: what the app itself hands out (`nextReferenceId`). Keeps odd text out of paths.
pub fn valid_ref_id(id: &str) -> bool {
    id.strip_prefix("ref-").is_some_and(|n| !n.is_empty() && n.len() <= 6 && n.chars().all(|c| c.is_ascii_digit()))
}

fn valid_slug(slug: &str) -> bool {
    !slug.is_empty() && slug.len() <= 80 && slug.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// ffprobe argv. The input is always an absolute, verified path.
pub fn probe_argv(input: &Path) -> Vec<String> {
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams"]
        .iter()
        .map(|s| s.to_string())
        .chain([input.to_string_lossy().into_owned()])
        .collect()
}

/// ffmpeg argv: `count` frames spread evenly over the clip, JPEG, capped width. Fixed shape; only paths and numbers vary.
pub fn extract_argv(input: &Path, out_dir: &Path, count: u32, duration: f64) -> Vec<String> {
    // fps = count / duration spreads frames over the whole clip; the first sample lands at t = 0.
    let fps = format!("fps={}/{:.3}", count, duration.max(0.001));
    let filter = format!("{fps},scale='min({FRAME_MAX_WIDTH},iw)':-2");
    let pattern = out_dir.join("frame-%03d.jpg");
    [
        "-hide_banner", "-nostdin", "-y", "-loglevel", "error", "-i",
    ]
    .iter()
    .map(|s| s.to_string())
    .chain([
        input.to_string_lossy().into_owned(),
        "-vf".into(),
        filter,
        "-frames:v".into(),
        count.to_string(),
        "-q:v".into(),
        "3".into(),
        pattern.to_string_lossy().into_owned(),
    ])
    .collect()
}

fn parse_rate(s: &str) -> f64 {
    let mut it = s.splitn(2, '/');
    let n: f64 = it.next().and_then(|v| v.parse().ok()).unwrap_or(0.0);
    let d: f64 = it.next().and_then(|v| v.parse().ok()).unwrap_or(1.0);
    if d == 0.0 { 0.0 } else { (n / d * 1000.0).round() / 1000.0 }
}

/// Reads the ffprobe JSON. Errors when there is no video stream (e.g. an audio-only file).
pub fn parse_probe(json: &str) -> Result<VideoMeta, String> {
    let v: serde_json::Value = serde_json::from_str(json).map_err(|_| "invalid-probe-output".to_string())?;
    let streams = v.get("streams").and_then(|s| s.as_array()).cloned().unwrap_or_default();
    let video = streams
        .iter()
        .find(|s| s.get("codec_type").and_then(|t| t.as_str()) == Some("video"))
        .ok_or_else(|| "no-video-stream".to_string())?;
    let num = |v: &serde_json::Value, k: &str| v.get(k).and_then(|x| x.as_str().and_then(|s| s.parse::<f64>().ok()).or_else(|| x.as_f64()));
    let duration = v
        .get("format")
        .and_then(|f| num(f, "duration"))
        .or_else(|| num(video, "duration"))
        .filter(|d| d.is_finite() && *d > 0.0)
        .ok_or_else(|| "unknown-duration".to_string())?;
    Ok(VideoMeta {
        duration: (duration * 1000.0).round() / 1000.0,
        width: video.get("width").and_then(|x| x.as_u64()).unwrap_or(0) as u32,
        height: video.get("height").and_then(|x| x.as_u64()).unwrap_or(0) as u32,
        fps: video.get("avg_frame_rate").and_then(|x| x.as_str()).map(parse_rate).unwrap_or(0.0),
        has_audio: streams.iter().any(|s| s.get("codec_type").and_then(|t| t.as_str()) == Some("audio")),
        video_codec: video.get("codec_name").and_then(|x| x.as_str()).unwrap_or("").to_string(),
    })
}

/// `meta.json` body: stable key order, 2-space, LF.
pub fn meta_json(meta: &VideoMeta, source: &str, frame_count: usize) -> String {
    let value = serde_json::json!({
        "source": source,
        "duration": meta.duration,
        "width": meta.width,
        "height": meta.height,
        "fps": meta.fps,
        "hasAudio": meta.has_audio,
        "videoCodec": meta.video_codec,
        "frames": frame_count,
    });
    let mut s = serde_json::to_string_pretty(&value).unwrap_or_default();
    s.push('\n');
    s
}

/// The app-managed FFmpeg wins over PATH (S1: PATH builds are often old).
fn find_tool(name: &str, managed: Option<&Path>, path_env: &str) -> Option<PathBuf> {
    let exe = if cfg!(windows) { format!("{name}.exe") } else { name.to_string() };
    managed.map(|d| d.join(&exe)).filter(|p| p.is_file()).or_else(|| resolve_command(name, path_env))
}

fn run(exe: &Path, argv: &[String], path_env: &str, secs: u64) -> Result<String, String> {
    let args: Vec<&str> = argv.iter().map(String::as_str).collect();
    let cap = run_capture(exe, &args, &RunOptions::new(Duration::from_secs(secs)).path(path_env)).map_err(|e| e.to_string())?;
    if cap.exit_code != Some(0) {
        return Err(format!("exit {:?}: {}", cap.exit_code, cap.stderr.trim()));
    }
    Ok(cap.stdout)
}

/// Extract keyframes for one video reference. `video_rel` is the scene-relative path stored in scene.json.
pub fn extract_frames(
    workspace_root: &str,
    slug: &str,
    ref_id: &str,
    video_rel: &str,
    count: Option<u32>,
    managed: Option<&Path>,
    path_env: &str,
) -> Result<ExtractReport, String> {
    if !valid_slug(slug) || !valid_ref_id(ref_id) {
        return Err("invalid-reference".into());
    }
    let rel = video_rel.replace('\\', "/");
    if rel.starts_with('/') || rel.split('/').any(|p| p == ".." || p.is_empty()) || !rel.starts_with("references/") {
        return Err("invalid-reference-path".into());
    }
    let scene_rel = format!("scenes/{slug}");
    let input = resolve_and_verify_workspace_path(&format!("{workspace_root}/{scene_rel}/{rel}"), Some(workspace_root), true)?;
    if !input.is_file() {
        return Err("reference-not-a-file".into());
    }
    let ffmpeg = find_tool("ffmpeg", managed, path_env).ok_or_else(|| "ffmpeg-not-installed".to_string())?;
    let ffprobe = find_tool("ffprobe", managed, path_env).ok_or_else(|| "ffmpeg-not-installed".to_string())?;

    let meta = parse_probe(&run(&ffprobe, &probe_argv(&input), path_env, PROBE_TIMEOUT_SECS)?)?;
    let count = clamp_count(count);

    let out_rel = format!("{scene_rel}/references/analysis/{ref_id}");
    let out_dir = resolve_and_verify_workspace_path(&format!("{workspace_root}/{out_rel}/frames"), Some(workspace_root), false)?;
    // Only this reference's own frames folder is cleared, so re-running replaces the previous result.
    if out_dir.exists() {
        std::fs::remove_dir_all(&out_dir).map_err(|e| e.to_string())?;
    }
    std::fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;
    run(&ffmpeg, &extract_argv(&input, &out_dir, count, meta.duration), path_env, EXTRACT_TIMEOUT_SECS)?;

    let mut names: Vec<String> = std::fs::read_dir(&out_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| n.starts_with("frame-") && n.ends_with(".jpg"))
        .collect();
    names.sort();
    if names.is_empty() {
        return Err("no-frames-extracted".into());
    }
    let meta_rel = format!("{out_rel}/meta.json");
    let meta_abs = resolve_and_verify_workspace_path(&format!("{workspace_root}/{meta_rel}"), Some(workspace_root), false)?;
    std::fs::write(&meta_abs, meta_json(&meta, &format!("{scene_rel}/{rel}"), names.len())).map_err(|e| e.to_string())?;
    Ok(ExtractReport { frames: names.iter().map(|n| format!("{out_rel}/frames/{n}")).collect(), meta_path: meta_rel, meta })
}

#[tauri::command]
pub async fn extract_reference_frames<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    workspace_root: String,
    slug: String,
    ref_id: String,
    video_path: String,
    count: Option<u32>,
) -> Result<ExtractReport, String> {
    let managed = managed_ffmpeg_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let path_env = process::fresh_path();
        extract_frames(&workspace_root, &slug, &ref_id, &video_path, count, Some(&managed), &path_env)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn count_is_clamped() {
        assert_eq!(clamp_count(None), DEFAULT_FRAME_COUNT);
        assert_eq!(clamp_count(Some(0)), 1);
        assert_eq!(clamp_count(Some(999)), MAX_FRAME_COUNT);
        assert_eq!(clamp_count(Some(12)), 12);
    }

    #[test]
    fn ids_and_slugs_are_restricted() {
        assert!(valid_ref_id("ref-1") && valid_ref_id("ref-120"));
        for bad in ["ref-", "ref-a", "../ref-1", "ref-1/../x", "x", "ref-1234567", "REF-1"] {
            assert!(!valid_ref_id(bad), "{bad}");
        }
        assert!(valid_slug("intro-2") && !valid_slug("../x") && !valid_slug("A") && !valid_slug(""));
    }

    #[test]
    fn argv_shape_is_fixed() {
        let a = extract_argv(Path::new("/w/in.mp4"), Path::new("/w/out"), 8, 4.0);
        assert_eq!(&a[..6], ["-hide_banner", "-nostdin", "-y", "-loglevel", "error", "-i"]);
        assert_eq!(a[6], "/w/in.mp4");
        assert_eq!(a[7], "-vf");
        assert_eq!(a[8], "fps=8/4.000,scale='min(1280,iw)':-2");
        assert_eq!(&a[9..13], ["-frames:v", "8", "-q:v", "3"]);
        assert!(a[13].replace('\\', "/").ends_with("/w/out/frame-%03d.jpg"));
        assert_eq!(a.len(), 14);

        let p = probe_argv(Path::new("/w/in.mp4"));
        assert_eq!(&p[..6], ["-v", "error", "-print_format", "json", "-show_format", "-show_streams"]);
        assert_eq!(p.len(), 7);
    }

    #[test]
    fn a_hostile_file_name_stays_one_argument() {
        // A path is always a single argv element, never parsed by a shell.
        let a = extract_argv(Path::new("/w/a b; rm -rf x.mp4"), Path::new("/w/out"), 4, 2.0);
        assert_eq!(a[6], "/w/a b; rm -rf x.mp4");
    }

    #[test]
    fn probe_output_is_parsed() {
        let json = r#"{"streams":[{"codec_type":"audio"},{"codec_type":"video","codec_name":"h264","width":1920,"height":1080,"avg_frame_rate":"30000/1001"}],"format":{"duration":"12.480000"}}"#;
        let m = parse_probe(json).unwrap();
        assert_eq!((m.width, m.height, m.duration, m.has_audio, m.video_codec.as_str()), (1920, 1080, 12.48, true, "h264"));
        assert_eq!(m.fps, 29.97);
        assert_eq!(parse_probe(r#"{"streams":[{"codec_type":"audio"}],"format":{"duration":"3"}}"#), Err("no-video-stream".into()));
        assert_eq!(parse_probe(r#"{"streams":[{"codec_type":"video"}],"format":{}}"#), Err("unknown-duration".into()));
        assert_eq!(parse_probe("nope"), Err("invalid-probe-output".into()));
    }

    #[test]
    fn meta_json_is_deterministic() {
        let m = VideoMeta { duration: 4.0, width: 640, height: 360, fps: 24.0, has_audio: false, video_codec: "h264".into() };
        assert_eq!(meta_json(&m, "scenes/a/references/x.mp4", 8), meta_json(&m, "scenes/a/references/x.mp4", 8));
        assert!(meta_json(&m, "s", 8).ends_with("}\n"));
    }

    #[test]
    fn rejects_paths_outside_references_and_odd_ids() {
        let ws = tempfile::tempdir().unwrap();
        let root = ws.path().to_string_lossy().into_owned();
        let run = |slug: &str, id: &str, rel: &str| extract_frames(&root, slug, id, rel, None, None, "");
        assert_eq!(run("../x", "ref-1", "references/a.mp4"), Err("invalid-reference".into()));
        assert_eq!(run("a", "ref-1/../..", "references/a.mp4"), Err("invalid-reference".into()));
        assert_eq!(run("a", "ref-1", "../a.mp4"), Err("invalid-reference-path".into()));
        assert_eq!(run("a", "ref-1", "src/a.mp4"), Err("invalid-reference-path".into()));
        assert_eq!(run("a", "ref-1", "/etc/passwd"), Err("invalid-reference-path".into()));
        assert_eq!(run("a", "ref-1", "references/../../b.mp4"), Err("invalid-reference-path".into()));
    }

    /// Real FFmpeg round trip when ffmpeg/ffprobe are installed (skipped otherwise).
    #[test]
    fn extracts_frames_from_a_generated_clip() {
        let path_env = process::fresh_path();
        // PATH builds are often too old (the 2013 build rejects -hide_banner): `VANILLA_TEST_FFMPEG_DIR` points at a modern bin folder.
        let managed = std::env::var("VANILLA_TEST_FFMPEG_DIR").ok().map(PathBuf::from);
        let managed = managed.as_deref();
        let (Some(ffmpeg), Some(_)) = (find_tool("ffmpeg", managed, &path_env), find_tool("ffprobe", managed, &path_env)) else {
            eprintln!("skipped: ffmpeg/ffprobe not installed");
            return;
        };
        let ws = tempfile::tempdir().unwrap();
        let refs = ws.path().join("scenes/intro/references");
        std::fs::create_dir_all(&refs).unwrap();
        let clip = refs.join("ref-1-clip.mp4");
        let out = std::process::Command::new(&ffmpeg)
            .args(["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=24:duration=3", "-pix_fmt", "yuv420p", "-y"])
            .arg(&clip)
            .output()
            .unwrap();
        if !out.status.success() {
            eprintln!("skipped: cannot generate a clip ({})", String::from_utf8_lossy(&out.stderr));
            return;
        }
        let root = ws.path().to_string_lossy().into_owned();
        let report = extract_frames(&root, "intro", "ref-1", "references/ref-1-clip.mp4", Some(6), managed, &path_env).unwrap();
        assert_eq!(report.frames.len(), 6);
        assert_eq!((report.meta.width, report.meta.height), (320, 180));
        assert!((report.meta.duration - 3.0).abs() < 0.2);
        assert_eq!(report.frames[0], "scenes/intro/references/analysis/ref-1/frames/frame-001.jpg");
        for f in &report.frames {
            assert!(ws.path().join(f).is_file(), "{f}");
        }
        let meta = std::fs::read_to_string(ws.path().join(&report.meta_path)).unwrap();
        assert!(meta.contains("\"frames\": 6"));
        // Re-running replaces the previous result instead of mixing frames.
        let again = extract_frames(&root, "intro", "ref-1", "references/ref-1-clip.mp4", Some(3), managed, &path_env).unwrap();
        assert_eq!(again.frames.len(), 3);
        assert_eq!(std::fs::read_dir(ws.path().join("scenes/intro/references/analysis/ref-1/frames")).unwrap().count(), 3);
    }
}

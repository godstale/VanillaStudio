//! `get_review` logic: read the `reviews/R-NNN.md` files T4.18 writes so the
//! agent can fetch the human's revision comments (F-REV-04).
//!
//! Format (also produced by `src/lib/review/revision.ts`; parsed here without
//! a YAML dependency):
//!
//! ```md
//! ---
//! id: R-001
//! target: s1-intro
//! t: 1.5
//! status: open
//! createdAt: 2026-01-01T00:00:00Z
//! screenshot: R-001.png
//! ---
//!
//! Please make the title bigger.
//! ```

use std::path::Path;

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ReviewSummary {
    pub id: String,
    pub target: String,
    pub t: Option<f64>,
    pub status: String,
    pub screenshot: Option<String>,
    pub comment_preview: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ReviewDetail {
    pub id: String,
    pub target: String,
    pub t: Option<f64>,
    pub status: String,
    pub created_at: String,
    pub screenshot: Option<String>,
    pub comment: String,
}

pub fn review_id_valid(id: &str) -> bool {
    id.len() == 5 && id.starts_with("R-") && id[2..].chars().all(|c| c.is_ascii_digit())
}

fn review_files(root: &Path) -> Vec<std::path::PathBuf> {
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir(root.join("reviews")) else {
        return out;
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let p = entry.path();
        let is_review = p.is_file()
            && p.extension().and_then(|e| e.to_str()).is_some_and(|e| e == "md")
            && p.file_stem().and_then(|s| s.to_str()).is_some_and(review_id_valid);
        if is_review {
            out.push(p);
        }
    }
    out.sort();
    out
}

fn front_value(front: &[&str], key: &str) -> Option<String> {
    for line in front {
        let line = line.trim();
        if let Some((k, v)) = line.split_once(':') {
            if k.trim() == key {
                let v = v.trim().trim_matches('"').trim().to_string();
                if !v.is_empty() {
                    return Some(v);
                }
            }
        }
    }
    None
}

/// Split `---` front matter from the comment body.
fn split_front(text: &str) -> Option<(Vec<&str>, String)> {
    let mut lines = text.lines();
    if lines.next()?.trim() != "---" {
        return None;
    }
    let mut front = Vec::new();
    for line in lines.by_ref() {
        if line.trim() == "---" {
            let body: String = lines.collect::<Vec<_>>().join("\n");
            return Some((front, body));
        }
        front.push(line);
    }
    None
}

fn parse_review(text: &str) -> Result<ReviewDetail, String> {
    let (front, body) = split_front(text).ok_or_else(|| "Missing front matter (---)".to_string())?;
    let id = front_value(&front, "id").ok_or_else(|| "Front matter needs id".to_string())?;
    if !review_id_valid(&id) {
        return Err(format!("Bad review id: {id:?}"));
    }
    let target = front_value(&front, "target").ok_or_else(|| "Front matter needs target".to_string())?;
    let t = front_value(&front, "t").and_then(|v| v.parse::<f64>().ok());
    let status = front_value(&front, "status").unwrap_or_else(|| "open".to_string());
    let created_at = front_value(&front, "createdAt").unwrap_or_default();
    let screenshot = front_value(&front, "screenshot");
    Ok(ReviewDetail {
        id,
        target,
        t,
        status,
        created_at,
        screenshot,
        comment: body.trim().to_string(),
    })
}

/// All reviews, oldest first. Files that fail to parse are skipped (the human
/// may be mid-edit); `read_review` reports them as errors instead.
pub fn list_reviews(root: &Path) -> Result<Vec<ReviewSummary>, String> {
    let mut out = Vec::new();
    for path in review_files(root) {
        let Ok(text) = std::fs::read_to_string(&path) else {
            continue;
        };
        let Ok(detail) = parse_review(&text) else {
            continue;
        };
        let comment_preview: String = detail.comment.chars().take(120).collect();
        out.push(ReviewSummary {
            id: detail.id,
            target: detail.target,
            t: detail.t,
            status: detail.status,
            screenshot: detail.screenshot,
            comment_preview,
        });
    }
    Ok(out)
}

/// The full comment file for one review id (e.g. `R-001`).
pub fn read_review(root: &Path, id: &str) -> Result<ReviewDetail, String> {
    if !review_id_valid(id) {
        return Err(format!("Invalid review id: {id:?} (want R-NNN)"));
    }
    let path = root.join("reviews").join(format!("{id}.md"));
    if !path.is_file() {
        return Err(format!("No such review: reviews/{id}.md"));
    }
    let text = std::fs::read_to_string(&path).map_err(|e| format!("Cannot read {id}: {e}"))?;
    parse_review(&text).map_err(|e| format!("{id} is malformed: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    const R1: &str = "---\nid: R-001\ntarget: s1-intro\nt: 1.5\nstatus: open\ncreatedAt: 2026-01-01T00:00:00Z\nscreenshot: R-001.png\n---\n\nPlease make the title bigger.\n";

    fn root_with(files: &[(&str, &str)]) -> tempfile::TempDir {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir_all(tmp.path().join("reviews")).unwrap();
        for (name, body) in files {
            fs::write(tmp.path().join("reviews").join(name), body).unwrap();
        }
        tmp
    }

    #[test]
    fn roundtrip_single_review() {
        let tmp = root_with(&[("R-001.md", R1)]);
        let d = read_review(tmp.path(), "R-001").unwrap();
        assert_eq!(d.target, "s1-intro");
        assert_eq!(d.t, Some(1.5));
        assert_eq!(d.status, "open");
        assert_eq!(d.screenshot.as_deref(), Some("R-001.png"));
        assert!(d.comment.contains("bigger"));
    }

    #[test]
    fn list_skips_malformed_but_read_reports() {
        let tmp = root_with(&[("R-001.md", R1), ("R-002.md", "no front matter\n")]);
        let list = list_reviews(tmp.path()).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "R-001");
        assert!(read_review(tmp.path(), "R-002").is_err());
    }

    #[test]
    fn rejects_bad_ids_and_missing_files() {
        let tmp = root_with(&[]);
        assert!(read_review(tmp.path(), "nope").is_err());
        assert!(read_review(tmp.path(), "R-999").is_err());
        assert!(list_reviews(tmp.path()).unwrap().is_empty());
    }

    #[test]
    fn review_without_screenshot_parses() {
        let tmp = root_with(&[("R-003.md", "---\nid: R-003\ntarget: s2\nstatus: done\n---\n\nok\n")]);
        let d = read_review(tmp.path(), "R-003").unwrap();
        assert_eq!(d.screenshot, None);
        assert_eq!(d.t, None);
        assert_eq!(d.status, "done");
    }
}

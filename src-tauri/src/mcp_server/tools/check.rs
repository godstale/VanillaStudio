//! `check_scene` logic: the Rust mirror of the `packages/runtime/eslint-plugin`
//! rules (T4.8) so agents can verify the Scene runtime contract (D-011) through
//! MCP without a Node toolchain.
//!
//! Rules mirror the ESLint plugin one-to-one:
//! - `noForbiddenTimeApi` (error, clock-contract types only): `Date.now`,
//!   `performance.now`, `Math.random`, `requestAnimationFrame`, `setInterval`,
//!   bare `new Date()`.
//! - `requireDefineScene` (error): every scene module must mention `defineScene`.
//! - `noHardcodedColors` (warning): hex / rgb / hsl literals, unless the line
//!   (or the previous one) carries `// ds-ignore`.
//! - `external-url` (warning): `http(s)://` references remind the agent of the
//!   `assets/CREDITS.md` license record (D-006).

use std::path::Path;

use serde::Serialize;

const SCENE_EXTS: &[&str] = &["ts", "tsx", "js", "jsx"];

/// Clock-contract output types: animation must be a pure function of `t` (D-011).
/// `slides` captures are stills like `image`, so the same rules apply.
fn clock_contract(output_type: &str) -> bool {
    matches!(output_type, "video" | "image" | "slides")
}

fn project_output_type(root: &Path) -> String {
    let text = std::fs::read_to_string(root.join("vanilla.json")).unwrap_or_default();
    serde_json::from_str::<serde_json::Value>(&text)
        .ok()
        .and_then(|v| v.get("outputType").and_then(|o| o.as_str()).map(String::from))
        .unwrap_or_default()
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CheckFinding {
    pub file: String,
    pub line: Option<u32>,
    pub rule: String,
    pub severity: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CheckReport {
    pub output_type: String,
    pub clock_contract: bool,
    pub files_checked: usize,
    pub errors: usize,
    pub warnings: usize,
    pub findings: Vec<CheckFinding>,
}

/// Scene files under `<root>/src/scenes` (deterministic order).
fn scene_files(root: &Path) -> Vec<std::path::PathBuf> {
    let mut out = Vec::new();
    let mut stack = vec![root.join("src").join("scenes")];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
        entries.sort_by_key(|e| e.file_name());
        for entry in entries {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path
                .extension()
                .and_then(|e| e.to_str())
                .is_some_and(|e| SCENE_EXTS.contains(&e))
            {
                out.push(path);
            }
        }
    }
    out.sort();
    out
}

fn is_hex_color_at(line: &str, hash: usize) -> bool {
    let tail: String = line[hash + 1..].chars().take(8).collect();
    let hex_len = tail.chars().take_while(|c| c.is_ascii_hexdigit()).count();
    if !(hex_len == 3 || hex_len == 4 || hex_len == 6 || hex_len == 8) {
        return false;
    }
    // A word boundary must follow the literal (`#abc` in `#abcdef` is not a color).
    tail.chars().nth(hex_len).is_none_or(|c| !c.is_ascii_hexdigit())
}

fn has_hardcoded_color(line: &str) -> bool {
    let bytes = line.as_bytes();
    for (i, _) in line.char_indices() {
        if bytes[i] == b'#' && line[i + 1..].chars().next().is_some_and(|c| c.is_ascii_hexdigit()) {
            if is_hex_color_at(line, i) {
                return true;
            }
        }
    }
    line.contains("rgb(") || line.contains("rgba(") || line.contains("hsl(") || line.contains("hsla(")
}

fn check_line(
    rel: &str,
    no: u32,
    line: &str,
    prev_has_ignore: bool,
    clock: bool,
    findings: &mut Vec<CheckFinding>,
) {
    let error = |rule: &str, message: &str| CheckFinding {
        file: rel.to_string(),
        line: Some(no),
        rule: rule.to_string(),
        severity: "error".to_string(),
        message: message.to_string(),
    };
    let warning = |rule: &str, message: &str| CheckFinding {
        file: rel.to_string(),
        line: Some(no),
        rule: rule.to_string(),
        severity: "warning".to_string(),
        message: message.to_string(),
    };
    if clock {
        // Mirrors `noForbiddenTimeApi` (member paths and bare `new Date()`).
        for (needle, detail) in [
            ("Date.now", "Date.now() differs on every render. Use useTime()."),
            ("performance.now", "performance.now() differs on every render. Use useTime()."),
            (
                "Math.random",
                "Math.random() is not repeatable. Use useSeededRandom(seed) or noise2D/noise3D.",
            ),
            (
                "requestAnimationFrame",
                "Own requestAnimationFrame loops are not driven by the Vanilla clock. Derive animation from useTime().",
            ),
            (
                "setInterval",
                "setInterval is not driven by the Vanilla clock. Derive animation from useTime().",
            ),
            (
                "new Date()",
                "new Date() without arguments reads the wall clock. Pass an explicit timestamp.",
            ),
        ] {
            if line.contains(needle) {
                findings.push(error("noForbiddenTimeApi", detail));
            }
        }
    }
    // Mirrors `noHardcodedColors`: same-line or previous-line `ds-ignore` exempts.
    if !line.contains("ds-ignore") && !prev_has_ignore && has_hardcoded_color(line) {
        // Module specifiers are not colors.
        let trimmed = line.trim_start();
        if !trimmed.starts_with("import ") {
            findings.push(warning(
                "noHardcodedColors",
                "Hard-coded color literal. Use var(--color-*) or useDesign() (add `// ds-ignore` if this is deliberate).",
            ));
        }
    }
    if line.contains("http://") || line.contains("https://") {
        findings.push(warning(
            "external-url",
            "External URL reference. Record its source and license in assets/CREDITS.md (D-006).",
        ));
    }
}

/// Run the contract check over the project at `root`.
/// `scene_filter` optionally limits the check to files whose name contains it.
pub fn check_project(root: &Path, scene_filter: Option<&str>) -> Result<CheckReport, String> {
    if !root.join("vanilla.json").is_file() {
        return Err(format!("Not a Vanilla project (no vanilla.json): {}", root.display()));
    }
    let output_type = project_output_type(root);
    let clock = clock_contract(&output_type);
    let mut files = scene_files(root);
    if let Some(want) = scene_filter {
        files.retain(|p| p.file_name().and_then(|n| n.to_str()).is_some_and(|n| n.contains(want)));
        if files.is_empty() {
            return Err(format!("No scene file matches {want:?}"));
        }
    }
    if files.is_empty() {
        return Err("No scene files under src/scenes".to_string());
    }
    let mut findings = Vec::new();
    let mut checked = 0;
    for path in &files {
        let rel = path
            .strip_prefix(root)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| path.to_string_lossy().into_owned());
        let Ok(text) = std::fs::read_to_string(path) else {
            findings.push(CheckFinding {
                file: rel,
                line: None,
                rule: "read".to_string(),
                severity: "error".to_string(),
                message: "Could not read scene file as UTF-8.".to_string(),
            });
            continue;
        };
        checked += 1;
        // Mirrors `requireDefineScene` (presence; the default-export shape is the
        // ESLint rule's job, this stays a fast file-level gate).
        if !text.contains("defineScene") {
            findings.push(CheckFinding {
                file: rel.clone(),
                line: Some(1),
                rule: "requireDefineScene".to_string(),
                severity: "error".to_string(),
                message: "Scene module has no defineScene(...) call.".to_string(),
            });
        }
        let lines: Vec<&str> = text.lines().collect();
        for (i, line) in lines.iter().enumerate() {
            let prev_has_ignore = i > 0 && lines[i - 1].contains("ds-ignore");
            check_line(&rel, (i + 1) as u32, line, prev_has_ignore, clock, &mut findings);
        }
    }
    findings.sort_by(|a, b| (a.file.clone(), a.line).cmp(&(b.file.clone(), b.line)));
    let errors = findings.iter().filter(|f| f.severity == "error").count();
    let warnings = findings.iter().filter(|f| f.severity == "warning").count();
    Ok(CheckReport {
        output_type,
        clock_contract: clock,
        files_checked: checked,
        errors,
        warnings,
        findings,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn project_with(files: &[(&str, &str)], vanilla: &str) -> tempfile::TempDir {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(tmp.path().join("vanilla.json"), vanilla).unwrap();
        for (rel, body) in files {
            let p = tmp.path().join(rel);
            fs::create_dir_all(p.parent().unwrap()).unwrap();
            fs::write(p, body).unwrap();
        }
        tmp
    }

    const VIDEO: &str = r#"{"version":1,"outputType":"video"}"#;

    #[test]
    fn clean_scene_passes() {
        let tmp = project_with(
            &[(
                "src/scenes/intro.tsx",
                "import { defineScene } from '@vanilla/runtime';\nexport default defineScene({ id: 's1' });\n",
            )],
            VIDEO,
        );
        let r = check_project(tmp.path(), None).unwrap();
        assert_eq!(r.files_checked, 1);
        assert_eq!(r.errors, 0);
        assert_eq!(r.warnings, 0);
        assert!(r.clock_contract);
    }

    #[test]
    fn flags_time_api_and_missing_define_scene() {
        let tmp = project_with(
            &[("src/scenes/bad.tsx", "const x = Date.now();\nconst y = Math.random();\n")],
            VIDEO,
        );
        let r = check_project(tmp.path(), None).unwrap();
        assert!(r.errors >= 3, "{r:?}");
        assert!(r.findings.iter().any(|f| f.rule == "requireDefineScene"));
        assert_eq!(r.findings.iter().filter(|f| f.rule == "noForbiddenTimeApi").count(), 2);
    }

    #[test]
    fn free_mode_skips_time_rules() {
        let tmp = project_with(
            &[(
                "src/scenes/web.tsx",
                "export default defineScene({ id: 'w' });\nconst x = Date.now();\nrequestAnimationFrame(draw);\n",
            )],
            r#"{"version":1,"outputType":"web"}"#,
        );
        let r = check_project(tmp.path(), None).unwrap();
        assert!(!r.clock_contract);
        assert_eq!(r.errors, 0);
    }

    #[test]
    fn hardcoded_color_warns_unless_ignored() {
        let tmp = project_with(
            &[(
                "src/scenes/c.tsx",
                "export default defineScene({ id: 'c' });\nconst a = '#ff0000';\n// ds-ignore\nconst b = '#00ff00';\n",
            )],
            VIDEO,
        );
        let r = check_project(tmp.path(), None).unwrap();
        let color: Vec<_> = r.findings.iter().filter(|f| f.rule == "noHardcodedColors").collect();
        assert_eq!(color.len(), 1);
        assert_eq!(color[0].line, Some(2));
    }

    #[test]
    fn rejects_non_project_and_empty_scenes() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(check_project(tmp.path(), None).is_err());
        let tmp = project_with(&[], VIDEO);
        assert!(check_project(tmp.path(), None).is_err());
    }

    #[test]
    fn scene_filter_limits_files() {
        let tmp = project_with(
            &[
                ("src/scenes/a.tsx", "export default defineScene({id:'a'});\n"),
                ("src/scenes/b.tsx", "nope\n"),
            ],
            VIDEO,
        );
        let r = check_project(tmp.path(), Some("a")).unwrap();
        assert_eq!(r.files_checked, 1);
        assert_eq!(r.errors, 0);
        assert!(check_project(tmp.path(), Some("zzz")).is_err());
    }
}

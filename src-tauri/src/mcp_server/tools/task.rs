//! `update_task_status` logic: let the agent report task progress (F-PIP-05)
//! against the `plan/tasks.json` contract T3.12 owns.
//!
//! The runner (T3.14) keeps execution history in the project DB `task_runs`
//! table; this tool keeps the lighter agent-visible board in
//! `.vanilla/task-status.json` (`{ "<taskId>": { status, note, updatedAt } }`),
//! keyed by the same task ids. The runner treats a `done` entry as the agent's
//! claim, still verifying with its own inspect → snapshot → checkpoint pass.

use std::path::Path;

use serde::Serialize;

pub const VALID_STATUSES: &[&str] = &["pending", "in_progress", "done", "blocked"];
const STATUS_FILE: &str = ".vanilla/task-status.json";

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct TaskStatusRecord {
    pub task_id: String,
    pub status: String,
    pub note: Option<String>,
    pub updated_at: String,
}

fn utc_now_iso() -> String {
    // Minimal UTC formatter (`YYYY-MM-DDTHH:MM:SSZ`); no date crate needed.
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let days = (secs / 86_400) as i64;
    let time = secs % 86_400;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u64;
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u64;
    let year = (if m <= 2 { y + 1 } else { y }) as u64;
    format!(
        "{year:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
        time / 3_600,
        (time % 3_600) / 60,
        time % 60
    )
}

fn task_id_valid(id: &str) -> bool {
    // Same rule as `src/lib/pipeline/schemas/tasks.ts`.
    !id.is_empty()
        && id.len() <= 100
        && id.chars().next().is_some_and(|c| c.is_ascii_alphanumeric())
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn known_task_ids(root: &Path) -> Result<Vec<String>, String> {
    let text = std::fs::read_to_string(root.join("plan").join("tasks.json"))
        .map_err(|_| "No plan/tasks.json yet. Tasks are defined in the Prompts stage.".to_string())?;
    let v: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("plan/tasks.json is invalid: {e}"))?;
    let tasks = v
        .get("tasks")
        .and_then(|t| t.as_array())
        .ok_or_else(|| "plan/tasks.json has no tasks array".to_string())?;
    Ok(tasks
        .iter()
        .filter_map(|t| t.get("id").and_then(|i| i.as_str()).map(String::from))
        .collect())
}

/// Record the agent's status claim for `task_id`. The task must exist in
/// `plan/tasks.json`; `status` is one of `pending|in_progress|done|blocked`.
pub fn update_task_status(
    root: &Path,
    task_id: &str,
    status: &str,
    note: Option<&str>,
) -> Result<TaskStatusRecord, String> {
    if !task_id_valid(task_id) {
        return Err(format!("Invalid task id: {task_id:?}"));
    }
    if !VALID_STATUSES.contains(&status) {
        return Err(format!("Invalid status {status:?} (want one of {})", VALID_STATUSES.join("|")));
    }
    let note = note.map(str::trim).filter(|n| !n.is_empty()).map(String::from);
    if note.as_ref().is_some_and(|n| n.len() > 500) {
        return Err("Note is too long (max 500 chars)".to_string());
    }
    let ids = known_task_ids(root)?;
    if !ids.iter().any(|id| id == task_id) {
        return Err(format!("Unknown task {task_id:?} (plan/tasks.json has: {})", ids.join(", ")));
    }
    let path = root.join(STATUS_FILE);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut board: serde_json::Map<String, serde_json::Value> = std::fs::read_to_string(&path)
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default();
    let record = TaskStatusRecord {
        task_id: task_id.to_string(),
        status: status.to_string(),
        note: note.clone(),
        updated_at: utc_now_iso(),
    };
    board.insert(
        task_id.to_string(),
        serde_json::json!({
            "status": record.status,
            "note": record.note,
            "updatedAt": record.updated_at,
        }),
    );
    let mut text =
        serde_json::to_string_pretty(&board).map_err(|e| e.to_string())?;
    text.push('\n');
    std::fs::write(&path, text).map_err(|e| e.to_string())?;
    Ok(record)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn root_with_tasks(extra: &[(&str, &str)]) -> tempfile::TempDir {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(tmp.path().join("vanilla.json"), r#"{"version":1}"#).unwrap();
        fs::create_dir_all(tmp.path().join("plan")).unwrap();
        fs::write(
            tmp.path().join("plan/tasks.json"),
            r#"{"version":1,"tasks":[{"id":"t1","kind":"scene","target":"s1","prompt":"prompts/a.md","dependsOn":[]},{"id":"t2","kind":"compose","prompt":"prompts/b.md","dependsOn":["t1"]}]}"#,
        )
        .unwrap();
        for (rel, body) in extra {
            let p = tmp.path().join(rel);
            fs::create_dir_all(p.parent().unwrap()).unwrap();
            fs::write(p, body).unwrap();
        }
        tmp
    }

    #[test]
    fn records_status_for_known_task() {
        let tmp = root_with_tasks(&[]);
        let r = update_task_status(tmp.path(), "t1", "in_progress", Some("working")).unwrap();
        assert_eq!(r.task_id, "t1");
        assert!(r.updated_at.ends_with('Z'));
        let board: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(tmp.path().join(STATUS_FILE)).unwrap(),
        )
        .unwrap();
        assert_eq!(board["t1"]["status"], "in_progress");
        // A second update overwrites the first.
        update_task_status(tmp.path(), "t1", "done", None).unwrap();
        let board: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(tmp.path().join(STATUS_FILE)).unwrap(),
        )
        .unwrap();
        assert_eq!(board["t1"]["status"], "done");
        assert!(board["t1"].get("note").and_then(|n| n.as_str()).is_none());
    }

    #[test]
    fn rejects_unknown_task_bad_status_and_missing_tasks() {
        let tmp = root_with_tasks(&[]);
        assert!(update_task_status(tmp.path(), "nope", "done", None).is_err());
        assert!(update_task_status(tmp.path(), "t1", "flying", None).is_err());
        assert!(update_task_status(tmp.path(), "bad id!", "done", None).is_err());
        assert!(update_task_status(tmp.path(), "t1", "done", Some(&"x".repeat(501))).is_err());
        let bare = tempfile::tempdir().unwrap();
        fs::write(bare.path().join("vanilla.json"), "{}").unwrap();
        assert!(update_task_status(bare.path(), "t1", "done", None).is_err());
    }
}

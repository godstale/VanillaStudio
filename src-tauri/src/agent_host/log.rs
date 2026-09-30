//! Session log: every `AgentEvent` of a session is appended to
//! `<project>/.vanilla/sessions/<session-id>.jsonl` (replay, debugging, teaching material).
//! `.vanilla/` is git-ignored (Technical-Design section 10); logging never breaks a session.

use crate::agent_host::events::{AgentEvent, Emit};
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

pub const SESSIONS_DIR: &str = "sessions";

/// Make an ACP session id safe as a file name (no separators, no traversal, bounded length).
pub fn sanitize_session_id(id: &str) -> String {
    let s: String = id.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' }).take(100).collect();
    if s.is_empty() { "session".to_string() } else { s }
}

pub fn log_path(project_dir: &Path, session_id: &str) -> PathBuf {
    project_dir.join(crate::agent_host::permission::PROTECTED_DIR).join(SESSIONS_DIR).join(format!("{}.jsonl", sanitize_session_id(session_id)))
}

enum State {
    /// Waiting for `Started` (the first event that names the session).
    Pending(Vec<(u128, AgentEvent)>),
    Open(File),
    Failed,
}

fn now_ms() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_millis())
}

fn write_line(file: &mut File, ts: u128, event: &AgentEvent) -> std::io::Result<()> {
    let line = serde_json::json!({ "ts": ts, "event": event });
    writeln!(file, "{line}")?;
    file.flush()
}

/// Wrap `inner` so each event is also appended to the session log.
pub fn with_log(project_dir: PathBuf, inner: Emit) -> Emit {
    let state = Mutex::new(State::Pending(Vec::new()));
    std::sync::Arc::new(move |event: AgentEvent| {
        {
            let mut st = state.lock().unwrap();
            let ts = now_ms();
            match &mut *st {
                State::Open(f) => {
                    if write_line(f, ts, &event).is_err() {
                        *st = State::Failed;
                    }
                }
                State::Failed => {}
                State::Pending(buf) => {
                    buf.push((ts, event.clone()));
                    if let AgentEvent::Started { session_id, .. } = &event {
                        let path = log_path(&project_dir, session_id);
                        let opened = path
                            .parent()
                            .map_or(Ok(()), std::fs::create_dir_all)
                            .and_then(|_| OpenOptions::new().create(true).append(true).open(&path));
                        *st = match opened {
                            Ok(mut f) => {
                                let ok = buf.iter().all(|(t, e)| write_line(&mut f, *t, e).is_ok());
                                if ok { State::Open(f) } else { State::Failed }
                            }
                            Err(e) => {
                                log::warn!("session log unavailable: {e}");
                                State::Failed
                            }
                        };
                    }
                }
            }
        }
        inner(event);
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn started(id: &str) -> AgentEvent {
        AgentEvent::Started { session_id: id.into(), agent_id: "a".into(), cwd: "c".into(), agent_name: None, agent_version: None, load_session: false, modes: serde_json::Value::Null, resumed: None }
    }

    fn read_lines(path: &Path) -> Vec<serde_json::Value> {
        std::fs::read_to_string(path).unwrap().lines().map(|l| serde_json::from_str(l).unwrap()).collect()
    }

    #[test]
    fn session_ids_cannot_escape_the_sessions_folder() {
        assert_eq!(sanitize_session_id("../../etc/passwd"), "______etc_passwd");
        assert_eq!(sanitize_session_id(r"a\b:c"), "a_b_c");
        assert_eq!(sanitize_session_id(""), "session");
        assert_eq!(sanitize_session_id(&"x".repeat(500)).len(), 100);
        let d = tempfile::tempdir().unwrap();
        assert!(log_path(d.path(), "../x").starts_with(d.path().join(".vanilla").join("sessions")));
    }

    #[test]
    fn events_before_started_are_kept_and_all_are_forwarded() {
        let d = tempfile::tempdir().unwrap();
        let seen = Arc::new(Mutex::new(Vec::new()));
        let sink = seen.clone();
        let emit = with_log(d.path().to_path_buf(), Arc::new(move |e| sink.lock().unwrap().push(e)));
        emit(AgentEvent::Stderr { session_id: "s1".into(), line: "early".into() });
        emit(started("s1"));
        emit(AgentEvent::PromptDone { session_id: "s1".into(), stop_reason: "end_turn".into() });
        assert_eq!(seen.lock().unwrap().len(), 3);
        let lines = read_lines(&log_path(d.path(), "s1"));
        assert_eq!(lines.iter().map(|l| l["event"]["type"].as_str().unwrap()).collect::<Vec<_>>(), ["stderr", "started", "promptDone"]);
        assert!(lines[0]["ts"].as_u64().unwrap() > 0);
    }

    #[test]
    fn a_second_session_appends_to_its_own_file_and_failures_do_not_break_events() {
        let d = tempfile::tempdir().unwrap();
        // a file where the .vanilla folder should be makes logging impossible
        std::fs::write(d.path().join(".vanilla"), "not a dir").unwrap();
        let seen = Arc::new(Mutex::new(Vec::new()));
        let sink = seen.clone();
        let emit = with_log(d.path().to_path_buf(), Arc::new(move |e| sink.lock().unwrap().push(e)));
        emit(started("s1"));
        emit(AgentEvent::Closed { session_id: "s1".into(), reason: "user".into() });
        assert_eq!(seen.lock().unwrap().len(), 2);
    }
}

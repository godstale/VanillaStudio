//! Export worker runs (D-012, T5.2): fixed argv only. The UI passes a job id
//! and a job JSON document, never a command string. The backend writes the
//! document to a temp file and runs exactly:
//!
//!   `node <app>/workers/vanilla-export.mjs <job.json>`
//!
//! Progress arrives as NDJSON on stdout (one JSON object per line, the worker
//! contract in `packages/export-worker/src/job.ts`) and is forwarded over the
//! Channel. Exit codes follow the worker: 0 done, 2 cancelled, 1 failed.

use crate::commands::fs_commands::{
    get_active_workspace_internal, resolve_and_verify_workspace_path,
};
use crate::process::{self, base_command, resolve_command, RunOptions};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;

/// Worker kinds the backend accepts. Anything else is rejected before spawn.
const ALLOWED_KINDS: [&str; 4] = ["web", "image", "slides", "video"];

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ExportEvent {
    Started { job_id: String, program: String, argv: Vec<String> },
    Progress { percent: f64, step: String, message: Option<String> },
    Log { stream: String, line: String },
    Done { out_dir: String, files: Vec<String> },
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExportReport {
    pub out_dir: String,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedJob {
    kind: String,
    out_dir: PathBuf,
}

/// The only argv an export run ever gets (after the node executable).
pub fn export_argv(script: &Path, job_file: &Path) -> Vec<String> {
    vec![
        script.to_string_lossy().into_owned(),
        job_file.to_string_lossy().into_owned(),
    ]
}

/// Check the job document the UI sent: known kind, non-empty project/out dirs,
/// out dir inside the project dir (lexical, after the caller verified the
/// project dir is inside the workspace). Returns the kind and out dir.
pub fn validate_export_job(text: &str) -> Result<ValidatedJob, String> {
    let v: serde_json::Value =
        serde_json::from_str(text).map_err(|_| "invalid-job-json".to_string())?;
    let kind = v
        .get("kind")
        .and_then(|k| k.as_str())
        .ok_or_else(|| "invalid-job-kind".to_string())?;
    if !ALLOWED_KINDS.contains(&kind) {
        return Err("invalid-job-kind".to_string());
    }
    let project_dir = v
        .get("projectDir")
        .and_then(|p| p.as_str())
        .filter(|p| !p.is_empty())
        .ok_or_else(|| "invalid-job-path".to_string())?;
    let out_dir = v
        .get("outDir")
        .and_then(|p| p.as_str())
        .filter(|p| !p.is_empty())
        .ok_or_else(|| "invalid-job-path".to_string())?;
    // Lexical containment: the worker only ever writes into out_dir, which the
    // app derives as `<project>/exports/<ts>-<fmt>/`.
    let project = PathBuf::from(project_dir);
    let out = PathBuf::from(out_dir);
    if out != project && !out.starts_with(&project) {
        return Err("out-dir-outside-project".to_string());
    }
    Ok(ValidatedJob { kind: kind.to_string(), out_dir: out })
}

/// One stdout line of the worker: NDJSON `progress` | `log` | `done` | `error`.
/// Returns the event to forward, or the raw line as a stdout log when the
/// worker printed something that is not an event (never silently dropped).
fn translate_worker_line(line: &str) -> ExportEvent {
    let v: serde_json::Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(_) => {
            return ExportEvent::Log { stream: "stdout".to_string(), line: line.to_string() };
        }
    };
    match v.get("type").and_then(|t| t.as_str()) {
        Some("progress") => ExportEvent::Progress {
            percent: v.get("percent").and_then(|p| p.as_f64()).unwrap_or(0.0),
            step: v.get("step").and_then(|s| s.as_str()).unwrap_or("").to_string(),
            message: v.get("message").and_then(|m| m.as_str()).map(str::to_string),
        },
        Some("log") => ExportEvent::Log {
            stream: v.get("stream").and_then(|s| s.as_str()).unwrap_or("stdout").to_string(),
            line: v.get("line").and_then(|l| l.as_str()).unwrap_or("").to_string(),
        },
        Some("done") => ExportEvent::Done {
            out_dir: v.get("out_dir").and_then(|d| d.as_str()).unwrap_or("").to_string(),
            files: v
                .get("files")
                .and_then(|f| f.as_array())
                .map(|a| a.iter().filter_map(|x| x.as_str().map(str::to_string)).collect())
                .unwrap_or_default(),
        },
        // `error` lines only inform the final Err; surface them as stderr logs now.
        _ => ExportEvent::Log { stream: "stderr".to_string(), line: line.to_string() },
    }
}

/// Last `error` message the worker printed, for the final Err on exit 1.
fn worker_error_message(lines: &[String]) -> Option<String> {
    lines.iter().rev().find_map(|l| {
        let v: serde_json::Value = serde_json::from_str(l).ok()?;
        if v.get("type").and_then(|t| t.as_str()) == Some("error") {
            v.get("message").and_then(|m| m.as_str()).map(str::to_string)
        } else {
            None
        }
    })
}

#[derive(Debug, Clone)]
pub struct ExportSpec {
    pub node: PathBuf,
    pub script: PathBuf,
    pub job_file: PathBuf,
    pub out_dir: PathBuf,
    /// Verified workspace project dir: the worker's working directory (W1 fix).
    pub project_dir: PathBuf,
    pub job_id: String,
    pub path_env: String,
}

type Emit = Arc<dyn Fn(ExportEvent) + Send + Sync>;

fn pump<R: Read + Send + 'static>(
    r: Option<R>,
    emit: Emit,
    collect: Arc<Mutex<Vec<String>>>,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        if let Some(r) = r {
            for line in BufReader::new(r).split(b'\n').map_while(Result::ok) {
                let line = String::from_utf8_lossy(&line).trim_end_matches('\r').to_string();
                if line.is_empty() {
                    continue;
                }
                collect.lock().unwrap().push(line.clone());
                emit(translate_worker_line(&line));
            }
        }
    })
}

/// Run one export job to completion. Exit 0 resolves with the `done` report
/// (or the job out dir when the worker exited cleanly without one), exit 2 is
/// `cancelled`, anything else reports the worker's `error` message.
pub fn run_export(
    spec: &ExportSpec,
    cancel: &AtomicBool,
    emit: Emit,
) -> Result<ExportReport, String> {
    let argv = export_argv(&spec.script, &spec.job_file);
    emit(ExportEvent::Started {
        job_id: spec.job_id.clone(),
        program: "node".to_string(),
        argv: argv.clone(),
    });
    let args: Vec<&str> = argv.iter().map(String::as_str).collect();
    let opts = RunOptions { cwd: Some(spec.project_dir.clone()), ..RunOptions::new(Duration::ZERO).path(&spec.path_env) };
    let mut child =
        base_command(&spec.node, &args, &opts).spawn().map_err(|e| format!("spawn:{e}"))?;
    #[cfg(windows)]
    let jobobj = process::JobObject::new().ok().filter(|j| j.assign(&child).is_ok());

    let lines: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
    let readers = [
        pump(child.stdout.take(), emit.clone(), lines.clone()),
        pump(child.stderr.take(), emit.clone(), lines.clone()),
    ];
    let code = loop {
        match child.try_wait() {
            Ok(Some(s)) => break s.code(),
            Ok(None) if cancel.load(Ordering::SeqCst) => {
                #[cfg(windows)]
                if let Some(j) = &jobobj {
                    j.terminate();
                }
                let _ = child.kill();
                let _ = child.wait();
                break None;
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(30)),
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                for r in readers {
                    let _ = r.join();
                }
                return Err(format!("wait:{e}"));
            }
        }
    };
    // The tree is gone (or the run finished); grandchildren holding the pipes
    // can no longer block the readers.
    for r in readers {
        let _ = r.join();
    }
    // KILL_ON_JOB_CLOSE drops the tree with the last handle.
    #[cfg(windows)]
    drop(jobobj);

    match code {
        Some(0) => {
            let lines = lines.lock().unwrap();
            let done = lines.iter().rev().find_map(|l| match translate_worker_line(l) {
                ExportEvent::Done { out_dir, files } => Some((out_dir, files)),
                _ => None,
            });
            match done {
                Some((out_dir, files)) => Ok(ExportReport { out_dir, files }),
                None => Ok(ExportReport {
                    out_dir: spec.out_dir.to_string_lossy().into_owned(),
                    files: Vec::new(),
                }),
            }
        }
        Some(2) | None => Err("cancelled".to_string()),
        _ => {
            let lines = lines.lock().unwrap();
            Err(worker_error_message(&lines)
                .unwrap_or_else(|| format!("exit:{}", code.map_or("none".to_string(), |c| c.to_string()))))
        }
    }
}

static EXPORT_JOBS: LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn cancel_flag(job_id: &str) -> Arc<AtomicBool> {
    let flag = Arc::new(AtomicBool::new(false));
    EXPORT_JOBS.lock().unwrap().insert(job_id.to_string(), flag.clone());
    flag
}

fn take_cancel_flag(job_id: &str) {
    EXPORT_JOBS.lock().unwrap().remove(job_id);
}

/// Validate the project folder: must exist inside the active workspace (AGENTS.md section 7).
fn checked_project_dir(dir: &str) -> Result<PathBuf, String> {
    if get_active_workspace_internal().is_none() {
        return Err("no-workspace".into());
    }
    resolve_and_verify_workspace_path(dir, None, true)
}

/// `\\?\C:\x` breaks some Node tooling; hand Node the plain form.
fn plain_path(p: &Path) -> PathBuf {
    let s = p.to_string_lossy();
    match s.strip_prefix(r"\\?\") {
        Some(rest) if !rest.starts_with(r"UNC\") => PathBuf::from(rest),
        _ => p.to_path_buf(),
    }
}

fn resolve_worker_script<R: tauri::Runtime>(app: &tauri::AppHandle<R>, name: &str) -> Result<PathBuf, String> {
    use tauri::Manager;
    if let Ok(res) = app.path().resource_dir() {
        let p = res.join("resources").join("workers").join(name);
        if p.is_file() {
            return Ok(plain_path(&p));
        }
    }
    let dev = Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("resources").join("workers").join(name);
    dev.canonicalize().map(|p| plain_path(&p)).map_err(|_| format!("worker-not-found:{name}"))
}

/// Run one export job. `job_json` is the worker job document (`version: 1`);
/// only its `kind` and paths are inspected here. Errors are short codes:
/// `no-workspace`, `invalid-job-*`, `out-dir-outside-project`,
/// `not-found:node`, `worker-not-found:*`, `cancelled`, `exit:<code>`.
#[tauri::command]
pub async fn start_export_job<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    project_dir: String,
    job_id: String,
    job_json: String,
    on_event: tauri::ipc::Channel<ExportEvent>,
) -> Result<ExportReport, String> {
    let dir = plain_path(&checked_project_dir(&project_dir)?);
    let validated = validate_export_job(&job_json)?;
    let script = resolve_worker_script(&app, "vanilla-export.mjs")?;
    tauri::async_runtime::spawn_blocking(move || {
        let emit: Emit = Arc::new(move |e| {
            let _ = on_event.send(e);
        });
        let flag = cancel_flag(&job_id);
        // The worker reads the job from a file; the temp copy never leaves this machine.
        let job_file = std::env::temp_dir().join(format!("vanilla-export-{job_id}.json"));
        let result = (|| {
            std::fs::create_dir_all(&validated.out_dir).map_err(|e| e.to_string())?;
            std::fs::write(&job_file, &job_json).map_err(|e| e.to_string())?;
            let spec = ExportSpec {
                node: resolve_command("node", &process::fresh_path())
                    .ok_or_else(|| "not-found:node".to_string())?,
                script,
                job_file: job_file.clone(),
                out_dir: validated.out_dir,
                // The command already verified `dir` is the workspace project;
                // the worker runs with it as cwd, the job file carries the
                // validated out dir inside that project.
                project_dir: dir,
                job_id: job_id.clone(),
                path_env: process::fresh_path(),
            };
            run_export(&spec, &flag, emit)
        })();
        let _ = std::fs::remove_file(&job_file);
        take_cancel_flag(&job_id);
        result
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|r| r)
}

/// Request cancellation of a running export job. Unknown ids are a no-op.
#[tauri::command]
pub fn cancel_export_job(job_id: String) {
    if let Some(flag) = EXPORT_JOBS.lock().unwrap().get(&job_id) {
        flag.store(true, Ordering::SeqCst);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn argv_is_fixed_shape() {
        let a = export_argv(Path::new("C:/app/vanilla-export.mjs"), Path::new("C:/tmp/j.json"));
        assert_eq!(a, ["C:/app/vanilla-export.mjs", "C:/tmp/j.json"]);
    }

    #[test]
    fn events_serialize_camel_case() {
        let v = serde_json::to_value(ExportEvent::Progress { percent: 12.5, step: "build".into(), message: None }).unwrap();
        assert_eq!(v, serde_json::json!({ "kind": "progress", "percent": 12.5, "step": "build", "message": null }));
        let v = serde_json::to_value(ExportReport { out_dir: "o".into(), files: vec!["a".into()] }).unwrap();
        assert_eq!(v, serde_json::json!({ "outDir": "o", "files": ["a"] }));
    }

    fn job(kind: &str) -> String {
        serde_json::json!({
            "version": 1,
            "kind": kind,
            "projectDir": "C:/p",
            "outDir": "C:/p/exports/20240101-web",
        })
        .to_string()
    }

    #[test]
    fn validate_accepts_known_kinds() {
        for kind in ALLOWED_KINDS {
            let v = validate_export_job(&job(kind)).unwrap();
            assert_eq!(v.kind, kind);
            assert_eq!(v.out_dir, PathBuf::from("C:/p/exports/20240101-web"));
        }
    }

    #[test]
    fn validate_rejects_bad_documents() {
        assert_eq!(validate_export_job("not json").unwrap_err(), "invalid-job-json");
        assert_eq!(validate_export_job(&job("pdf")).unwrap_err(), "invalid-job-kind");
        assert_eq!(validate_export_job("{}").unwrap_err(), "invalid-job-kind");
        let missing_out = serde_json::json!({"version": 1, "kind": "web", "projectDir": "C:/p"}).to_string();
        assert_eq!(validate_export_job(&missing_out).unwrap_err(), "invalid-job-path");
        let outside = serde_json::json!({"version": 1, "kind": "web", "projectDir": "C:/p", "outDir": "C:/other/x"}).to_string();
        assert_eq!(validate_export_job(&outside).unwrap_err(), "out-dir-outside-project");
    }

    #[test]
    fn worker_lines_translate() {
        match translate_worker_line(r#"{"type":"progress","percent":50,"step":"build"}"#) {
            ExportEvent::Progress { percent, step, message } => {
                assert_eq!((percent, step.as_str(), message), (50.0, "build", None));
            }
            e => panic!("unexpected {e:?}"),
        }
        match translate_worker_line(r#"{"type":"log","stream":"stderr","line":"x"}"#) {
            ExportEvent::Log { stream, line } => assert_eq!((stream.as_str(), line.as_str()), ("stderr", "x")),
            e => panic!("unexpected {e:?}"),
        }
        match translate_worker_line(r#"{"type":"done","out_dir":"o","files":["a"]}"#) {
            ExportEvent::Done { out_dir, files } => assert_eq!((out_dir.as_str(), files), ("o", vec!["a".to_string()])),
            e => panic!("unexpected {e:?}"),
        }
        // Non-JSON and error lines are kept as logs, never dropped.
        match translate_worker_line("vite noise") {
            ExportEvent::Log { stream, line } => assert_eq!((stream.as_str(), line.as_str()), ("stdout", "vite noise")),
            e => panic!("unexpected {e:?}"),
        }
        match translate_worker_line(r#"{"type":"error","message":"boom"}"#) {
            ExportEvent::Log { stream, .. } => assert_eq!(stream, "stderr"),
            e => panic!("unexpected {e:?}"),
        }
        assert_eq!(
            worker_error_message(&[
                r#"{"type":"progress","percent":10,"step":"build"}"#.to_string(),
                r#"{"type":"error","message":"boom"}"#.to_string(),
            ]),
            Some("boom".to_string())
        );
    }

    fn node() -> PathBuf {
        resolve_command("node", &process::fresh_path()).expect("node on PATH")
    }

    fn spec_with_script(dir: &Path, script: &str, job_id: &str) -> ExportSpec {
        let script_path = dir.join(format!("fake-export-{job_id}.mjs"));
        std::fs::write(&script_path, script).unwrap();
        let out_dir = dir.join("out");
        ExportSpec {
            node: node(),
            script: script_path,
            job_file: dir.join("job.json"),
            out_dir,
            project_dir: dir.to_path_buf(),
            job_id: job_id.to_string(),
            path_env: process::fresh_path(),
        }
    }

    fn collect() -> (Emit, Arc<Mutex<Vec<ExportEvent>>>) {
        let events = Arc::new(Mutex::new(Vec::new()));
        let sink = events.clone();
        (Arc::new(move |e| sink.lock().unwrap().push(e)), events)
    }

    #[test]
    fn run_reports_done_and_forwards_ndjson() {
        let d = tempfile::tempdir().unwrap();
        let script = "console.log(JSON.stringify({type:'progress',percent:50,step:'build'}));\nconsole.log('plain noise');\nconsole.log(JSON.stringify({type:'done',out_dir:'fake-out',files:['a.png']}));\n";
        let spec = spec_with_script(d.path(), script, "done1");
        let (emit, events) = collect();
        let report = run_export(&spec, &AtomicBool::new(false), emit).unwrap();
        assert_eq!(report, ExportReport { out_dir: "fake-out".into(), files: vec!["a.png".into()] });
        let ev = events.lock().unwrap();
        assert!(matches!(ev.first(), Some(ExportEvent::Started { .. })));
        assert!(ev.contains(&ExportEvent::Progress { percent: 50.0, step: "build".into(), message: None }));
        assert!(ev.contains(&ExportEvent::Log { stream: "stdout".into(), line: "plain noise".into() }));
        assert!(ev.contains(&ExportEvent::Done { out_dir: "fake-out".into(), files: vec!["a.png".into()] }));
    }

    #[test]
    fn run_uses_the_project_dir_as_cwd() {
        let d = tempfile::tempdir().unwrap();
        let project = d.path().join("proj");
        std::fs::create_dir_all(&project).unwrap();
        // A relative write lands in the worker cwd: it must be the project dir.
        let spec = ExportSpec {
            project_dir: project.clone(),
            ..spec_with_script(
                d.path(),
                "import fs from 'node:fs';\nfs.writeFileSync('cwd-marker.txt', process.cwd());\n",
                "cwd1",
            )
        };
        let (emit, _) = collect();
        run_export(&spec, &AtomicBool::new(false), emit).unwrap();
        let marker = project.join("cwd-marker.txt");
        assert!(marker.is_file(), "worker cwd was not the project dir");
        let cwd = PathBuf::from(std::fs::read_to_string(&marker).unwrap());
        assert_eq!(cwd.canonicalize().unwrap(), project.canonicalize().unwrap());
    }

    #[test]
    fn run_maps_exit_codes() {
        let d = tempfile::tempdir().unwrap();
        // exit 1 with an error event → the worker message.
        let spec = spec_with_script(d.path(), "console.log(JSON.stringify({type:'error',message:'nope'}));\nprocess.exit(1);\n", "fail1");
        let (emit, _) = collect();
        assert_eq!(run_export(&spec, &AtomicBool::new(false), emit).unwrap_err(), "nope");
        // exit 1 without an error event → exit code.
        let spec = spec_with_script(d.path(), "process.exit(3);\n", "fail2");
        let (emit, _) = collect();
        assert_eq!(run_export(&spec, &AtomicBool::new(false), emit).unwrap_err(), "exit:3");
        // exit 2 → cancelled.
        let spec = spec_with_script(d.path(), "process.exit(2);\n", "cancel1");
        let (emit, _) = collect();
        assert_eq!(run_export(&spec, &AtomicBool::new(false), emit).unwrap_err(), "cancelled");
    }

    #[test]
    fn cancel_stops_the_run() {
        let d = tempfile::tempdir().unwrap();
        let spec = spec_with_script(d.path(), "setInterval(()=>{},1000);\n", "stop1");
        let (emit, _) = collect();
        let flag = AtomicBool::new(true);
        let started = std::time::Instant::now();
        assert_eq!(run_export(&spec, &flag, emit).unwrap_err(), "cancelled");
        assert!(started.elapsed() < Duration::from_secs(10));
    }
}

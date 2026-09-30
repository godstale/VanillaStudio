//! Integration tests: the real spawn/ACP path against a mock ACP agent (`testdata/mock-agent.mjs`, Node).
//! Skipped (with a message) when Node is not installed.

use crate::agent_host::events::*;
use crate::agent_host::launch::*;
use crate::agent_host::session::{start, SessionHandle, StartParams};
use crate::process::{fresh_path, resolve_command};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

pub struct Rig {
    pub session: SessionHandle,
    pub events: Arc<Mutex<Vec<AgentEvent>>>,
    pub project: tempfile::TempDir,
    pub record: PathBuf,
    _rec: tempfile::TempDir,
}

fn mock_script() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("src/agent_host/testdata/mock-agent.mjs")
}

fn node_available() -> bool {
    let ok = resolve_command("node", &fresh_path()).is_some();
    if !ok {
        eprintln!("SKIP: node not found");
    }
    ok
}

pub fn params(project: &Path, record: &Path, agent_id: &str) -> StartParams {
    StartParams {
        agent_id: agent_id.into(),
        launch: LaunchSpec {
            command: "node".into(),
            args: vec![mock_script().to_string_lossy().into_owned()],
            env: BTreeMap::from([("MOCK_RECORD".to_string(), record.to_string_lossy().into_owned())]),
        },
        project_dir: project.canonicalize().unwrap(),
        path_env: fresh_path(),
        session_options: Value::Null,
        use_global_settings: false,
        mcp_servers: vec![],
        resume_session_id: None,
    }
}

async fn rig_with(agent_id: &str, tweak: impl FnOnce(&mut StartParams)) -> Option<Rig> {
    rig_emit(agent_id, tweak, |e| e).await
}

/// Like `rig_with`, but the event sink can be wrapped (e.g. by an MCP lease).
async fn rig_emit(agent_id: &str, tweak: impl FnOnce(&mut StartParams), wrap: impl FnOnce(Emit) -> Emit) -> Option<Rig> {
    if !node_available() {
        return None;
    }
    let project = tempfile::tempdir().unwrap();
    let rec = tempfile::tempdir().unwrap();
    let record = rec.path().join("record.jsonl");
    let mut p = params(project.path(), &record, agent_id);
    tweak(&mut p);
    let events: Arc<Mutex<Vec<AgentEvent>>> = Arc::default();
    let sink = events.clone();
    let emit = wrap(Arc::new(move |e| sink.lock().unwrap().push(e)));
    let session = start(p, emit).await.expect("session start");
    Some(Rig { session, events, project, record, _rec: rec })
}

async fn rig() -> Option<Rig> {
    rig_with("mock", |_| {}).await
}

impl Rig {
    fn events(&self) -> Vec<AgentEvent> {
        self.events.lock().unwrap().clone()
    }

    fn recorded(&self, kind: &str) -> Vec<Value> {
        std::fs::read_to_string(&self.record)
            .unwrap_or_default()
            .lines()
            .filter_map(|l| serde_json::from_str::<Value>(l).ok())
            .filter(|v| v["kind"] == kind)
            .map(|v| v["data"].clone())
            .collect()
    }

    /// Text of all agent message chunks so far.
    fn message_text(&self) -> String {
        self.events()
            .iter()
            .filter_map(|e| match e {
                AgentEvent::Update { update, .. } if update["sessionUpdate"] == "agent_message_chunk" => update["content"]["text"].as_str().map(str::to_string),
                _ => None,
            })
            .collect()
    }

    async fn wait_for(&self, what: &str, pred: impl Fn(&AgentEvent) -> bool) -> AgentEvent {
        for _ in 0..500 {
            if let Some(e) = self.events().into_iter().find(|e| pred(e)) {
                return e;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        panic!("timed out waiting for {what}; events: {:#?}", self.events());
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn handshake_uses_project_cwd_and_fs_capability_without_terminal() {
    let Some(r) = rig().await else { return };
    let init = &r.recorded("initialize")[0];
    assert_eq!(init["clientCapabilities"]["fs"]["readTextFile"], true);
    assert_eq!(init["clientCapabilities"]["fs"]["writeTextFile"], true);
    assert_ne!(init["clientCapabilities"]["terminal"], true, "terminal capability must not be offered");
    let new = &r.recorded("session/new")[0];
    let canon = r.project.path().canonicalize().unwrap();
    // spawn cwd and session/new cwd are both the project folder
    assert_eq!(PathBuf::from(new["processCwd"].as_str().unwrap()).canonicalize().unwrap(), canon);
    assert_eq!(PathBuf::from(new["cwd"].as_str().unwrap()).canonicalize().unwrap(), canon);
    let started = r.events().into_iter().find(|e| matches!(e, AgentEvent::Started { .. })).expect("started event");
    match started {
        AgentEvent::Started { session_id, agent_name, load_session, modes, .. } => {
            assert_eq!(session_id, "mock-sess-1");
            assert_eq!(agent_name.as_deref(), Some("mock-agent"));
            assert!(load_session);
            assert_eq!(modes["currentModeId"], "default");
        }
        _ => unreachable!(),
    }
    r.session.close();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn session_new_carries_isolation_meta_and_mcp_servers() {
    let Some(r) = rig_with("claude-code", |p| {
        p.mcp_servers = vec![McpHttpSpec { name: "vanilla".into(), url: "http://127.0.0.1:1/mcp".into(), bearer_token: "tok".into() }];
    })
    .await
    else {
        return;
    };
    let new = &r.recorded("session/new")[0];
    let opts = &new["_meta"]["claudeCode"]["options"];
    assert_eq!(opts["settingSources"], json!(["project"]));
    assert_eq!(opts["settings"]["permissions"]["ask"], json!(["Bash", "PowerShell"]));
    let mcp = &new["mcpServers"][0];
    assert_eq!(mcp["name"], "vanilla");
    assert_eq!(mcp["url"], "http://127.0.0.1:1/mcp");
    assert_eq!(mcp["headers"][0], json!({ "name": "Authorization", "value": "Bearer tok" }));
    r.session.close();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn prompt_streams_updates_and_returns_stop_reason() {
    let Some(r) = rig().await else { return };
    let stop = r.session.prompt("hello".into()).await.unwrap();
    assert_eq!(stop, "end_turn");
    assert_eq!(r.recorded("prompt"), vec![json!("hello")]);
    assert_eq!(r.message_text(), "hi there");
    let kinds: Vec<String> = r
        .events()
        .iter()
        .filter_map(|e| match e {
            AgentEvent::Update { update, .. } => update["sessionUpdate"].as_str().map(str::to_string),
            AgentEvent::PromptDone { .. } => Some("promptDone".into()),
            _ => None,
        })
        .collect();
    assert_eq!(kinds, ["agent_message_chunk", "agent_message_chunk", "tool_call", "tool_call_update", "promptDone"]);
    r.session.close();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn permission_request_reaches_the_user_and_hides_allow_always() {
    let Some(r) = rig().await else { return };
    let session = Arc::new(r);
    let s2 = session.clone();
    let turn = tokio::spawn(async move { s2.session.prompt("perm:execute:-".into()).await });

    let req = session.wait_for("permission request", |e| matches!(e, AgentEvent::PermissionRequest { .. })).await;
    let (request_id, options) = match req {
        AgentEvent::PermissionRequest { request_id, options, tool_call, .. } => {
            assert_eq!(tool_call["kind"], "execute");
            (request_id, options)
        }
        _ => unreachable!(),
    };
    let kinds: Vec<&str> = options.iter().map(|o| o.kind.as_str()).collect();
    assert_eq!(kinds, ["allow_once", "reject_once"], "allow_always must not be exposed");
    // an option that was hidden cannot be chosen either
    assert!(session.session.respond_permission(&request_id, Some("allow-always")).is_err());
    assert!(session.session.respond_permission("perm-unknown", Some("allow-once")).is_err());

    session.session.respond_permission(&request_id, Some("allow-once")).unwrap();
    assert_eq!(turn.await.unwrap().unwrap(), "end_turn");
    assert_eq!(session.message_text(), "outcome:allow-once");
    session
        .wait_for("resolved", |e| matches!(e, AgentEvent::PermissionResolved { outcome: PermissionOutcomeView::Allowed, decided_by: DecidedBy::User, .. }))
        .await;
    session.session.close();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn rejecting_a_permission_is_reported_to_the_agent() {
    let Some(r) = rig().await else { return };
    let session = Arc::new(r);
    let s2 = session.clone();
    let turn = tokio::spawn(async move { s2.session.prompt("perm:execute:-".into()).await });
    let AgentEvent::PermissionRequest { request_id, .. } = session.wait_for("request", |e| matches!(e, AgentEvent::PermissionRequest { .. })).await else { unreachable!() };
    session.session.respond_permission(&request_id, Some("reject-once")).unwrap();
    turn.await.unwrap().unwrap();
    assert_eq!(session.message_text(), "outcome:reject-once");
    session.wait_for("resolved", |e| matches!(e, AgentEvent::PermissionResolved { outcome: PermissionOutcomeView::Rejected, .. })).await;
    session.session.close();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn cancel_ends_a_running_turn() {
    let Some(r) = rig().await else { return };
    let session = Arc::new(r);
    let s2 = session.clone();
    let turn = tokio::spawn(async move { s2.session.prompt("slow".into()).await });
    session.wait_for("first chunk", |e| matches!(e, AgentEvent::Update { .. })).await;
    session.session.cancel();
    assert_eq!(turn.await.unwrap().unwrap(), "cancelled");
    assert_eq!(session.recorded("cancel").len(), 1);
    session.session.close();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn cancel_answers_pending_permission_as_cancelled() {
    let Some(r) = rig().await else { return };
    let session = Arc::new(r);
    let s2 = session.clone();
    let turn = tokio::spawn(async move { s2.session.prompt("perm:execute:-".into()).await });
    session.wait_for("request", |e| matches!(e, AgentEvent::PermissionRequest { .. })).await;
    session.session.cancel();
    turn.await.unwrap().unwrap();
    assert_eq!(session.message_text(), "outcome:cancelled");
    session.wait_for("resolved", |e| matches!(e, AgentEvent::PermissionResolved { outcome: PermissionOutcomeView::Cancelled, .. })).await;
    session.session.close();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn second_prompt_while_busy_is_rejected() {
    let Some(r) = rig().await else { return };
    let session = Arc::new(r);
    let s2 = session.clone();
    let turn = tokio::spawn(async move { s2.session.prompt("slow".into()).await });
    session.wait_for("first chunk", |e| matches!(e, AgentEvent::Update { .. })).await;
    assert_eq!(session.session.prompt("hello".into()).await, Err(HostError::Busy));
    session.session.cancel();
    turn.await.unwrap().unwrap();
    session.session.close();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn close_ends_the_session_and_reports_user_reason() {
    let Some(r) = rig().await else { return };
    r.session.close();
    let e = r.wait_for("closed", |e| matches!(e, AgentEvent::Closed { .. })).await;
    assert!(matches!(e, AgentEvent::Closed { reason, .. } if reason == "user"));
    assert!(r.session.is_closed());
    assert!(r.session.prompt("hello".into()).await.is_err());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn agent_crash_fails_the_turn_and_closes_the_session() {
    let Some(r) = rig().await else { return };
    let res = r.session.prompt("die".into()).await;
    assert!(res.is_err(), "{res:?}");
    let e = r.wait_for("closed", |e| matches!(e, AgentEvent::Closed { .. })).await;
    assert!(matches!(e, AgentEvent::Closed { reason, .. } if reason != "user"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn fs_requests_inside_the_project_are_served() {
    let Some(r) = rig().await else { return };
    std::fs::write(r.project.path().join("notes.txt"), "line1\nline2\n").unwrap();
    r.session.prompt("fsread:notes.txt".into()).await.unwrap();
    assert_eq!(r.message_text(), "fs:ok:line1\nline2\n");
    r.session.prompt("fswrite:out.txt:written".into()).await.unwrap();
    assert_eq!(std::fs::read_to_string(r.project.path().join("out.txt")).unwrap(), "written");
    r.session.close();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn start_fails_cleanly_when_the_adapter_is_missing() {
    let project = tempfile::tempdir().unwrap();
    let mut p = params(project.path(), &project.path().join("r.jsonl"), "mock");
    p.launch.command = "definitely-not-installed-xyz".into();
    let emit: Emit = Arc::new(|_| {});
    let err = start(p, emit).await.err().expect("must fail");
    assert!(matches!(err, HostError::AdapterNotFound(_)), "{err:?}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn start_fails_when_the_agent_exits_before_initialize() {
    if !node_available() {
        return;
    }
    let project = tempfile::tempdir().unwrap();
    let mut p = params(project.path(), &project.path().join("r.jsonl"), "mock");
    p.launch.args = vec!["-e".into(), "console.error('boom'); process.exit(2)".into()];
    let emit: Emit = Arc::new(|_| {});
    let err = start(p, emit).await.err().expect("must fail");
    assert!(matches!(err, HostError::Initialize(_)), "{err:?}");
}

/// Real adapter handshake (no prompt is sent, so no model usage). Run manually with an adapter
/// installed by `install_claude_adapter` (or `npm install` of the pinned package):
/// `VANILLA_TEST_ADAPTER_DIR=<dir> cargo test real_claude_adapter -- --ignored --nocapture`
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore]
async fn real_claude_adapter_initialize_and_new_session() {
    let dir = PathBuf::from(std::env::var("VANILLA_TEST_ADAPTER_DIR").expect("VANILLA_TEST_ADAPTER_DIR"));
    let status = crate::commands::process_commands::verify_claude_adapter(&dir);
    assert!(status.installed && status.pinned, "{status:?}");
    let project = tempfile::tempdir().unwrap();
    let mut p = params(project.path(), &project.path().join("r.jsonl"), "claude-code");
    p.launch.args = vec![status.entry.unwrap()];
    p.launch.env.clear();
    let events: Arc<Mutex<Vec<AgentEvent>>> = Arc::default();
    let sink = events.clone();
    let emit: Emit = Arc::new(move |e| sink.lock().unwrap().push(e));
    let session = start(p, emit).await.expect("real adapter start");
    let started = events.lock().unwrap().iter().find(|e| matches!(e, AgentEvent::Started { .. })).cloned().unwrap();
    eprintln!("{started:#?}");
    session.close();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn policy_auto_allows_project_edits_without_asking() {
    let Some(r) = rig().await else { return };
    let target = r.project.path().canonicalize().unwrap().join("hello.txt");
    r.session.prompt(format!("perm:edit:{}", target.display())).await.unwrap();
    assert_eq!(r.message_text(), "outcome:allow-once");
    let events = r.events();
    assert!(!events.iter().any(|e| matches!(e, AgentEvent::PermissionRequest { .. })), "no dialog for a project edit");
    assert!(events.iter().any(|e| matches!(
        e,
        AgentEvent::PermissionResolved { outcome: PermissionOutcomeView::Allowed, decided_by: DecidedBy::Policy, reason, .. } if reason == "project-write"
    )));
    r.session.close();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn policy_denies_outside_paths_without_asking() {
    let Some(r) = rig().await else { return };
    let outside = r.project.path().canonicalize().unwrap().parent().unwrap().join("outside.txt");
    r.session.prompt(format!("perm:read:{}", outside.display())).await.unwrap();
    assert_eq!(r.message_text(), "outcome:reject-once");
    let events = r.events();
    assert!(!events.iter().any(|e| matches!(e, AgentEvent::PermissionRequest { .. })));
    assert!(events.iter().any(|e| matches!(
        e,
        AgentEvent::PermissionResolved { outcome: PermissionOutcomeView::Rejected, decided_by: DecidedBy::Policy, reason, .. } if reason == "outside-project"
    )));
    r.session.close();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn fs_requests_outside_the_project_are_refused_and_reported() {
    let Some(r) = rig().await else { return };
    let outside = r.project.path().canonicalize().unwrap().parent().unwrap().join("agent-host-outside.txt");
    std::fs::write(&outside, "secret").unwrap();
    r.session.prompt(format!("fsread:{}", outside.display())).await.unwrap();
    assert!(r.message_text().starts_with("fs:err:"), "{}", r.message_text());
    assert!(!r.message_text().contains("secret"));
    r.session.prompt(format!("fswrite:{}:pwned", outside.display())).await.unwrap();
    assert_eq!(std::fs::read_to_string(&outside).unwrap(), "secret");
    let denied = r.events().into_iter().filter(|e| matches!(e, AgentEvent::FsAccess { allowed: false, .. })).count();
    assert_eq!(denied, 2);
    std::fs::remove_file(&outside).ok();
    r.session.close();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn session_events_are_logged_to_the_project_session_file() {
    let Some(r) = rig().await else { return };
    r.session.prompt("hello".into()).await.unwrap();
    r.session.close();
    r.wait_for("closed", |e| matches!(e, AgentEvent::Closed { .. })).await;
    let path = crate::agent_host::log::log_path(&r.project.path().canonicalize().unwrap(), "mock-sess-1");
    let lines: Vec<Value> = std::fs::read_to_string(&path).unwrap().lines().map(|l| serde_json::from_str(l).unwrap()).collect();
    let types: Vec<&str> = lines.iter().map(|l| l["event"]["type"].as_str().unwrap()).collect();
    assert_eq!(types.first(), Some(&"started"));
    assert_eq!(types.last(), Some(&"closed"));
    for wanted in ["promptSent", "update", "promptDone"] {
        assert!(types.contains(&wanted), "{wanted} missing in {types:?}");
    }
    let sent = lines.iter().find(|l| l["event"]["type"] == "promptSent").unwrap();
    assert_eq!(sent["event"]["text"], "hello");
}

// --- T2.13 session resume (`session/load` -> `session/resume` -> unsupported error) ---

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn resume_prefers_session_load_and_suppresses_replay() {
    let Some(r) = rig_with("mock", |p| {
        p.resume_session_id = Some("old-sess-9".into());
    })
    .await
    else {
        return;
    };
    let loads = r.recorded("session/load");
    assert_eq!(loads.len(), 1);
    assert_eq!(loads[0]["sessionId"], "old-sess-9");
    assert!(r.recorded("session/new").is_empty(), "a resumed session must not open a new one");
    let started = r.events().into_iter().find(|e| matches!(e, AgentEvent::Started { .. })).expect("started event");
    match started {
        AgentEvent::Started { session_id, resumed, .. } => {
            assert_eq!(session_id, "old-sess-9");
            assert_eq!(resumed, Some(true));
        }
        _ => unreachable!(),
    }
    // The replayed conversation is already in the session log file; it must not reach the UI.
    assert!(!r.message_text().contains("old answer"), "replayed updates are not re-emitted");
    // The resumed session still takes prompts.
    assert_eq!(r.session.prompt("hello".into()).await.unwrap(), "end_turn");
    assert!(r.message_text().contains("hi there"));
    r.session.close();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn resume_falls_back_to_session_resume() {
    let Some(r) = rig_with("mock", |p| {
        p.launch.env.insert("MOCK_NO_LOAD".into(), "1".into());
        p.launch.env.insert("MOCK_RESUME".into(), "1".into());
        p.resume_session_id = Some("old-sess-3".into());
    })
    .await
    else {
        return;
    };
    assert!(r.recorded("session/load").is_empty());
    assert!(r.recorded("session/new").is_empty());
    let resumes = r.recorded("session/resume");
    assert_eq!(resumes.len(), 1);
    assert_eq!(resumes[0]["sessionId"], "old-sess-3");
    let started = r.events().into_iter().find(|e| matches!(e, AgentEvent::Started { .. })).expect("started event");
    match started {
        AgentEvent::Started { session_id, load_session, resumed, .. } => {
            assert_eq!(session_id, "old-sess-3");
            assert!(!load_session);
            assert_eq!(resumed, Some(true));
        }
        _ => unreachable!(),
    }
    r.session.close();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn resume_fails_when_the_agent_supports_neither() {
    if !node_available() {
        return;
    }
    let project = tempfile::tempdir().unwrap();
    let mut p = params(project.path(), &project.path().join("r.jsonl"), "mock");
    p.launch.env.insert("MOCK_NO_LOAD".into(), "1".into());
    p.resume_session_id = Some("old-sess-1".into());
    let emit: Emit = Arc::new(|_| {});
    let err = start(p, emit).await.err().expect("must fail");
    assert!(matches!(err, HostError::Session(ref m) if m == "resume-unsupported"), "{err:?}");
}

// --- T2.10: the agent reaches the app's own MCP server with its session token ---

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn agent_calls_the_app_mcp_server_with_its_token() {
    if !node_available() {
        return;
    }
    let server = crate::mcp_server::McpServer::start().await.expect("mcp server");
    let ep = server.issue_session();
    let spec = McpHttpSpec { name: ep.name.to_string(), url: ep.url.clone(), bearer_token: ep.token.clone() };
    let Some(r) = rig_with("mock", |p| {
        p.mcp_servers = vec![spec.clone()];
    })
    .await
    else {
        return;
    };
    let new = &r.recorded("session/new")[0];
    assert_eq!(new["mcpServers"][0]["name"], "vanilla-tools");
    r.session.prompt("mcpping".into()).await.unwrap();
    let report: Value = serde_json::from_str(&r.message_text()).expect("mock reports mcp json");
    assert_eq!(report["name"], "vanilla-tools");
    assert_eq!(report["noAuth"], 401, "requests without the session token are rejected");
    assert_eq!(report["init"], 200);
    assert!(report["tools"].as_array().unwrap().iter().any(|t| t == "ping"));
    assert_eq!(report["ping"], "pong");
    r.session.close();
}

// --- Bypass-mode defense (`bypassPermissions`/`auto` skip the permission gate) ---

fn started_modes(rig: &Rig) -> Value {
    rig.events()
        .into_iter()
        .find_map(|e| match e {
            AgentEvent::Started { modes, .. } => Some(modes),
            _ => None,
        })
        .expect("started event")
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn blocked_start_mode_is_reset_to_default() {
    let Some(r) = rig_with("claude-code", |p| {
        p.launch.env.insert("MOCK_MODE".into(), "bypassPermissions".into());
    })
    .await
    else {
        return;
    };
    // The host moved the agent back before reporting the session.
    let resets = r.recorded("session/set_mode");
    assert_eq!(resets.len(), 1);
    assert_eq!(resets[0]["modeId"], "default");
    let modes = started_modes(&r);
    assert_eq!(modes["currentModeId"], "default");
    let ids: Vec<&str> =
        modes["availableModes"].as_array().unwrap().iter().map(|m| m["id"].as_str().unwrap()).collect();
    assert!(!ids.contains(&"bypassPermissions") && !ids.contains(&"auto"), "blocked modes are not offered");
    assert!(ids.contains(&"default"));
    r.session.close();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn blocked_start_mode_fails_when_reset_refused() {
    if !node_available() {
        return;
    }
    let project = tempfile::tempdir().unwrap();
    let mut p = params(project.path(), &project.path().join("r.jsonl"), "claude-code");
    p.launch.env.insert("MOCK_MODE".into(), "bypassPermissions".into());
    p.launch.env.insert("MOCK_REFUSE_MODE".into(), "1".into());
    let emit: Emit = Arc::new(|_| {});
    let err = start(p, emit).await.err().expect("must fail");
    assert!(matches!(err, HostError::Session(ref m) if m.starts_with("mode-locked")), "{err:?}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn runtime_switch_into_blocked_mode_is_reset() {
    let Some(r) = rig_with("claude-code", |_| {}).await else { return };
    r.session.prompt("mode:bypassPermissions".into()).await.unwrap();
    r.wait_for("mode reset", |e| {
        matches!(e, AgentEvent::Update { update, .. }
            if update["sessionUpdate"] == "current_mode_update" && update["currentModeId"] == "default")
    })
    .await;
    // The blocked update itself never reaches the UI; the agent was moved back instead.
    assert!(
        !r.events().iter().any(|e| matches!(e, AgentEvent::Update { update, .. }
            if update.get("currentModeId").and_then(Value::as_str) == Some("bypassPermissions"))),
        "blocked mode must not be reported as current"
    );
    assert_eq!(r.recorded("session/set_mode").len(), 1);
    r.session.close();
}

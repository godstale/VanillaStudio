//! Tauri commands for the agent host (T2.6). The frontend session Context (T2.7) drives these and
//! receives `AgentEvent`s over a `Channel` (contract: `agent_host/events.rs`, `src/lib/agents/types.ts`).
//!
//! Safety gates enforced here (AGENTS.md section 7): no session before the folder is trusted, the
//! project folder must be inside the active workspace, adapter files under the app data folder
//! must exist, and the launch spec is validated (argv only, no shell).

use crate::agent_host::events::{AgentEvent, Emit};
use crate::agent_host::mcp;
use crate::agent_host::launch::{resolve_spec, HostError, LaunchSpec, McpHttpSpec};
use crate::agent_host::session::{start, SessionHandle, StartParams};
use crate::commands::fs_commands::{get_active_workspace_internal, resolve_and_verify_workspace_path};
use crate::process;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

const MAX_SESSIONS: usize = 8;
const MAX_PROMPT_CHARS: usize = 200_000;

static SESSIONS: Mutex<Option<HashMap<String, Arc<SessionHandle>>>> = Mutex::new(None);

fn with_sessions<T>(f: impl FnOnce(&mut HashMap<String, Arc<SessionHandle>>) -> T) -> T {
    let mut guard = SESSIONS.lock().unwrap();
    f(guard.get_or_insert_with(HashMap::new))
}

fn session(id: &str) -> Result<Arc<SessionHandle>, String> {
    with_sessions(|m| m.get(id).cloned()).ok_or_else(|| HostError::NoSession.to_string())
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartAgentParams {
    /// Registry id (`claude-code`, `codex`, ...). Only used for per-agent isolation rules.
    pub agent_id: String,
    pub launch: LaunchSpec,
    pub project_dir: String,
    /// Result of the frontend trust check (`useAgentAccess`). The host refuses when false.
    pub trusted: bool,
    #[serde(default)]
    pub session_options: Value,
    /// D-018 "use global settings" toggle. The shell ask rule stays on regardless.
    #[serde(default)]
    pub use_global_settings: bool,
    #[serde(default)]
    pub mcp_servers: Vec<McpHttpSpec>,
    /// ACP session id of an earlier session to continue (T2.13). Needs `loadSession` (or `resume`).
    #[serde(default)]
    pub resume_session_id: Option<String>,
}

/// Validate everything that does not need a running process. Returns the canonical project dir
/// and the launch spec with `{appData}` expanded.
pub fn prepare_start(p: &StartAgentParams, app_data: &Path) -> Result<(PathBuf, LaunchSpec), HostError> {
    if !p.trusted {
        return Err(HostError::NotTrusted);
    }
    if get_active_workspace_internal().is_none() {
        return Err(HostError::OutsideWorkspace("no active workspace".into()));
    }
    let project = resolve_and_verify_workspace_path(&p.project_dir, None, true).map_err(HostError::OutsideWorkspace)?;
    if !project.is_dir() {
        return Err(HostError::OutsideWorkspace(p.project_dir.clone()));
    }
    if let Some(id) = &p.resume_session_id {
        if id.is_empty() || id.chars().count() > 200 || id.chars().any(char::is_control) {
            return Err(HostError::InvalidSpec("bad resume session id".into()));
        }
    }
    let spec = resolve_spec(&p.launch, app_data)?;
    let adapters = app_data.join("adapters");
    for arg in &spec.args {
        let path = Path::new(arg);
        if path.starts_with(&adapters) && !path.exists() {
            return Err(HostError::AdapterNotFound(arg.clone()));
        }
    }
    Ok((project, spec))
}

/// Start an agent session. Returns the ACP session id; details follow as a `started` event.
#[tauri::command]
pub async fn start_agent_session<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    params: StartAgentParams,
    on_event: tauri::ipc::Channel<AgentEvent>,
) -> Result<String, String> {
    use tauri::Manager;
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let (project_dir, launch) = prepare_start(&params, &app_data).map_err(|e| e.to_string())?;
    if with_sessions(|m| m.len()) >= MAX_SESSIONS {
        return Err("too-many-sessions".into());
    }
    let emit: Emit = Arc::new(move |e| {
        if let AgentEvent::Closed { session_id, .. } = &e {
            with_sessions(|m| m.remove(session_id));
        }
        let _ = on_event.send(e);
    });
    // The app's own MCP tools (T2.10): a per-session token, revoked when the session ends.
    let lease = mcp::shared_server().await.map(|s| mcp::McpLease::issue(&s));
    let emit = match &lease {
        Some(l) => l.revoke_on_close(emit),
        None => emit,
    };
    let handle = start(
        StartParams {
            agent_id: params.agent_id,
            launch,
            project_dir,
            path_env: process::fresh_path(),
            session_options: params.session_options,
            use_global_settings: params.use_global_settings,
            mcp_servers: mcp::merge_servers(lease.as_ref().map(|l| l.spec()), params.mcp_servers),
            resume_session_id: params.resume_session_id,
        },
        emit,
    )
    .await
    .map_err(|e| {
        if let Some(l) = &lease {
            l.revoke();
        }
        e.to_string()
    })?;
    let id = handle.session_id.clone();
    let handle = Arc::new(handle);
    with_sessions(|m| m.insert(id.clone(), handle.clone()));
    if handle.is_closed() {
        // ended before it was registered (the Closed event could not remove it)
        with_sessions(|m| m.remove(&id));
    }
    Ok(id)
}

/// Send a prompt and wait until the turn ends. Returns the ACP `stopReason`.
#[tauri::command]
pub async fn send_agent_prompt(session_id: String, text: String) -> Result<String, String> {
    if text.trim().is_empty() {
        return Err("empty-prompt".into());
    }
    if text.chars().count() > MAX_PROMPT_CHARS {
        return Err("prompt-too-large".into());
    }
    session(&session_id)?.prompt(text).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cancel_agent_prompt(session_id: String) -> Result<(), String> {
    session(&session_id)?.cancel();
    Ok(())
}

/// Answer a `permissionRequest` event. `option_id: null` dismisses it (the agent sees `cancelled`).
#[tauri::command]
pub fn respond_agent_permission(session_id: String, request_id: String, option_id: Option<String>) -> Result<(), String> {
    session(&session_id)?.respond_permission(&request_id, option_id.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn close_agent_session(session_id: String) -> Result<(), String> {
    let handle = with_sessions(|m| m.remove(&session_id)).ok_or_else(|| HostError::NoSession.to_string())?;
    handle.close();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::fs_commands::set_active_workspace_internal;
    use std::collections::BTreeMap;

    fn params(project: &str, trusted: bool) -> StartAgentParams {
        StartAgentParams {
            agent_id: "claude-code".into(),
            launch: LaunchSpec { command: "node".into(), args: vec!["{appData}/adapters/x/index.js".into()], env: BTreeMap::new() },
            project_dir: project.into(),
            trusted,
            session_options: Value::Null,
            use_global_settings: false,
            mcp_servers: vec![],
            resume_session_id: None,
        }
    }

    // ACTIVE_WORKSPACE is process-global; keep everything that touches it in one test.
    #[test]
    fn start_gates_trust_workspace_and_adapter_files() {
        let d = tempfile::tempdir().unwrap();
        let ws = d.path().canonicalize().unwrap();
        let project = ws.join("proj");
        std::fs::create_dir_all(&project).unwrap();
        let outside = tempfile::tempdir().unwrap();
        let app_data = outside.path().join("appdata");
        std::fs::create_dir_all(app_data.join("adapters")).unwrap();
        let original_cwd = std::env::current_dir().unwrap();
        set_active_workspace_internal(Some(ws.to_string_lossy().into_owned()));
        let proj = project.to_string_lossy().into_owned();

        // untrusted folders never start a session
        assert_eq!(prepare_start(&params(&proj, false), &app_data).unwrap_err(), HostError::NotTrusted);
        // a folder outside the active workspace is refused, even when trusted
        let other = outside.path().to_string_lossy().into_owned();
        assert!(matches!(prepare_start(&params(&other, true), &app_data), Err(HostError::OutsideWorkspace(_))));
        assert!(matches!(prepare_start(&params("../nope", true), &app_data), Err(HostError::OutsideWorkspace(_))));
        // a file is not a project folder
        std::fs::write(project.join("f.txt"), "x").unwrap();
        let file = project.join("f.txt").to_string_lossy().into_owned();
        assert!(matches!(prepare_start(&params(&file, true), &app_data), Err(HostError::OutsideWorkspace(_))));
        // adapter script under appData/adapters must exist
        assert!(matches!(prepare_start(&params(&proj, true), &app_data), Err(HostError::AdapterNotFound(_))));
        std::fs::create_dir_all(app_data.join("adapters/x")).unwrap();
        std::fs::write(app_data.join("adapters/x/index.js"), "").unwrap();
        let (dir, spec) = prepare_start(&params(&proj, true), &app_data).unwrap();
        assert_eq!(dir, project);
        assert!(spec.args[0].ends_with("index.js") && !spec.args[0].contains("{appData}"));
        // shell-looking commands are refused
        let mut bad = params(&proj, true);
        bad.launch.command = "node && calc".into();
        assert!(matches!(prepare_start(&bad, &app_data), Err(HostError::InvalidSpec(_))));
        // resume ids are opaque agent ids, but not arbitrary text
        let mut resume = params(&proj, true);
        resume.resume_session_id = Some("sess\n1".into());
        assert!(matches!(prepare_start(&resume, &app_data), Err(HostError::InvalidSpec(_))));
        resume.resume_session_id = Some("sess-1".into());
        assert!(prepare_start(&resume, &app_data).is_ok());
        set_active_workspace_internal(None);
        // set_active_workspace_internal also chdirs into the (temporary) workspace
        std::env::set_current_dir(original_cwd).unwrap();
    }

    #[test]
    fn unknown_sessions_are_reported() {
        assert_eq!(session("nope").err().as_deref(), Some("no-session"));
        assert_eq!(cancel_agent_prompt("nope".into()), Err("no-session".into()));
        assert_eq!(respond_agent_permission("nope".into(), "p".into(), None), Err("no-session".into()));
        assert_eq!(close_agent_session("nope".into()), Err("no-session".into()));
    }

    #[test]
    fn params_deserialize_from_camel_case_and_reject_unknown_shapes() {
        let p: StartAgentParams = serde_json::from_value(serde_json::json!({
            "agentId": "claude-code",
            "launch": { "command": "node", "args": ["a.js"], "env": { "K": "v" } },
            "projectDir": "C:/p", "trusted": true,
            "sessionOptions": { "claudeCode": {} }, "useGlobalSettings": true,
            "mcpServers": [{ "name": "vanilla", "url": "http://127.0.0.1:1/mcp", "bearerToken": "t" }]
        }))
        .unwrap();
        assert!(p.use_global_settings && p.mcp_servers.len() == 1 && p.launch.env["K"] == "v");
        assert!(serde_json::from_value::<StartAgentParams>(serde_json::json!({ "agentId": "x" })).is_err());
    }
}

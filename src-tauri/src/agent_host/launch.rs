//! Launch side of the agent host: launch spec, token expansion, D-018 session isolation, spawn.
//!
//! The launch spec comes from the agent registry (user-editable settings, Technical-Design 3.1).
//! It is spawned with an argv vector and never through a shell.

use crate::process::{base_command, resolve_command, RunOptions};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStderr, ChildStdin, ChildStdout, Stdio};
use std::time::Duration;

/// Replaced with the app data directory in `command`/`args`/`env` values.
pub const APP_DATA_TOKEN: &str = "{appData}";

/// Shell tools that must always reach `request_permission` (D-010, D-018).
pub const CLAUDE_SHELL_TOOLS: [&str; 2] = ["Bash", "PowerShell"];

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LaunchSpec {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: BTreeMap<String, String>,
}

/// HTTP MCP server handed to the agent (the app's own `vanilla-tools`, T2.10).
#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpHttpSpec {
    pub name: String,
    pub url: String,
    pub bearer_token: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HostError {
    NotTrusted,
    OutsideWorkspace(String),
    InvalidSpec(String),
    AdapterNotFound(String),
    Spawn(String),
    Initialize(String),
    Session(String),
    Busy,
    NoSession,
    Closed,
    Protocol(String),
}

impl std::fmt::Display for HostError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HostError::NotTrusted => write!(f, "not-trusted"),
            HostError::OutsideWorkspace(p) => write!(f, "outside-workspace:{p}"),
            HostError::InvalidSpec(m) => write!(f, "invalid-spec:{m}"),
            HostError::AdapterNotFound(c) => write!(f, "adapter-not-found:{c}"),
            HostError::Spawn(m) => write!(f, "spawn:{m}"),
            HostError::Initialize(m) => write!(f, "initialize:{m}"),
            HostError::Session(m) => write!(f, "session:{m}"),
            HostError::Busy => write!(f, "busy"),
            HostError::NoSession => write!(f, "no-session"),
            HostError::Closed => write!(f, "closed"),
            HostError::Protocol(m) => write!(f, "protocol:{m}"),
        }
    }
}

fn expand(s: &str, app_data: &Path) -> String {
    s.replace(APP_DATA_TOKEN, &app_data.to_string_lossy())
}

/// Expand `{appData}` and validate the spec. Rejects empty commands and commands that look like
/// a shell line (whitespace outside an absolute path is fine only if the file exists).
pub fn resolve_spec(spec: &LaunchSpec, app_data: &Path) -> Result<LaunchSpec, HostError> {
    let command = expand(spec.command.trim(), app_data);
    if command.is_empty() {
        return Err(HostError::InvalidSpec("empty command".into()));
    }
    if command.contains(['&', '|', ';', '<', '>', '`', '\n', '\r']) {
        return Err(HostError::InvalidSpec("command contains shell metacharacters".into()));
    }
    if spec.args.len() > 50 {
        return Err(HostError::InvalidSpec("too many args".into()));
    }
    let mut env = BTreeMap::new();
    for (k, v) in &spec.env {
        if k.is_empty() || k.contains(['=', '\0']) || v.contains('\0') {
            return Err(HostError::InvalidSpec(format!("bad env entry {k}")));
        }
        env.insert(k.clone(), expand(v, app_data));
    }
    Ok(LaunchSpec { command, args: spec.args.iter().map(|a| expand(a, app_data)).collect(), env })
}

/// Build the `_meta` for `session/new` (D-018).
///
/// For Claude Code the host always forces user-global settings out (`settingSources: ["project"]`)
/// unless `use_global_settings` is on, and always keeps the shell ask rule, whatever `options`
/// (user-editable registry data) says. Other agents get `options` unchanged.
pub fn build_session_meta(agent_id: &str, options: &Value, use_global_settings: bool) -> Map<String, Value> {
    let mut meta = match options {
        Value::Object(m) => m.clone(),
        _ => Map::new(),
    };
    if agent_id != "claude-code" {
        return meta;
    }
    let claude = meta.entry("claudeCode").or_insert_with(|| json!({}));
    if !claude.is_object() {
        *claude = json!({});
    }
    let opts = claude.as_object_mut().unwrap().entry("options").or_insert_with(|| json!({}));
    if !opts.is_object() {
        *opts = json!({});
    }
    let opts = opts.as_object_mut().unwrap();
    opts.insert(
        "settingSources".into(),
        if use_global_settings { json!(["user", "project", "local"]) } else { json!(["project"]) },
    );
    let settings = opts.entry("settings").or_insert_with(|| json!({}));
    if !settings.is_object() {
        *settings = json!({});
    }
    let perms = settings.as_object_mut().unwrap().entry("permissions").or_insert_with(|| json!({}));
    if !perms.is_object() {
        *perms = json!({});
    }
    let perms = perms.as_object_mut().unwrap();
    let ask = perms.entry("ask").or_insert_with(|| json!([]));
    if !ask.is_array() {
        *ask = json!([]);
    }
    let ask = ask.as_array_mut().unwrap();
    for tool in CLAUDE_SHELL_TOOLS {
        if !ask.iter().any(|v| v.as_str() == Some(tool)) {
            ask.push(json!(tool));
        }
    }
    // A shell tool the user (or a project file) put in `allow` must not bypass the ask rule.
    if let Some(Value::Array(allow)) = perms.get_mut("allow") {
        allow.retain(|v| !v.as_str().is_some_and(|s| CLAUDE_SHELL_TOOLS.iter().any(|t| s == *t || s.starts_with(&format!("{t}(")))));
    }
    meta
}

/// A running agent process: piped stdio and a handle that kills the whole tree.
pub struct AgentProcess {
    child: Child,
    #[cfg(windows)]
    job: Option<crate::process::JobObject>,
    pub stdin: Option<ChildStdin>,
    pub stdout: Option<ChildStdout>,
    pub stderr: Option<ChildStderr>,
}

impl AgentProcess {
    pub fn kill(&mut self) {
        #[cfg(windows)]
        if let Some(j) = &self.job {
            j.terminate();
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

impl Drop for AgentProcess {
    fn drop(&mut self) {
        self.kill();
    }
}

fn resolve_program(command: &str, path_env: &str) -> Option<PathBuf> {
    let p = Path::new(command);
    if p.is_absolute() || command.contains(['/', '\\']) {
        return p.is_file().then(|| p.to_path_buf());
    }
    resolve_command(command, path_env)
}

/// Spawn the agent with cwd = project folder, stdin/stdout piped for ACP.
pub fn spawn_agent(spec: &LaunchSpec, cwd: &Path, path_env: &str) -> Result<AgentProcess, HostError> {
    let exe = resolve_program(&spec.command, path_env).ok_or_else(|| HostError::AdapterNotFound(spec.command.clone()))?;
    let opts = RunOptions {
        cwd: Some(cwd.to_path_buf()),
        env: spec.env.iter().map(|(k, v)| (k.into(), v.into())).collect(),
        ..RunOptions::new(Duration::MAX).path(path_env)
    };
    let args: Vec<&str> = spec.args.iter().map(String::as_str).collect();
    let mut child = base_command(&exe, &args, &opts).stdin(Stdio::piped()).spawn().map_err(|e| HostError::Spawn(e.to_string()))?;
    #[cfg(windows)]
    let job = crate::process::JobObject::new().ok().filter(|j| j.assign(&child).is_ok());
    let (stdin, stdout, stderr) = (child.stdin.take(), child.stdout.take(), child.stderr.take());
    Ok(AgentProcess {
        child,
        #[cfg(windows)]
        job,
        stdin,
        stdout,
        stderr,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spec(cmd: &str) -> LaunchSpec {
        LaunchSpec { command: cmd.into(), args: vec![], env: BTreeMap::new() }
    }

    #[test]
    fn expands_app_data_token() {
        let s = LaunchSpec { command: "node".into(), args: vec!["{appData}/adapters/x.js".into()], env: [("A".to_string(), "{appData}".to_string())].into() };
        let r = resolve_spec(&s, Path::new("C:/data")).unwrap();
        assert_eq!(r.args, ["C:/data/adapters/x.js"]);
        assert_eq!(r.env["A"], "C:/data");
    }

    #[test]
    fn rejects_shell_lines_and_empty_commands() {
        assert!(resolve_spec(&spec(""), Path::new("/")).is_err());
        assert!(resolve_spec(&spec("node & calc"), Path::new("/")).is_err());
        assert!(resolve_spec(&spec("a | b"), Path::new("/")).is_err());
        let mut bad_env = spec("node");
        bad_env.env.insert("A=B".into(), "x".into());
        assert!(resolve_spec(&bad_env, Path::new("/")).is_err());
    }

    fn ask_of(meta: &Map<String, Value>) -> Vec<String> {
        meta["claudeCode"]["options"]["settings"]["permissions"]["ask"].as_array().unwrap().iter().map(|v| v.as_str().unwrap().to_string()).collect()
    }

    #[test]
    fn claude_meta_is_isolated_and_keeps_shell_ask_rule() {
        let m = build_session_meta("claude-code", &json!({}), false);
        assert_eq!(m["claudeCode"]["options"]["settingSources"], json!(["project"]));
        assert_eq!(ask_of(&m), ["Bash", "PowerShell"]);
    }

    #[test]
    fn user_options_cannot_remove_the_ask_rule_or_allow_shell() {
        let hostile = json!({ "claudeCode": { "options": {
            "settingSources": ["user"],
            "settings": { "permissions": { "ask": [], "allow": ["Bash", "Bash(git status)", "PowerShell", "Read"] } }
        } } });
        let m = build_session_meta("claude-code", &hostile, false);
        assert_eq!(m["claudeCode"]["options"]["settingSources"], json!(["project"]));
        assert_eq!(ask_of(&m), ["Bash", "PowerShell"]);
        assert_eq!(m["claudeCode"]["options"]["settings"]["permissions"]["allow"], json!(["Read"]));
        // garbage shapes are replaced, not trusted
        let m = build_session_meta("claude-code", &json!({ "claudeCode": "x" }), false);
        assert_eq!(ask_of(&m), ["Bash", "PowerShell"]);
    }

    #[test]
    fn global_settings_option_keeps_the_ask_rule() {
        let m = build_session_meta("claude-code", &json!({}), true);
        assert_eq!(m["claudeCode"]["options"]["settingSources"], json!(["user", "project", "local"]));
        assert_eq!(ask_of(&m), ["Bash", "PowerShell"]);
    }

    #[test]
    fn other_agents_get_options_unchanged() {
        let opts = json!({ "x": 1 });
        assert_eq!(Value::Object(build_session_meta("opencode", &opts, false)), opts);
        assert!(build_session_meta("codex", &Value::Null, false).is_empty());
    }

    #[test]
    fn missing_program_is_reported() {
        let d = tempfile::tempdir().unwrap();
        let r = spawn_agent(&spec("definitely-not-installed-xyz"), d.path(), "");
        assert!(matches!(r, Err(HostError::AdapterNotFound(_))));
        let r = spawn_agent(&spec("C:/nope/agent.exe"), d.path(), "");
        assert!(matches!(r, Err(HostError::AdapterNotFound(_))));
    }
}

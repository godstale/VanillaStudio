//! Permission policy (D-010 + S3 rules). Pure functions over a decoupled `Input` so the S3
//! scenario table can be unit-tested without an ACP connection.

use crate::agent_host::events::PermissionOptionView;
use crate::commands::fs_commands::resolve_and_verify_workspace_path;
use agent_client_protocol::schema::v1::{
    PermissionOption, PermissionOptionId, PermissionOptionKind, RequestPermissionRequest, ToolKind,
};
use serde_json::Value;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Read,
    Edit,
    Delete,
    Move,
    Search,
    Execute,
    Think,
    Fetch,
    SwitchMode,
    Other,
}

/// What the policy needs to know about a `session/request_permission`.
#[derive(Debug, Clone, PartialEq)]
pub struct Input {
    pub kind: Kind,
    pub title: String,
    pub name: Option<String>,
    pub locations: Vec<PathBuf>,
    pub raw_input: Option<Value>,
    /// `_meta.claudeCode.mcpServer.source` when the adapter says where an MCP tool came from
    /// (`dynamic` = passed by the app in `session/new`, anything else = project/user config).
    pub mcp_source: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decision {
    /// Allow without asking (policy grants `allow_once`).
    AutoAllow(&'static str),
    /// Show the user a dialog.
    Ask(&'static str),
    /// Reject without asking.
    Deny(&'static str),
}

pub fn input_from_request(req: &RequestPermissionRequest) -> Input {
    let f = &req.tool_call.fields;
    Input {
        kind: match f.kind {
            Some(ToolKind::Read) => Kind::Read,
            Some(ToolKind::Edit) => Kind::Edit,
            Some(ToolKind::Delete) => Kind::Delete,
            Some(ToolKind::Move) => Kind::Move,
            Some(ToolKind::Search) => Kind::Search,
            Some(ToolKind::Execute) => Kind::Execute,
            Some(ToolKind::Think) => Kind::Think,
            Some(ToolKind::Fetch) => Kind::Fetch,
            Some(ToolKind::SwitchMode) => Kind::SwitchMode,
            _ => Kind::Other,
        },
        title: f.title.clone().unwrap_or_default(),
        name: f.name.clone(),
        locations: f.locations.iter().flatten().map(|l| l.path.clone()).collect(),
        raw_input: f.raw_input.clone(),
        mcp_source: req
            .tool_call
            .meta
            .as_ref()
            .and_then(|m| m.get("claudeCode"))
            .and_then(|c| c.get("mcpServer"))
            .and_then(|s| s.get("source"))
            .and_then(Value::as_str)
            .map(str::to_string),
    }
}

/// Prefix of the app's own MCP tools (`vanilla-tools` server, T2.10). The agent reports them as
/// `mcp__<server>__<tool>` with an empty/`other` kind (PoC S3).
pub const APP_MCP_PREFIX: &str = "mcp__vanilla__";
/// App state inside a project. Agents have no business editing it; edits there are always asked.
pub const PROTECTED_DIR: &str = ".vanilla";

/// `rawInput` keys that carry a file path in agent tool inputs (Claude: `file_path`, `notebook_path`).
const PATH_KEYS: [&str; 6] = ["file_path", "path", "filePath", "notebook_path", "old_path", "new_path"];

/// Every path the request refers to: ACP `locations` plus path-like `rawInput` fields, so a
/// request that hides its target from `locations` cannot slip past the scope check.
pub fn candidate_paths(input: &Input) -> Vec<PathBuf> {
    let mut out = input.locations.clone();
    if let Some(Value::Object(raw)) = &input.raw_input {
        for key in PATH_KEYS {
            if let Some(Value::String(p)) = raw.get(key) {
                if !p.trim().is_empty() {
                    out.push(PathBuf::from(p));
                }
            }
        }
        if let Some(Value::Array(list)) = raw.get("paths") {
            out.extend(list.iter().filter_map(Value::as_str).filter(|p| !p.trim().is_empty()).map(PathBuf::from));
        }
    }
    out
}

/// Resolve `requested` (absolute or relative to `root`) and return it when it stays inside `root`.
/// Symlinks and junctions are followed (canonicalize) before the check; a path that does not exist
/// yet is checked through its nearest existing ancestor.
pub fn resolve_inside(root: &Path, requested: &Path) -> Option<PathBuf> {
    let root_str = root.to_str().filter(|s| !s.trim().is_empty())?;
    resolve_and_verify_workspace_path(&requested.to_string_lossy(), Some(root_str), false).ok()
}

fn is_protected(root: &Path, resolved: &Path) -> bool {
    root.canonicalize().is_ok_and(|r| resolved.starts_with(r.join(PROTECTED_DIR)))
}

fn tool_name(input: &Input) -> &str {
    input.name.as_deref().filter(|n| !n.is_empty()).unwrap_or(&input.title)
}

/// Classify a request (D-010 + PoC S3 rules). Order matters:
/// 1. any path outside the project -> deny (whatever the tool kind)
/// 2. shell and network -> always ask
/// 3. file operations inside the project -> allow (protected app state and unverifiable targets -> ask)
/// 4. the app's own MCP tools -> allow; every other MCP or unknown tool -> ask
pub fn classify(root: &Path, input: &Input) -> Decision {
    let mut resolved = Vec::new();
    for p in candidate_paths(input) {
        match resolve_inside(root, &p) {
            Some(r) => resolved.push(r),
            None => return Decision::Deny("outside-project"),
        }
    }
    match input.kind {
        Kind::Execute => Decision::Ask("shell"),
        Kind::Fetch => Decision::Ask("network"),
        Kind::Read | Kind::Search if resolved.is_empty() => Decision::Ask("no-location"),
        Kind::Read | Kind::Search => Decision::AutoAllow("project-read"),
        Kind::Edit | Kind::Delete | Kind::Move if resolved.is_empty() => Decision::Ask("no-location"),
        Kind::Edit | Kind::Delete | Kind::Move if resolved.iter().any(|r| is_protected(root, r)) => Decision::Ask("protected-path"),
        Kind::Edit | Kind::Delete | Kind::Move => Decision::AutoAllow("project-write"),
        Kind::Think => Decision::AutoAllow("no-side-effect"),
        Kind::SwitchMode => Decision::Ask("mode-switch"),
        Kind::Other => {
            let name = tool_name(input);
            if name.starts_with(APP_MCP_PREFIX) && input.mcp_source.as_deref().is_none_or(|s| s == "dynamic") {
                Decision::AutoAllow("app-mcp")
            } else if name.starts_with("mcp__") {
                Decision::Ask("mcp")
            } else {
                Decision::Ask("unclassified")
            }
        }
    }
}

/// Options the UI may show: only `allow_once` and `reject_once` (D-010).
pub fn visible_options(options: &[PermissionOption]) -> Vec<PermissionOptionView> {
    options
        .iter()
        .filter_map(|o| {
            let kind = match o.kind {
                PermissionOptionKind::AllowOnce => "allow_once",
                PermissionOptionKind::RejectOnce => "reject_once",
                _ => return None,
            };
            Some(PermissionOptionView { option_id: o.option_id.to_string(), name: o.name.clone(), kind: kind.into() })
        })
        .collect()
}

/// The agent's option of exactly this kind, if it offered one.
pub fn find_option(options: &[PermissionOption], kind: PermissionOptionKind) -> Option<PermissionOptionId> {
    options.iter().find(|o| o.kind == kind).map(|o| o.option_id.clone())
}

#[cfg(test)]
mod tests {
    //! The S3 scenario table: request shapes captured from the real Claude Code adapter
    //! (spikes/s3-acp-claude, wiki/sources/poc-s3.md) plus the edge cases the policy adds.
    use super::*;
    use serde_json::json;

    struct Fixture {
        _dir: tempfile::TempDir,
        root: PathBuf,
        outside: PathBuf,
    }

    fn fixture() -> Fixture {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().canonicalize().unwrap();
        let root = base.join("sandbox");
        std::fs::create_dir_all(root.join(".vanilla")).unwrap();
        std::fs::write(root.join("notes.txt"), "x").unwrap();
        let outside = base.join("outside.txt");
        std::fs::write(&outside, "secret").unwrap();
        Fixture { _dir: dir, root, outside }
    }

    fn request(tool_call: Value) -> RequestPermissionRequest {
        serde_json::from_value(json!({
            "sessionId": "s1",
            "toolCall": tool_call,
            "options": [
                { "optionId": "always", "name": "Always allow", "kind": "allow_always" },
                { "optionId": "allow", "name": "Allow", "kind": "allow_once" },
                { "optionId": "reject", "name": "Reject", "kind": "reject_once" }
            ]
        }))
        .unwrap()
    }

    fn decide(f: &Fixture, tool_call: Value) -> Decision {
        classify(&f.root, &input_from_request(&request(tool_call)))
    }

    fn p(path: &Path) -> String {
        path.to_string_lossy().into_owned()
    }

    #[test]
    fn s3_edit_inside_project_is_allowed() {
        let f = fixture();
        let target = f.root.join("hello.txt"); // does not exist yet
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "edit", "title": format!("Write {}", p(&target)), "name": "Write",
            "locations": [{ "path": p(&target) }], "rawInput": { "file_path": p(&target), "content": "hello" } }));
        assert_eq!(d, Decision::AutoAllow("project-write"));
    }

    #[test]
    fn s3_read_outside_project_is_denied() {
        let f = fixture();
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "read", "name": "Read", "title": "Read outside.txt",
            "locations": [{ "path": p(&f.outside), "line": 1 }], "rawInput": { "file_path": p(&f.outside) } }));
        assert_eq!(d, Decision::Deny("outside-project"));
    }

    #[test]
    fn s3_shell_is_always_asked_with_or_without_locations() {
        let f = fixture();
        let inside = f.root.join("shell-made.txt");
        let ps = decide(&f, json!({ "toolCallId": "t", "kind": "execute", "name": "PowerShell", "title": "Set-Content -Path shell-made.txt -Value x",
            "locations": [{ "path": p(&inside) }], "rawInput": { "command": "Set-Content -Path shell-made.txt -Value x" } }));
        assert_eq!(ps, Decision::Ask("shell"));
        let bash = decide(&f, json!({ "toolCallId": "t", "kind": "execute", "name": "Bash", "title": "echo acp-shell-test", "rawInput": { "command": "echo acp-shell-test" } }));
        assert_eq!(bash, Decision::Ask("shell"));
    }

    #[test]
    fn s3_app_mcp_tool_is_allowed_by_name_prefix() {
        let f = fixture();
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "other", "name": "mcp__vanilla__vanilla_ping", "title": "mcp__vanilla__vanilla_ping",
            "rawInput": { "message": "hi" }, "_meta": { "claudeCode": { "toolName": "mcp__vanilla__vanilla_ping", "mcpServer": { "name": "vanilla", "source": "dynamic" } } } }));
        assert_eq!(d, Decision::AutoAllow("app-mcp"));
        // some adapters send no kind at all
        let d = decide(&f, json!({ "toolCallId": "t", "title": "mcp__vanilla__snapshot_scene" }));
        assert_eq!(d, Decision::AutoAllow("app-mcp"));
    }

    #[test]
    fn mcp_lookalikes_and_foreign_servers_are_asked() {
        let f = fixture();
        // a project-level .mcp.json server that is also called "vanilla"
        let spoof = decide(&f, json!({ "toolCallId": "t", "kind": "other", "name": "mcp__vanilla__x", "title": "mcp__vanilla__x",
            "_meta": { "claudeCode": { "mcpServer": { "name": "vanilla", "source": "project" } } } }));
        assert_eq!(spoof, Decision::Ask("mcp"));
        let other = decide(&f, json!({ "toolCallId": "t", "kind": "other", "name": "mcp__github__create_issue", "title": "mcp__github__create_issue" }));
        assert_eq!(other, Decision::Ask("mcp"));
        // the prefix must be a real prefix
        let near = decide(&f, json!({ "toolCallId": "t", "kind": "other", "name": "mcp__vanillax__y", "title": "y" }));
        assert_eq!(near, Decision::Ask("mcp"));
        let unknown = decide(&f, json!({ "toolCallId": "t", "kind": "other", "name": "SomethingNew", "title": "SomethingNew" }));
        assert_eq!(unknown, Decision::Ask("unclassified"));
    }

    #[test]
    fn app_mcp_tool_with_an_outside_path_argument_is_denied() {
        let f = fixture();
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "other", "name": "mcp__vanilla__read_file", "title": "x", "rawInput": { "path": p(&f.outside) } }));
        assert_eq!(d, Decision::Deny("outside-project"));
    }

    #[test]
    fn file_operations_inside_the_project() {
        let f = fixture();
        let notes = f.root.join("notes.txt");
        let read = |extra: Value| {
            let mut t = json!({ "toolCallId": "t", "kind": "read", "name": "Read", "title": "Read" });
            t.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
            decide(&f, t)
        };
        assert_eq!(read(json!({ "locations": [{ "path": p(&notes) }] })), Decision::AutoAllow("project-read"));
        // relative locations are relative to the project
        assert_eq!(read(json!({ "locations": [{ "path": "notes.txt" }] })), Decision::AutoAllow("project-read"));
        assert_eq!(read(json!({})), Decision::Ask("no-location"));
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "delete", "title": "Delete", "locations": [{ "path": p(&notes) }] }));
        assert_eq!(d, Decision::AutoAllow("project-write"));
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "move", "title": "Move", "locations": [{ "path": p(&notes) }, { "path": p(&f.root.join("sub/new.txt")) }] }));
        assert_eq!(d, Decision::AutoAllow("project-write"));
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "search", "title": "Grep", "locations": [{ "path": p(&f.root) }] }));
        assert_eq!(d, Decision::AutoAllow("project-read"));
    }

    #[test]
    fn any_outside_path_denies_whatever_the_kind() {
        let f = fixture();
        let out = p(&f.outside);
        for kind in ["read", "edit", "delete", "move", "search", "execute", "fetch", "other"] {
            let d = decide(&f, json!({ "toolCallId": "t", "kind": kind, "title": "t", "locations": [{ "path": out }] }));
            assert_eq!(d, Decision::Deny("outside-project"), "kind {kind}");
        }
        // move with only the destination outside
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "move", "title": "t",
            "locations": [{ "path": p(&f.root.join("notes.txt")) }, { "path": out }] }));
        assert_eq!(d, Decision::Deny("outside-project"));
    }

    #[test]
    fn traversal_and_hidden_targets_are_caught() {
        let f = fixture();
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "read", "title": "t", "locations": [{ "path": "../outside.txt" }] }));
        assert_eq!(d, Decision::Deny("outside-project"));
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "edit", "title": "t", "locations": [{ "path": "new/../../escape.txt" }] }));
        assert_eq!(d, Decision::Deny("outside-project"));
        // no locations, but the input names the file
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "read", "title": "t", "rawInput": { "file_path": p(&f.outside) } }));
        assert_eq!(d, Decision::Deny("outside-project"));
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "edit", "title": "t", "rawInput": { "paths": ["notes.txt", p(&f.outside)] } }));
        assert_eq!(d, Decision::Deny("outside-project"));
    }

    #[test]
    fn app_state_edits_are_asked_and_network_is_asked() {
        let f = fixture();
        let db = f.root.join(".vanilla").join("app.db");
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "edit", "title": "t", "locations": [{ "path": p(&db) }] }));
        assert_eq!(d, Decision::Ask("protected-path"));
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "fetch", "title": "Fetch https://example.com", "rawInput": { "url": "https://example.com" } }));
        assert_eq!(d, Decision::Ask("network"));
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "switch_mode", "title": "Exit plan mode" }));
        assert_eq!(d, Decision::Ask("mode-switch"));
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "think", "title": "Thinking" }));
        assert_eq!(d, Decision::AutoAllow("no-side-effect"));
    }

    #[test]
    fn edit_without_a_verifiable_target_is_asked() {
        let f = fixture();
        let d = decide(&f, json!({ "toolCallId": "t", "kind": "edit", "title": "Edit something" }));
        assert_eq!(d, Decision::Ask("no-location"));
    }

    #[test]
    fn allow_always_is_never_visible() {
        let req = request(json!({ "toolCallId": "t", "kind": "execute", "title": "x" }));
        let shown = visible_options(&req.options);
        assert_eq!(
            shown.iter().map(|o| (o.option_id.as_str(), o.kind.as_str())).collect::<Vec<_>>(),
            [("allow", "allow_once"), ("reject", "reject_once")]
        );
        let only_always: RequestPermissionRequest = serde_json::from_value(json!({
            "sessionId": "s", "toolCall": { "toolCallId": "t" },
            "options": [{ "optionId": "a", "name": "A", "kind": "allow_always" }, { "optionId": "r", "name": "R", "kind": "reject_always" }]
        }))
        .unwrap();
        assert!(visible_options(&only_always.options).is_empty());
        assert!(find_option(&only_always.options, PermissionOptionKind::AllowOnce).is_none());
    }
}

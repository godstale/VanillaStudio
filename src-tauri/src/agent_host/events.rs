//! Event contract between the agent host and the frontend session context (T2.3, T2.6).
//!
//! This is the shape lane F (frontend session Context, T2.7) consumes. It is mirrored by
//! `src/lib/agents/types.ts`; change both together. Every event is JSON with a `type` tag and
//! camelCase fields. `Update.update` is the ACP `session/update` payload verbatim (tagged by
//! `sessionUpdate`), so the frontend reducer follows the ACP spec for message/tool/plan/usage
//! shapes instead of a second app-specific schema.

use serde::Serialize;
use serde_json::Value;
use std::sync::Arc;

/// Sink for events. The Tauri command layer forwards to a `Channel`; tests collect into a Vec.
pub type Emit = Arc<dyn Fn(AgentEvent) + Send + Sync>;

/// A permission option shown to the user. `allow_always`/`reject_always` are never included
/// (D-010): only `allow_once` and `reject_once` can be chosen.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PermissionOptionView {
    pub option_id: String,
    pub name: String,
    /// `allow_once` or `reject_once`.
    pub kind: String,
}

/// How a permission request ended.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PermissionOutcomeView {
    Allowed,
    Rejected,
    Cancelled,
}

/// Who decided a permission request.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DecidedBy {
    Policy,
    User,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum AgentEvent {
    /// Emitted once, after `initialize` and `session/new` succeeded.
    Started {
        session_id: String,
        agent_id: String,
        cwd: String,
        agent_name: Option<String>,
        agent_version: Option<String>,
        /// The agent can resume sessions (`loadSession`), used by T2.13.
        load_session: bool,
        /// `modes` from `session/new` (available and current session modes), or null. Modes that
        /// skip the permission gate (`launch::is_blocked_mode`) are removed / reset.
        modes: Value,
        /// Present (`true`) only when this is a resumed session (`session/load` or `session/resume`);
        /// the conversation so far is in the session log, replayed updates are not re-emitted.
        #[serde(skip_serializing_if = "Option::is_none")]
        resumed: Option<bool>,
    },
    /// ACP `session/update`: message/thought chunks, tool_call, tool_call_update, plan,
    /// usage_update, current_mode_update, ...
    Update { session_id: String, update: Value },
    /// The user must decide. Answer with the `respond_agent_permission` command.
    PermissionRequest {
        session_id: String,
        request_id: String,
        /// ACP `toolCall` (id, kind, title, locations, content, rawInput ...) verbatim.
        tool_call: Value,
        options: Vec<PermissionOptionView>,
        /// Short machine code of the policy rule that led to asking (`shell`, `network`, `unclassified`, ...).
        reason: String,
    },
    /// A permission request was settled (by policy or by the user). Also emitted for auto decisions
    /// so the UI and the session log show what was allowed or denied.
    PermissionResolved {
        session_id: String,
        request_id: String,
        tool_call_id: String,
        outcome: PermissionOutcomeView,
        decided_by: DecidedBy,
        reason: String,
    },
    /// A prompt was sent to the agent (recorded so the session log can be replayed).
    PromptSent { session_id: String, text: String },
    /// A `session/prompt` turn ended. `stop_reason`: end_turn, max_tokens, max_turn_requests, refusal, cancelled.
    PromptDone { session_id: String, stop_reason: String },
    /// A fs request from the agent was handled (allowed or denied by the scope check).
    FsAccess {
        session_id: String,
        /// `read` or `write`.
        op: String,
        path: String,
        allowed: bool,
        error: Option<String>,
    },
    /// A line the agent process wrote to stderr (diagnostics only).
    Stderr { session_id: String, line: String },
    /// Fatal problem in the session (initialize failure, protocol error). `Closed` follows.
    Error { session_id: String, message: String },
    /// The session ended. `reason`: `user`, `process-exit`, `error`.
    Closed { session_id: String, reason: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn events_use_type_tag_and_camel_case() {
        let v = serde_json::to_value(AgentEvent::PromptDone { session_id: "s1".into(), stop_reason: "end_turn".into() }).unwrap();
        assert_eq!(v, serde_json::json!({ "type": "promptDone", "sessionId": "s1", "stopReason": "end_turn" }));
        let v = serde_json::to_value(AgentEvent::PermissionResolved {
            session_id: "s1".into(),
            request_id: "p1".into(),
            tool_call_id: "t1".into(),
            outcome: PermissionOutcomeView::Rejected,
            decided_by: DecidedBy::Policy,
            reason: "outside-project".into(),
        })
        .unwrap();
        assert_eq!(
            v,
            serde_json::json!({ "type": "permissionResolved", "sessionId": "s1", "requestId": "p1", "toolCallId": "t1",
                "outcome": "rejected", "decidedBy": "policy", "reason": "outside-project" })
        );
    }
}

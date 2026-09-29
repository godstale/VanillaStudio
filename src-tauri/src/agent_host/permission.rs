//! Permission policy (D-010 + S3 rules). Pure functions over a decoupled `Input` so the S3
//! scenario table can be unit-tested without an ACP connection.

use crate::agent_host::events::PermissionOptionView;
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
    }
}

/// Classify a request. Filled in by T2.4; until then everything is shown to the user.
pub fn classify(_root: &Path, _input: &Input) -> Decision {
    Decision::Ask("unclassified")
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

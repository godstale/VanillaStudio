//! `vanilla-tools` tool implementations (T4.20, D-014, F-AGT-06).
//!
//! The token handshake stays in the parent module; every tool here takes the
//! open project's absolute path (`project_path`) and refuses anything that is
//! not a Vanilla project (a folder with `vanilla.json`). All file access stays
//! under that folder: fixed subdirectories plus validated file names, so a
//! tool call can never escape the project.
//!
//! - `ping`: connectivity check (T2.10, unchanged).
//! - `check_scene`: Scene runtime contract check, the Rust mirror of the
//!   `packages/runtime/eslint-plugin` rules (T4.8, D-011).
//! - `snapshot_scene`: serve the latest review capture (`reviews/*.png` saved
//!   by the host `capture()`, T4.18) as a base64 data URL for visual
//!   self-review. Headless rendering itself belongs to the export worker.
//! - `get_review`: read `reviews/R-NNN.md` revision comments (F-REV-04).
//! - `update_task_status`: record the agent's progress claim against
//!   `plan/tasks.json` in `.vanilla/task-status.json` for the runner (T3.14).

pub mod check;
pub mod review;
pub mod snapshot;
pub mod task;

use std::path::PathBuf;

use rmcp::{
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::{ServerCapabilities, ServerInfo},
    schemars, tool, tool_handler, tool_router, ServerHandler,
};

/// The folder must exist and hold `vanilla.json`: every tool below only reads
/// or writes inside it.
fn project_root(project_path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_path);
    if !root.is_dir() {
        return Err(format!("Not a directory: {project_path}"));
    }
    if !root.join("vanilla.json").is_file() {
        return Err(format!("Not a Vanilla project (no vanilla.json): {project_path}"));
    }
    Ok(root)
}

fn ok(value: serde_json::Value) -> String {
    serde_json::json!({ "ok": true, "result": value }).to_string()
}

fn err(message: impl Into<String>) -> String {
    serde_json::json!({ "ok": false, "error": message.into() }).to_string()
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
pub struct CheckSceneParams {
    /// Absolute path of the open Vanilla project.
    pub project_path: String,
    /// Optional file-name filter: only check scene files containing this text.
    pub scene: Option<String>,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
pub struct SnapshotSceneParams {
    /// Absolute path of the open Vanilla project.
    pub project_path: String,
    /// Optional capture file in `reviews/`, e.g. `R-001.png`. Without it the
    /// newest capture is served.
    pub name: Option<String>,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
pub struct GetReviewParams {
    /// Absolute path of the open Vanilla project.
    pub project_path: String,
    /// Optional review id, e.g. `R-001`. Without it all reviews are listed.
    pub id: Option<String>,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
pub struct UpdateTaskStatusParams {
    /// Absolute path of the open Vanilla project.
    pub project_path: String,
    /// Task id from `plan/tasks.json`.
    pub task_id: String,
    /// One of `pending|in_progress|done|blocked`.
    pub status: String,
    /// Optional short note (max 500 chars).
    pub note: Option<String>,
}

#[derive(Clone)]
pub struct VanillaTools {
    tool_router: ToolRouter<Self>,
}

impl VanillaTools {
    pub fn new() -> Self {
        Self { tool_router: Self::tool_router() }
    }
}

impl Default for VanillaTools {
    fn default() -> Self {
        Self::new()
    }
}

#[tool_router]
impl VanillaTools {
    #[tool(description = "Connectivity check. Returns \"pong\".")]
    fn ping(&self) -> String {
        "pong".to_string()
    }

    #[tool(
        description = "Check the Scene runtime contract (forbidden time APIs in clock-contract types, missing defineScene, hard-coded colors, external URLs). Pass the open project's absolute path."
    )]
    fn check_scene(&self, Parameters(p): Parameters<CheckSceneParams>) -> String {
        let root = match project_root(&p.project_path) {
            Ok(r) => r,
            Err(e) => return err(e),
        };
        match check::check_project(&root, p.scene.as_deref()) {
            Ok(report) => ok(serde_json::to_value(report).unwrap_or(serde_json::Value::Null)),
            Err(e) => err(e),
        }
    }

    #[tool(
        description = "Get the latest review screenshot (PNG) as a base64 data URL so you can see your own result. Captures are taken by the host review UI; when none exists the tool says so."
    )]
    fn snapshot_scene(&self, Parameters(p): Parameters<SnapshotSceneParams>) -> String {
        let root = match project_root(&p.project_path) {
            Ok(r) => r,
            Err(e) => return err(e),
        };
        match snapshot::read_capture(&root, p.name.as_deref()) {
            Ok(cap) => ok(serde_json::to_value(cap).unwrap_or(serde_json::Value::Null)),
            Err(e) => err(e),
        }
    }

    #[tool(
        description = "Read human revision comments (reviews/R-NNN.md). Pass an id for the full comment, or nothing to list all reviews."
    )]
    fn get_review(&self, Parameters(p): Parameters<GetReviewParams>) -> String {
        let root = match project_root(&p.project_path) {
            Ok(r) => r,
            Err(e) => return err(e),
        };
        match &p.id {
            Some(id) => match review::read_review(&root, id) {
                Ok(detail) => ok(serde_json::to_value(detail).unwrap_or(serde_json::Value::Null)),
                Err(e) => err(e),
            },
            None => match review::list_reviews(&root) {
                Ok(list) => ok(serde_json::to_value(list).unwrap_or(serde_json::Value::Null)),
                Err(e) => err(e),
            },
        }
    }

    #[tool(
        description = "Report task progress against plan/tasks.json (pending|in_progress|done|blocked). The runner still verifies with its own inspect-snapshot-checkpoint pass."
    )]
    fn update_task_status(&self, Parameters(p): Parameters<UpdateTaskStatusParams>) -> String {
        let root = match project_root(&p.project_path) {
            Ok(r) => r,
            Err(e) => return err(e),
        };
        match task::update_task_status(&root, &p.task_id, &p.status, p.note.as_deref()) {
            Ok(record) => ok(serde_json::to_value(record).unwrap_or(serde_json::Value::Null)),
            Err(e) => err(e),
        }
    }
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for VanillaTools {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_instructions("Vanilla Studio tools for the current project.")
    }
}

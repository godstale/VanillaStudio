//! S3: drive Claude Code through its ACP adapter from Rust and exercise the D-010 permission policy.
//!
//! Scenarios: fs read/write inside the project, shell request (simulated user rejection),
//! access outside the project, app MCP tool call, and cancellation of a long prompt.

use agent_client_protocol::schema::ProtocolVersion;
use agent_client_protocol::schema::v1::{
    CancelNotification, ClientCapabilities, ContentBlock, FileSystemCapabilities, InitializeRequest,
    HttpHeader, McpServer, McpServerHttp, McpServerStdio, EnvVariable, NewSessionRequest, PermissionOptionKind, PromptRequest,
    ReadTextFileRequest, ReadTextFileResponse, RequestPermissionOutcome, RequestPermissionRequest,
    RequestPermissionResponse, SelectedPermissionOutcome, SessionNotification, TextContent, ToolKind,
    WriteTextFileRequest, WriteTextFileResponse,
};
use agent_client_protocol::{AcpAgent, AcpAgentConfig, Agent, ConnectionTo};
use serde_json::json;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Clone)]
struct Log(Arc<Mutex<std::fs::File>>, Instant);

impl Log {
    fn write(&self, kind: &str, value: serde_json::Value) {
        let line = json!({ "ms": self.1.elapsed().as_millis() as u64, "kind": kind, "data": value });
        eprintln!("{line}");
        let mut f = self.0.lock().unwrap();
        let _ = writeln!(f, "{line}");
    }
}

/// Resolve a path the agent asked for and verify it stays inside the project root.
/// Non-existent files (writes) are checked through their parent directory.
fn inside_project(root: &Path, requested: &Path) -> Option<PathBuf> {
    let candidate = if requested.is_absolute() { requested.to_path_buf() } else { root.join(requested) };
    let resolved = match candidate.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            let parent = candidate.parent()?.canonicalize().ok()?;
            parent.join(candidate.file_name()?)
        }
    };
    resolved.starts_with(root).then_some(resolved)
}

#[derive(Debug, Clone, Copy)]
enum Decision {
    AutoAllow,
    AskUser,
    Deny,
}

/// D-010 policy applied to a permission request.
fn classify(root: &Path, req: &RequestPermissionRequest) -> (Decision, &'static str) {
    let f = &req.tool_call.fields;
    let locations: Vec<PathBuf> = f.locations.iter().flatten().map(|l| l.path.clone()).collect();
    if locations.iter().any(|p| inside_project(root, p).is_none()) {
        return (Decision::Deny, "location outside project");
    }
    let is_vanilla_mcp = f.title.as_deref().unwrap_or_default().contains("vanilla")
        || f.name.as_deref().unwrap_or_default().contains("vanilla");
    match f.kind {
        Some(ToolKind::Read | ToolKind::Edit | ToolKind::Delete | ToolKind::Move | ToolKind::Search) => {
            (Decision::AutoAllow, "file op inside project")
        }
        Some(ToolKind::Execute) => (Decision::AskUser, "shell: always ask"),
        Some(ToolKind::Fetch) => (Decision::AskUser, "network: ask"),
        _ if is_vanilla_mcp => (Decision::AutoAllow, "app's own MCP tool"),
        _ => (Decision::AskUser, "unclassified: ask"),
    }
}

fn pick(req: &RequestPermissionRequest, kind: PermissionOptionKind) -> RequestPermissionOutcome {
    match req.options.iter().find(|o| o.kind == kind) {
        Some(o) => RequestPermissionOutcome::Selected(SelectedPermissionOutcome::new(o.option_id.clone())),
        None => RequestPermissionOutcome::Cancelled,
    }
}

fn text(s: &str) -> Vec<ContentBlock> {
    vec![ContentBlock::Text(TextContent::new(s.to_string()))]
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let here = std::env::current_dir()?;
    let root = here.join("sandbox").canonicalize()?;
    std::fs::create_dir_all(here.join("out"))?;
    let file = OpenOptions::new().create(true).write(true).truncate(true).open(here.join("out/session.jsonl"))?;
    let log = Log(Arc::new(Mutex::new(file)), Instant::now());

    let adapter = here.join("node_modules/@agentclientprotocol/claude-agent-acp/dist/index.js");
    let agent = AcpAgent::new(AcpAgentConfig::new("node").arg(adapter.to_string_lossy()));
    let only: Option<String> = std::env::args().nth(1);

    let (l1, l2, l3, l4) = (log.clone(), log.clone(), log.clone(), log.clone());
    let (r2, r3, r4) = (root.clone(), root.clone(), root.clone());

    agent_client_protocol::Client
        .builder()
        .on_receive_notification(
            async move |n: SessionNotification, _cx| {
                l1.write("update", serde_json::to_value(&n.update).unwrap_or_default());
                Ok(())
            },
            agent_client_protocol::on_receive_notification!(),
        )
        .on_receive_request(
            async move |req: RequestPermissionRequest, responder, _cx| {
                let (decision, why) = classify(&r2, &req);
                let offered: Vec<String> = req.options.iter().map(|o| format!("{:?}", o.kind)).collect();
                // D-010: the app never shows allow_always for shell; a real UI would ask here.
                let outcome = match decision {
                    Decision::AutoAllow => pick(&req, PermissionOptionKind::AllowOnce),
                    Decision::AskUser | Decision::Deny => pick(&req, PermissionOptionKind::RejectOnce),
                };
                l2.write("permission", json!({
                    "decision": format!("{decision:?}"), "why": why, "offered": offered,
                    "toolCall": serde_json::to_value(&req.tool_call).unwrap_or_default(),
                }));
                responder.respond(RequestPermissionResponse::new(outcome))
            },
            agent_client_protocol::on_receive_request!(),
        )
        .on_receive_request(
            async move |req: ReadTextFileRequest, responder, _cx| {
                match inside_project(&r3, &req.path) {
                    Some(p) => {
                        let content = std::fs::read_to_string(&p).unwrap_or_default();
                        l3.write("fs.read", json!({ "path": req.path, "allowed": true, "bytes": content.len() }));
                        responder.respond(ReadTextFileResponse::new(content))
                    }
                    None => {
                        l3.write("fs.read", json!({ "path": req.path, "allowed": false }));
                        responder.respond_with_error(agent_client_protocol::util::internal_error("path outside project"))
                    }
                }
            },
            agent_client_protocol::on_receive_request!(),
        )
        .on_receive_request(
            async move |req: WriteTextFileRequest, responder, _cx| {
                match inside_project(&r4, &req.path) {
                    Some(p) => {
                        let ok = std::fs::write(&p, &req.content).is_ok();
                        l4.write("fs.write", json!({ "path": req.path, "allowed": true, "ok": ok, "bytes": req.content.len() }));
                        responder.respond(WriteTextFileResponse::new())
                    }
                    None => {
                        l4.write("fs.write", json!({ "path": req.path, "allowed": false }));
                        responder.respond_with_error(agent_client_protocol::util::internal_error("path outside project"))
                    }
                }
            },
            agent_client_protocol::on_receive_request!(),
        )
        .connect_with(agent, |cx: ConnectionTo<Agent>| async move {
            let caps = ClientCapabilities::new()
                .fs(FileSystemCapabilities::new().read_text_file(true).write_text_file(true))
                .terminal(false);
            let init = cx
                .send_request(InitializeRequest::new(ProtocolVersion::V1).client_capabilities(caps))
                .block_task()
                .await?;
            log.write("initialize", serde_json::to_value(&init).unwrap_or_default());

            // VANILLA_MCP_HTTP=<url>: use the Streamable HTTP server (design default) instead of stdio.
            let mcp = match std::env::var("VANILLA_MCP_HTTP") {
                Ok(url) => McpServer::Http(McpServerHttp::new("vanilla", url).headers(vec![HttpHeader::new(
                    "Authorization",
                    format!("Bearer {}", std::env::var("VANILLA_MCP_TOKEN").unwrap_or_else(|_| "dev-token".into())),
                )])),
                Err(_) => McpServer::Stdio(
                    McpServerStdio::new("vanilla", "node")
                        .args(vec![here.join("mcp-server.mjs").to_string_lossy().into_owned()])
                        .env(vec![EnvVariable::new("VANILLA_MCP_LOG", here.join("out/mcp-calls.jsonl").to_string_lossy())]),
                ),
            };
            let mut request = NewSessionRequest::new(root.clone()).mcp_servers(vec![mcp]);
            // VANILLA_STRICT=1: isolate from the user's global Claude settings and force an
            // explicit "ask" rule for shell tools, so even read-only commands reach the app.
            if std::env::var("VANILLA_STRICT").is_ok() {
                let meta = json!({ "claudeCode": { "options": {
                    "settingSources": ["project"],
                    "settings": { "permissions": { "ask": ["Bash", "PowerShell"] } }
                } } });
                if let serde_json::Value::Object(m) = meta { request = request.meta(m); }
            }
            let session = cx.send_request(request).block_task().await?;
            let sid = session.session_id.clone();
            log.write("session", serde_json::to_value(&session).unwrap_or_default());

            let scenarios: [(&str, &str); 5] = [
                ("shell-write", "Using a shell command (not the file-writing tool), create a file named shell-made.txt containing x. If you cannot, say so in one sentence."),
                ("fs", "Read notes.txt in this project and reply with its first line only. Then create hello.txt containing exactly: hello from acp"),
                ("shell", "Run the shell command `echo acp-shell-test` and tell me its output. If you cannot run it, say so in one sentence."),
                ("outside", "Read the file ../outside.txt (one level above the project folder) and reply with its content. If you cannot, say so in one sentence."),
                ("mcp", "Call the vanilla_ping tool from the vanilla MCP server with message 'hi' and reply with the exact result text."),
            ];
            for (name, prompt) in scenarios {
                if only.as_deref().is_some_and(|o| o != name && o != "all") { continue; }
                log.write("scenario.start", json!({ "name": name }));
                let started = Instant::now();
                let resp = cx.send_request(PromptRequest::new(sid.clone(), text(prompt))).block_task().await?;
                log.write("scenario.end", json!({ "name": name, "stopReason": format!("{:?}", resp.stop_reason), "secs": started.elapsed().as_secs_f32() }));
            }

            if only.as_deref().is_none_or(|o| o == "cancel" || o == "all") {
                log.write("scenario.start", json!({ "name": "cancel" }));
                let started = Instant::now();
                let prompt = cx
                    .send_request(PromptRequest::new(sid.clone(), text("Write a 2000-word essay about color theory in design. Do not use any tools.")))
                    .block_task();
                let cancel = async {
                    tokio::time::sleep(Duration::from_secs(6)).await;
                    log.write("cancel.sent", json!({ "afterSecs": started.elapsed().as_secs_f32() }));
                    cx.send_notification(CancelNotification::new(sid.clone()))
                };
                let (resp, sent) = tokio::join!(prompt, cancel);
                sent?;
                let resp = resp?;
                log.write("scenario.end", json!({ "name": "cancel", "stopReason": format!("{:?}", resp.stop_reason), "secs": started.elapsed().as_secs_f32() }));
            }
            Ok(())
        })
        .await?;
    Ok(())
}

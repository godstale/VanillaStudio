//! One agent session: spawn the agent (cwd = project), run the ACP client connection,
//! translate ACP traffic into `AgentEvent`s and route user decisions back.
//!
//! Flow (Technical-Design 3.2): spawn -> initialize(fs capability, no terminal) -> session/new
//! (cwd, isolation meta, MCP servers) -> prompt / cancel / permission responses -> close.

use crate::agent_host::events::{AgentEvent, DecidedBy, Emit, PermissionOutcomeView};
use crate::agent_host::launch::{build_session_meta, spawn_agent, AgentProcess, HostError, LaunchSpec, McpHttpSpec};
use crate::agent_host::{fs, permission};
use agent_client_protocol::schema::v1::{
    CancelNotification, ClientCapabilities, ContentBlock, FileSystemCapabilities, HttpHeader, Implementation, InitializeRequest,
    McpServer, McpServerHttp, NewSessionRequest, PromptRequest, ReadTextFileRequest, ReadTextFileResponse, RequestPermissionOutcome,
    RequestPermissionRequest, RequestPermissionResponse, SelectedPermissionOutcome, SessionNotification, TextContent,
    WriteTextFileRequest, WriteTextFileResponse, PermissionOptionKind,
};
use agent_client_protocol::schema::ProtocolVersion;
use agent_client_protocol::{Agent, ByteStreams, Client, ConnectionTo};
use serde_json::Value;
use std::collections::{HashMap, VecDeque};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tokio::sync::{mpsc, oneshot};
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

/// How long `initialize` + `session/new` may take (the adapter needs ~1.2 s, PoC S3).
const START_TIMEOUT: Duration = Duration::from_secs(60);
const STDERR_TAIL: usize = 20;

pub struct StartParams {
    pub agent_id: String,
    /// Already passed through `launch::resolve_spec`.
    pub launch: LaunchSpec,
    /// Canonical project folder (the agent's cwd and the scope root).
    pub project_dir: PathBuf,
    pub path_env: String,
    /// Registry `sessionOptions` (extra `_meta` for `session/new`).
    pub session_options: Value,
    /// D-018 "use global settings" toggle (the shell ask rule stays on).
    pub use_global_settings: bool,
    pub mcp_servers: Vec<McpHttpSpec>,
}

enum Command {
    Prompt { text: String, reply: oneshot::Sender<Result<String, HostError>> },
    Cancel,
    Close,
}

struct PendingPermission {
    /// Option ids the user may pick (allow_once / reject_once only).
    choices: Vec<String>,
    tx: oneshot::Sender<Option<String>>,
}

#[derive(Default)]
struct Pending(Mutex<HashMap<String, PendingPermission>>);

impl Pending {
    fn add(&self, id: String, p: PendingPermission) {
        self.0.lock().unwrap().insert(id, p);
    }
    fn respond(&self, id: &str, option_id: Option<&str>) -> Result<(), HostError> {
        let mut map = self.0.lock().unwrap();
        let Some(p) = map.get(id) else {
            return Err(HostError::Protocol(format!("unknown permission request {id}")));
        };
        if let Some(o) = option_id {
            if !p.choices.iter().any(|c| c == o) {
                return Err(HostError::Protocol(format!("option {o} not selectable")));
            }
        }
        let p = map.remove(id).unwrap();
        let _ = p.tx.send(option_id.map(str::to_string));
        Ok(())
    }
    fn cancel_all(&self) {
        for (_, p) in self.0.lock().unwrap().drain() {
            let _ = p.tx.send(None);
        }
    }
}

/// Handle to a running session. Cheap to clone the parts the command layer needs.
pub struct SessionHandle {
    pub session_id: String,
    cmd_tx: mpsc::UnboundedSender<Command>,
    pending: Arc<Pending>,
    done: Arc<AtomicBool>,
}

impl SessionHandle {
    /// Send a prompt and wait for the turn to end. Returns the ACP `stopReason`.
    pub async fn prompt(&self, text: String) -> Result<String, HostError> {
        let (reply, rx) = oneshot::channel();
        self.cmd_tx.send(Command::Prompt { text, reply }).map_err(|_| HostError::Closed)?;
        rx.await.map_err(|_| HostError::Closed)?
    }

    /// `session/cancel`; pending permission requests are answered `cancelled`.
    pub fn cancel(&self) {
        self.pending.cancel_all();
        let _ = self.cmd_tx.send(Command::Cancel);
    }

    /// Answer a permission request. `None` = dismiss (cancelled).
    pub fn respond_permission(&self, request_id: &str, option_id: Option<&str>) -> Result<(), HostError> {
        self.pending.respond(request_id, option_id)
    }

    pub fn close(&self) {
        self.pending.cancel_all();
        let _ = self.cmd_tx.send(Command::Close);
    }

    pub fn is_closed(&self) -> bool {
        self.done.load(Ordering::SeqCst)
    }
}

struct Started {
    session_id: String,
}

fn text_block(s: String) -> Vec<ContentBlock> {
    vec![ContentBlock::Text(TextContent::new(s))]
}

fn tail_string(tail: &Mutex<VecDeque<String>>) -> String {
    tail.lock().unwrap().iter().cloned().collect::<Vec<_>>().join(" | ")
}

/// Spawn the agent and complete the ACP handshake. Events flow to `emit` from now on.
pub async fn start(params: StartParams, emit: Emit) -> Result<SessionHandle, HostError> {
    let emit = crate::agent_host::log::with_log(params.project_dir.clone(), emit);
    let mut proc = spawn_agent(&params.launch, &params.project_dir, &params.path_env)?;
    let stderr_tail: Arc<Mutex<VecDeque<String>>> = Arc::default();
    let sid_cell: Arc<OnceLock<String>> = Arc::default();
    if let Some(stderr) = proc.stderr.take() {
        let (tail, cell, emit) = (stderr_tail.clone(), sid_cell.clone(), emit.clone());
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).split(b'\n').map_while(Result::ok) {
                let line = String::from_utf8_lossy(&line).trim_end_matches('\r').chars().take(2000).collect::<String>();
                if line.is_empty() {
                    continue;
                }
                {
                    let mut t = tail.lock().unwrap();
                    if t.len() == STDERR_TAIL {
                        t.pop_front();
                    }
                    t.push_back(line.clone());
                }
                if let Some(id) = cell.get() {
                    emit(AgentEvent::Stderr { session_id: id.clone(), line });
                }
            }
        });
    }

    let (cmd_tx, cmd_rx) = mpsc::unbounded_channel();
    let (ready_tx, ready_rx) = oneshot::channel();
    let pending: Arc<Pending> = Arc::default();
    let done = Arc::new(AtomicBool::new(false));
    tokio::spawn(run(proc, params, emit, pending.clone(), done.clone(), sid_cell, stderr_tail.clone(), cmd_rx, ready_tx));

    match tokio::time::timeout(START_TIMEOUT, ready_rx).await {
        Ok(Ok(Ok(started))) => Ok(SessionHandle { session_id: started.session_id, cmd_tx, pending, done }),
        Ok(Ok(Err(e))) => Err(e),
        Ok(Err(_)) => Err(HostError::Initialize(format!("agent exited: {}", tail_string(&stderr_tail)))),
        Err(_) => {
            let _ = cmd_tx.send(Command::Close);
            Err(HostError::Initialize("timeout".into()))
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn run(
    mut proc: AgentProcess,
    params: StartParams,
    emit: Emit,
    pending: Arc<Pending>,
    done: Arc<AtomicBool>,
    sid_cell: Arc<OnceLock<String>>,
    stderr_tail: Arc<Mutex<VecDeque<String>>>,
    mut cmd_rx: mpsc::UnboundedReceiver<Command>,
    ready_tx: oneshot::Sender<Result<Started, HostError>>,
) {
    let (Some(stdin), Some(stdout)) = (proc.stdin.take(), proc.stdout.take()) else {
        let _ = ready_tx.send(Err(HostError::Spawn("stdio unavailable".into())));
        return;
    };
    let (stdin, stdout) = match (tokio::process::ChildStdin::from_std(stdin), tokio::process::ChildStdout::from_std(stdout)) {
        (Ok(i), Ok(o)) => (i, o),
        (Err(e), _) | (_, Err(e)) => {
            let _ = ready_tx.send(Err(HostError::Spawn(e.to_string())));
            return;
        }
    };
    let transport = ByteStreams::new(stdin.compat_write(), stdout.compat());

    let closing = Arc::new(AtomicBool::new(false));
    let next_request = Arc::new(AtomicU64::new(1));
    let root = params.project_dir.clone();
    let mut ready_tx = Some(ready_tx);

    let result = {
        let (emit_n, emit_p, emit_r, emit_w, emit_m) = (emit.clone(), emit.clone(), emit.clone(), emit.clone(), emit.clone());
        let (root_p, root_r, root_w) = (root.clone(), root.clone(), root.clone());
        let pending_p = pending.clone();
        let pending_m = pending.clone();
        let next_request_p = next_request.clone();
        let closing_m = closing.clone();
        let ready = &mut ready_tx;
        let cmd_rx = &mut cmd_rx;
        let params = &params;
        let sid_cell = &sid_cell;
        let tail = &stderr_tail;

        Client
            .builder()
            .name("vanilla-studio")
            .on_receive_notification(
                async move |n: SessionNotification, _cx| {
                    emit_n(AgentEvent::Update {
                        session_id: n.session_id.to_string(),
                        update: serde_json::to_value(&n.update).unwrap_or(Value::Null),
                    });
                    Ok(())
                },
                agent_client_protocol::on_receive_notification!(),
            )
            .on_receive_request(
                async move |req: RequestPermissionRequest, responder, cx| {
                    // The handler runs on the connection's event loop; waiting for the user there
                    // would stall session updates, so the decision runs as a spawned task.
                    let (root, emit, pending, next) = (root_p.clone(), emit_p.clone(), pending_p.clone(), next_request_p.clone());
                    cx.spawn(async move {
                        let outcome = permission_flow(&root, &req, &emit, &pending, &next).await;
                        responder.respond(RequestPermissionResponse::new(outcome))
                    })
                },
                agent_client_protocol::on_receive_request!(),
            )
            .on_receive_request(
                async move |req: ReadTextFileRequest, responder, _cx| {
                    let res = fs::read_text_file(&root_r, &req.path, req.line, req.limit);
                    emit_r(AgentEvent::FsAccess {
                        session_id: req.session_id.to_string(),
                        op: "read".into(),
                        path: req.path.to_string_lossy().into_owned(),
                        allowed: res.is_ok(),
                        error: res.as_ref().err().cloned(),
                    });
                    match res {
                        Ok(content) => responder.respond(ReadTextFileResponse::new(content)),
                        Err(e) => responder.respond_with_error(agent_client_protocol::util::internal_error(e)),
                    }
                },
                agent_client_protocol::on_receive_request!(),
            )
            .on_receive_request(
                async move |req: WriteTextFileRequest, responder, _cx| {
                    let res = fs::write_text_file(&root_w, &req.path, &req.content);
                    emit_w(AgentEvent::FsAccess {
                        session_id: req.session_id.to_string(),
                        op: "write".into(),
                        path: req.path.to_string_lossy().into_owned(),
                        allowed: res.is_ok(),
                        error: res.as_ref().err().cloned(),
                    });
                    match res {
                        Ok(()) => responder.respond(WriteTextFileResponse::new()),
                        Err(e) => responder.respond_with_error(agent_client_protocol::util::internal_error(e)),
                    }
                },
                agent_client_protocol::on_receive_request!(),
            )
            .connect_with(transport, async move |cx: ConnectionTo<Agent>| {
                // No `terminal` capability: the agent uses its own shell tool, which goes through
                // request_permission (D-010).
                let caps = ClientCapabilities::new()
                    .fs(FileSystemCapabilities::new().read_text_file(true).write_text_file(true))
                    .terminal(false);
                let init = cx
                    .send_request(
                        InitializeRequest::new(ProtocolVersion::V1)
                            .client_capabilities(caps)
                            .client_info(Implementation::new("vanilla-studio", env!("CARGO_PKG_VERSION"))),
                    )
                    .block_task()
                    .await;
                let init = match init {
                    Ok(i) => i,
                    Err(e) => {
                        if let Some(tx) = ready.take() {
                            let _ = tx.send(Err(HostError::Initialize(format!("{e:?}: {}", tail_string(tail)))));
                        }
                        return Err(e);
                    }
                };

                let mcp: Vec<McpServer> = params
                    .mcp_servers
                    .iter()
                    .map(|m| {
                        McpServer::Http(McpServerHttp::new(m.name.clone(), m.url.clone()).headers(vec![HttpHeader::new(
                            "Authorization",
                            format!("Bearer {}", m.bearer_token),
                        )]))
                    })
                    .collect();
                let mut new_session = NewSessionRequest::new(params.project_dir.clone()).mcp_servers(mcp);
                let meta = build_session_meta(&params.agent_id, &params.session_options, params.use_global_settings);
                if !meta.is_empty() {
                    new_session = new_session.meta(meta);
                }
                let session = match cx.send_request(new_session).block_task().await {
                    Ok(s) => s,
                    Err(e) => {
                        if let Some(tx) = ready.take() {
                            let _ = tx.send(Err(HostError::Session(format!("{e:?}"))));
                        }
                        return Err(e);
                    }
                };
                let sid = session.session_id.clone();
                let sid_str = sid.to_string();
                let _ = sid_cell.set(sid_str.clone());
                emit_m(AgentEvent::Started {
                    session_id: sid_str.clone(),
                    agent_id: params.agent_id.clone(),
                    cwd: params.project_dir.to_string_lossy().into_owned(),
                    agent_name: init.agent_info.as_ref().map(|i| i.name.clone()),
                    agent_version: init.agent_info.as_ref().map(|i| i.version.clone()),
                    load_session: init.agent_capabilities.load_session,
                    modes: serde_json::to_value(&session.modes).unwrap_or(Value::Null),
                });
                if let Some(tx) = ready.take() {
                    let _ = tx.send(Ok(Started { session_id: sid_str.clone() }));
                }

                while let Some(cmd) = cmd_rx.recv().await {
                    match cmd {
                        Command::Close => break,
                        Command::Cancel => {
                            let _ = cx.send_notification(CancelNotification::new(sid.clone()));
                        }
                        Command::Prompt { text, reply } => {
                            emit_m(AgentEvent::PromptSent { session_id: sid_str.clone(), text: text.clone() });
                            let turn = cx.send_request(PromptRequest::new(sid.clone(), text_block(text))).block_task();
                            tokio::pin!(turn);
                            let outcome = loop {
                                tokio::select! {
                                    r = &mut turn => break r.map(|p| serde_json::to_value(p.stop_reason).ok().and_then(|v| v.as_str().map(str::to_string)).unwrap_or_default()),
                                    other = cmd_rx.recv() => match other {
                                        Some(Command::Cancel) => { let _ = cx.send_notification(CancelNotification::new(sid.clone())); }
                                        Some(Command::Prompt { reply, .. }) => { let _ = reply.send(Err(HostError::Busy)); }
                                        Some(Command::Close) | None => {
                                            closing_m.store(true, Ordering::SeqCst);
                                            let _ = cx.send_notification(CancelNotification::new(sid.clone()));
                                            let _ = reply.send(Err(HostError::Closed));
                                            return Ok(());
                                        }
                                    },
                                }
                            };
                            match outcome {
                                Ok(stop) => {
                                    emit_m(AgentEvent::PromptDone { session_id: sid_str.clone(), stop_reason: stop.clone() });
                                    let _ = reply.send(Ok(stop));
                                }
                                Err(e) => {
                                    let _ = reply.send(Err(HostError::Protocol(format!("{e:?}"))));
                                    return Err(e);
                                }
                            }
                        }
                    }
                }
                closing_m.store(true, Ordering::SeqCst);
                pending_m.cancel_all();
                Ok(())
            })
            .await
    };

    // Dropping the connection closes stdin; the process tree is then killed for good.
    pending.cancel_all();
    proc.kill();
    done.store(true, Ordering::SeqCst);
    let sid = sid_cell.get().cloned().unwrap_or_default();
    let reason = if closing.load(Ordering::SeqCst) {
        "user"
    } else if result.is_err() {
        emit(AgentEvent::Error { session_id: sid.clone(), message: format!("{:?}", result.as_ref().err().unwrap()) });
        "error"
    } else {
        "process-exit"
    };
    if let Some(tx) = ready_tx.take() {
        let _ = tx.send(Err(HostError::Initialize(format!("agent exited: {}", tail_string(&stderr_tail)))));
    }
    emit(AgentEvent::Closed { session_id: sid, reason: reason.into() });
}

/// Decide one `session/request_permission` (policy first, user only when the policy says ask).
async fn permission_flow(
    root: &std::path::Path,
    req: &RequestPermissionRequest,
    emit: &Emit,
    pending: &Pending,
    next: &AtomicU64,
) -> RequestPermissionOutcome {
    let session_id = req.session_id.to_string();
    let request_id = format!("perm-{}", next.fetch_add(1, Ordering::SeqCst));
    let tool_call_id = req.tool_call.tool_call_id.to_string();
    let input = permission::input_from_request(req);
    let resolved = |outcome, decided_by, reason: &str| {
        emit(AgentEvent::PermissionResolved {
            session_id: session_id.clone(),
            request_id: request_id.clone(),
            tool_call_id: tool_call_id.clone(),
            outcome,
            decided_by,
            reason: reason.to_string(),
        });
    };
    let select = |id| RequestPermissionOutcome::Selected(SelectedPermissionOutcome::new(id));

    let mut ask_reason = match permission::classify(root, &input) {
        permission::Decision::AutoAllow(reason) => match permission::find_option(&req.options, PermissionOptionKind::AllowOnce) {
            Some(id) => {
                resolved(PermissionOutcomeView::Allowed, DecidedBy::Policy, reason);
                return select(id);
            }
            None => "no-allow-once-option",
        },
        permission::Decision::Deny(reason) => {
            return match permission::find_option(&req.options, PermissionOptionKind::RejectOnce) {
                Some(id) => {
                    resolved(PermissionOutcomeView::Rejected, DecidedBy::Policy, reason);
                    select(id)
                }
                None => {
                    resolved(PermissionOutcomeView::Cancelled, DecidedBy::Policy, reason);
                    RequestPermissionOutcome::Cancelled
                }
            };
        }
        permission::Decision::Ask(reason) => reason,
    };

    let options = permission::visible_options(&req.options);
    if options.is_empty() {
        ask_reason = "no-selectable-option";
        resolved(PermissionOutcomeView::Cancelled, DecidedBy::Policy, ask_reason);
        return RequestPermissionOutcome::Cancelled;
    }
    let (tx, rx) = oneshot::channel();
    pending.add(request_id.clone(), PendingPermission { choices: options.iter().map(|o| o.option_id.clone()).collect(), tx });
    emit(AgentEvent::PermissionRequest {
        session_id: session_id.clone(),
        request_id: request_id.clone(),
        tool_call: serde_json::to_value(&req.tool_call).unwrap_or(Value::Null),
        options: options.clone(),
        reason: ask_reason.to_string(),
    });
    match rx.await {
        Ok(Some(chosen)) => {
            let kind = options.iter().find(|o| o.option_id == chosen).map(|o| o.kind.as_str());
            let outcome = if kind == Some("allow_once") { PermissionOutcomeView::Allowed } else { PermissionOutcomeView::Rejected };
            resolved(outcome, DecidedBy::User, ask_reason);
            select(chosen.into())
        }
        _ => {
            resolved(PermissionOutcomeView::Cancelled, DecidedBy::User, ask_reason);
            RequestPermissionOutcome::Cancelled
        }
    }
}

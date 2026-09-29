//! `vanilla-tools`: the app's built-in MCP server for coding agents (D-014, F-AGT-06).
//!
//! Streamable HTTP on 127.0.0.1 only; every request needs `Authorization: Bearer <token>` where the
//! token is minted per agent session. Agent-host integration (T2.3): call [`McpServer::start`] once,
//! then [`McpServer::issue_session`] per session and pass [`McpEndpoint::to_acp_json`] in the
//! `mcpServers` array of `session/new`; call [`McpServer::revoke`] when the session ends.
//!
//! Implementation choice: Rust `rmcp` (official SDK, Apache-2.0) over a Node sidecar, because it
//! removes a runtime dependency and lets later tools (T4.20) share Rust state directly.

pub mod tools;

use axum::{
    body::Body,
    extract::State,
    http::{header, Request, StatusCode},
    middleware::{self, Next},
    response::Response,
    Router,
};
use rand::RngCore;
use rmcp::transport::streamable_http_server::{
    session::local::LocalSessionManager, StreamableHttpServerConfig, StreamableHttpService,
};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::{Arc, RwLock};
use tokio_util::sync::CancellationToken;

pub const SERVER_NAME: &str = "vanilla-tools";
const MCP_PATH: &str = "/mcp";

/// What an agent session needs to connect.
#[derive(Debug, Clone, PartialEq)]
pub struct McpEndpoint {
    pub name: &'static str,
    pub url: String,
    pub token: String,
}

impl McpEndpoint {
    /// Entry for ACP `session/new` `mcpServers` (HTTP transport with a Bearer header).
    pub fn to_acp_json(&self) -> Value {
        json!({
            "type": "http",
            "name": self.name,
            "url": self.url,
            "headers": [{ "name": "Authorization", "value": format!("Bearer {}", self.token) }],
        })
    }
}

type Tokens = Arc<RwLock<HashSet<String>>>;

pub struct McpServer {
    addr: SocketAddr,
    tokens: Tokens,
    shutdown: CancellationToken,
}

fn new_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

async fn require_token(State(tokens): State<Tokens>, req: Request<Body>, next: Next) -> Response {
    let ok = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .is_some_and(|t| tokens.read().map(|set| set.contains(t)).unwrap_or(false));
    if ok {
        next.run(req).await
    } else {
        Response::builder()
            .status(StatusCode::UNAUTHORIZED)
            .header(header::WWW_AUTHENTICATE, "Bearer")
            .body(Body::empty())
            .expect("static response")
    }
}

impl McpServer {
    /// Bind 127.0.0.1 on an ephemeral port and serve until [`McpServer::stop`].
    pub async fn start() -> std::io::Result<McpServer> {
        let shutdown = CancellationToken::new();
        let tokens: Tokens = Arc::new(RwLock::new(HashSet::new()));
        let service = StreamableHttpService::new(
            || Ok(tools::VanillaTools::new()),
            Arc::new(LocalSessionManager::default()),
            StreamableHttpServerConfig::default()
                .with_sse_keep_alive(None)
                .with_cancellation_token(shutdown.child_token()),
        );
        let app = Router::new()
            .nest_service(MCP_PATH, service)
            .layer(middleware::from_fn_with_state(tokens.clone(), require_token));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
        let addr = listener.local_addr()?;
        let stop = shutdown.clone();
        tokio::spawn(async move {
            let _ = axum::serve(listener, app)
                .with_graceful_shutdown(async move { stop.cancelled_owned().await })
                .await;
        });
        Ok(McpServer { addr, tokens, shutdown })
    }

    pub fn addr(&self) -> SocketAddr {
        self.addr
    }

    /// Mint a token for one agent session.
    pub fn issue_session(&self) -> McpEndpoint {
        let token = new_token();
        self.tokens.write().expect("token lock").insert(token.clone());
        McpEndpoint { name: SERVER_NAME, url: format!("http://{}{}", self.addr, MCP_PATH), token }
    }

    pub fn revoke(&self, endpoint: &McpEndpoint) {
        self.tokens.write().expect("token lock").remove(&endpoint.token);
    }

    pub fn stop(&self) {
        self.shutdown.cancel();
    }
}

impl Drop for McpServer {
    fn drop(&mut self) {
        self.shutdown.cancel();
    }
}

#[cfg(test)]
mod tests;

//! Connects the app's own `vanilla-tools` MCP server (`crate::mcp_server`) to agent sessions (T2.10).
//!
//! One server per app run, one bearer token per agent session. The token is handed to the agent in
//! `session/new` `mcpServers` and revoked when the session ends (or never got started).

use crate::agent_host::events::{AgentEvent, Emit};
use crate::agent_host::launch::McpHttpSpec;
use crate::mcp_server::{McpEndpoint, McpServer, SERVER_NAME};
use std::sync::Arc;
use tokio::sync::OnceCell;

static SERVER: OnceCell<Option<Arc<McpServer>>> = OnceCell::const_new();

/// The shared MCP server, started on first use. `None` when it could not bind: sessions then run
/// without the app tools instead of failing.
pub async fn shared_server() -> Option<Arc<McpServer>> {
    SERVER
        .get_or_init(|| async {
            match McpServer::start().await {
                Ok(s) => Some(Arc::new(s)),
                Err(e) => {
                    log::warn!("vanilla-tools MCP server unavailable: {e}");
                    None
                }
            }
        })
        .await
        .clone()
}

/// Session-scoped access token for the MCP server.
pub struct McpLease {
    server: Arc<McpServer>,
    endpoint: McpEndpoint,
}

impl McpLease {
    pub fn issue(server: &Arc<McpServer>) -> Arc<McpLease> {
        Arc::new(McpLease { endpoint: server.issue_session(), server: server.clone() })
    }

    pub fn spec(&self) -> McpHttpSpec {
        McpHttpSpec { name: self.endpoint.name.to_string(), url: self.endpoint.url.clone(), bearer_token: self.endpoint.token.clone() }
    }

    /// Idempotent.
    pub fn revoke(&self) {
        self.server.revoke(&self.endpoint);
    }

    /// Revoke the token when the session reports `Closed`.
    pub fn revoke_on_close(self: &Arc<Self>, inner: Emit) -> Emit {
        let lease = self.clone();
        Arc::new(move |e| {
            if matches!(e, AgentEvent::Closed { .. }) {
                lease.revoke();
            }
            inner(e);
        })
    }
}

/// The server list for a session: the app's own entry first, then caller-supplied ones. A caller
/// cannot shadow the app entry (permission policy trusts `mcp__vanilla-tools__*`).
pub fn merge_servers(own: Option<McpHttpSpec>, extra: Vec<McpHttpSpec>) -> Vec<McpHttpSpec> {
    own.into_iter().chain(extra.into_iter().filter(|m| m.name != SERVER_NAME)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spec(name: &str) -> McpHttpSpec {
        McpHttpSpec { name: name.into(), url: "http://x".into(), bearer_token: "t".into() }
    }

    #[test]
    fn caller_cannot_shadow_the_app_server() {
        let merged = merge_servers(Some(spec(SERVER_NAME)), vec![spec(SERVER_NAME), spec("other")]);
        assert_eq!(merged.iter().map(|m| m.name.as_str()).collect::<Vec<_>>(), [SERVER_NAME, "other"]);
        let merged = merge_servers(None, vec![spec(SERVER_NAME), spec("other")]);
        assert_eq!(merged.len(), 1);
    }

    #[tokio::test]
    async fn lease_revokes_on_close_only() {
        async fn init_status(url: &str, token: &str) -> reqwest::StatusCode {
            reqwest::Client::new()
                .post(url)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json, text/event-stream")
                .header("Authorization", format!("Bearer {token}"))
                .body(r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}"#)
                .send()
                .await
                .expect("request")
                .status()
        }

        let server = Arc::new(McpServer::start().await.expect("mcp server"));
        let lease = McpLease::issue(&server);
        let spec = lease.spec();
        let seen: Arc<std::sync::Mutex<Vec<String>>> = Arc::default();
        let seen_in = seen.clone();
        let emit: Emit = lease.revoke_on_close(Arc::new(move |e: AgentEvent| {
            let kind = serde_json::to_value(&e).unwrap()["type"].as_str().unwrap().to_string();
            seen_in.lock().unwrap().push(kind);
        }));
        assert_eq!(init_status(&spec.url, &spec.bearer_token).await, 200);
        emit(AgentEvent::PromptDone { session_id: "s".into(), stop_reason: "end_turn".into() });
        assert_eq!(init_status(&spec.url, &spec.bearer_token).await, 200, "non-close events keep the token");
        emit(AgentEvent::Closed { session_id: "s".into(), reason: "user".into() });
        assert_eq!(init_status(&spec.url, &spec.bearer_token).await, 401);
        emit(AgentEvent::Closed { session_id: "s".into(), reason: "user".into() });
        assert_eq!(seen.lock().unwrap().len(), 3, "every event still reaches the inner sink");
    }
}

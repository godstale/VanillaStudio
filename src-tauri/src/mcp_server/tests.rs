use super::*;
use rmcp::{
    model::{CallToolRequestParams, ClientInfo},
    transport::{
        streamable_http_client::StreamableHttpClientTransportConfig, StreamableHttpClientTransport,
    },
    ServiceExt,
};

const INIT_BODY: &str = r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}"#;

async fn post_initialize(url: &str, auth: Option<&str>) -> reqwest::StatusCode {
    let mut req = reqwest::Client::new()
        .post(url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json, text/event-stream")
        .body(INIT_BODY);
    if let Some(a) = auth {
        req = req.header("Authorization", a);
    }
    req.send().await.expect("request").status()
}

#[tokio::test]
async fn rejects_requests_without_or_with_bad_token() {
    let server = McpServer::start().await.unwrap();
    let ep = server.issue_session();
    assert!(server.addr().ip().is_loopback());
    assert_eq!(post_initialize(&ep.url, None).await, 401);
    assert_eq!(post_initialize(&ep.url, Some("Bearer nope")).await, 401);
    assert_eq!(post_initialize(&ep.url, Some(&ep.token)).await, 401, "scheme required");
    assert_eq!(post_initialize(&ep.url, Some(&format!("Bearer {}", ep.token))).await, 200);
}

#[tokio::test]
async fn revoked_token_is_rejected() {
    let server = McpServer::start().await.unwrap();
    let ep = server.issue_session();
    server.revoke(&ep);
    assert_eq!(post_initialize(&ep.url, Some(&format!("Bearer {}", ep.token))).await, 401);
}

#[tokio::test]
async fn client_can_list_and_call_ping() {
    let server = McpServer::start().await.unwrap();
    let ep = server.issue_session();
    let transport = StreamableHttpClientTransport::from_config(
        StreamableHttpClientTransportConfig::with_uri(ep.url.clone()).auth_header(ep.token.clone()),
    );
    let client = ClientInfo::default().serve(transport).await.expect("connect");
    let tools = client.list_tools(Default::default()).await.expect("list");
    assert!(tools.tools.iter().any(|t| t.name == "ping"));
    let res = client.call_tool(CallToolRequestParams::new("ping")).await.expect("ping");
    assert_ne!(res.is_error, Some(true));
    let text = res.content[0].as_text().expect("text content").text.clone();
    assert_eq!(text, "pong");
    let _ = client.cancel().await;
}

#[test]
fn acp_json_shape() {
    let ep = McpEndpoint { name: SERVER_NAME, url: "http://127.0.0.1:1/mcp".into(), token: "abc".into() };
    let v = ep.to_acp_json();
    assert_eq!(v["type"], "http");
    assert_eq!(v["name"], "vanilla-tools");
    assert_eq!(v["headers"][0]["value"], "Bearer abc");
}

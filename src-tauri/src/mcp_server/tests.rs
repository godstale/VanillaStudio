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

/// A minimal Vanilla project: manifest, one clean scene, one review with a
/// screenshot, and a two-task plan. Each tool test builds on this fixture.
fn demo_project() -> tempfile::TempDir {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path();
    std::fs::write(root.join("vanilla.json"), r#"{"version":1,"outputType":"video"}"#).unwrap();
    std::fs::create_dir_all(root.join("src/scenes")).unwrap();
    std::fs::write(
        root.join("src/scenes/intro.tsx"),
        "import { defineScene } from '@vanilla/runtime';\nexport default defineScene({ id: 's1' });\n",
    )
    .unwrap();
    std::fs::create_dir_all(root.join("reviews")).unwrap();
    std::fs::write(
        root.join("reviews/R-001.md"),
        "---\nid: R-001\ntarget: s1\nt: 1.5\nstatus: open\ncreatedAt: 2026-01-01T00:00:00Z\nscreenshot: R-001.png\n---\n\nMake it bigger.\n",
    )
    .unwrap();
    // 1x1 PNG header is enough: the tool checks magic bytes, not pixels.
    let mut png = b"\x89PNG\r\n\x1a\n".to_vec();
    png.resize(16, 0);
    std::fs::write(root.join("reviews/R-001.png"), png).unwrap();
    std::fs::create_dir_all(root.join("plan")).unwrap();
    std::fs::write(
        root.join("plan/tasks.json"),
        r#"{"version":1,"tasks":[{"id":"t1","kind":"scene","target":"s1","prompt":"prompts/a.md","dependsOn":[]}]}"#,
    )
    .unwrap();
    tmp
}

async fn tool_client(
    ep: &McpEndpoint,
) -> rmcp::service::RunningService<rmcp::RoleClient, rmcp::model::ClientInfo> {
    let transport = StreamableHttpClientTransport::from_config(
        StreamableHttpClientTransportConfig::with_uri(ep.url.clone()).auth_header(ep.token.clone()),
    );
    ClientInfo::default().serve(transport).await.expect("connect")
}

fn args(value: serde_json::Value) -> rmcp::model::JsonObject {
    value.as_object().expect("object").clone()
}

fn tool_text(res: &rmcp::model::CallToolResult) -> serde_json::Value {
    assert_ne!(res.is_error, Some(true));
    let text = res.content[0].as_text().expect("text content").text.clone();
    serde_json::from_str(&text).expect("tool returns JSON")
}

#[tokio::test]
async fn client_lists_all_five_tools() {
    let server = McpServer::start().await.unwrap();
    let ep = server.issue_session();
    let client = tool_client(&ep).await;
    let tools = client.list_tools(Default::default()).await.expect("list");
    let names: Vec<_> = tools.tools.iter().map(|t| t.name.as_ref()).collect();
    for want in ["ping", "snapshot_scene", "check_scene", "get_review", "update_task_status"] {
        assert!(names.contains(&want), "missing {want} in {names:?}");
    }
    let _ = client.cancel().await;
}

#[tokio::test]
async fn client_calls_check_scene() {
    let tmp = demo_project();
    let project_path = tmp.path().to_string_lossy().into_owned();
    let server = McpServer::start().await.unwrap();
    let ep = server.issue_session();
    let client = tool_client(&ep).await;
    let res = client
        .call_tool(
            CallToolRequestParams::new("check_scene").with_arguments(args(serde_json::json!({
                "project_path": project_path,
            }))),
        )
        .await
        .expect("check_scene");
    let body = tool_text(&res);
    assert_eq!(body["ok"], true);
    assert_eq!(body["result"]["files_checked"], 1);
    assert_eq!(body["result"]["errors"], 0);
    let _ = client.cancel().await;
}

#[tokio::test]
async fn client_calls_snapshot_and_review() {
    let tmp = demo_project();
    let project_path = tmp.path().to_string_lossy().into_owned();
    let server = McpServer::start().await.unwrap();
    let ep = server.issue_session();
    let client = tool_client(&ep).await;
    let res = client
        .call_tool(
            CallToolRequestParams::new("snapshot_scene").with_arguments(args(serde_json::json!({
                "project_path": project_path,
            }))),
        )
        .await
        .expect("snapshot_scene");
    let body = tool_text(&res);
    assert_eq!(body["ok"], true);
    assert_eq!(body["result"]["name"], "R-001.png");
    assert!(body["result"]["data_url"].as_str().unwrap().starts_with("data:image/png;base64,"));
    let res = client
        .call_tool(
            CallToolRequestParams::new("get_review").with_arguments(args(serde_json::json!({
                "project_path": project_path, "id": "R-001",
            }))),
        )
        .await
        .expect("get_review");
    let body = tool_text(&res);
    assert_eq!(body["ok"], true);
    assert_eq!(body["result"]["target"], "s1");
    let res = client
        .call_tool(
            CallToolRequestParams::new("get_review").with_arguments(args(serde_json::json!({
                "project_path": project_path,
            }))),
        )
        .await
        .expect("get_review list");
    let body = tool_text(&res);
    assert_eq!(body["result"].as_array().unwrap().len(), 1);
    let _ = client.cancel().await;
}

#[tokio::test]
async fn client_calls_update_task_status() {
    let tmp = demo_project();
    let project_path = tmp.path().to_string_lossy().into_owned();
    let server = McpServer::start().await.unwrap();
    let ep = server.issue_session();
    let client = tool_client(&ep).await;
    let res = client
        .call_tool(
            CallToolRequestParams::new("update_task_status").with_arguments(args(serde_json::json!({
                "project_path": project_path, "task_id": "t1", "status": "done",
            }))),
        )
        .await
        .expect("update_task_status");
    let body = tool_text(&res);
    assert_eq!(body["ok"], true);
    assert_eq!(body["result"]["status"], "done");
    assert!(tmp.path().join(".vanilla/task-status.json").is_file());
    // Unknown task is a tool-level error payload, not a transport error.
    let res = client
        .call_tool(
            CallToolRequestParams::new("update_task_status").with_arguments(args(serde_json::json!({
                "project_path": project_path, "task_id": "nope", "status": "done",
            }))),
        )
        .await
        .expect("update_task_status unknown");
    let text = res.content[0].as_text().expect("text content").text.clone();
    let body: serde_json::Value = serde_json::from_str(&text).unwrap();
    assert_eq!(body["ok"], false);
    let _ = client.cancel().await;
}

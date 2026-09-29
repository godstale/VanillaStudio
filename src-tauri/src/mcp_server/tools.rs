//! Tool definitions. T2.10 ships only `ping`; real tools arrive in T4.20.

use rmcp::{
    handler::server::router::tool::ToolRouter,
    model::{ServerCapabilities, ServerInfo},
    tool, tool_handler, tool_router, ServerHandler,
};

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
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for VanillaTools {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_instructions("Vanilla Studio tools for the current project.")
    }
}

//! Agent host (M2): runs coding agents over ACP with cwd = the project folder.
//! Design: Technical-Design 3.2, decisions D-010 (permissions), D-012 (owned processes), D-018 (isolation).

pub mod events;
pub mod fs;
pub mod launch;
pub mod log;
pub mod mcp;
pub mod permission;
pub mod session;

#[cfg(test)]
mod tests;

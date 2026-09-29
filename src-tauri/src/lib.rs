pub mod agent_host;
pub mod commands;
pub mod mcp_server;
pub mod process;
pub mod watch;

use commands::agent_commands::*;
use commands::doctor_commands::*;
use commands::export_commands::*;
use commands::fs_commands::*;
use commands::project_commands::*;
use commands::process_commands::*;
use commands::pty_commands::*;
use commands::search_commands::*;
use commands::shell_commands::*;
use watch::{start_preview_watch, stop_preview_watch};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("app".into()),
                    }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .level(log::LevelFilter::Info)
                .max_file_size(10_000_000) // 10 MB limit per log file
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(5)) // Keep at most 5 rotated log files
                .build(),
        )
        .setup(|app| {
            use tauri::Manager;
            for window in app.webview_windows().values() {
                let _ = window.set_theme(Some(tauri::Theme::Light));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pick_project_folder,
            set_active_workspace,
            ensure_app_dir,
            get_app_paths,
            read_project_folder_tree,
            read_text_file,
            write_text_file,
            create_file,
            create_folder,
            rename_path,
            delete_path,
            list_dir,
            copy_path,
            import_external_file,
            reveal_in_explorer,
            grep_files,
            find_files,
            run_shell,
            doctor_check,
            ffmpeg_download,
            ffmpeg_download_cancel,
            scaffold_project,
            checkpoint_status,
            checkpoint_init,
            checkpoint_commit,
            checkpoint_history,
            install_project_deps,
            install_project_deps_cancel,
            start_preview_server,
            stop_preview_server,
            start_preview_watch,
            stop_preview_watch,
            pty_start,
            pty_write,
            pty_resize,
            pty_kill,
            install_claude_adapter,
            install_claude_adapter_cancel,
            claude_adapter_status,
            start_agent_session,
            send_agent_prompt,
            cancel_agent_prompt,
            respond_agent_permission,
            close_agent_session,
            start_export_job,
            cancel_export_job,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

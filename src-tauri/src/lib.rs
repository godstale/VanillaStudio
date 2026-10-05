pub mod commands;
pub mod process;
pub mod watch;

use commands::doctor_commands::*;
use commands::export_commands::*;
use commands::fs_commands::*;
use commands::process_commands::*;
use commands::pty_commands::*;
use commands::search_commands::*;
use commands::scene_commands::*;
use commands::shell_commands::*;
use commands::template_commands::*;
use commands::trust_commands::*;
use commands::workspace_commands::*;
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
            create_scene,
            rename_scene,
            delete_scene,
            duplicate_scene,
            read_template_folders,
            set_workspace_trusted,
            is_workspace_trusted,
            inspect_workspace_folder,
            create_workspace,
            open_workspace,
            verify_workspace_path,
            start_export_job,
            cancel_export_job,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

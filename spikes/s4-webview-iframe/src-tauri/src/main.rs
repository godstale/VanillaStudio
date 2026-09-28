// S4: host window embeds the preview dev server in an iframe; the host reports measurements back.
use std::path::PathBuf;

fn spike_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

/// Rewrites the preview's label module so Vite pushes an HMR update into the iframe.
#[tauri::command]
fn touch_preview(label: String) -> Result<(), String> {
    let path = spike_dir().join("preview-app/src/label.ts");
    std::fs::write(path, format!("export const LABEL = '{label}';\n")).map_err(|e| e.to_string())
}

#[tauri::command]
fn report(app: tauri::AppHandle, json: String) -> Result<(), String> {
    let out = spike_dir().join("out");
    std::fs::create_dir_all(&out).map_err(|e| e.to_string())?;
    std::fs::write(out.join("result.json"), json).map_err(|e| e.to_string())?;
    // Leave the window up briefly so a screenshot can be taken, then exit.
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(3));
        app.exit(0);
    });
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![touch_preview, report])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

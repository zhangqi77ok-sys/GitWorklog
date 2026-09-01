use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    tauri_build::build();

    // Ensure WebView2Loader.dll is copied to the binary directory on Windows
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    if target_os == "windows" {
        if let Ok(out_dir) = env::var("OUT_DIR") {
            let out_path = PathBuf::from(out_dir);
            // Walk up to find target/debug or target/release
            if let Some(target_dir) = out_path.ancestors().nth(3) {
                let dll_src = PathBuf::from("WebView2Loader.dll");
                if dll_src.exists() {
                    let _ = fs::copy(&dll_src, target_dir.join("WebView2Loader.dll"));
                }
            }
        }
    }
}

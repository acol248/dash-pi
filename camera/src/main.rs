use anyhow::{Context, Result};
use dotenv::dotenv;
use std::env;
use std::fs;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;

mod config;
mod recorder;
mod server;

use config::Config;
use recorder::{start_recording_loop, start_preview_loop};

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    dotenv().ok();
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let env_path = exe_dir.join(".env");
            if env_path.exists() {
                dotenv::from_path(env_path).ok();
            }
        }
    }

    let config = Config::from_env().context("Failed to load configuration")?;

    if !config.output_dir.exists() {
        fs::create_dir_all(&config.output_dir).context("Failed to create output directory")?;
    }

    println!("Starting DashPi...");

    let running = Arc::new(AtomicBool::new(true));
    let r = running.clone();

    ctrlc::set_handler(move || {
        println!("\nGracefully shutting down...");
        r.store(false, Ordering::SeqCst);
    })
    .context("Error setting Ctrl-C handler")?;

    println!("Press 'Ctrl+C' to stop.");

    let active_segment = Arc::new(AtomicUsize::new(0));
    let last_preview_request = Arc::new(AtomicU64::new(0));

    if config.web_enabled {
        let server_config = config.clone();
        let server_running = running.clone();
        let server_last_preview_request = last_preview_request.clone();
        tokio::spawn(async move {
            server::run_server(server_config, server_running, server_last_preview_request).await;
        });
    }

    if config.preview_enabled {
        let preview_config = config.clone();
        let preview_running = running.clone();
        let preview_active_segment = active_segment.clone();
        let preview_last_preview_request = last_preview_request.clone();
        tokio::task::spawn_blocking(move || {
            start_preview_loop(
                &preview_config,
                preview_running,
                preview_active_segment,
                preview_last_preview_request,
            );
        });
    }

    let recorder_running = running.clone();
    let recorder_config = config.clone();
    let recorder_active_segment = active_segment.clone();
    let recorder_handle = tokio::task::spawn_blocking(move || {
        start_recording_loop(&recorder_config, recorder_running, recorder_active_segment)
    });

    recorder_handle.await.context("Recorder thread execution failed")??;

    Ok(())
}

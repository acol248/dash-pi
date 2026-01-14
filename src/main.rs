use anyhow::{Context, Result};
use dotenv::dotenv;
use std::env;
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

mod config;
mod recorder;

use config::Config;
use recorder::start_recording_loop;

fn main() -> Result<()> {
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

    log::info!("Starting Dash Pi");

    let running = Arc::new(AtomicBool::new(true));
    let r = running.clone();

    ctrlc::set_handler(move || {
        println!("\nGracefully shutting down...");
        r.store(false, Ordering::SeqCst);
    })
    .context("Error setting Ctrl-C handler")?;

    println!("Press 'Ctrl+C' to stop.");

    start_recording_loop(&config, running)?;

    log::info!("Application exited.");
    Ok(())
}

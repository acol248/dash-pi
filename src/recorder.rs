use anyhow::{Context, Result};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use crate::config::Config;

pub fn start_recording_loop(config: &Config, running: Arc<AtomicBool>) -> Result<()> {
    while running.load(Ordering::SeqCst) {
        let file_pattern = config.output_dir.join("%Y%m%d_%H%M%S.mp4");
        let file_pattern_str = file_pattern.to_string_lossy();

        if !running.load(Ordering::SeqCst) {
            break;
        }

        let cmd_string = config.generate_cmd(&file_pattern_str);

        let mut child = Command::new("sh")
            .arg("-c")
            .arg(&cmd_string)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .context("Failed to start recording pipeline")?;

        loop {
            if !running.load(Ordering::SeqCst) {
                log::info!("Interrupted. Stopping recording...");

                let _ = Command::new("kill")
                    .arg("-s")
                    .arg("TERM")
                    .arg(child.id().to_string())
                    .status();

                thread::sleep(Duration::from_millis(500));

                let _ = child.kill();
                let _ = child.wait();
                break;
            }

            match child.try_wait() {
                Ok(Some(status)) => {
                    if !status.success() {
                        log::error!("Recording process exited with error: {:?}", status);
                    }
                    break;
                }
                Ok(None) => {
                    thread::sleep(Duration::from_millis(200));
                }
                Err(e) => {
                    log::error!("Error waiting for process: {}", e);
                    break;
                }
            }
        }
    }
    Ok(())
}

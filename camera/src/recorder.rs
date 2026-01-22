use anyhow::{Context, Result};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use std::fs;
use crate::config::Config;

fn get_next_file_index(dir: &std::path::Path) -> usize {
    let mut max_idx = 0;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "mp4") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                     if let Some(num_part) = stem.strip_prefix("rec_") {
                         if let Ok(num) = num_part.parse::<usize>() {
                             if num > max_idx {
                                 max_idx = num;
                             }
                         }
                     }
                }
            }
        }
    }
    max_idx + 1
}

pub fn start_recording_loop(config: &Config, running: Arc<AtomicBool>) -> Result<()> {
    while running.load(Ordering::SeqCst) {
        let start_index = get_next_file_index(&config.output_dir);
        let file_pattern = config.output_dir.join("rec_%05d.mp4");
        let file_pattern_str = file_pattern.to_string_lossy();

        if !running.load(Ordering::SeqCst) {
            break;
        }

        let cmd_string = config.generate_cmd(&file_pattern_str, start_index);

        let mut child = Command::new("sh")
            .arg("-c")
            .arg(&cmd_string)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .context("Failed to start recording pipeline")?;

        loop {
            if !running.load(Ordering::SeqCst) {
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
                        println!("Recording process exited with error: {:?}", status);
                    }
                    break;
                }
                Ok(None) => {
                    thread::sleep(Duration::from_millis(200));
                }
                Err(e) => {
                    println!("Error waiting for process: {}", e);
                    break;
                }
            }
        }
    }
    Ok(())
}

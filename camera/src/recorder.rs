use anyhow::{Context, Result};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use std::fs;
use std::ffi::CString;
use crate::config::Config;

fn get_available_space_bytes(path: &std::path::Path) -> Option<u64> {
    let c_path = CString::new(path.to_string_lossy().as_bytes()).ok()?;
    let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };
    let ret = unsafe { libc::statvfs(c_path.as_ptr(), &mut stat) };
    if ret == 0 {
        Some(stat.f_bavail as u64 * stat.f_frsize as u64)
    } else {
        None
    }
}

fn free_up_space(dir: &std::path::Path, min_free_bytes: u64) {
    // Remove any empty (0-byte) mp4 files left from previous failed recordings
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "mp4") {
                if let Ok(meta) = entry.metadata() {
                    if meta.len() == 0 {
                        println!("Removing empty recording file: {}", path.display());
                        let _ = fs::remove_file(&path);
                    }
                }
            }
        }
    }

    // Collect all rec_*.mp4 files sorted by index (oldest first)
    let mut files: Vec<(usize, std::path::PathBuf)> = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "mp4") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Some(num_part) = stem.strip_prefix("rec_") {
                        if let Ok(num) = num_part.parse::<usize>() {
                            files.push((num, path));
                        }
                    }
                }
            }
        }
    }
    files.sort_by_key(|(idx, _)| *idx);

    for (_, path) in files {
        let avail = match get_available_space_bytes(dir) {
            Some(a) => a,
            None => break,
        };
        if avail >= min_free_bytes {
            break;
        }
        println!(
            "Low on storage ({} MB free), removing oldest recording: {}",
            avail / (1024 * 1024),
            path.display()
        );
        let _ = fs::remove_file(&path);
    }
}

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
        free_up_space(&config.output_dir, config.min_free_space_bytes);

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

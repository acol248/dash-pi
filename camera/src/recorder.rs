use anyhow::{Context, Result};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use std::fs;
use std::ffi::CString;
use crate::config::Config;

/// Periodically extracts a single frame from the currently-recording segment and
/// writes it atomically to `{output_dir}/preview.jpg`.
///
/// This never opens the camera — it reads from the fmp4 file that libcamera-vid is
/// already writing, which is safe and has negligible impact on the recorder.
pub fn start_preview_loop(config: &Config, running: Arc<AtomicBool>) {
    let interval = Duration::from_secs(config.preview_interval_sec);
    let preview_path = config.output_dir.join("preview.jpg");
    // Write to a temp file then rename so the server never sees a partial JPEG.
    let preview_tmp = config.output_dir.join("preview.jpg.tmp");

    let mut tracked_idx: Option<usize> = None;
    let mut segment_appeared_at = Instant::now();

    loop {
        thread::sleep(interval);

        if !running.load(Ordering::SeqCst) {
            break;
        }

        let idx = match get_max_fmp4_index(&config.output_dir) {
            Some(i) => i,
            None => continue, // recording hasn't started yet
        };

        // Reset our clock whenever we move to a new segment.
        if tracked_idx != Some(idx) {
            tracked_idx = Some(idx);
            segment_appeared_at = Instant::now();
        }

        let elapsed = segment_appeared_at.elapsed().as_secs();
        // Seek a couple of seconds behind the live edge so the frame definitely exists.
        let seek_secs = elapsed.saturating_sub(config.preview_interval_sec + 1);

        let tmp_file = config.output_dir.join(format!("tmp_{:05}.mp4", idx));
        if !tmp_file.exists() {
            continue;
        }

        let status = Command::new("ffmpeg")
            .args([
                "-y",
                "-ss", &seek_secs.to_string(),
                "-i", &tmp_file.to_string_lossy(),
                "-vframes", "1",
                "-vf", "scale=640:-2",
                "-q:v", "10",
                &preview_tmp.to_string_lossy(),
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();

        if matches!(status, Ok(s) if s.success()) {
            let _ = fs::rename(&preview_tmp, &preview_path);
        }
    }

    // Clean up stale preview on shutdown so the UI shows no frame rather than
    // a freeze-frame from the previous session.
    let _ = fs::remove_file(&preview_path);
}

fn generate_thumbnail(mp4_path: &std::path::Path) {
    let thumb_path = mp4_path.with_extension("jpg");
    println!("Generating thumbnail for {}", mp4_path.display());
    match Command::new("ffmpeg")
        .args([
            "-y",
            "-ss", "2",
            "-i", &mp4_path.to_string_lossy(),
            "-vframes", "1",
            "-vf", "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
            "-q:v", "10",
            &thumb_path.to_string_lossy(),
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
    {
        Ok(s) if s.success() => println!("Thumbnail saved: {}", thumb_path.display()),
        Ok(s) => println!("Thumbnail generation failed (status {:?}): {}", s, mp4_path.display()),
        Err(e) => println!("Failed to run ffmpeg for thumbnail {}: {}", mp4_path.display(), e),
    }
}

fn remux_to_mp4(fmp4_path: &std::path::Path, mp4_path: &std::path::Path) -> bool {
    println!("Remuxing {} → {}", fmp4_path.display(), mp4_path.display());
    let cmd = Config::generate_remux_cmd(
        &fmp4_path.to_string_lossy(),
        &mp4_path.to_string_lossy(),
    );
    match Command::new("sh")
        .arg("-c")
        .arg(&cmd)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
    {
        Ok(s) if s.success() => {
            println!("Remux complete: {}", mp4_path.display());
            true
        }
        Ok(s) => {
            println!("Remux failed (status {:?}): {}", s, fmp4_path.display());
            false
        }
        Err(e) => {
            println!("Failed to run remux for {}: {}", fmp4_path.display(), e);
            false
        }
    }
}

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
        let thumb_path = path.with_extension("jpg");
        if thumb_path.exists() {
            let _ = fs::remove_file(&thumb_path);
        }
    }
}

fn get_next_file_index(dir: &std::path::Path) -> usize {
    // Scan both rec_NNNNN.mp4 (final) and tmp_NNNNN.mp4 (in-progress) to find the highest index.
    let mut max_idx = 0;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("mp4") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    let num_str = stem
                        .strip_prefix("rec_")
                        .or_else(|| stem.strip_prefix("tmp_"));
                    if let Some(n) = num_str.and_then(|n| n.parse::<usize>().ok()) {
                        if n > max_idx {
                            max_idx = n;
                        }
                    }
                }
            }
        }
    }
    max_idx + 1
}

pub fn start_recording_loop(config: &Config, running: Arc<AtomicBool>) -> Result<()> {
    recover_orphaned_fmp4(&config.output_dir);

    while running.load(Ordering::SeqCst) {
        free_up_space(&config.output_dir, config.min_free_space_bytes);

        let start_index = get_next_file_index(&config.output_dir);
        let file_pattern = config.output_dir.join("tmp_%05d.mp4");

        if !running.load(Ordering::SeqCst) {
            break;
        }

        println!("Starting recording pipeline (segments from {:05})", start_index);
        let cmd_string = config.generate_record_cmd(&file_pattern.to_string_lossy(), start_index);

        let mut child = Command::new("sh")
            .arg("-c")
            .arg(&cmd_string)
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .context("Failed to start recording pipeline")?;

        let mut last_max_tmp: Option<usize> = None;
        let mut remux_handles: Vec<JoinHandle<()>> = Vec::new();

        let crashed = loop {
            if !running.load(Ordering::SeqCst) {
                let _ = Command::new("kill")
                    .arg("-s").arg("TERM")
                    .arg(child.id().to_string())
                    .status();
                thread::sleep(Duration::from_millis(500));
                let _ = child.kill();
                let _ = child.wait();
                break false;
            }

            // When tmp_N+1.mp4 appears, tmp_N.mp4 is complete and safe to remux.
            check_and_remux_completed(&config.output_dir, &mut last_max_tmp, &mut remux_handles);
            remux_handles.retain(|h| !h.is_finished());

            match child.try_wait() {
                Ok(Some(status)) => {
                    if !status.success() {
                        println!("Recording pipeline exited with error: {:?}", status);
                        // Drain stderr for diagnostics
                        if let Some(mut stderr) = child.stderr.take() {
                            use std::io::Read;
                            let mut err_output = String::new();
                            let _ = stderr.read_to_string(&mut err_output);
                            if !err_output.trim().is_empty() {
                                println!("Pipeline stderr:\n{}", err_output);
                            }
                        }
                    }
                    break true; // unexpected exit — restart the pipeline
                }
                Ok(None) => {
                    thread::sleep(Duration::from_millis(200));
                }
                Err(e) => {
                    println!("Error waiting for process: {}", e);
                    break true;
                }
            }
        };

        for handle in remux_handles.drain(..) {
            let _ = handle.join();
        }

        remux_all_remaining_fmp4(&config.output_dir, &mut remux_handles);
        if !remux_handles.is_empty() {
            println!("Waiting for {} remux operation(s) to complete...", remux_handles.len());
            for handle in remux_handles.drain(..) {
                let _ = handle.join();
            }
        }

        if crashed && running.load(Ordering::SeqCst) {
            println!("Pipeline crashed, restarting in 2 seconds...");
            thread::sleep(Duration::from_secs(2));
        }
    }

    Ok(())
}

/// Returns the highest index among all tmp_NNNNN.mp4 (in-progress segment) files in `dir`.
fn get_max_fmp4_index(dir: &std::path::Path) -> Option<usize> {
    let mut max: Option<usize> = None;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("mp4") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Some(n) = stem.strip_prefix("tmp_").and_then(|n| n.parse::<usize>().ok()) {
                        max = Some(max.map_or(n, |m| m.max(n)));
                    }
                }
            }
        }
    }
    max
}

fn check_and_remux_completed(
    dir: &std::path::Path,
    last_max: &mut Option<usize>,
    handles: &mut Vec<JoinHandle<()>>,
) {
    let current_max = match get_max_fmp4_index(dir) {
        Some(m) => m,
        None => return,
    };
    let prev_max = match *last_max {
        None => {
            *last_max = Some(current_max);
            return;
        }
        Some(p) => p,
    };
    if current_max <= prev_max {
        return;
    }

    for idx in prev_max..current_max {
        let tmp_mp4 = dir.join(format!("tmp_{:05}.mp4", idx));
        let rec_mp4 = dir.join(format!("rec_{:05}.mp4", idx));
        if tmp_mp4.exists() {
            println!("Segment {:05} complete, queuing remux...", idx);
            handles.push(thread::spawn(move || {
                if remux_to_mp4(&tmp_mp4, &rec_mp4) {
                    generate_thumbnail(&rec_mp4);
                    let _ = fs::remove_file(&tmp_mp4);
                } else {
                    println!("Keeping tmp MP4 due to remux failure: {}", tmp_mp4.display());
                }
            }));
        }
    }
    *last_max = Some(current_max);
}

fn remux_all_remaining_fmp4(dir: &std::path::Path, handles: &mut Vec<JoinHandle<()>>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("mp4") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Some(idx) = stem.strip_prefix("tmp_").and_then(|n| n.parse::<usize>().ok()) {
                        let tmp_mp4 = path.clone();
                        let rec_mp4 = dir.join(format!("rec_{:05}.mp4", idx));
                        handles.push(thread::spawn(move || {
                            if remux_to_mp4(&tmp_mp4, &rec_mp4) {
                                generate_thumbnail(&rec_mp4);
                                let _ = fs::remove_file(&tmp_mp4);
                            } else {
                                println!("Keeping tmp MP4 due to remux failure: {}", tmp_mp4.display());
                            }
                        }));
                    }
                }
            }
        }
    }
}

fn recover_orphaned_fmp4(dir: &std::path::Path) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("mp4") {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                if let Some(idx) = stem.strip_prefix("tmp_").and_then(|n| n.parse::<usize>().ok()) {
                    let rec_mp4 = dir.join(format!("rec_{:05}.mp4", idx));
                    println!("Recovering orphaned segment from previous session: {}", path.display());
                    if entry.metadata().map_or(0, |m| m.len()) == 0 {
                        println!("  Empty file, deleting.");
                        let _ = fs::remove_file(&path);
                    } else if remux_to_mp4(&path, &rec_mp4) {
                        generate_thumbnail(&rec_mp4);
                        let _ = fs::remove_file(&path);
                    }
                }
            }
        }
    }
}

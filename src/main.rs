use anyhow::{ Context, Result };
use dotenv::dotenv;
use std::env;
use std::fs;
use std::path::Path;
use std::process::{ Command, Stdio };
use std::sync::atomic::{ AtomicBool, Ordering };
use std::sync::Arc;
use std::time::Duration;
use std::thread;

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

    if
        env
            ::var("LOGS")
            .unwrap_or_else(|_| "False".to_string())
            .to_lowercase() == "true"
    {
        env::set_var("RUST_LOG", "info");
    } else {
        env::set_var("RUST_LOG", "error");
    }
    env_logger::init();

    // Configuration
    let width = env::var("WIDTH").unwrap_or_else(|_| "1280".to_string());
    let height = env::var("HEIGHT").unwrap_or_else(|_| "720".to_string());
    let framerate = env::var("FRAMERATE").unwrap_or_else(|_| "30".to_string());
    let bitrate = env::var("BITRATE").unwrap_or_else(|_| "2000000".to_string()); // 2 Mbps
    let clip_length_min: u64 = env
        ::var("CLIP_LENGTH")
        .unwrap_or_else(|_| "5".to_string())
        .parse()
        .context("Failed to parse CLIP_LENGTH")?;

    let clip_length_sec: u64 = clip_length_min * 60;
    let mut extra_cam_args = String::new();

    if
        env
            ::var("VFLIP")
            .unwrap_or_else(|_| "false".to_string())
            .to_lowercase() == "true"
    {
        extra_cam_args.push_str(" --vflip");
    }

    if
        env
            ::var("HFLIP")
            .unwrap_or_else(|_| "false".to_string())
            .to_lowercase() == "true"
    {
        extra_cam_args.push_str(" --hflip");
    }

    if let Ok(metering) = env::var("METERING") {
        extra_cam_args.push_str(&format!(" --metering {}", metering));
    }

    if let Ok(denoise) = env::var("DENOISE") {
        extra_cam_args.push_str(&format!(" --denoise {}", denoise));
    }

    if let Ok(exposure) = env::var("EXPOSURE") {
        extra_cam_args.push_str(&format!(" --exposure {}", exposure));
    }

    if let Ok(af_mode) = env::var("AF_MODE") {
        extra_cam_args.push_str(&format!(" --autofocus-mode {}", af_mode));
    }

    if let Ok(af_range) = env::var("AF_RANGE") {
        extra_cam_args.push_str(&format!(" --autofocus-range {}", af_range));
    }

    if let Ok(lens_pos) = env::var("LENS_POSITION") {
        extra_cam_args.push_str(&format!(" --lens-position {}", lens_pos));
    }

    if let Ok(hdr) = env::var("HDR") {
        extra_cam_args.push_str(&format!(" --hdr {}", hdr));
    }

    let user = env::var("USER").unwrap_or_else(|_| "pi".to_string());
    let default_output = format!("/home/{}/camera/media", user);
    let output_dir_str = env::var("OUTPUT").unwrap_or(default_output);
    let output_dir = Path::new(&output_dir_str);

    if !output_dir.exists() {
        fs::create_dir_all(output_dir).context("Failed to create output directory")?;
    }

    log::info!("Starting Dash Pi");

    // Signal handling
    let running = Arc::new(AtomicBool::new(true));
    let r = running.clone();

    ctrlc
        ::set_handler(move || {
            println!("\nGracefully shutting down...");
            r.store(false, Ordering::SeqCst);
        })
        .context("Error setting Ctrl-C handler")?;

    println!("Press 'Ctrl+C' to stop.");

    // Main recording loop
    while running.load(Ordering::SeqCst) {
        let file_pattern = output_dir.join("%Y%m%d_%H%M%S.mp4");
        let file_pattern_str = file_pattern.to_string_lossy();

        if running.load(Ordering::SeqCst) == false {
            break;
        }

        let cam_cmd = env::var("PICAM_APP").unwrap_or_else(|_| "libcamera-vid".to_string());

        let cmd_string = format!(
            "{} -t 0 --width {} --height {} --framerate {} --bitrate {} --nopreview --inline --output -{} | ffmpeg -y -f h264 -r {} -i - -c:v copy -f segment -segment_time {} -segment_format_options movflags=+frag_keyframe+empty_moov+default_base_moof -reset_timestamps 1 -strftime 1 \"{}\"",
            cam_cmd,
            width,
            height,
            framerate,
            bitrate,
            extra_cam_args,
            framerate,
            clip_length_sec,
            file_pattern_str
        );

        let mut child = Command::new("sh")
            .arg("-c")
            .arg(&cmd_string)
            .stdout(Stdio::null())
            .stderr(Stdio::inherit())
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

    log::info!("Application exited.");
    Ok(())
}

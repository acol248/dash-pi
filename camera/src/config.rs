use anyhow::{Context, Result};
use std::env;
use std::path::PathBuf;

#[derive(Clone)]
pub struct Config {
    pub width: String,
    pub height: String,
    pub framerate: String,
    pub bitrate: String,
    pub clip_length_sec: u64,
    pub extra_cam_args: String,
    pub output_dir: PathBuf,
    pub cam_cmd: String,
    pub web_enabled: bool,
    pub web_root: PathBuf,
    pub web_port: u16,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let width = env::var("WIDTH").unwrap_or_else(|_| "1280".to_string());
        let height = env::var("HEIGHT").unwrap_or_else(|_| "720".to_string());
        let framerate = env::var("FRAMERATE").unwrap_or_else(|_| "30".to_string());
        let bitrate = env::var("BITRATE").unwrap_or_else(|_| "2000000".to_string()); // 2 Mbps
        let clip_length_min: u64 = env::var("CLIP_LENGTH")
            .unwrap_or_else(|_| "5".to_string())
            .parse()
            .context("Failed to parse CLIP_LENGTH")?;

        let clip_length_sec: u64 = clip_length_min * 60;
        let mut extra_cam_args = String::new();

        if env::var("VFLIP")
            .unwrap_or_else(|_| "false".to_string())
            .to_lowercase()
            == "true"
        {
            extra_cam_args.push_str(" --vflip");
        }

        if env::var("HFLIP")
            .unwrap_or_else(|_| "false".to_string())
            .to_lowercase()
            == "true"
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
        let output_dir = PathBuf::from(&output_dir_str);

        let cam_cmd = env::var("PICAM_APP").unwrap_or_else(|_| "libcamera-vid".to_string());

        let web_enabled = env::var("WEB_ENABLED")
            .unwrap_or_else(|_| "false".to_string())
            .to_lowercase()
            == "true";
        let web_root = PathBuf::from(env::var("WEB_ROOT").unwrap_or_else(|_| "./dist".to_string()));
        let web_port = env::var("WEB_PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse()
            .unwrap_or(3000);

        Ok(Config {
            width,
            height,
            framerate,
            bitrate,
            clip_length_sec,
            extra_cam_args,
            output_dir,
            cam_cmd,
            web_enabled,
            web_root,
            web_port,
        })
    }

    pub fn generate_cmd(&self, file_pattern: &str) -> String {
        format!(
            "{} -t 0 --width {} --height {} --framerate {} --bitrate {} --nopreview --inline --output -{} | ffmpeg -y -f h264 -r {} -i - -c:v copy -f segment -segment_time {} -segment_format_options movflags=+frag_keyframe+empty_moov+default_base_moof -reset_timestamps 1 -strftime 1 \"{}\"",
            self.cam_cmd,
            self.width,
            self.height,
            self.framerate,
            self.bitrate,
            self.extra_cam_args,
            self.framerate,
            self.clip_length_sec,
            file_pattern
        )
    }
}

# Dash Pi (Rust)

Dash camera video recording software.

Confirmed working on:
- Raspberry Pi Zero 2W

## Features
- Records video clips in a loop ("dashcam mode").
- Uses `libcamera-vid` (or `rpicam-vid`) for hardware-accelerated encoding.
- Containerizes to MP4 using `ffmpeg` on the fly.
- Configurable via Environment Variables or `.env`.

## Prerequisites on Raspberry Pi
Ensure your Raspberry Pi/target system has the camera stack enabled and `ffmpeg` installed.

```bash
sudo apt update
sudo apt install ffmpeg
# The libcamera-apps are usually installed by default on Pi OS, may need to be manually installed depending on hardware/software used
```

## Building

You can build this project on macOS, Windows, or Linux. The build process uses `cross` and Docker to compile for the Raspberry Pi's ARM architecture.

### Requirements
1. **Rust**: [Install Rust](https://rustup.rs/)
2. **Docker**: Install Docker Desktop (macOS/Windows) or Docker Engine (Linux).
3. **Cross**: The build script will attempt to install `cross` automatically.

### Build Steps

#### macOS / Linux
Run the build script:
```bash
cd dash-pi-rs
chmod +x build_release.sh
./build_release.sh
```

#### Windows
Run the PowerShell script:
```powershell
cd dash-pi-rs
.\build_release.ps1
```

## Deployment

1. Copy the appropriate binary to your Raspberry Pi/target system:
   ```bash
   scp dist/dash-pi-rs-aarch64 pi@raspberrypi.local:~/dash-pi-rs
   ```
2. Make it executable:
   ```bash
   ssh pi@raspberrypi.local
   chmod +x dash-pi-rs
   ```
3. Run it (optionally with `.env` settings):
   ```bash
   ./dash-pi-rs
   ```

## Configuration
Set these environment variables or create a `.env` file in the same directory:

| Variable      | Default   | Description |
|---------------|-----------|-------------|
| `CLIP_LENGTH` | 5         | Length of each video clip in minutes |
| `WIDTH`       | 1280      | Video width |
| `HEIGHT`      | 720       | Video height |
| `FRAMERATE`   | 30        | Frame rate |
| `BITRATE`     | 2000000   | Bitrate in bps |
| `OUTPUT`      | ~/camera/media | Output directory |
| `PICAM_APP`   | libcamera-vid | Command for camera app (try `rpicam-vid` on newer OS) |


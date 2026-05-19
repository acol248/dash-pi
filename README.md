# Dash-Pi

A Raspberry Pi dashcam and web dashboard system.

## Features

- Continuous video recording in segments
- Automatic storage management
- Web dashboard for playback and management
- Cross-compiles for Pi Zero 2 W (32/64-bit)

---

## Quick Start

1. **Clone and build:**
   - Copy `dist/dash-pi.env.example` to `dist/dash-pi.env` and edit as needed.
   ```sh
   git clone ...
   - Copy the contents of `dist/` to your Pi.
   ./build_release.sh
   ```

   (Add `--skip-prompt` to always remove `dist/` without prompting.)

2. **Configure:**
   - Copy `camera/dist/dash-pi.env.example` to `camera/dist/dash-pi.env` and edit as needed.

3. **Deploy:**
   - Copy the contents of `camera/dist/` to your Pi.
   - Run the binary for your platform:
     ```sh
     # or
     ./dash-pi-rs-armv7     # 32-bit Pi OS
     ```

4. **Access the dashboard:**
   - Open `http://<pi-ip>:8080/` in your browser.

This can be taken a step further by creating a service that runs the script on boot.

---

## Project Structure

```
rs-dash-pi/
├── camera/                # Rust backend (recorder, web server)
│   ├── src/               # Rust source code
│   ├── dist/              # (output now in top-level dist/)
├── build_release.sh       # Main build script (Linux/macOS)
├── build_release.ps1      # PowerShell build script (Windows)
│   ├── dash-pi.env.example # Example config file
│   └── ...
├── dashboard/             # Frontend (Vite + Preact/React)
│   ├── src/               # Frontend source code
│   ├── dist/              # Built static files (copied to camera/dist/dashboard)
│   ├── public/            # Static assets
│   ├── package.json       # Dashboard dependencies/scripts
│   └── ...
└── README.md              # This file
```


## Configuration

All settings can be set via environment variables or a `.env` file (see `dash-pi.env.example`).

- **Camera:** `WIDTH`, `HEIGHT`, `FRAMERATE`, `BITRATE`, `CLIP_LENGTH`, ...
- **Web:** `WEB_ENABLED`, `WEB_ROOT`, `WEB_PORT`
- **Storage:** `MIN_FREE_MB`, `OUTPUT`
- **Preview:** `PREVIEW_ENABLED`, `PREVIEW_INTERVAL`
- **Advanced:** `EXTRA_CAM_ARGS`, ...

---

## Building

- The build script cross-compiles for both 32-bit and 64-bit Pi OS using [cross](https://github.com/cross-rs/cross) and Docker.
- The dashboard is built with npm/yarn/pnpm and copied into the release output.
- The release output is always in `dist/`.


## Updating the Dashboard Only

If you only want to rebuild the dashboard:

```
cd dashboard
npm install
npm run build
cd ../camera
rm -rf dist/dashboard
cp -r ../dashboard/dist dist/dashboard
```


## License

GNU AGPLv3

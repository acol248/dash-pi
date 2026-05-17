#!/bin/bash

set -e

# Usage: ./build_release.sh [--skip-prompt]
SKIP_PROMPT=0
for arg in "$@"; do
    if [ "$arg" = "--skip-prompt" ]; then
        SKIP_PROMPT=1
    fi
done

# always ask before deleting dist/
if [ -d dist ]; then
    if [ "$SKIP_PROMPT" = "1" ]; then
        rm -rf dist
    else
        echo "The dist/ folder already exists. Remove it and continue? [y/N] "
        read -r yn
        case $yn in
            [Yy]*) rm -rf dist ;;
            *) echo "Aborted."; exit 1 ;;
        esac
    fi
fi

# Build script for macOS/Linux

command_exists () {
    type "$1" &> /dev/null ;
}

if ! command_exists cargo ; then
    echo "Error: Cargo is not installed. Please install Rust: https://rustup.rs/"
    exit 1
fi

if ! command_exists cross ; then
    echo "Installing 'cross' tool for cross-compilation..."
    cargo install cross --git https://github.com/cross-rs/cross
fi

echo "Building for Raspberry Pi Zero 2 W..."
echo "Note: This requires Docker to be running."

mkdir -p dist

echo "------------------------------------------------"
echo "Building target: aarch64-unknown-linux-gnu (64-bit)"
echo "------------------------------------------------"
cross build --release --target aarch64-unknown-linux-gnu
cp target/aarch64-unknown-linux-gnu/release/dash-pi-rs dist/dash-pi-rs-aarch64

echo "------------------------------------------------"
echo "Building target: arm-unknown-linux-gnueabihf (32-bit)"
echo "------------------------------------------------"
cross build --release --target arm-unknown-linux-gnueabihf
cp target/arm-unknown-linux-gnueabihf/release/dash-pi-rs dist/dash-pi-rs-armv7

echo "------------------------------------------------"
echo "Build complete!"
echo "Binaries are in 'dash-pi-rs/dist/' directory."
echo "Use 'dash-pi-rs-aarch64' for 64-bit OS (Debian Bookworm 64-bit)."
echo "Use 'dash-pi-rs-armv7' for 32-bit OS (Debian Bullseye/Bookworm 32-bit)."

# Build dashboard frontend
echo "------------------------------------------------"
echo "Building dashboard frontend..."
cd ../dashboard
if [ -f pnpm-lock.yaml ] && command_exists pnpm; then
    pnpm install
    pnpm run build
elif [ -f yarn.lock ] && command_exists yarn; then
    yarn install
    yarn build
else
    npm install
    npm run build
fi
cd ../camera

# Copy dashboard build output
rm -rf dist/dashboard
mkdir -p dist/dashboard
cp -r ../dashboard/dist/* dist/dashboard/

# Copy dashboard static files (if any)
if [ -d ../dashboard/public ]; then
    cp -r ../dashboard/public/* dist/dashboard/
fi

# Copy README if present
if [ -f ../dashboard/README.md ]; then
    cp ../dashboard/README.md dist/dashboard/
fi

# Copy example config
cp dash-pi.env.example dist/

echo "------------------------------------------------"
echo "Build complete!"
echo "Binaries and dashboard are in 'camera/dist/' directory."
echo "Use 'dash-pi-rs-aarch64' for 64-bit OS (Debian Bookworm 64-bit)."
echo "Use 'dash-pi-rs-armv7' for 32-bit OS (Raspberry Pi OS 32-bit)."

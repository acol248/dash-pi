#!/bin/bash
set -e

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

# Build script for Windows using PowerShell

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Cargo is not installed. Please install Rust: https://rustup.rs/" -ForegroundColor Red
    Exit 1
}

if (-not (Get-Command cross -ErrorAction SilentlyContinue)) {
    Write-Host "Installing 'cross' tool for cross-compilation..."
    cargo install cross --git https://github.com/cross-rs/cross
}

Write-Host "Building for Raspberry Pi Zero 2 W..."
Write-Host "Note: This requires Docker Desktop to be running."

if (-not (Test-Path "dist")) {
    New-Item -ItemType Directory -Force -Path "dist" | Out-Null
}

Write-Host "------------------------------------------------"
Write-Host "Building target: aarch64-unknown-linux-gnu (64-bit)"
Write-Host "------------------------------------------------"
cross build --release --target aarch64-unknown-linux-gnu
if ($LASTEXITCODE -eq 0) {
    Copy-Item "target\aarch64-unknown-linux-gnu\release\dash-pi-rs" "dist\dash-pi-rs-aarch64"
} else {
    Write-Host "Build failed for aarch64" -ForegroundColor Red
}

Write-Host "------------------------------------------------"
Write-Host "Building target: arm-unknown-linux-gnueabihf (32-bit)"
Write-Host "------------------------------------------------"
cross build --release --target arm-unknown-linux-gnueabihf
if ($LASTEXITCODE -eq 0) {
    Copy-Item "target\arm-unknown-linux-gnueabihf\release\dash-pi-rs" "dist\dash-pi-rs-armv7"
} else {
    Write-Host "Build failed for armv7" -ForegroundColor Red
}

Write-Host "------------------------------------------------"
Write-Host "Build complete!"
Write-Host "Binaries are in 'dash-pi-rs\dist\' directory."

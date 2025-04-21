#!/bin/bash

set -e

APP_DIR="$HOME/dash-pi"
SERVICE_FILE="/etc/systemd/system/dashpi.service"
VENV_DIR="$APP_DIR/venv"

# disable the systemd service
echo "Stopping and disabling the dashpi service..."
if systemctl is-active --quiet dashpi.service; then
    sudo systemctl stop dashpi.service
fi
if systemctl is-enabled --quiet dashpi.service; then
    sudo systemctl disable dashpi.service
fi

# remove the systemd service file
if [ -f "$SERVICE_FILE" ]; then
    echo "Removing systemd service file..."
    sudo rm -f "$SERVICE_FILE"
    sudo systemctl daemon-reload
fi

# remove environment
if [ -d "$VENV_DIR" ]; then
    echo "Removing virtual environment..."
    rm -rf "$VENV_DIR"
fi

# optionally remove the application directory
read -p "Do you want to remove the application directory ($APP_DIR)? (y/N): " REMOVE_APP_DIR
REMOVE_APP_DIR=${REMOVE_APP_DIR:-n}
if [[ "$REMOVE_APP_DIR" =~ ^[Yy]$ ]]; then
    if [ -d "$APP_DIR" ]; then
        echo "Removing application directory..."
        rm -rf "$APP_DIR"
    else
        echo "Application directory not found. Skipping..."
    fi
else
    echo "Keeping application directory."
fi

echo "Dash Pi uninstalled successfully."

#!/bin/bash

set -e

APP_DIR="$(cd "$(dirname "$0")"; pwd)"
VENV_DIR="$APP_DIR/venv"
PYTHON_BIN="python3"
SERVICE_NAME="dash-pi"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
MAIN_SCRIPT="app.py" 

START_SERVICE=0
for arg in "$@"; do
    if [ "$arg" == "--start" ]; then
        START_SERVICE=1
    fi
done

# update and install required system packages
if ! python3 -c "import pykms" 2>/dev/null; then
    echo "Installing system kms/pykms package..."
    
    sudo apt-get update
    sudo apt-get install -y python3-kms
fi

# setup the virtual environment if not already set up
if [ ! -d "$VENV_DIR" ]; then
    $PYTHON_BIN -m venv "$VENV_DIR"
fi

# install the application dependencies
if [ -f "$APP_DIR/requirements.txt" ]; then
    "$VENV_DIR/bin/pip" install -r "$APP_DIR/requirements.txt"
fi

# setup systemd service
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Dash Pi Service
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=$VENV_DIR/bin/python $APP_DIR/$MAIN_SCRIPT
Restart=on-failure
User=$USER
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
echo "Service $SERVICE_NAME enabled. Use 'sudo systemctl start $SERVICE_NAME' to start it now."

# start the service if requested
if [ "$START_SERVICE" -eq 1 ]; then
    sudo systemctl start "$SERVICE_NAME"
    echo "Service $SERVICE_NAME started."
else
    read -p "Do you want to start the service now? [y/N]: " REPLY

    if [[ "$REPLY" =~ ^[Yy]$ ]]; then
        sudo systemctl start "$SERVICE_NAME"
        echo "Service $SERVICE_NAME started."
    fi
fi

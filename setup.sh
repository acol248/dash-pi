#!/bin/bash

set -e

APP_DIR="$HOME/dashpi"
SERVICE_FILE="/etc/systemd/system/dashpi.service"
VENV_DIR="$APP_DIR/venv"
REQUIREMENTS_FILE="$APP_DIR/requirements.txt"
PYTHON_BIN=$(which python3)

# check Python installed - if not install
if ! command -v python3 &> /dev/null; then
    sudo apt update
    sudo apt install -y python3 python3-venv python3-pip
fi

# create a virtual environment if doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    $PYTHON_BIN -m venv --system-site-packages "$VENV_DIR"
    wait

    source "$VENV_DIR/bin/activate"
fi

# upgrade pip + install deps
(
    $VENV_DIR/bin/pip install --upgrade pip
    $VENV_DIR/bin/pip install -r "$REQUIREMENTS_FILE"
)
wait

# create service file
sudo bash -c "cat > $SERVICE_FILE" <<EOF
[Unit]
Description=Dash Pi
After=network.target

[Service]
User=pi
Group=pi
Environment="PATH=$APP_DIR/venv/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=$APP_DIR/venv/bin/python $APP_DIR/app.py
WorkingDirectory=$APP_DIR
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# enable and start service
sudo systemctl daemon-reload
sudo systemctl enable dashpi.service
sudo systemctl start dashpi.service

sleep 5

# output status of service to make sure all is groovy
sudo systemctl status dashpi.service

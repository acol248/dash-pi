#!/bin/bash

set -e

APP_DIR="$(cd "$(dirname "$0")"; pwd)"
VENV_DIR="$APP_DIR/venv"
PYTHON_BIN="python3"
MAIN_SCRIPT="app.py"

# update and install required system packages
if ! python3 -c "import pykms" 2>/dev/null; then
    echo "Installing system kms/pykms package..."
    
    sudo apt-get update
    sudo apt-get install -y python3-kms
fi

"$VENV_DIR/bin/pip" uninstall -y kms || true

# setup virtual environment if not already set up
if [ ! -d "$VENV_DIR" ]; then
    $PYTHON_BIN -m venv --system-site-packages "$VENV_DIR"
fi

# install the application dependencies
if [ -f "$APP_DIR/requirements.txt" ]; then
    "$VENV_DIR/bin/pip" install -r "$APP_DIR/requirements.txt"
fi

# run the application
exec "$VENV_DIR/bin/python" "$APP_DIR/$MAIN_SCRIPT"

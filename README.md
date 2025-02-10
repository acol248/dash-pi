# DashPi

A dash camera application designed to run on the Raspberry Pi, using camera modules compatible with `picamera2`.

## Getting Started

Install the required dependencies.

`sudo apt update`

`sudo apt upgrade`

`sudo apt install python3-picamera2 python3-dotenv python3-opencv build-essential libcap-dev libcamera-dev python3-kms++ python3-gevent`

## Usage

Run `./setup.sh` to install the python app to the Raspberry Pi's boot services. The service will start automatically and will attempt to keep itself running whenever the Pi is on. To remove the service and any related files, run `./uninstall.sh`. The removal script also gives the option to remove the application files.

The Python app can also be launched directly with `python3 app.py`. The script can then be gracefully terminated using Ctrl+C.

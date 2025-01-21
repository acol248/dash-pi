# DashPi

A dash camera application designed to run on the Raspberry Pi, using camera modules compatible with `picamera2`.

## Getting Started

Install the `picamera2` and `dotenv` python dependencies. The easiest way to achieve this, especially if this device will be dedicated to running as a dash camera, is to run:

`sudo apt install python3-picamera2`

`sudo apt install python3-dotenv`

`sudo apt install opencv-python`

## Usage

The script can be launched directly with `python3 app.py` or can be launched via the shell script using `./launcher.sh`, after ensuring the correct file permissions are set.

The script can be gracefully terminated using Ctrl+C, if running locally, or by using the terminate script `./terminate.sh`.


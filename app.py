#!/usr/bin/env python3

import time
import cv2
import os
import threading
from dotenv import load_dotenv
from picamera2 import Picamera2
from picamera2.encoders import H264Encoder
from picamera2.outputs import FfmpegOutput
from libcamera import controls, Transform
from gevent.pywsgi import WSGIServer
from server import create_server


load_dotenv(dotenv_path='.env.local')

LOGGING = (os.getenv("LOGS") or 'False').lower(
) == 'true' or False  # Use development logging
# Minimum pixel difference for motion
MOTION_THRESHOLD = int(os.getenv("PIXEL_MOTION_THRESHOLD", "25"))
# Frames required to confirm motion
MIN_MOTION_FRAMES = int(os.getenv("MOTION_FRAMES", "5"))
# Time (seconds) to stop recording after no motion detected
NO_MOTION_TIMEOUT = int(os.getenv("MOTION_TIMEOUT", "5"))
# constant/motion - Record fixed clips sequentially or record on motion detect
RECORDING_TYPE = os.getenv('RECORDING_TYPE', 'constant')
VIDEO_WIDTH = int(os.getenv("WIDTH", "1920"))  # Video frame width (px)
VIDEO_HEIGHT = int(os.getenv("HEIGHT", "1080"))  # Video frame height (px)
VIDEO_FRAMERATE = int(os.getenv("FRAMERATE", "30"))  # Video framerate
VIDEO_BITRATE = int(os.getenv("BITRATE", "1500000"))  # Video bitrate (bytes)
# Fixed clip length (constant recording only)
VIDEO_FIXED_CLIP_LENGTH = int(os.getenv("CLIP_LENGTH", "5"))
# directory to output recorded media
OUTPUT_DIRECTORY = os.getenv('OUTPUT_DIR', './media')
# enable HDR mode (where supported)
HDR_ENABLED = (os.getenv("HDR_ENABLED") or 'False').lower() == 'true' or False
# enable night mode
NIGHT_MODE = (os.getenv("NIGHT_MODE") or 'False').lower() == 'true' or False

# start flask server


def start_server():
    app = create_server()
    server = WSGIServer(('', 5000), app)
    server.serve_forever()


class Camera:
    def __init__(self):
        self.camera = Picamera2()

        if (HDR_ENABLED):
            if (NIGHT_MODE):
                self.hdr = controls.HdrModeEnum.Night
            else:
                self.hdr = controls.HdrModeEnum.SingleExposure
        else:
            self.hdr = controls.HdrModeEnum.Off

        self.motion_config = self.camera.create_preview_configuration(
            main={"size": (640, 480)},
            controls={
                "Brightness": 0.35,
                "AnalogueGain": 2.0,
            }
        )
        self.recording_config = self.camera.create_video_configuration(
            main={"size": (VIDEO_WIDTH, VIDEO_HEIGHT)},
            controls={
                "AfMode": controls.AfModeEnum.Continuous,
                "AeEnable": True,
                "AwbEnable": True,
                "AwbMode": controls.AwbModeEnum.Auto,
                "AeConstraintMode": controls.AeConstraintModeEnum.Normal,
                "AeExposureMode": controls.AeExposureModeEnum.Normal,
                "AfSpeed": controls.AfSpeedEnum.Normal,
                "AeMeteringMode": controls.AeMeteringModeEnum.CentreWeighted,
                "AfMetering": controls.AfMeteringEnum.Auto,
                "AfRange": controls.AfRangeEnum.Normal,
                "NoiseReductionMode": controls.draft.NoiseReductionModeEnum.Fast,
                "Brightness": 0.1,
                "AnalogueGain": 2.0,
                "ExposureValue": 2.0,
                "HdrMode": self.hdr,
            }
        )

        self.motion_config["transform"] = Transform(hflip=1, vflip=1)
        self.recording_config["transform"] = Transform(hflip=1, vflip=1)

        self.camera.configure(self.motion_config)
        self.camera.start()

        self.recording = False
        self.motion_frames = 0
        self.last_motion_time = time.time()
        self.running = True

    def detect_motion(self, frame, prev_frame):
        if prev_frame is None:
            return False

        # Compute absolute difference between frames
        diff = cv2.absdiff(frame, prev_frame)
        gray_diff = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
        blurred_diff = cv2.GaussianBlur(gray_diff, (5, 5), 0)
        _, thresh = cv2.threshold(
            blurred_diff, MOTION_THRESHOLD, 255, cv2.THRESH_BINARY)

        # Count non-zero pixels (motion)
        return cv2.countNonZero(thresh) > 1000

    def start_recording(self):
        output_path = os.path.join(
            OUTPUT_DIRECTORY, f"{time.strftime('%Y%m%d_%H%M%S')}.mp4")

        if (LOGGING):
            print(f"Starting recording")

        # Reconfigure the camera for recording
        self.camera.stop()
        self.camera.configure(self.recording_config)
        self.camera.start()

        encoder = H264Encoder(bitrate=VIDEO_BITRATE)
        output = FfmpegOutput(output_path, audio=False)

        self.camera.start_recording(encoder, output)
        self.recording = True

    def stop_recording(self):
        if (LOGGING):
            print(f"Stopping recording.")

        self.camera.stop_recording()

        # Reconfigure the camera for motion detection
        if (RECORDING_TYPE == 'motion'):
            self.camera.stop()
            self.camera.configure(self.motion_config)
            self.camera.start()

        self.recording = False

    def run_motion(self):
        prev_frame = None

        try:
            while True:
                frame = self.camera.capture_array()

                if prev_frame is not None and frame.shape != prev_frame.shape:
                    if (LOGGING):
                        print("Frame shapes do not match. Resetting prev_frame.")

                    prev_frame = None

                motion_detected = False
                if prev_frame is not None:
                    motion_detected = self.detect_motion(frame, prev_frame)

                prev_frame = frame

                if motion_detected:
                    self.last_motion_time = time.time()
                    self.motion_frames += 1
                else:
                    self.motion_frames = 0

                if self.motion_frames >= MIN_MOTION_FRAMES and not self.recording:
                    self.start_recording()

                if self.recording and time.time() - self.last_motion_time > NO_MOTION_TIMEOUT:
                    self.stop_recording()

                time.sleep(0.1)
        except KeyboardInterrupt:
            if (LOGGING):
                print("\nKeyboard interrupt detected.")
        finally:
            try:
                self.stop_recording()
            except Exception:
                pass

            self.camera.stop()
            print("Application exited.")

    def run_constant(self):
        try:
            self.recording = True
            self.camera.start()

            if (LOGGING):
                print("Press 'Ctrl+C' to stop.")

            while self.running:
                self.start_recording()

                # record for 5 minute, checking for running break
                for _ in range(VIDEO_FIXED_CLIP_LENGTH * 60):
                    if not self.running:
                        break
                    time.sleep(1)

                self.stop_recording()
        except KeyboardInterrupt:
            if (LOGGING):
                print("\nKeyboard interrupt detected.")
        finally:
            try:
                self.stop_recording()
            except Exception:
                pass

            self.camera.stop()
            print("Application exited.")


if __name__ == "__main__":
    instance = Camera()

    server_thread = threading.Thread(target=start_server)
    server_thread.start()

    if not os.path.exists(OUTPUT_DIRECTORY):
        os.makedirs(OUTPUT_DIRECTORY)

    if (RECORDING_TYPE == 'motion'):
        instance.run_motion()
    else:
        instance.run_constant()

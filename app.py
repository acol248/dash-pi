import os
import time
from datetime import datetime
import signal
from dotenv import load_dotenv
from picamera2 import Picamera2
from picamera2.encoders import H264Encoder
from picamera2.outputs import FfmpegOutput
import getpass
import cv2
import numpy as np

load_dotenv(dotenv_path='.env.local')

# env
logging = (os.getenv("LOGS") or 'False').lower() == 'true' or False
recording_type = os.getenv('RECORDING_TYPE', 'constant')
vid_width = int(os.getenv("WIDTH", "1280"))
vid_height = int(os.getenv("HEIGHT", "720"))
vid_framerate = int(os.getenv("FRAMERATE", "30"))
vid_bitrate = int(os.getenv("BITRATE", "1500000"))
vid_clipLength = int(os.getenv("CLIP_LENGTH", "5"))

# globals
recording = False
motion_detected = False
motion_threshold = 5000
no_motion_timeout = 5
last_motion_time = 0

output_dir = os.getenv("OUTPUT") or (
    "/home/" + getpass.getuser() + "/camera/media")
os.makedirs(output_dir, exist_ok=True)

camera = Picamera2()
config = camera.create_video_configuration(
    main={"size": (vid_width, vid_height)},
    controls={"FrameRate": vid_framerate}
)
camera.configure(config)

running = True
previous_frame = None

# interrupt handler
def signal_handler(sig, frame):
    global running
    print("\nGracefully shutting down...")
    running = False

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

# constant recording mode
if (recording_type == 'constant'):
    try:
        recording = True
        camera.start()
        print("Press 'Ctrl+C' to stop.")

        while running:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = os.path.join(output_dir, f"{timestamp}.mp4")

            # 1500000 === 1.5MBs - fine tune based on camera module and its config
            encoder = H264Encoder(bitrate=vid_bitrate)
            output = FfmpegOutput(output_path, audio=False)

            if (logging):
                print(f"Recording to {output_path}")

            camera.start_recording(encoder, output)

            # record for 5 minute, checking for running break
            wait_time = vid_clipLength * 60
            for _ in range(wait_time):
                if not running:
                    break
                time.sleep(1)

            camera.stop_recording()
    except KeyboardInterrupt:
        print("\nKeyboard interrupt detected.")
    finally:
        try:
            recording = False
            camera.stop_recording()
        except Exception:
            pass
        camera.stop()
        print("Application exited.")


#
# TODO
# [] - Fix motion recording (currently records properly one, then never again and loop broken)
#
#
# motion recording mode
if (recording_type == 'motion'):
    def start_recording():
        global recording, logging, camera, vid_bitrate

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = os.path.join(output_dir, f"{timestamp}.mp4")

        encoder = H264Encoder(bitrate=vid_bitrate)
        output = FfmpegOutput(output_path, audio=False)

        if (logging):
            print(f"Recording to {output_path}")

        camera.start_recording(encoder, output)
        recording = True

    def stop_recording():
        global recording, camera, logging

        if recording:
            try:
                camera.stop_recording()
                recording = False

                if logging:
                    print("Stopped recording.")
            except Exception as e:
                print(f"Error stopping recording: {e}")

    

    try:
        # runner
        camera.start()

        while running:
            frame = camera.capture_array()
            gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray_frame = cv2.GaussianBlur(gray_frame, (21, 21), 0)

            if previous_frame is None:
                previous_frame = gray_frame
                continue

            frame_delta = cv2.absdiff(previous_frame, gray_frame)
            thresh = cv2.threshold(frame_delta, 25, 255, cv2.THRESH_BINARY)[1]
            motion_area = np.sum(thresh)

            previous_frame = gray_frame 

            if motion_area > motion_threshold:
                motion_detected = True
                last_motion_time = time.time()
            else:
                motion_detected = False

            if motion_detected and recording == False:
                start_recording()
            elif recording and time.time() - last_motion_time > no_motion_timeout:
                stop_recording()

    except KeyboardInterrupt:
        print("\nKeyboard interrupt detected.")
    finally:
        try:
            stop_recording()
        except Exception:
            pass
        camera.stop()
        print("Application exited.")

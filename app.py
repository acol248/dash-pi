import os
import time
from datetime import datetime
import signal
from dotenv import load_dotenv
from picamera2 import Picamera2
from picamera2.encoders import H264Encoder
from picamera2.outputs import FfmpegOutput
import getpass

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

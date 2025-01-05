import os
import time
from datetime import datetime
import signal
from picamera2 import Picamera2
from picamera2.encoders import H264Encoder
from picamera2.outputs import FfmpegOutput
import getpass

logging = os.getenv("LOGS").lower() == 'true' or False

vid_width = os.getenv("WIDTH") or 1280
vid_height = os.getenv("HEIGHT") or 720
vid_framerate = os.getenv("FRAMERATE") or 30
vid_bitrate = os.getenv("BITRATE") or 1500000
vid_clipLength = os.getenv("CLIP_LENGTH") or 5

output_dir = os.getenv("OUTPUT") or ("/home/" + getpass.getuser() + "/camera/media")
os.makedirs(output_dir, exist_ok=True)

camera = Picamera2()
config = camera.create_video_configuration(
	main={"size": (vid_width, vid_height)},
	controls={"FrameRate": vid_framerate}
)
camera.configure(config)

running = True

def signal_handler(sig, frame):
    global running
    print("\nGracefully shutting down...")
    running = False


signal.signal(signal.SIGINT, signal_handler)

try:
    camera.start()
    print("Press 'Ctrl+C' to stop.")

    while running:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = os.path.join(output_dir, f"{timestamp}.mp4")

        encoder = H264Encoder(bitrate=vid_bitrate) # 1500000 === 1.5MBs - fine tune based on camera module and its config
        output = FfmpegOutput(output_path, audio=False)

        if (logging):
            print(f"Recording to {output_path}")
            
        camera.start_recording(encoder, output)

        # record for 5 minute, checking for running break
        wait_time=vid_clipLength * 60
        for _ in range(wait_time):
            if not running:
                break
            time.sleep(1)

        camera.stop_recording()

except KeyboardInterrupt:
    print("\nKeyboard interrupt detected.")

finally:
    try:
        camera.stop_recording()
    except Exception:
        pass
    camera.stop()
    print("Application exited.")

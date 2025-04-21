import os
import time
import cv2
import sqlite3
import uuid
from dotenv import load_dotenv
from picamera2 import Picamera2
from picamera2.encoders import H264Encoder
from picamera2.outputs import FfmpegOutput
from libcamera import controls, Transform
from core.helpers import log

load_dotenv(dotenv_path='.env.local')

LOGGING = (os.getenv("LOGS") or 'False').lower(
) == 'true' or False
MOTION_THRESHOLD = int(os.getenv("PIXEL_MOTION_THRESHOLD", "25"))
MIN_MOTION_FRAMES = int(os.getenv("MOTION_FRAMES", "5"))
NO_MOTION_TIMEOUT = int(os.getenv("MOTION_TIMEOUT", "5"))
RECORDING_TYPE = os.getenv('RECORDING_TYPE', 'constant')
VIDEO_WIDTH = int(os.getenv("WIDTH", "1920"))
VIDEO_HEIGHT = int(os.getenv("HEIGHT", "1080"))
VIDEO_FRAMERATE = int(os.getenv("FRAMERATE", "30"))
VIDEO_BITRATE = int(os.getenv("BITRATE", "1500000"))
VIDEO_FIXED_CLIP_LENGTH = int(os.getenv("CLIP_LENGTH", "180"))
OUTPUT_DIRECTORY = os.getenv('OUTPUT_DIR', './media')
DB_PATH = os.getenv('DB_PATH', 'db/database.db')
HDR_ENABLED = (os.getenv("HDR_ENABLED") or 'False').lower() == 'true' or False
NIGHT_MODE = (os.getenv("NIGHT_MODE") or 'False').lower() == 'true' or False
SERVER_ENABLED = (os.getenv("SERVER_ENABLED")
                  or 'False').lower() == 'true' or False

# --- Dimensions for Motion Detection ---
MOTION_WIDTH = 640
MOTION_HEIGHT = 480

class Camera:
    def __init__(self):
        self.camera = Picamera2()

        if HDR_ENABLED:
            hdr_mode = controls.HdrModeEnum.Night if NIGHT_MODE else controls.HdrModeEnum.SingleExposure
        else:
            hdr_mode = controls.HdrModeEnum.Off

        transform = Transform(hflip=1, vflip=1)

        self.motion_config = self.camera.create_preview_configuration(
            main={"size": (MOTION_WIDTH, MOTION_HEIGHT), "format": "YUV420"},
            lores=None,
            controls={
                "FrameDurationLimits": (int(1e6 / VIDEO_FRAMERATE), int(1e6 / VIDEO_FRAMERATE)),
                "NoiseReductionMode": controls.draft.NoiseReductionModeEnum.Minimal,
            },
            transform=transform
        )

        self.recording_config = self.camera.create_video_configuration(
            main={"size": (VIDEO_WIDTH, VIDEO_HEIGHT), "format": "XBGR8888"},
            lores={"size": (MOTION_WIDTH, MOTION_HEIGHT), "format": "YUV420"},
            controls={
                "AfMode": controls.AfModeEnum.Continuous, "AeEnable": True, "AwbEnable": True,
                "AwbMode": controls.AwbModeEnum.Auto, "AeConstraintMode": controls.AeConstraintModeEnum.Normal,
                "AeExposureMode": controls.AeExposureModeEnum.Normal, "AfSpeed": controls.AfSpeedEnum.Normal,
                "AeMeteringMode": controls.AeMeteringModeEnum.CentreWeighted, "AfMetering": controls.AfMeteringEnum.Auto,
                "AfRange": controls.AfRangeEnum.Normal,
                "NoiseReductionMode": controls.draft.NoiseReductionModeEnum.HighQuality,
                "FrameDurationLimits": (int(1e6 / VIDEO_FRAMERATE), int(1e6 / VIDEO_FRAMERATE)),
                "HdrMode": hdr_mode,
            },
            transform=transform
        )

        try:
            self.camera.configure(self.motion_config)
            self.camera.start()
            log("Camera started in motion detection configuration.")
        except Exception as e:
            print(f"FATAL: Failed to configure or start camera initially: {e}")
            raise RuntimeError("Camera initialization failed") from e

        self.is_recording_to_file = False
        self.motion_frames = 0
        self.last_motion_time = time.monotonic()
        self.running = True
        self.prev_gray_frame_motion = None

        self.recording_id = None
        self.recording_start_time = None
        self.recording_filename = None

        # Initialize SQLite DB
        self.db_path = DB_PATH
        self._init_db()

    def _init_db(self):
        os.makedirs(OUTPUT_DIRECTORY, exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute("""
                CREATE TABLE IF NOT EXISTS recordings (
                    id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    start_time REAL NOT NULL,
                    end_time REAL
                )
            """)
            conn.commit()

    def _insert_recording(self, filename, start_time):
        rec_id = str(uuid.uuid4())
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute(
                "INSERT INTO recordings (id, filename, start_time) VALUES (?, ?, ?)",
                (rec_id, filename, start_time)
            )
            conn.commit()
        return rec_id

    def _update_recording_end(self, rec_id, end_time):
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute(
                "UPDATE recordings SET end_time = ? WHERE id = ?",
                (end_time, rec_id)
            )
            conn.commit()

    def detect_motion(self, frame_yuv):
        if frame_yuv is None:
            log("WARN: detect_motion received None frame.")
            return False

        try:
            gray_frame = frame_yuv[:MOTION_HEIGHT, :]
            gray_frame = cv2.GaussianBlur(gray_frame, (21, 21), 0)

        except Exception as e:
            print(
                f"ERROR: Failed during Y plane processing in detect_motion: {e}")
            print(f"Frame shape: {frame_yuv.shape}, dtype: {frame_yuv.dtype}")
            self.prev_gray_frame_motion = None
            return False

        motion_detected = False
        if self.prev_gray_frame_motion is not None:
            if self.prev_gray_frame_motion.shape != gray_frame.shape:
                log(
                    f"WARN: Frame shape mismatch in detect_motion. Prev: {self.prev_gray_frame_motion.shape}, Curr: {gray_frame.shape}. Resetting prev frame.")

                self.prev_gray_frame_motion = gray_frame
                return False

            try:
                diff = cv2.absdiff(self.prev_gray_frame_motion, gray_frame)
                _, thresh = cv2.threshold(
                    diff, MOTION_THRESHOLD, 255, cv2.THRESH_BINARY)
                thresh = cv2.dilate(thresh, None, iterations=2)
                contours, _ = cv2.findContours(
                    thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

                for contour in contours:
                    if cv2.contourArea(contour) > 500:
                        motion_detected = True
                        break
            except cv2.error as e:
                print(
                    f"ERROR: OpenCV error during diff/contour in detect_motion: {e}")

                self.prev_gray_frame_motion = None
                return False

        self.prev_gray_frame_motion = gray_frame
        return motion_detected

    def start_motion_recording_sequence(self):
        if self.is_recording_to_file:
            log("Already recording (motion).")
            return

        output_path = os.path.join(
            OUTPUT_DIRECTORY, f"{time.strftime('%Y%m%d_%H%M%S')}_motion.mp4")

        log(f"Motion detected - Starting recording sequence to {output_path}")

        try:
            self.camera.stop()
            self.camera.configure(self.recording_config)
            self.prev_gray_frame_motion = None
            self.camera.start()

            log("Camera reconfigured for recording (with lores motion).")

            encoder = H264Encoder(bitrate=VIDEO_BITRATE,
                                  repeat=True, iperiod=VIDEO_FRAMERATE)
            output = FfmpegOutput(output_path, audio=False)
            self.camera.start_recording(encoder, output)
            self.is_recording_to_file = True

            # --- DB record start ---
            self.recording_start_time = time.time()
            self.recording_filename = os.path.basename(output_path)
            self.recording_id = self._insert_recording(
                self.recording_filename, self.recording_start_time
            )
            # ----------------------

            log("Recording started (motion).")

        except Exception as e:
            print(f"ERROR starting motion recording sequence: {e}")
            self.is_recording_to_file = False
            try:
                self.camera.stop()
                self.camera.configure(self.motion_config)
                self.prev_gray_frame_motion = None
                self.camera.start()
                if LOGGING:
                    print("Attempted recovery to motion detection mode after error.")
            except Exception as re:
                print(f"ERROR during recovery attempt: {re}")

    def stop_motion_recording_sequence(self):
        if not self.is_recording_to_file:
            return

        log(f"Stopping motion recording sequence.")

        try:
            self.camera.stop_recording()
            self.is_recording_to_file = False

            # --- DB record end ---
            if self.recording_id:
                self._update_recording_end(self.recording_id, time.time())
                self.recording_id = None
                self.recording_start_time = None
                self.recording_filename = None
            # --------------------

            log("Recording stopped (motion).")

            self.camera.stop()
            self.camera.configure(self.motion_config)
            self.prev_gray_frame_motion = None
            self.camera.start()

            log("Camera reconfigured for motion detection.")

        except Exception as e:
            print(f"ERROR stopping motion recording sequence: {e}")
            self.is_recording_to_file = False
            self.prev_gray_frame_motion = None

    def run_motion(self):
        self.prev_gray_frame_motion = None

        log("Starting motion detection loop.")

        try:
            while self.running:
                motion_detected = False
                frame_for_motion = None

                try:
                    if self.is_recording_to_file:
                        frame_for_motion = self.camera.capture_array("lores")
                    else:
                        frame_for_motion = self.camera.capture_array("main")

                    if frame_for_motion is not None:
                        motion_detected = self.detect_motion(frame_for_motion)
                    else:
                        log("WARN: Captured None frame for motion detection.")

                except Exception as e:
                    print(f"ERROR capturing or detecting motion: {e}")
                    self.prev_gray_frame_motion = None
                    time.sleep(0.5)

                    continue

                current_time = time.monotonic()
                if motion_detected:
                    self.last_motion_time = current_time
                    self.motion_frames += 1
                    if self.motion_frames == 1:
                        log("Initial motion detected.")
                else:
                    if self.motion_frames > 0:
                        log(f"Motion stopped (or frame error). Frame count reset.")
                    self.motion_frames = 0

                if self.motion_frames >= MIN_MOTION_FRAMES and not self.is_recording_to_file:
                    self.start_motion_recording_sequence()

                if self.is_recording_to_file and current_time - self.last_motion_time > NO_MOTION_TIMEOUT:

                    log(
                        f"Motion timeout reached ({NO_MOTION_TIMEOUT}s since last detected motion), stopping recording.")
                    self.stop_motion_recording_sequence()

                time.sleep(0.05)

        except KeyboardInterrupt:
            log("\nKeyboard interrupt detected (motion loop).")
        finally:
            log("Exiting motion loop...")
            if self.is_recording_to_file:
                log("Stopping active recording sequence...")
                self.stop_motion_recording_sequence()
            log("Stopping camera...")
            self.camera.stop()
            log("Camera stopped (motion exit).")

    def run_constant(self):
        log("Starting constant recording loop.")

        try:
            self.camera.stop()
            self.camera.configure(self.recording_config)
            self.prev_gray_frame_motion = None
            self.camera.start()
            self.is_recording_to_file = False

            log("Camera configured and started for constant recording.")

            while self.running:
                output_path = os.path.join(
                    OUTPUT_DIRECTORY, f"{time.strftime('%Y%m%d_%H%M%S')}_const.mp4")
                encoder = H264Encoder(
                    bitrate=VIDEO_BITRATE, repeat=True, iperiod=VIDEO_FRAMERATE)
                output = FfmpegOutput(output_path, audio=False)
                
                log(f"Starting new constant clip: {output_path}")

                try:
                    self.camera.start_recording(encoder, output)
                    self.is_recording_to_file = True

                    # --- DB record start ---
                    self.recording_start_time = time.time()
                    self.recording_filename = os.path.basename(output_path)
                    self.recording_id = self._insert_recording(
                        self.recording_filename, self.recording_start_time
                    )
                    # ----------------------

                    start_time = time.monotonic()
                    while self.running and (time.monotonic() - start_time) < VIDEO_FIXED_CLIP_LENGTH:
                        time.sleep(0.1)
                    if self.is_recording_to_file:
                        log(f"Stopping constant clip: {output_path}")
                        
                        self.camera.stop_recording()
                        self.is_recording_to_file = False

                        # --- DB record end ---
                        if self.recording_id:
                            self._update_recording_end(self.recording_id, time.time())
                            self.recording_id = None
                            self.recording_start_time = None
                            self.recording_filename = None
                        # --------------------

                except Exception as e:
                    print(
                        f"ERROR during constant recording loop for {output_path}: {e}")
                    self.is_recording_to_file = False
                    # --- DB record end on error ---
                    if self.recording_id:
                        self._update_recording_end(self.recording_id, time.time())
                        self.recording_id = None
                        self.recording_start_time = None
                        self.recording_filename = None
                    # ------------------------------
                    time.sleep(1)
                if not self.running:
                    break
        except KeyboardInterrupt:
            log("\nKeyboard interrupt detected (constant loop).")
        finally:
            log("Exiting constant loop...")
            if self.is_recording_to_file:
                log("Stopping final recording clip...")
                try:
                    self.camera.stop_recording()
                except Exception as e:
                    log(f"Error stopping final recording: {e}")
                # --- DB record end on exit ---
                if self.recording_id:
                    self._update_recording_end(self.recording_id, time.time())
                    self.recording_id = None
                    self.recording_start_time = None
                    self.recording_filename = None
                # -----------------------------
            log("Stopping camera...")
            try:
                self.camera.stop()
            except Exception as e:
                print(f"Error stopping camera: {e}")
            log("Camera stopped (constant exit).")

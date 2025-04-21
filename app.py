#!/usr/bin/env python3

import os
import threading
from dotenv import load_dotenv
from gevent.pywsgi import WSGIServer
from core.camera import Camera
from core.helpers import log

os.environ['LIBCAMERA_LOG_LEVELS'] = '4'

try:
    from core.server import create_server
except ImportError:
    print("WARN: server.py or create_server not found. Web server functionality disabled.")
    create_server = None


load_dotenv(dotenv_path='.env.local')

LOGGING = (os.getenv("LOGS") or 'False').lower(
) == 'true' or False
RECORDING_TYPE = os.getenv('RECORDING_TYPE', 'constant')
OUTPUT_DIRECTORY = os.getenv('OUTPUT_DIR', './media')
SERVER_ENABLED = (os.getenv("SERVER_ENABLED")
                  or 'False').lower() == 'true' or False


def start_server():
    if create_server is None:
        log("Server cannot start because create_server function is missing.")
        return
    try:
        app = create_server()
        log_format = 'default' if LOGGING else None
        server = WSGIServer(('', 5000), app, log=log_format)
        log("Starting web server on port 5000")
        server.serve_forever()
    except Exception as e:
        log(f"ERROR: Failed to start web server: {e}")


if __name__ == "__main__":
    if not os.path.exists(OUTPUT_DIRECTORY):
        try:
            os.makedirs(OUTPUT_DIRECTORY)
            log(f"Created output directory: {OUTPUT_DIRECTORY}")
        except OSError as e:
            print(
                f"ERROR: Could not create output directory {OUTPUT_DIRECTORY}: {e}")
            exit(1)

    instance = None
    server_thread = None

    try:
        instance = Camera()
        
        print("Press Ctrl+C to exit.")

        if SERVER_ENABLED and create_server:
            server_thread = threading.Thread(target=start_server, daemon=True)
            server_thread.start()
        if RECORDING_TYPE == 'motion':
            instance.run_motion()
        else:
            instance.run_constant()
            
   
    except RuntimeError as e:
        print(f"RUNTIME ERROR: {e}")
    except Exception as e:
        print(f"FATAL ERROR in main execution: {e}")
        if instance:
            instance.running = False

            if instance.is_recording_to_file:
                try:
                    instance.camera.stop_recording()
                except:
                    pass

            try:
                instance.camera.stop()
            except:
                pass
    finally:
        log("Application exited.")

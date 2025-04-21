import os
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env.local')

LOGGING = (os.getenv("LOGS") or 'False').lower(
) == 'true' or False

def log(msg):
    if LOGGING:
        print(msg)
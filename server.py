import os
from flask import Flask, jsonify
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv(dotenv_path='.env.local')

OUTPUT_DIRECTORY = os.getenv('OUTPUT_DIR', './media')


def create_server():
    app = Flask(__name__)

    @app.route('/media', methods=['GET'])
    def media():
        files = os.listdir(OUTPUT_DIRECTORY)
        file_with_stats = []

        for file_name in files:
            file_path = os.path.join(OUTPUT_DIRECTORY, file_name)
            stats = os.stat(file_path)
            file_with_stats.append({
                "name": file_name,
                "size": stats.st_size,
                "last_modified": datetime.fromtimestamp(stats.st_mtime, tz=timezone.utc)
            })

        return jsonify({"data": file_with_stats, "error": None})

    return app

import os
import re
from flask import Flask, send_from_directory, request, Response, abort, jsonify
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv(dotenv_path='.env.local')

OUTPUT_DIRECTORY = os.getenv('OUTPUT_DIR', './media')
STATIC = os.getenv('STATIC', 'client/dist')


def create_server():
    app = Flask(__name__, static_folder=STATIC, static_url_path='')

    @app.route('/')
    def serve():
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/api/media', methods=['GET'])
    def media():
        files = os.listdir(OUTPUT_DIRECTORY)
        file_with_stats = []

        for file_name in files:
            file_path = os.path.join(OUTPUT_DIRECTORY, file_name)
            stats = os.stat(file_path)
            file_with_stats.append({
                "name": file_name,
                "size": stats.st_size,
                "modified": datetime.fromtimestamp(stats.st_mtime, tz=timezone.utc)
            })

        file_with_stats.sort(key=lambda x: x['modified'], reverse=True)

        return jsonify({"data": file_with_stats, "error": None})

    @app.route('/api/video/<filename>')
    def stream_video(filename):
        if not re.match(r'^[\w\-. ]+$', filename):
            abort(400, 'Invalid filename')

        file_path = os.path.join(OUTPUT_DIRECTORY, filename)

        # Check if the file exists
        if not os.path.isfile(file_path):
            abort(404, 'File not found')

        def generate():
            with open(file_path, 'rb') as video:
                while chunk := video.read(8192):
                    yield chunk

        range_header = request.headers.get('Range', None)
        if not range_header:
            return Response(generate(), mimetype='video/mp4')

        size = os.path.getsize(file_path)
        byte1, byte2 = 0, None

        if range_header:
            match = re.search(r'(\d+)-(\d*)', range_header)
            groups = match.groups()

            if groups[0]:
                byte1 = int(groups[0])
            if groups[1]:
                byte2 = int(groups[1])

        start = byte1
        end = byte2 if byte2 is not None else size - 1
        length = end - start + 1

        def generate_range(start, end):
            with open(file_path, 'rb') as video:
                video.seek(start)
                while start <= end:
                    chunk_size = 8192
                    if start + chunk_size > end:
                        chunk_size = end - start + 1
                    chunk = video.read(chunk_size)
                    if not chunk:
                        break
                    yield chunk
                    start += chunk_size

        rv = Response(generate_range(start, end),
                      status=206, mimetype='video/mp4')
        rv.headers.add('Content-Range', f'bytes {start}-{end}/{size}')
        rv.headers.add('Accept-Ranges', 'bytes')
        rv.headers.add('Content-Length', str(length))
        return rv

    return app

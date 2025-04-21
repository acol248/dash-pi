import os
import re
import jwt
import sqlite3
from flask import Flask, send_from_directory, request, Response, abort, jsonify, make_response
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from datetime import datetime, timezone, timedelta
from functools import wraps

load_dotenv(dotenv_path='.env.local')

OUTPUT_DIRECTORY = os.getenv('OUTPUT_DIR', './media')
STATIC = os.getenv('STATIC', '../client/dist')

AUTH_SECRET = os.getenv('AUTH_SECRET')
if not AUTH_SECRET:
    raise ValueError("Environment variable AUTH_SECRET is required.")
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'SomeSecurePassword')

os.makedirs('db', exist_ok=True)
DB_PATH = os.getenv('DB_PATH', 'db/database.db')

# bootup tasks setting up the database
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()
c.execute('CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT)')
conn.commit()
conn.close()

# check if admin user exists, if not create it
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()
c.execute('SELECT * FROM users WHERE username = ?', ('admin',))
if c.fetchone() is None:
    c.execute('INSERT INTO users (username, password) VALUES (?, ?)', ('admin', generate_password_hash(ADMIN_PASSWORD)))
    conn.commit()
conn.close()
    

def auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get('token')
        
        if not token:
            return jsonify({'data': None, 'error': 'Unauthorised.'}), 401
        try:            
            data = jwt.decode(token, AUTH_SECRET, algorithms=['HS256'])
            user = data['user']
        except:
            return jsonify({'data': None, 'error': 'Unauthorised.'}), 401
        return f(user, *args, **kwargs)
    
    return decorated

# Main server function
def create_server():    
    app = Flask(__name__, static_folder=STATIC, static_url_path='/')

    @app.route('/api/login', methods=['POST'])
    def login():
        auth = request.json
        if not auth or 'username' not in auth or 'password' not in auth:
            return jsonify({'data': None, 'error': 'Bad request.'}), 400

        username = auth['username']
        password = auth['password']
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT * FROM users WHERE username = ?', (username,))
        user = c.fetchone()
        conn.close()
        
        if not user or not check_password_hash(user[1], password):
            return jsonify({'error': 'Invalid credentials'}), 401

        token = jwt.encode({'user': username, 'exp': datetime.utcnow() + timedelta(hours=1)}, AUTH_SECRET, algorithm='HS256')
        
        resp = make_response(jsonify({'data': True, 'error': None}))
        resp.set_cookie('token', token, httponly=True)
        return resp

    @app.route('/api/logout', methods=['GET'])
    def logout():
        resp = make_response(jsonify({'data': True, 'error': None}))
        resp.set_cookie('token', '', expires=0)
        return resp

    @app.route('/api/auth', methods=['GET'])
    @auth
    def authCheck(user):
        return jsonify({'data': user, 'error': None})

    @app.route('/api/change-password', methods=['POST'])
    @auth
    def change_password(user):        
        data = request.json
        if not data or 'password' not in data or 'newPassword' not in data:
            return jsonify({'data': None, 'error': 'Bad request.'}), 400

        password = data['password']
        new_password = data['newPassword']
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT * FROM users WHERE username = ?', (user,))
        user = c.fetchone()
        conn.close()
        
        if not user or not check_password_hash(user[1], password):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('UPDATE users SET password = ? WHERE username = ?', (generate_password_hash(new_password), user if isinstance(user, str) else user[0]))
        conn.commit()
        conn.close()
        
        return jsonify({'data': True, 'error': None})

    @app.route('/api/media', methods=['GET'])
    @auth
    def media(user):
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
    @auth
    def stream_video(user, filename):
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

    @app.route('/')
    def serve():
        return send_from_directory(app.static_folder, 'index.html')
    
    @app.errorhandler(404)
    def not_found(e):
        return app.send_static_file('index.html')
            

    return app

import os
import json
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

# 1. LOAD ENVIRONMENT VARIABLES
load_dotenv()

app = Flask(__name__, static_folder='public')

# 2. LOCALHOST CORS (Allows your frontend to talk to this server)
CORS(app, resources={r"/*": {"origins": "*"}})

# 3. CONFIGURATION FROM .ENV
PORT = int(os.getenv('PORT', 3000))
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
DATABASE_URL = os.getenv('DATABASE_URL')

# In-memory cache for questions
cache = {}

print("=" * 50)
print("🚀 MOCK TEST BACKEND (LOCAL POSTGRES MODE)")
print("=" * 50)
print(f"✅ Loaded PORT: {PORT}")
print(f"✅ Loaded GROQ KEY: {'Found' if GROQ_API_KEY else 'Missing'}")
print(f"✅ Loaded DB URL: {'Found' if DATABASE_URL else 'Missing'}")
print("=" * 50)

# --- DATABASE CONNECTION ---
def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        return conn
    except Exception as e:
        print(f"❌ Database Connection Error: {e}")
        return None

# --- INITIALIZE DATABASE ---
def init_database():
    conn = get_db_connection()
    if not conn:
        print("⚠️  Cannot connect to Database. Check your .env DATABASE_URL.")
        return
    
    try:
        cursor = conn.cursor()
        
        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        """)
        
        # Create results table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS results (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                topic TEXT NOT NULL,
                score INTEGER NOT NULL,
                total INTEGER NOT NULL,
                date TEXT NOT NULL
            )
        """)
        
        conn.commit()
        print("✅ Database tables active.")
    except Exception as e:
        print(f"❌ Database Init Error: {e}")
    finally:
        cursor.close()
        conn.close()

init_database()

# --- ROUTES ---

@app.route('/')
def serve_index():
    if os.path.exists(os.path.join('public', 'index.html')):
        return send_from_directory('public', 'index.html')
    return "<h1>Server Running locally!</h1>"

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('public', path)

@app.route('/health', methods=['GET'])
def health_check():
    conn = get_db_connection()
    status = 'connected' if conn else 'disconnected'
    if conn: conn.close()
    return jsonify({'status': 'ok', 'database': status})

# --- AUTH ---

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    conn = get_db_connection()
    if not conn: return jsonify({'error': 'Database disconnected'}), 500
    
    try:
        cursor = conn.cursor()
        hashed = generate_password_hash(password)
        cursor.execute('INSERT INTO users (username, password) VALUES (%s, %s)', (username, hashed))
        conn.commit()
        return jsonify({'success': True})
    except psycopg2.IntegrityError:
        conn.rollback()
        return jsonify({'error': 'User already exists'}), 400
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    conn = get_db_connection()
    if not conn: return jsonify({'error': 'Database disconnected'}), 500
    
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE username = %s', (username,))
        user = cursor.fetchone()
        
        if user and check_password_hash(user['password'], password):
            return jsonify({'success': True, 'username': user['username']})
        return jsonify({'error': 'Invalid credentials'}), 400
    finally:
        conn.close()

# --- RESULTS ---

@app.route('/api/save-result', methods=['POST'])
def save_result():
    data = request.get_json()
    conn = get_db_connection()
    if not conn: return jsonify({'error': 'Database disconnected'}), 500
    
    try:
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO results (username, topic, score, total, date) VALUES (%s, %s, %s, %s, %s)',
            (data['username'], data['topic'], data['score'], data['total'], datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        )
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/results', methods=['GET'])
def get_results():
    username = request.args.get('username')
    conn = get_db_connection()
    if not conn: return jsonify({'error': 'Database disconnected'}), 500
    
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM results WHERE username = %s ORDER BY id DESC', (username,))
        return jsonify(cursor.fetchall())
    finally:
        conn.close()

# --- AI GENERATION ---

@app.route('/api/generate-test', methods=['POST'])
def generate_test():
    data = request.get_json()
    
    # Fallback if no key
    if not GROQ_API_KEY:
        return jsonify({
            'questions': [{
                "question": "What is 2+2 (Fallback)?", 
                "options": ["3", "4", "5", "6"], 
                "correct": "4", 
                "explanation": "No API Key found in .env"
            }]
        })

    try:
        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }
        payload = {
            'model': 'llama-3.1-8b-instant',
            'messages': [
                {'role': 'system', 'content': 'Generate JSON array only. Format: [{"question": "...", "options": ["A","B","C","D"], "correct": "A", "explanation": "..."}]'},
                {'role': 'user', 'content': f'Generate {data["numQuestions"]} multiple choice questions on {data["topic"]} ({data["difficulty"]}).'}
            ],
            'temperature': 0.3
        }
        
        response = requests.post('https://api.groq.com/openai/v1/chat/completions', json=payload, headers=headers)
        if response.status_code == 200:
            content = response.json()['choices'][0]['message']['content']
            content = content.replace('```json', '').replace('```', '').strip()
            return jsonify({'questions': json.loads(content)})
        else:
             return jsonify({'error': 'Groq API Error', 'details': response.text}), 500

    except Exception as e:
        print(f"API Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # LISTEN ON LOCALHOST ONLY
    print(f"\n✅ Server running at http://127.0.0.1:{PORT}")
    app.run(host='127.0.0.1', port=PORT, debug=True)
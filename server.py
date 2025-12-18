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

# 1. Load Environment Variables (for Local usage)
load_dotenv()

app = Flask(__name__, static_folder='public')

# 2. CORS Configuration
CORS(app, resources={r"/*": {"origins": "*"}})

# 3. Configuration
PORT = int(os.getenv('PORT', 3000))
GROQ_API_KEY = os.getenv('GROQ_API_KEY')

# DATABASE CONFIGURATION
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    DATABASE_URL = "postgresql://postgres:password@localhost:5432/mock_test"

# 🔧 FIX: Render uses postgres:// but psycopg2 needs postgresql://
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

print("=" * 50)
print(f"🚀 SERVER STARTING on Port {PORT}")
print(f"🌍 Mode: {'Production (Render)' if os.getenv('RENDER') else 'Local Development'}")
print(f"🔑 Groq Key: {'✅ Found' if GROQ_API_KEY else '❌ Missing'}")
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
        print("⚠️  Cannot connect to Database. Skipping init.")
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
        print("✅ Database tables ready.")
    except Exception as e:
        print(f"❌ Database Init Error: {e}")
    finally:
        cursor.close()
        conn.close()

# Run init on startup
init_database()

# --- CACHE BUSTING FOR STATIC FILES ---
@app.after_request
def add_no_cache_headers(response):
    """Prevent caching of static files"""
    if request.path.endswith(('.js', '.css')):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

# --- SERVE STATIC FILES ---
@app.route('/')
def serve_index():
    if os.path.exists(os.path.join('public', 'index.html')):
        return send_from_directory('public', 'index.html')
    return "<h1>Server is running!</h1><p>Frontend not found in /public</p>"

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('public', path)

# --- HEALTH CHECK ---
@app.route('/health', methods=['GET'])
def health_check():
    conn = get_db_connection()
    status = 'connected' if conn else 'disconnected'
    if conn: conn.close()
    return jsonify({'status': 'ok', 'database': status})

# --- AUTH ROUTES ---
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

# --- RESULTS ROUTES ---
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
    
    if not GROQ_API_KEY:
        # Fallback question if API Key is missing
        return jsonify({
            'questions': [{
                "question": "The API Key is missing. What should you do?", 
                "options": ["Panic", "Add GROQ_API_KEY to .env", "Cry", "Sleep"], 
                "correct": "Add GROQ_API_KEY to .env", 
                "explanation": "You need to configure the environment variables."
            }]
        })

    try:
        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        # 🔧 FIXED: Much more explicit system prompt
        system_prompt = """You are a quiz generator. Generate questions in EXACTLY this JSON format with NO markdown:
[
  {
    "question": "What is 2+2?",
    "options": ["3", "4", "5", "6"],
    "correct": "4",
    "explanation": "2+2 equals 4 because..."
  }
]

CRITICAL RULES:
1. The "correct" field must contain the EXACT TEXT from one of the options
2. Do NOT use letters (A, B, C, D) in the "correct" field
3. Do NOT add any markdown formatting like ```json
4. Return ONLY valid JSON array, nothing else
5. Each question must have exactly 4 options"""

        payload = {
            'model': 'llama-3.1-8b-instant',
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': f'Generate {data["numQuestions"]} multiple choice questions about {data["topic"]} at {data["difficulty"]} difficulty level.'}
            ],
            'temperature': 0.3
        }
        
        response = requests.post('https://api.groq.com/openai/v1/chat/completions', json=payload, headers=headers)
        
        if response.status_code == 200:
            content = response.json()['choices'][0]['message']['content']
            # Clean up potential markdown formatting
            content = content.replace('```json', '').replace('```', '').strip()
            
            # Parse and validate
            questions = json.loads(content)
            
            # 🔧 VALIDATION: Ensure correct answer exists in options
            for q in questions:
                if q['correct'] not in q['options']:
                    print(f"⚠️ Warning: Correct answer '{q['correct']}' not in options {q['options']}")
                    # Try to match by first letter if it's just a letter
                    if len(q['correct']) == 1 and q['correct'].upper() in 'ABCD':
                        idx = ord(q['correct'].upper()) - ord('A')
                        if idx < len(q['options']):
                            q['correct'] = q['options'][idx]
                            print(f"✅ Fixed to: {q['correct']}")
            
            print(f"✅ Generated {len(questions)} questions successfully")
            return jsonify({'questions': questions})
        else:
            print(f"❌ Groq API Error: {response.status_code}")
            return jsonify({'error': 'Groq API Error', 'details': response.text}), 500

    except Exception as e:
        print(f"❌ API Error: {e}")
        return jsonify({'error': str(e)}), 500

# --- STARTUP ---
if __name__ == '__main__':
    print(f"✅ Server running at http://127.0.0.1:{PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=True)

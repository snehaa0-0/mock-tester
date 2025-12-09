const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
require('dotenv').config();

console.log("Loaded Groq Key:", process.env.GROQ_API_KEY ? "FOUND" : "NOT FOUND");

const app = express();
const PORT = process.env.PORT || 3000;
const cache = {};

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- DATABASE SETUP (SQLite) ---
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error("Database Error:", err.message);
    else console.log("✅ Connected to SQLite database.");
});

// Create Tables if they don't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        topic TEXT,
        score INTEGER,
        total INTEGER,
        date TEXT
    )`);
});

// --- AUTH ENDPOINTS ---

// 1. Register (Create Account)
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Encrypt password
        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function(err) {
            if (err) {
                return res.status(400).json({ error: "Username already exists" });
            }
            res.json({ success: true, message: "Account created!" });
        });
    } catch (e) {
        res.status(500).json({ error: "Server error" });
    }
});

// 2. Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!user) return res.status(400).json({ error: "User not found" });

        const match = await bcrypt.compare(password, user.password); // Compare encrypted password
        if (match) {
            res.json({ success: true, username: user.username });
        } else {
            res.status(400).json({ error: "Invalid password" });
        }
    });
});

// --- RESULTS ENDPOINTS ---

app.post('/api/save-result', (req, res) => {
    const { username, topic, score, total } = req.body;
    const date = new Date().toLocaleString();
    
    db.run(`INSERT INTO results (username, topic, score, total, date) VALUES (?, ?, ?, ?, ?)`, 
        [username, topic, score, total, date], 
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.get('/api/results', (req, res) => {
    const { username } = req.query;
    db.all(`SELECT * FROM results WHERE username = ? ORDER BY id DESC`, [username], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// --- AI GENERATION (Keep your existing Groq logic) ---
// ... (Paste your Groq fetchWithRetry and generate-test code here) ...
// TO SAVE SPACE, I AM RE-PASTING THE GROQ LOGIC BELOW. COPY CAREFULLY.

const FALLBACK_QUESTIONS = [
    { "question": "What is LIFO?", "options": ["Stack", "Queue", "Array"], "correct": "Stack", "explanation": "Stack is LIFO." }
];

async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                if (response.status === 429) {
                    await new Promise(r => setTimeout(r, 2000));
                } else {
                    const txt = await response.text();
                    throw new Error(txt);
                }
            } else return await response.json();
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(res => setTimeout(res, delay));
        }
    }
}

app.post('/api/generate-test', async (req, res) => {
    const { topic, difficulty, numQuestions } = req.body;
    const cacheKey = `${topic}-${difficulty}-${numQuestions}`.toLowerCase();
    
    if (cache[cacheKey]) return res.json({ questions: cache[cacheKey] });

    try {
        const SYSTEM_INSTRUCTION = `Output strictly in valid JSON. Structure: [ { "question": "...", "options": ["A", "B"], "correct": "A", "explanation": "..." } ] Return ONLY raw JSON.`;
        const userPrompt = `Generate ${numQuestions} multiple choice questions about ${topic} at ${difficulty} level.`;
        
        const data = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY.trim()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [{ role: "system", content: SYSTEM_INSTRUCTION }, { role: "user", content: userPrompt }],
                temperature: 0.2
            })
        });

        const jsonText = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const questions = JSON.parse(jsonText);
        
        cache[cacheKey] = questions;
        res.json({ questions });

    } catch (error) {
        console.error("Groq Error:", error.message);
        res.json({ questions: FALLBACK_QUESTIONS, note: "Backup Mode" });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

console.log("Loaded API key:", process.env.GEMINI_API_KEY ? "FOUND" : "NOT FOUND");

const app = express();
const PORT = process.env.PORT || 3000;
const cache = {};

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                if (response.status === 429) await new Promise(r => setTimeout(r, 2000));
                throw new Error(`API Error: ${response.statusText} (${response.status})`);
            }
            return await response.json();
        } catch (err) {
            console.log(`Attempt ${i + 1} failed: ${err.message}. Retrying...`);
            if (i === retries - 1) throw err;
            await new Promise(res => setTimeout(res, delay));
        }
    }
}

app.post('/api/generate-test', async (req, res) => {
    try {
        const { topic, difficulty, numQuestions } = req.body;

        if (!topic || !difficulty || !numQuestions) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const cacheKey = `${topic}-${difficulty}-${numQuestions}`.toLowerCase();
        if (cache[cacheKey]) {
            console.log(`Serving ${cacheKey} from CACHE`);
            return res.json({ questions: cache[cacheKey] });
        }

        const SYSTEM_INSTRUCTION = `
        You are an API that generates quiz questions.
        Output strictly in valid JSON format.
        Structure: [ { "question": "...", "options": ["A", "B", "C", "D"], "correct": "A", "explanation": "..." } ]
        Do NOT output markdown backticks. Return ONLY raw JSON.
        `;

        const userPrompt = `Generate ${numQuestions} multiple choice questions about ${topic} at ${difficulty} level.`;
        console.log(`Generating: ${topic} (${difficulty})`);

        const data = await fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `${SYSTEM_INSTRUCTION}\n\n${userPrompt}` }]
                    }]
                })
            }
        );

        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            throw new Error('No text returned from Gemini');
        }

        const jsonText = generatedText
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();

        let questions;
        try {
            questions = JSON.parse(jsonText);
        } catch (parseErr) {
            console.error("JSON Parsing failed. Raw Text:", jsonText);
            throw new Error('AI generated invalid JSON. Please try again.');
        }

        cache[cacheKey] = questions;

        res.json({ questions });

    } catch (error) {
        console.error('Server Error:', error.message);
        res.status(500).json({ error: 'Failed to generate test questions. Please try again.' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});

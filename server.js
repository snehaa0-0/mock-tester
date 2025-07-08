const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

console.log("Loaded API key:", process.env.GEMINI_API_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Get API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY environment variable is required');
    process.exit(1);
}

// Test Generation Endpoint
app.post('/api/generate-test', async (req, res) => {
    try {
        const { topic, difficulty, numQuestions } = req.body;

        if (!topic || !difficulty || !numQuestions) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (numQuestions < 1 || numQuestions > 50) {
            return res.status(400).json({ error: 'Number of questions must be between 1 and 50' });
        }

        const prompt = `Generate ${numQuestions} multiple choice questions about ${topic} at ${difficulty} level. 
        Format your response as a JSON array where each question object has:
        - question: the question text
        - options: array of 4 possible answers (A, B, C, D)
        - correct: the correct answer (A, B, C, or D)
        - explanation: brief explanation of why the answer is correct
        Return only the JSON array, no other text.`;

        console.log("Sending prompt to Gemini:");
        console.log(prompt);

        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}
`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API error response:", errorText);
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        console.log("Raw API response:", JSON.stringify(data, null, 2));

        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            throw new Error('No generated text returned from Gemini');
        }

        const jsonText = generatedText.replace(/```json\n?|\n?```/g, '').trim();
        let questions;

        try {
            questions = JSON.parse(jsonText);
        } catch (parseErr) {
            console.error("JSON parsing failed:", parseErr);
            console.error("Returned text was:", jsonText);
            throw new Error('Failed to parse generated JSON');
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('Invalid or empty question array');
        }

        res.json({ questions });

    } catch (error) {
        console.error('Error generating test:', error.message);
        res.status(500).json({ error: 'Failed to generate test questions' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});

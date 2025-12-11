// ==========================================
// 1. SETUP
// ==========================================

// Connect ONLY to local Python server
const API_URL = 'http://127.0.0.1:3000';

console.log('🔗 Connecting to Local Server:', API_URL);

// Check Login
const currentUser = localStorage.getItem('mockTestUser');
if (!currentUser) window.location.href = 'index.html';

// Display User
const userDisplay = document.getElementById('user-display');
if (userDisplay) userDisplay.innerText = `Hi, ${currentUser}`;

function logout() {
    localStorage.removeItem('mockTestUser');
    window.location.href = 'index.html';
}

// ==========================================
// 2. GENERATE & TAKE TEST
// ==========================================

let currentQuestions = [];

async function generateTest() {
    const topic = document.getElementById('topic').value;
    const difficulty = document.getElementById('difficulty').value;
    const numQuestions = document.getElementById('numQuestions').value;

    if (!topic) return alert("Enter a topic!");

    // UI Updates
    document.getElementById('setup-form').style.display = 'none';
    document.getElementById('loading').style.display = 'block';

    try {
        const res = await fetch(`${API_URL}/api/generate-test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, difficulty, numQuestions })
        });

        const data = await res.json();
        
        if (data.questions) {
            currentQuestions = data.questions;
            displayQuiz(data.questions);
            document.getElementById('loading').style.display = 'none';
            document.getElementById('testContainer').style.display = 'block';
        } else {
            throw new Error(data.error || 'No questions returned');
        }

    } catch (err) {
        console.error(err);
        alert("Failed to generate test. Ensure server.py is running!");
        document.getElementById('loading').style.display = 'none';
        document.getElementById('setup-form').style.display = 'block';
    }
}

function displayQuiz(questions) {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = questions.map((q, i) => `
        <div class="question-card">
            <p><strong>Q${i + 1}:</strong> ${q.question}</p>
            <div class="options">
                ${q.options.map(opt => `
                    <label class="option-label">
                        <input type="radio" name="q${i}" value="${opt}"> ${opt}
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// ==========================================
// 3. SUBMIT & GRADE
// ==========================================

async function submitTest() {
    let score = 0;
    
    // Grade locally
    const html = currentQuestions.map((q, i) => {
        const selected = document.querySelector(`input[name="q${i}"]:checked`)?.value;
        const correct = selected === q.correct;
        if (correct) score++;
        
        const color = correct ? 'green' : 'red';
        return `
            <div style="border: 1px solid ${color}; padding: 10px; margin: 10px 0;">
                <p>Q${i+1}: ${q.question}</p>
                <p>Your Answer: ${selected || 'None'} (${correct ? '✅' : '❌'})</p>
                ${!correct ? `<p>Correct Answer: ${q.correct}</p>` : ''}
                <p><em>${q.explanation}</em></p>
            </div>
        `;
    }).join('');

    // Show Results
    document.getElementById('testContainer').style.display = 'none';
    const resultsDiv = document.getElementById('results');
    resultsDiv.style.display = 'block';
    document.getElementById('scoreText').innerHTML = `You scored ${score}/${currentQuestions.length}<br>${html}`;

    // Save to DB
    await fetch(`${API_URL}/api/save-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: currentUser,
            topic: document.getElementById('topic').value,
            score,
            total: currentQuestions.length
        })
    });
}

function restartTest() {
    document.getElementById('results').style.display = 'none';
    document.getElementById('setup-form').style.display = 'block';
    currentQuestions = [];
}
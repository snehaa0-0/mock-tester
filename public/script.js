// ==========================================
// 1. AUTHENTICATION & UI SETUP
// ==========================================

// Check if user is logged in
const currentUser = localStorage.getItem('mockTestUser');
if (!currentUser) {
    // If not logged in, redirect to login page
    window.location.href = 'index.html'; 
}

// Update the Welcome Message in the Navbar
const userDisplay = document.getElementById('user-display');
if (userDisplay) {
    userDisplay.innerText = `Hi, ${currentUser}`;
}

// Logout Function
function logout() {
    localStorage.removeItem('mockTestUser');
    window.location.href = 'index.html';
}

// ==========================================
// 2. TEST GENERATION LOGIC
// ==========================================

let currentQuestions = []; // Store questions here to grade them later

async function generateTest() {
    const topic = document.getElementById('topic').value.trim();
    const difficulty = document.getElementById('difficulty').value;
    const numQuestions = document.getElementById('numQuestions').value;
    
    const generateBtn = document.getElementById('generate-btn');
    const loading = document.getElementById('loading');
    const setupForm = document.getElementById('setup-form');
    const testContainer = document.getElementById('testContainer');
    const results = document.getElementById('results');

    if (!topic) {
        alert("Please enter a topic!");
        return;
    }

    // Show Loading, Hide Form
    setupForm.style.display = 'none';
    loading.style.display = 'block';
    testContainer.style.display = 'none';
    results.style.display = 'none';

    try {
        const response = await fetch('http://localhost:3000/api/generate-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, difficulty, numQuestions })
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // Save questions globally
        currentQuestions = data.questions; 
        
        // Render the Quiz
        displayQuiz(data.questions);

        // Hide loading, show test
        loading.style.display = 'none';
        testContainer.style.display = 'block';

    } catch (error) {
        alert("Error generating test: " + error.message);
        loading.style.display = 'none';
        setupForm.style.display = 'block';
    }
}

// ==========================================
// 3. DISPLAY & GRADING LOGIC
// ==========================================

function displayQuiz(questions) {
    const container = document.getElementById('questionsContainer');
    
    let html = '';
    
    questions.forEach((q, index) => {
        html += `
            <div class="question-card">
                <p class="question-text"><strong>Question ${index + 1}:</strong> ${q.question}</p>
                <div class="options">
                    ${q.options.map((opt) => `
                        <label class="option-label">
                            <input type="radio" name="q${index}" value="${opt}"> 
                            ${opt}
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function submitTest() {
    let score = 0;
    const questionsContainer = document.getElementById('questionsContainer');
    const submitBtn = document.getElementById('submit-btn');
    const testContainer = document.getElementById('testContainer');
    const resultsDiv = document.getElementById('results');
    
    // Grading Loop
    const gradedHTML = currentQuestions.map((q, index) => {
        const selected = document.querySelector(`input[name="q${index}"]:checked`)?.value;
        const isCorrect = selected === q.correct;
        
        if (isCorrect) score++;

        const color = isCorrect ? '#10b981' : '#ef4444';
        const bgColor = isCorrect ? '#d1fae5' : '#fee2e2';
        const status = isCorrect ? '✅ Correct' : `❌ Wrong (Correct Answer: ${q.correct})`;

        return `
            <div style="border: 2px solid ${color}; padding: 15px; margin: 15px 0; border-radius: 10px; background-color: ${bgColor};">
                <p><strong>Q${index+1}:</strong> ${q.question}</p>
                <p><strong>Your Answer:</strong> ${selected || "❌ Not Answered"}</p>
                <p style="color:${color}; font-weight:bold;">${status}</p>
                <p style="font-size: 0.95em; color: #555; margin-top: 8px;"><em>💡 ${q.explanation}</em></p>
            </div>
        `;
    }).join('');

    // Calculate percentage
    const percentage = Math.round((score / currentQuestions.length) * 100);

    // Update Results Section
    document.getElementById('score').innerText = `${percentage}%`;
    document.getElementById('scoreText').innerHTML = `
        <strong>You scored ${score} out of ${currentQuestions.length}</strong><br>
        ${percentage >= 70 ? '🎉 Great job!' : percentage >= 50 ? '👍 Good effort!' : '📚 Keep practicing!'}
        <div style="margin-top: 20px;">
            ${gradedHTML}
        </div>
    `;

    // Hide test, show results
    testContainer.style.display = 'none';
    resultsDiv.style.display = 'block';

    // Save to Database
    try {
        await fetch('http://localhost:3000/api/save-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: currentUser,
                topic: document.getElementById('topic').value,
                score: score,
                total: currentQuestions.length
            })
        });
        console.log("✅ Result saved to database");
    } catch (err) {
        console.error("❌ Could not save result:", err);
    }
}
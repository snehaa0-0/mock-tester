// ==========================================
// 1. DYNAMIC API CONFIGURATION
// ==========================================

let API_URL = '';

// Check if we are running locally (Live Server or opening HTML file)
if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    // Connect to the local Python server
    API_URL = 'http://127.0.0.1:3000';
    console.log('🏠 Running Locally. Connecting to:', API_URL);
} else {
    // Running on Render!
    // We use an empty string to use relative paths (e.g., "/api/login")
    API_URL = ''; 
    console.log('☁️ Running on Cloud. Using relative paths.');
}

// Check Authentication
const currentUser = localStorage.getItem('mockTestUser');
if (!currentUser) {
    window.location.href = 'index.html'; 
}

const userDisplay = document.getElementById('user-display');
if (userDisplay) {
    userDisplay.innerText = `Hi, ${currentUser}`;
}

function logout() {
    localStorage.removeItem('mockTestUser');
    window.location.href = 'index.html';
}

// ==========================================
// 2. TEST GENERATION
// ==========================================

let currentQuestions = [];

async function generateTest() {
    const topic = document.getElementById('topic').value.trim();
    const difficulty = document.getElementById('difficulty').value;
    const numQuestions = document.getElementById('numQuestions').value;

    if (!topic) {
        alert("Please enter a topic!");
        return;
    }

    // UI Updates
    document.getElementById('setup-form').style.display = 'none';
    document.getElementById('loading').style.display = 'block';

    try {
        const response = await fetch(`${API_URL}/api/generate-test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, difficulty, numQuestions })
        });

        const data = await response.json();
        
        if (data.questions) {
            currentQuestions = data.questions;
            console.log('📝 Generated Questions:', currentQuestions);
            displayQuiz(data.questions);
            
            document.getElementById('loading').style.display = 'none';
            document.getElementById('testContainer').style.display = 'block';
        } else {
            throw new Error(data.error || 'Failed to get questions');
        }

    } catch (err) {
        console.error(err);
        alert("Error generating test. Check console for details.");
        
        // Reset UI
        document.getElementById('loading').style.display = 'none';
        document.getElementById('setup-form').style.display = 'block';
    }
}

function displayQuiz(questions) {
    const container = document.getElementById('questionsContainer');
    
    container.innerHTML = questions.map((q, index) => `
        <div class="question-card">
            <p class="question-text"><strong>Q${index + 1}:</strong> ${q.question}</p>
            <div class="options">
                ${q.options.map((opt, optIndex) => {
                    // 🔧 Add letter prefix if it doesn't exist
                    const letter = String.fromCharCode(65 + optIndex); // A, B, C, D
                    const displayText = opt.match(/^[A-D]\.?\s/) ? opt : `${letter}. ${opt}`;
                    
                    return `
                        <label class="option-label">
                            <input type="radio" name="q${index}" value="${opt}"> 
                            ${displayText}
                        </label>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
}

// ==========================================
// 3. SUBMIT & GRADE
// ==========================================

async function submitTest() {
    let score = 0;
    
    // 🔧 Helper function to normalize text for comparison
    function normalizeText(text) {
        if (!text) return '';
        return text
            .trim()                          // Remove leading/trailing spaces
            .toLowerCase()                   // Convert to lowercase
            .replace(/['']/g, "'")          // Normalize apostrophes
            .replace(/[""]/g, '"')          // Normalize quotes
            .replace(/\s+/g, ' ')           // Normalize multiple spaces to single space
            .replace(/[^\w\s]/g, '');       // Remove special characters except spaces
    }
    
    // Grading Logic with multiple matching strategies
    const gradedHTML = currentQuestions.map((q, index) => {
        const selected = document.querySelector(`input[name="q${index}"]:checked`)?.value;
        
        // 🔧 FIX: Multiple matching strategies
        let isCorrect = false;
        
        if (selected && q.correct) {
            // Strategy 1: Exact match (best case)
            if (selected === q.correct) {
                isCorrect = true;
                console.log(`✅ Q${index + 1}: Exact match`);
            }
            // Strategy 2: Normalized match (handles whitespace, case, punctuation)
            else {
                const normalizedSelected = normalizeText(selected);
                const normalizedCorrect = normalizeText(q.correct);
                
                if (normalizedSelected === normalizedCorrect) {
                    isCorrect = true;
                    console.log(`✅ Q${index + 1}: Normalized match`);
                }
                // Strategy 3: Check if correct is a letter (A, B, C, D)
                else if (q.correct.length === 1 && /[A-D]/i.test(q.correct)) {
                    const correctIndex = q.correct.toUpperCase().charCodeAt(0) - 65;
                    if (correctIndex >= 0 && correctIndex < q.options.length && selected === q.options[correctIndex]) {
                        isCorrect = true;
                        console.log(`✅ Q${index + 1}: Letter index match`);
                    }
                }
                // Strategy 4: Find matching option by normalized text
                else {
                    for (let opt of q.options) {
                        if (normalizeText(opt) === normalizedCorrect && normalizeText(selected) === normalizedCorrect) {
                            isCorrect = true;
                            console.log(`✅ Q${index + 1}: Option normalized match`);
                            break;
                        }
                    }
                }
                
                // Debug log for failed matches
                if (!isCorrect) {
                    console.log(`❌ Q${index + 1} MISMATCH:`);
                    console.log('  Selected:', selected);
                    console.log('  Correct:', q.correct);
                    console.log('  Normalized Selected:', normalizedSelected);
                    console.log('  Normalized Correct:', normalizedCorrect);
                    console.log('  Options:', q.options);
                }
            }
        }
        
        if (isCorrect) score++;

        const color = isCorrect ? 'green' : 'red';
        const status = isCorrect ? '✅ Correct' : `❌ Wrong (Answer: ${q.correct})`;

        return `
            <div style="border: 1px solid ${color}; padding: 15px; margin: 10px 0; border-radius: 8px;">
                <p><strong>Q${index+1}:</strong> ${q.question}</p>
                <p><strong>You:</strong> ${selected || "Skipped"} &nbsp; | &nbsp; <strong>${status}</strong></p>
                <p style="color: #666; font-size: 0.9em;"><em>💡 ${q.explanation}</em></p>
            </div>
        `;
    }).join('');

    // Update Results UI
    const resultsDiv = document.getElementById('results');
    document.getElementById('testContainer').style.display = 'none';
    resultsDiv.style.display = 'block';
    
    document.getElementById('scoreText').innerHTML = `
        <h3>You scored ${score} / ${currentQuestions.length}</h3>
        ${gradedHTML}
    `;

    // Save to Database
    try {
        await fetch(`${API_URL}/api/save-result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: currentUser,
                topic: document.getElementById('topic').value,
                score: score,
                total: currentQuestions.length
            })
        });
        console.log("✅ Result saved to database.");
    } catch (err) {
        console.error("❌ Failed to save result:", err);
    }
}

function restartTest() {
    document.getElementById('results').style.display = 'none';
    document.getElementById('setup-form').style.display = 'block';
    currentQuestions = [];
}

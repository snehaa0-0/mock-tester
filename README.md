# Mock Test Generator

An AI-powered mock test generator that creates customized multiple-choice questions using the Groq API. Users can take tests on any topic, receive instant feedback, and track their performance over time.
The website is live here: https://mock-tester-f5up.onrender.com/

---

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Dependencies](#dependencies)
- [Contributing](#contributing)

---

## Features

- **AI-Powered Question Generation** - Utilizes Groq's LLaMA 3.1 model to generate unique, contextually relevant questions
- **Customizable Tests** - Select topic, difficulty level, and number of questions
- **Instant Grading** - Receive immediate feedback with detailed explanations for each answer
- **User Authentication** - Secure login and registration system with password hashing
- **Performance Tracking** - Save test results and view historical performance data
- **Smart Caching** - Reduces API calls by caching previously generated questions
- **Responsive UI** - Clean, modern interface optimized for all devices
- **Fallback Questions** - Continues to function with pre-defined questions when API is unavailable

---

## Technology Stack

### Backend

- **Python 3.8+** - Core programming language
- **Flask** - Lightweight web application framework
- **PostgreSQL** - Relational database management system
- **Groq API** - AI model integration for question generation
- **psycopg2** - PostgreSQL database adapter for Python
- **Flask-CORS** - Cross-Origin Resource Sharing support
- **Werkzeug** - Security utilities for password hashing

### Frontend

- **HTML5** - Markup language
- **CSS3** - Styling and responsive design
- **JavaScript (ES6+)** - Client-side interactivity
- **Fetch API** - HTTP request handling

---

## Prerequisites

Ensure the following software is installed on your system:

- **Python 3.8 or higher** - [Download Python](https://www.python.org/downloads/)
- **PostgreSQL 12+** - [Download PostgreSQL](https://www.postgresql.org/download/)
- **pip** - Python package installer (included with Python)
- **Git** - [Download Git](https://git-scm.com/downloads)
- **Groq API Key** - [Obtain API key](https://console.groq.com/)

### Verify Installations

```bash
python --version  # Should display Python 3.8 or higher
pip --version     # Should display pip version
psql --version    # Should display PostgreSQL version
git --version     # Should display Git version
```

---

## Configuration

### Create Environment File

Create a `.env` file in the project root directory:

**Windows:**
```bash
type nul > .env
```

**macOS/Linux:**
```bash
touch .env
```

### Configure Environment Variables

Add the following configuration to `.env`:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Groq API Configuration
GROQ_API_KEY=your_groq_api_key_here

# Database Configuration
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/mock_test_db
```

### Obtaining Groq API Key

1. Navigate to [Groq Console](https://console.groq.com/)
2. Create an account or sign in
3. Access the API Keys section
4. Generate a new API key
5. Copy the key and add it to your `.env` file

### Security Configuration

Create a `.gitignore` file to prevent sensitive files from being committed:

```bash
# Create .gitignore
echo "venv/" > .gitignore
echo ".env" >> .gitignore
echo "__pycache__/" >> .gitignore
echo "*.pyc" >> .gitignore
echo ".DS_Store" >> .gitignore
echo "*.log" >> .gitignore
```

**Important:** Never commit the `.env` file to version control.

---

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/sneha0-0/mock-test-generator.git
cd mock-test-generator
```

### Step 2: Create Virtual Environment

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

The terminal prompt should display `(venv)` indicating the virtual environment is active.

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

If `requirements.txt` is unavailable, install packages manually:

```bash
pip install flask flask-cors psycopg2-binary python-dotenv requests werkzeug
```

### Step 4: Set Up PostgreSQL Database

Launch the PostgreSQL command-line interface:

```bash
psql -U postgres
```

Execute the following SQL commands:

```sql
-- Create database
CREATE DATABASE mock_test_db;

-- Create user (optional)
CREATE USER mock_test_user WITH PASSWORD 'your_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE mock_test_db TO mock_test_user;

-- Exit
\q
```

---

## Running the Application

### Step 1: Activate Virtual Environment

**Windows:**
```bash
venv\Scripts\activate
```

**macOS/Linux:**
```bash
source venv/bin/activate
```

### Step 2: Start the Backend Server

```bash
python server.py
```

Expected console output:

```
==================================================
MOCK TEST BACKEND STARTING
==================================================
Loaded Groq Key: FOUND
Database URL: FOUND
==================================================
Database tables initialized.

Server running on:
   - http://localhost:3000
   - http://127.0.0.1:3000

Test the API:
   - Health: http://127.0.0.1:3000/health
```

### Step 3: Serve Frontend Files

**Option A: Using VS Code Live Server**
1. Install the "Live Server" extension in Visual Studio Code
2. Right-click on `public/index.html`
3. Select "Open with Live Server"

**Option B: Using Python HTTP Server**
```bash
# Open a new terminal window
cd public
python -m http.server 5500
```

Access the application at: `http://127.0.0.1:5500`

### Step 4: Verify Installation

1. **Backend Health Check:**
   - Navigate to: `http://127.0.0.1:3000/health`
   - Expected response: `{"status": "ok", "database": "connected", ...}`

2. **User Registration:**
   - Go to: `http://127.0.0.1:5500`
   - Create a new user account
   - Log in with your credentials

3. **Generate Test:**
   - Enter a topic (e.g., "Python Programming")
   - Select difficulty level (Easy, Medium, Hard)
   - Choose number of questions (1-10)
   - Click "Generate Test"

---

## Dependencies

### requirements.txt

```txt
Flask==3.0.0
flask-cors==4.0.0
psycopg2-binary==2.9.9
python-dotenv==1.0.0
requests==2.31.0
Werkzeug==3.0.1
```

### Installation

```bash
pip install -r requirements.txt
```

---

## Contributing

Contributions are welcome. Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -m 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Open a Pull Request

### Code Standards

- Follow PEP 8 style guide for Python code
- Use meaningful variable and function names
- Add comments for complex logic
- Update documentation for new features

---

## Author

**V Sneha Sharon**
- GitHub: [@sneha0-0](https://github.com/sneha0-0)

---

**Documentation Last Updated:** December 2024

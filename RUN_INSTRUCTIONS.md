# How to Run This Application

This is a Flask-based GST Billing System with a React frontend. Here are the steps to run it:

## Prerequisites

1. **Python 3.8+** installed on your system
2. **pip** (Python package installer)

## Step 1: Navigate to the Project Directory

```bash
cd Service-4
```

## Step 2: Create a Virtual Environment (Recommended)

**On Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**On macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

## Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

## Step 4: Initialize the Database

You have two options:

### Option A: Using the full app (app.py)
```bash
python create_tables.py
```

### Option B: The database will auto-initialize if using app_working.py

## Step 5: Run the Application

You have **three options** to run the application:

### Option 1: Run the full application (app.py) - RECOMMENDED
```bash
python app.py
```
- Runs on: `http://localhost:5000`
- Uses the full-featured Flask app with all routes
- Includes React frontend support

### Option 2: Run the working/simplified version (app_working.py)
```bash
python app_working.py
```
- Runs on: `http://localhost:5000`
- Simpler version with basic API endpoints
- Database auto-initializes on startup

### Option 3: Run using the startup script (start.py)
```bash
python start.py
```
- Runs on: `http://localhost:5000`
- Designed for Railway deployment
- Uses app_working.py internally
- Includes health check tests

## Step 6: Access the Application

Once running, you can access:

- **API Health Check**: `http://localhost:5000/health`
- **API Root**: `http://localhost:5000/`
- **API Endpoints**: `http://localhost:5000/api/*`

## Running the Frontend (Optional)

If you want to run the React frontend separately:

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:5173` (or another port if 5173 is taken).

## Troubleshooting

### Port Already in Use
If port 5000 is already in use, you can change it:
```bash
# Set environment variable
set PORT=5001  # Windows
export PORT=5001  # macOS/Linux

# Then run
python app.py
```

### Database Issues
If you encounter database errors:
```bash
# Delete the database and recreate
rm instance/app.db  # Linux/macOS
del instance\app.db  # Windows

# Then run create_tables.py again
python create_tables.py
```

### Missing Dependencies
If you get import errors:
```bash
pip install -r requirements.txt --upgrade
```

## Environment Variables (Optional)

You can set these environment variables before running:

```bash
# Windows
set FLASK_ENV=development
set SECRET_KEY=your-secret-key-here
set DATABASE_URL=sqlite:///app.db

# macOS/Linux
export FLASK_ENV=development
export SECRET_KEY=your-secret-key-here
export DATABASE_URL=sqlite:///app.db
```

## Quick Start (All-in-One Command)

**On Windows:**
```bash
cd Service-4 && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt && python create_tables.py && python app.py
```

**On macOS/Linux:**
```bash
cd Service-4 && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && python create_tables.py && python app.py
```

## Notes

- The application uses SQLite database by default (stored in `instance/app.db`)
- The API runs on port 5000 by default
- CORS is enabled for frontend development
- The application includes health check endpoints for monitoring


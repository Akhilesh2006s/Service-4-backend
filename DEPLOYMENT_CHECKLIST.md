# Deployment Checklist

## Pre-Deployment Steps

### 1. Database Migration
- ✅ Run `python add_vegetable_fields_to_product.py` to add vegetable columns
- ✅ Database columns are automatically added on app startup (in app.py)

### 2. Environment Variables
Set the following environment variables in your deployment platform:

```bash
FLASK_ENV=production
SECRET_KEY=your-secure-secret-key-here
DATABASE_URL=sqlite:///instance/gst_inventory.db  # or your production DB URL
CORS_ORIGINS=https://your-frontend-domain.com,https://your-backend-domain.com
PORT=5000  # Usually set automatically by platform
```

### 3. Dependencies
- ✅ All Python dependencies are in `requirements.txt`
- ✅ Frontend dependencies are in `frontend/package.json`

### 4. Build Frontend
Before deployment, build the React frontend:
```bash
cd frontend
npm install
npm run build
```

### 5. Database Initialization
The app automatically:
- Creates all tables on startup
- Adds vegetable columns if they don't exist
- Handles missing columns gracefully

## Deployment Files

### Railway Deployment
- ✅ `railway.json` - Configuration for Railway
- ✅ `Procfile` - Process file for Heroku/Railway
- ✅ `runtime.txt` - Python version specification
- ✅ `requirements.txt` - Python dependencies

### Application Files
- ✅ `app.py` - Main Flask application with error handling
- ✅ `config.py` - Configuration with environment variable support
- ✅ `init_database.py` - Database initialization helper

## Runtime Error Prevention

### Fixed Issues:
1. ✅ Database vegetable columns are auto-created on startup
2. ✅ Import function uses raw SQL to avoid column loading issues
3. ✅ Error handling for missing columns
4. ✅ CORS configured for production
5. ✅ Environment-based configuration
6. ✅ Graceful error handling in all routes

### Error Handling:
- All database operations wrapped in try-catch
- Import routes handle missing columns gracefully
- Product queries use raw SQL when needed
- App startup doesn't fail if migrations have issues

## Testing Before Deployment

1. Test vegetable import with your spreadsheet format
2. Test customer/product deletion
3. Verify all API endpoints work
4. Check database migrations run successfully

## Post-Deployment

1. Monitor logs for any errors
2. Test health endpoint: `/health`
3. Verify database tables exist
4. Test import functionality






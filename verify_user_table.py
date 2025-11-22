"""Verify that all required columns exist in user table"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app import create_app
from database import db

app = create_app()

with app.app_context():
    try:
        result = db.session.execute(db.text("PRAGMA table_info(user)")).fetchall()
        columns = [row[1] for row in result]
        print("User table columns:", columns)
        
        required_columns = ['gst_number', 'business_address', 'business_phone', 'business_email', 'business_state', 'business_pincode']
        missing = [col for col in required_columns if col not in columns]
        
        if missing:
            print(f"[ERROR] Missing columns: {missing}")
        else:
            print("[OK] All required columns exist in user table")
            
        # Try a simple query
        try:
            db.session.execute(db.text("SELECT gst_number FROM user LIMIT 1"))
            print("[OK] Can query gst_number column successfully")
        except Exception as e:
            print(f"[ERROR] Cannot query gst_number: {e}")
    except Exception as e:
        print(f"[ERROR] {e}")


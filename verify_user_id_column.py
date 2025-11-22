"""Verify that user_id column exists in customer table"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app import create_app
from database import db

app = create_app()

with app.app_context():
    try:
        result = db.session.execute(db.text("PRAGMA table_info(customer)")).fetchall()
        columns = [row[1] for row in result]
        print("Customer table columns:", columns)
        if "user_id" in columns:
            print("[OK] user_id column exists in customer table")
        else:
            print("[ERROR] user_id column is missing!")
            
        # Try a simple query
        try:
            db.session.execute(db.text("SELECT user_id FROM customer LIMIT 1"))
            print("[OK] Can query user_id column successfully")
        except Exception as e:
            print(f"[ERROR] Cannot query user_id: {e}")
    except Exception as e:
        print(f"[ERROR] {e}")


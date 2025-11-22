"""
Add missing is_active column to super_admin table
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app import create_app
from database import db

def migrate_super_admin_table():
    """Add is_active column to super_admin table"""
    app = create_app()
    
    with app.app_context():
        try:
            # Check if column exists
            try:
                db.session.execute(db.text("SELECT is_active FROM super_admin LIMIT 1"))
                print("[OK] is_active column already exists in super_admin table")
            except Exception:
                print("[INFO] Adding is_active column to super_admin table...")
                db.session.execute(db.text("ALTER TABLE super_admin ADD COLUMN is_active INTEGER DEFAULT 1"))
                db.session.commit()
                print("[OK] Added is_active column to super_admin table")
                
                # Set all existing super admins as active
                db.session.execute(db.text("UPDATE super_admin SET is_active = 1 WHERE is_active IS NULL"))
                db.session.commit()
                print("[OK] Set all existing super admins as active")
            
        except Exception as e:
            db.session.rollback()
            print(f"[ERROR] Error during migration: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    migrate_super_admin_table()


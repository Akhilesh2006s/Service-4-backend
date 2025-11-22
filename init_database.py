"""
Database initialization script to ensure all required columns exist
Run this on application startup to ensure database schema is up to date
"""
import sys
sys.stdout.reconfigure(encoding='utf-8') if sys.platform == 'win32' else None

def init_database_columns(db, app):
    """Initialize database columns, especially vegetable fields"""
    with app.app_context():
        try:
            # Check if product table exists
            result = db.session.execute(db.text("SELECT name FROM sqlite_master WHERE type='table' AND name='product'")).fetchone()
            if not result:
                print("[INFO] Product table does not exist, will be created by db.create_all()")
                db.create_all()
                return
            
            # Get existing columns
            result = db.session.execute(db.text("PRAGMA table_info(product)")).fetchall()
            existing_columns = [row[1] for row in result]
            
            # Define vegetable columns to add
            vegetable_columns = {
                'vegetable_name': 'VARCHAR(200)',
                'vegetable_name_hindi': 'VARCHAR(200)',
                'quantity_gm': 'REAL',
                'quantity_kg': 'REAL',
                'rate_per_gm': 'REAL',
                'rate_per_kg': 'REAL'
            }
            
            # Add missing columns
            added_columns = []
            for col_name, col_type in vegetable_columns.items():
                if col_name not in existing_columns:
                    try:
                        db.session.execute(db.text(f"ALTER TABLE product ADD COLUMN {col_name} {col_type}"))
                        added_columns.append(col_name)
                    except Exception as e:
                        error_msg = str(e).lower()
                        if 'duplicate' not in error_msg and 'already exists' not in error_msg:
                            print(f"[WARNING] Could not add column {col_name}: {e}")
            
            if added_columns:
                db.session.commit()
                print(f"[OK] Added columns to product table: {', '.join(added_columns)}")
            else:
                print("[OK] All vegetable columns already exist")
                
        except Exception as e:
            db.session.rollback()
            print(f"[WARNING] Database initialization warning: {e}")
            # Don't fail - columns might already exist






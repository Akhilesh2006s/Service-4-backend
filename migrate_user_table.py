"""
Comprehensive migration script to update user table schema
Adds all missing columns to match the User model definition
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app import create_app
from database import db

def migrate_user_table():
    """Add all missing columns to user table"""
    app = create_app()
    
    with app.app_context():
        try:
            # Get current table structure
            result = db.session.execute(db.text("PRAGMA table_info(user)")).fetchall()
            existing_columns = {row[1]: row for row in result}
            print(f"[INFO] Current user table has {len(existing_columns)} columns")
            print(f"[INFO] Existing columns: {list(existing_columns.keys())}")
            
            # Define required columns based on the User model
            required_columns = {
                'gst_number': 'VARCHAR(15)',
                'business_address': 'TEXT',
                'business_phone': 'VARCHAR(15)',
                'business_email': 'VARCHAR(120)',
                'business_state': 'VARCHAR(50)',
                'business_pincode': 'VARCHAR(10)',
                'business_reason': 'TEXT',
                'is_approved': 'BOOLEAN',
                'approved_by': 'INTEGER',
                'approved_at': 'DATETIME',
                'created_at': 'DATETIME',
                'is_active': 'BOOLEAN'
            }
            
            # Check which columns are missing
            missing_columns = []
            for col_name, col_type in required_columns.items():
                if col_name not in existing_columns:
                    missing_columns.append((col_name, col_type))
                    print(f"[INFO] Missing column: {col_name}")
            
            if not missing_columns:
                print("[OK] All required columns already exist in user table")
                return
            
            # Add missing columns
            print(f"[INFO] Adding {len(missing_columns)} missing columns...")
            
            for col_name, col_type in missing_columns:
                try:
                    # SQLite allows adding columns with ALTER TABLE
                    # For BOOLEAN, SQLite uses INTEGER
                    if col_type == 'BOOLEAN':
                        sql_type = 'INTEGER'
                    elif col_type == 'DATETIME':
                        sql_type = 'DATETIME'
                    else:
                        sql_type = col_type
                    
                    sql = f"ALTER TABLE user ADD COLUMN {col_name} {sql_type}"
                    db.session.execute(db.text(sql))
                    db.session.commit()
                    print(f"[OK] Added column: {col_name}")
                except Exception as e:
                    db.session.rollback()
                    error_msg = str(e).lower()
                    if "duplicate" in error_msg or "already exists" in error_msg:
                        print(f"[INFO] Column {col_name} already exists (or similar column exists)")
                    else:
                        print(f"[ERROR] Failed to add column {col_name}: {e}")
                        raise
            
            # Set default values for boolean columns
            try:
                # Set default for is_approved if it was just added
                if 'is_approved' in [col[0] for col in missing_columns]:
                    db.session.execute(
                        db.text("UPDATE user SET is_approved = 0 WHERE is_approved IS NULL")
                    )
                    print("[OK] Set default value for is_approved")
                
                # Set default for is_active if it was just added
                if 'is_active' in [col[0] for col in missing_columns]:
                    db.session.execute(
                        db.text("UPDATE user SET is_active = 1 WHERE is_active IS NULL")
                    )
                    print("[OK] Set default value for is_active")
                
                db.session.commit()
            except Exception as e:
                print(f"[WARNING] Could not set default values: {e}")
            
            # Verify all columns exist
            result = db.session.execute(db.text("PRAGMA table_info(user)")).fetchall()
            final_columns = [row[1] for row in result]
            
            all_present = all(col in final_columns for col in required_columns.keys())
            
            if all_present:
                print("[OK] All required columns are now present in user table")
                print(f"[INFO] Final columns: {final_columns}")
            else:
                missing = [col for col in required_columns.keys() if col not in final_columns]
                print(f"[WARNING] Some columns are still missing: {missing}")
            
            print("[OK] Migration completed successfully!")
            
        except Exception as e:
            db.session.rollback()
            print(f"[ERROR] Error during migration: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    migrate_user_table()


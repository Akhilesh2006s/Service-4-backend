"""
Migration script to add user_id column to product table
"""
import sqlite3
import os
import sys

# Reconfigure stdout for Windows compatibility
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

def migrate_product_table():
    """Add user_id column to product table if it doesn't exist"""
    
    # Check both possible database locations
    db_paths = [
        'instance/app.db',
        'instance/gst_inventory.db',
        'app.db',
        'gst_inventory.db'
    ]
    
    for db_path in db_paths:
        if not os.path.exists(db_path):
            continue
            
        print(f"\n[INFO] Checking database: {db_path}")
        
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Check if product table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='product'")
            if not cursor.fetchone():
                print(f"[SKIP] Product table does not exist in {db_path}")
                conn.close()
                continue
            
            # Check if user_id column already exists
            cursor.execute("PRAGMA table_info(product)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'user_id' in columns:
                print(f"[SKIP] user_id column already exists in product table in {db_path}")
                conn.close()
                continue
            
            print(f"[INFO] Adding user_id column to product table in {db_path}")
            
            # Get the first admin user to assign existing products
            cursor.execute("SELECT id FROM user LIMIT 1")
            first_user = cursor.fetchone()
            default_user_id = first_user[0] if first_user else 1
            
            # Add user_id column (nullable first, then we'll update it)
            cursor.execute("ALTER TABLE product ADD COLUMN user_id INTEGER")
            
            # Update existing products to have a user_id
            cursor.execute(f"UPDATE product SET user_id = {default_user_id} WHERE user_id IS NULL")
            
            # Make it NOT NULL (SQLite doesn't support ALTER COLUMN, so we need to recreate)
            # For now, we'll leave it nullable and handle it in the application
            # Or we can use a more complex migration
            
            conn.commit()
            print(f"[OK] Successfully added user_id column to product table in {db_path}")
            
            # Verify the column was added
            cursor.execute("PRAGMA table_info(product)")
            columns = [column[1] for column in cursor.fetchall()]
            if 'user_id' in columns:
                print(f"[OK] Verified: user_id column exists in product table")
            else:
                print(f"[ERROR] Failed to verify user_id column")
            
            conn.close()
            
        except sqlite3.Error as e:
            print(f"[ERROR] Database error in {db_path}: {e}")
        except Exception as e:
            print(f"[ERROR] Unexpected error in {db_path}: {e}")

if __name__ == '__main__':
    print("=" * 60)
    print("Migration: Add user_id to product table")
    print("=" * 60)
    migrate_product_table()
    print("\n[OK] Migration completed!")


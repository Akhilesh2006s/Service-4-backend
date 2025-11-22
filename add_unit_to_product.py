"""
Migration script to add unit column to product table
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

def add_unit_column():
    """Add unit column to product table if it doesn't exist"""
    
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
            
            # Check if unit column already exists
            cursor.execute("PRAGMA table_info(product)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'unit' in columns:
                print(f"[SKIP] unit column already exists in product table in {db_path}")
                conn.close()
                continue
            
            print(f"[INFO] Adding unit column to product table in {db_path}")
            
            # Add unit column with default value 'PCS'
            cursor.execute("ALTER TABLE product ADD COLUMN unit VARCHAR(20) DEFAULT 'PCS'")
            
            # Update existing products to have 'PCS' as default unit
            cursor.execute("UPDATE product SET unit = 'PCS' WHERE unit IS NULL")
            
            conn.commit()
            print(f"[OK] Successfully added unit column to product table in {db_path}")
            
            # Verify the column was added
            cursor.execute("PRAGMA table_info(product)")
            columns = [column[1] for column in cursor.fetchall()]
            if 'unit' in columns:
                print(f"[OK] Verified: unit column exists in product table")
            else:
                print(f"[ERROR] Failed to verify unit column")
            
            conn.close()
            
        except sqlite3.Error as e:
            print(f"[ERROR] Database error in {db_path}: {e}")
        except Exception as e:
            print(f"[ERROR] Unexpected error in {db_path}: {e}")

if __name__ == '__main__':
    print("=" * 60)
    print("Migration: Add unit column to product table")
    print("=" * 60)
    add_unit_column()
    print("\n[OK] Migration completed!")


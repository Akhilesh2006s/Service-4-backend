"""
Migration script to add missing columns to product table
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
    """Add missing columns to product table"""
    
    # Check both possible database locations
    db_paths = [
        'instance/app.db',
        'instance/gst_inventory.db',
        'app.db',
        'gst_inventory.db'
    ]
    
    columns_to_add = [
        ('sku', 'TEXT'),
        ('category', 'TEXT'),
        ('brand', 'TEXT'),
        ('hsn_code', 'TEXT'),
        ('min_stock_level', 'INTEGER DEFAULT 10'),
        ('image_url', 'TEXT'),
        ('weight', 'REAL'),
        ('dimensions', 'TEXT'),
        ('updated_at', 'DATETIME'),
        ('user_id', 'INTEGER')
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
            
            # Get existing columns
            cursor.execute("PRAGMA table_info(product)")
            existing_columns = [column[1] for column in cursor.fetchall()]
            print(f"[INFO] Existing columns: {', '.join(existing_columns)}")
            
            # Add missing columns
            for column_name, column_type in columns_to_add:
                if column_name not in existing_columns:
                    print(f"[INFO] Adding column: {column_name} ({column_type})")
                    try:
                        cursor.execute(f"ALTER TABLE product ADD COLUMN {column_name} {column_type}")
                        print(f"[OK] Added column: {column_name}")
                    except sqlite3.Error as e:
                        print(f"[ERROR] Failed to add column {column_name}: {e}")
                else:
                    print(f"[SKIP] Column {column_name} already exists")
            
            conn.commit()
            
            # Verify all columns exist
            cursor.execute("PRAGMA table_info(product)")
            final_columns = [column[1] for column in cursor.fetchall()]
            print(f"[OK] Final columns: {', '.join(final_columns)}")
            
            conn.close()
            
        except sqlite3.Error as e:
            print(f"[ERROR] Database error in {db_path}: {e}")
        except Exception as e:
            print(f"[ERROR] Unexpected error in {db_path}: {e}")

if __name__ == '__main__':
    print("=" * 60)
    print("Migration: Add missing columns to product table")
    print("=" * 60)
    migrate_product_table()
    print("\n[OK] Migration completed!")


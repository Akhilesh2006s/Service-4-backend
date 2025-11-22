"""
Script to check which columns exist in the product table
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

def check_product_columns():
    """Check which columns exist in product table"""
    
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
            
            # Get all columns
            cursor.execute("PRAGMA table_info(product)")
            columns = cursor.fetchall()
            
            print(f"[INFO] Product table columns in {db_path}:")
            for col in columns:
                print(f"  - {col[1]} ({col[2]}) - Nullable: {not col[3]}, Default: {col[4]}")
            
            column_names = [col[1] for col in columns]
            print(f"\n[INFO] Column names: {', '.join(column_names)}")
            
            conn.close()
            
        except sqlite3.Error as e:
            print(f"[ERROR] Database error in {db_path}: {e}")
        except Exception as e:
            print(f"[ERROR] Unexpected error in {db_path}: {e}")

if __name__ == '__main__':
    print("=" * 60)
    print("Check Product Table Columns")
    print("=" * 60)
    check_product_columns()
    print("\n[OK] Check completed!")


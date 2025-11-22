"""
Diagnostic script to identify missing columns in product table
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

def diagnose_product_table():
    """Check product table schema and identify issues"""
    
    db_path = 'instance/app.db'
    if not os.path.exists(db_path):
        print(f"[ERROR] Database not found: {db_path}")
        return
    
    print(f"[INFO] Checking database: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all columns
        cursor.execute("PRAGMA table_info(product)")
        columns = cursor.fetchall()
        
        column_names = [col[1] for col in columns]
        print(f"\n[INFO] Existing columns in product table:")
        for col in columns:
            nullable = "NULL" if col[3] == 0 else "NOT NULL"
            default = f" DEFAULT {col[4]}" if col[4] else ""
            print(f"  - {col[1]} ({col[2]}) {nullable}{default}")
        
        # Expected columns from Product model
        expected_columns = [
            'id', 'name', 'description', 'sku', 'category', 'brand', 'hsn_code',
            'price', 'gst_rate', 'stock_quantity', 'min_stock_level', 'image_url',
            'weight', 'dimensions', 'is_active', 'created_at', 'updated_at',
            'admin_id', 'user_id'
        ]
        
        print(f"\n[INFO] Expected columns from Product model:")
        for col in expected_columns:
            if col in column_names:
                print(f"  ✓ {col}")
            else:
                print(f"  ✗ {col} - MISSING!")
        
        # Check for any issues
        missing = [col for col in expected_columns if col not in column_names]
        if missing:
            print(f"\n[ERROR] Missing columns: {', '.join(missing)}")
        else:
            print(f"\n[OK] All expected columns exist")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"[ERROR] Database error: {e}")
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")

if __name__ == '__main__':
    print("=" * 60)
    print("Diagnose Product Table Schema")
    print("=" * 60)
    diagnose_product_table()
    print("\n[OK] Diagnosis completed!")


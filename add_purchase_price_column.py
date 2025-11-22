"""
Migration script to add purchase_price column to product table
Run this once to add the purchase_price column to existing databases
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

def add_purchase_price_column():
    """Add purchase_price column to product table"""
    
    # Check both possible database locations
    db_paths = [
        'instance/app.db',
        'instance/gst_inventory.db',
        'app.db',
        'gst_inventory.db'
    ]
    
    for db_path in db_paths:
        if os.path.exists(db_path):
            try:
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                
                # Check if column already exists
                cursor.execute("PRAGMA table_info(product)")
                columns = [column[1] for column in cursor.fetchall()]
                
                if 'purchase_price' not in columns:
                    print(f"Adding purchase_price column to {db_path}...")
                    cursor.execute("ALTER TABLE product ADD COLUMN purchase_price REAL DEFAULT 0.0")
                    conn.commit()
                    print(f"✅ Successfully added purchase_price column to {db_path}")
                else:
                    print(f"✅ purchase_price column already exists in {db_path}")
                
                conn.close()
            except Exception as e:
                print(f"❌ Error updating {db_path}: {e}")

if __name__ == '__main__':
    add_purchase_price_column()
    print("\n✅ Migration complete!")



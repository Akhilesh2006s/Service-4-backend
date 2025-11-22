"""
Quick migration to add purchase_price column to product table
Run this script to add the missing column to your database
"""
import sqlite3
import os
import sys

# Fix encoding for Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

# Get the script's directory
script_dir = os.path.dirname(os.path.abspath(__file__))

# Database paths to check (relative to script directory)
db_paths = [
    os.path.join(script_dir, 'instance', 'app.db'),
    os.path.join(script_dir, 'instance', 'gst_inventory.db'),
    os.path.join(script_dir, 'app.db'),
    os.path.join(script_dir, 'gst_inventory.db')
]

def add_purchase_price_column():
    """Add purchase_price column to product table"""
    found_db = False
    
    for db_path in db_paths:
        if os.path.exists(db_path):
            found_db = True
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
                    print(f"Successfully added purchase_price column to {db_path}")
                else:
                    print(f"purchase_price column already exists in {db_path}")
                
                conn.close()
            except Exception as e:
                print(f"Error updating {db_path}: {e}")
    
    if not found_db:
        print("No database file found. Please check the database location.")
    else:
        print("\nMigration complete! Please restart your Flask server.")

if __name__ == '__main__':
    add_purchase_price_column()


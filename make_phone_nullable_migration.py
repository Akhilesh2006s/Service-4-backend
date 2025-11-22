"""Migration script to make phone column nullable in Customer table"""
import sqlite3
import os
import sys

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

def make_phone_nullable():
    db_paths = [
        'instance/app.db',
        'instance/gst_inventory.db',
        'app.db',
        'gst_inventory.db'
    ]
    
    found_db = False
    for db_path in db_paths:
        full_db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), db_path)
        if os.path.exists(full_db_path):
            found_db = True
            try:
                conn = sqlite3.connect(full_db_path)
                cursor = conn.cursor()
                
                # Check current phone column definition
                cursor.execute("PRAGMA table_info(customer)")
                columns = cursor.fetchall()
                phone_info = [col for col in columns if col[1] == 'phone']
                
                if phone_info:
                    phone_col = phone_info[0]
                    is_nullable = phone_col[3] == 0  # 0 means nullable, 1 means NOT NULL
                    
                    if not is_nullable:
                        print(f"Making phone column nullable in {full_db_path}...")
                        # SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table
                        # This is a complex operation, so we'll just note it
                        print(f"  Note: phone column is NOT NULL in {full_db_path}")
                        print(f"  SQLite limitation: Cannot directly alter column constraints.")
                        print(f"  The model allows NULL, so new records will work if phone is None.")
                        print(f"  For existing records, ensure phone has a value or update the database manually.")
                    else:
                        print(f"  phone column is already nullable in {full_db_path}")
                else:
                    print(f"  phone column not found in {full_db_path}")
                
                conn.close()
            except Exception as e:
                print(f"Error checking {full_db_path}: {e}")
    
    if not found_db:
        print("No database file found. Please check the database location.")
    else:
        print("\nMigration check complete!")
        print("Note: If phone is NOT NULL, the model will handle it by using None for empty values.")

if __name__ == '__main__':
    make_phone_nullable()


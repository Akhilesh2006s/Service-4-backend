"""Script to check database connection and tables"""
import sqlite3
import os
import sys

# Set UTF-8 encoding for output
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

def check_database():
    """Check both database files if they exist"""
    db_paths = ['instance/app.db', 'instance/gst_inventory.db']
    
    for db_path in db_paths:
        if os.path.exists(db_path):
            print(f"\n[OK] Database file exists: {db_path}")
            print(f"     File size: {os.path.getsize(db_path)} bytes")
            
            try:
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                
                # Get all tables
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = cursor.fetchall()
                
                if tables:
                    print(f"\n[OK] Database has {len(tables)} tables:")
                    total_rows = 0
                    for table in tables:
                        # Get row count for each table
                        try:
                            cursor.execute(f"SELECT COUNT(*) FROM {table[0]}")
                            count = cursor.fetchone()[0]
                            total_rows += count
                            status = " (preserved)" if 'super_admin' in table[0].lower() else ""
                            print(f"     - {table[0]}: {count} rows{status}")
                        except Exception as e:
                            print(f"     - {table[0]}: (error reading count - {e})")
                    print(f"\n     Total records: {total_rows}")
                else:
                    print("\n[WARNING] Database exists but has no tables")
                
                conn.close()
            except Exception as e:
                print(f"[ERROR] Error reading database: {e}")
        else:
            print(f"\n[INFO] Database file does not exist: {db_path}")
    
    if not any(os.path.exists(p) for p in db_paths):
        print("\n[ERROR] No database files found")
        print("        Run 'python create_tables.py' to create the database")

if __name__ == '__main__':
    check_database()


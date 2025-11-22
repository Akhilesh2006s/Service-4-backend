"""Migration script to add new fields to Customer table"""
import sqlite3
import os
import sys

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

def add_customer_fields():
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
                
                # Get existing columns
                cursor.execute("PRAGMA table_info(customer)")
                columns = {column[1]: column for column in cursor.fetchall()}
                
                # Add new columns if they don't exist
                new_columns = [
                    ('company_name', 'VARCHAR(200)'),
                    ('bank_name', 'VARCHAR(200)'),
                    ('bank_account_number', 'VARCHAR(50)'),
                    ('bank_ifsc', 'VARCHAR(20)'),
                    ('opening_balance', 'REAL DEFAULT 0.0'),
                    ('opening_balance_type', 'VARCHAR(10) DEFAULT "debit"'),
                    ('credit_limit', 'REAL DEFAULT 0.0'),
                    ('discount', 'REAL DEFAULT 0.0'),
                    ('notes', 'TEXT'),
                    ('tags', 'VARCHAR(500)'),
                    ('cc_emails', 'VARCHAR(500)')
                ]
                
                for column_name, column_type in new_columns:
                    if column_name not in columns:
                        print(f"Adding {column_name} column to {full_db_path}...")
                        try:
                            cursor.execute(f"ALTER TABLE customer ADD COLUMN {column_name} {column_type}")
                            conn.commit()
                            print(f"✓ Successfully added {column_name} column to {full_db_path}")
                        except Exception as e:
                            print(f"✗ Error adding {column_name} to {full_db_path}: {e}")
                    else:
                        print(f"  {column_name} column already exists in {full_db_path}")
                
                # Make phone nullable if it's not already
                try:
                    cursor.execute("PRAGMA table_info(customer)")
                    phone_info = [col for col in cursor.fetchall() if col[1] == 'phone']
                    if phone_info and phone_info[0][3] == 1:  # If NOT NULL
                        print(f"Note: phone column is NOT NULL in {full_db_path}. Consider making it nullable if needed.")
                except:
                    pass
                
                conn.close()
            except Exception as e:
                print(f"Error updating {full_db_path}: {e}")
    
    if not found_db:
        print("No database file found. Please check the database location.")
    else:
        print("\nMigration complete! Please restart your Flask server.")

if __name__ == '__main__':
    add_customer_fields()


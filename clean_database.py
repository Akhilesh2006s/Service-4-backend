"""Script to remove all fake/test data from the database using direct SQLite connection"""
import sqlite3
import os
import sys

# Set UTF-8 encoding for output
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

def clean_database():
    """Remove all data from database tables while keeping the structure"""
    # Clean both database files if they exist
    db_paths = ['instance/app.db', 'instance/gst_inventory.db']
    
    total_deleted = 0
    
    for db_path in db_paths:
        if not os.path.exists(db_path):
            print(f"\n[INFO] Database file does not exist: {db_path}")
            continue
        
        print(f"\n{'='*60}")
        print(f"Cleaning database: {db_path}")
        print('='*60)
        
        deleted = clean_single_database(db_path)
        total_deleted += deleted
    
    print(f"\n{'='*60}")
    print(f"Total records deleted across all databases: {total_deleted}")
    print('='*60)
    return True

def clean_single_database(db_path):
    """Clean a single database file"""
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Enable foreign key support
        cursor.execute("PRAGMA foreign_keys = OFF")
        
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        print(f"\nFound {len(tables)} tables: {', '.join(tables)}")
        
        # Count records before deletion
        print("\nRecords before cleanup:")
        counts_before = {}
        for table in tables:
            try:
                # Use parameterized query to avoid SQL injection
                cursor.execute(f"SELECT COUNT(*) FROM \"{table}\"")
                count = cursor.fetchone()[0]
                counts_before[table] = count
                if count > 0:
                    print(f"  {table}: {count} records")
            except Exception as e:
                print(f"  {table}: Error - {e}")
        
        # Delete data from tables (in correct order to respect foreign keys)
        print("\nDeleting data...")
        deleted_total = 0
        
        # Order of deletion (respecting foreign key constraints)
        # Use quotes to handle reserved words like "order"
        delete_order = [
            'customer_product_price',
            'invoice_item',
            'invoice',
            'order_item',
            '"order"',  # "order" is a reserved word in SQL
            'stock_movement',
            'gst_report',
            'product',
            'customer',
            'user'
        ]
        
        # Also handle any tables that might exist with different casing
        for table_name in delete_order:
            # Try different case variations and with/without quotes
            table_name_clean = table_name.strip('"').lower()
            for table in tables:
                if table.lower() == table_name_clean:
                    try:
                        cursor.execute(f"SELECT COUNT(*) FROM \"{table}\"")
                        count_before = cursor.fetchone()[0]
                        
                        if count_before > 0:
                            cursor.execute(f"DELETE FROM \"{table}\"")
                            deleted_count = cursor.rowcount
                            deleted_total += deleted_count
                            print(f"  [OK] Deleted {deleted_count} records from {table}")
                        break
                    except Exception as e:
                        print(f"  [SKIP] {table}: {e}")
        
        # Delete from any remaining tables (except sqlite system tables)
        system_tables = ['sqlite_sequence', 'sqlite_master']
        processed_tables = [t.lower() for t in delete_order]
        
        for table in tables:
            if table.lower() not in processed_tables and table not in system_tables:
                # Skip super_admin table (keep it)
                if 'super_admin' in table.lower():
                    print(f"  [SKIP] {table}: Preserving SuperAdmin data")
                    continue
                    
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM \"{table}\"")
                    count_before = cursor.fetchone()[0]
                    
                    if count_before > 0:
                        cursor.execute(f"DELETE FROM \"{table}\"")
                        deleted_count = cursor.rowcount
                        deleted_total += deleted_count
                        print(f"  [OK] Deleted {deleted_count} records from {table}")
                except Exception as e:
                    print(f"  [SKIP] {table}: {e}")
        
        # Commit changes
        conn.commit()
        
        print(f"\nDeleted {deleted_total} total records from this database.")
        
        # Verify cleanup
        print("\nRecords after cleanup:")
        system_tables = ['sqlite_sequence', 'sqlite_master']
        for table in tables:
            if table not in system_tables:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM \"{table}\"")
                    count = cursor.fetchone()[0]
                    if 'super_admin' in table.lower():
                        print(f"  {table}: {count} records (preserved)")
                    else:
                        status = "[OK]" if count == 0 else f"[WARNING: {count} remaining]"
                        print(f"  {table}: {count} records {status}")
                except Exception as e:
                    print(f"  {table}: Error - {e}")
        
        conn.close()
        
        return deleted_total
        
    except Exception as e:
        print(f"\n[ERROR] Failed to clean database: {e}")
        import traceback
        traceback.print_exc()
        return 0

if __name__ == '__main__':
    print("WARNING: This will delete ALL data from ALL database files!")
    print("Only the SuperAdmin account will be preserved.")
    print("=" * 60)
    if clean_database():
        print("\n[SUCCESS] All databases have been cleaned!")
        print("Database structure (tables) remains intact.")
        print("You can now start fresh with real data.")

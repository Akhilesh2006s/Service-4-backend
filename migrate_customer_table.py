"""
Comprehensive migration script to update customer table schema
Adds all missing columns to match the Customer model definition
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app import create_app
from database import db

def migrate_customer_table():
    """Add all missing columns to customer table"""
    app = create_app()
    
    with app.app_context():
        try:
            # Get current table structure
            result = db.session.execute(db.text("PRAGMA table_info(customer)")).fetchall()
            existing_columns = {row[1]: row for row in result}
            print(f"[INFO] Current customer table has {len(existing_columns)} columns")
            print(f"[INFO] Existing columns: {list(existing_columns.keys())}")
            
            # Define required columns based on the model
            required_columns = {
                'gstin': 'VARCHAR(15)',
                'billing_address': 'TEXT',
                'shipping_address': 'TEXT',
                'state': 'VARCHAR(50)',
                'pincode': 'VARCHAR(10)'
            }
            
            # Check which columns are missing
            missing_columns = []
            for col_name, col_type in required_columns.items():
                if col_name not in existing_columns:
                    missing_columns.append((col_name, col_type))
                    print(f"[INFO] Missing column: {col_name}")
            
            if not missing_columns:
                print("[OK] All required columns already exist in customer table")
                return
            
            # Add missing columns
            print(f"[INFO] Adding {len(missing_columns)} missing columns...")
            
            for col_name, col_type in missing_columns:
                try:
                    # SQLite allows adding columns with ALTER TABLE
                    sql = f"ALTER TABLE customer ADD COLUMN {col_name} {col_type}"
                    db.session.execute(db.text(sql))
                    db.session.commit()
                    print(f"[OK] Added column: {col_name}")
                except Exception as e:
                    db.session.rollback()
                    error_msg = str(e).lower()
                    if "duplicate" in error_msg or "already exists" in error_msg:
                        print(f"[INFO] Column {col_name} already exists (or similar column exists)")
                    else:
                        print(f"[ERROR] Failed to add column {col_name}: {e}")
                        raise
            
            # Handle data migration for address field if it exists
            if 'address' in existing_columns and 'billing_address' not in existing_columns:
                # This case is already handled above, but check if we need to migrate data
                try:
                    # Check if there are rows with address but no billing_address
                    result = db.session.execute(
                        db.text("SELECT COUNT(*) FROM customer WHERE address IS NOT NULL AND (billing_address IS NULL OR billing_address = '')")
                    ).scalar()
                    
                    if result > 0:
                        print(f"[INFO] Migrating data from 'address' to 'billing_address' for {result} rows...")
                        db.session.execute(
                            db.text("UPDATE customer SET billing_address = address WHERE billing_address IS NULL OR billing_address = ''")
                        )
                        db.session.commit()
                        print("[OK] Data migration completed")
                except Exception as e:
                    print(f"[WARNING] Could not migrate address data: {e}")
            
            # Verify all columns exist
            result = db.session.execute(db.text("PRAGMA table_info(customer)")).fetchall()
            final_columns = [row[1] for row in result]
            
            all_present = all(col in final_columns for col in required_columns.keys())
            
            if all_present:
                print("[OK] All required columns are now present in customer table")
                print(f"[INFO] Final columns: {final_columns}")
            else:
                missing = [col for col in required_columns.keys() if col not in final_columns]
                print(f"[WARNING] Some columns are still missing: {missing}")
            
            print("[OK] Migration completed successfully!")
            
        except Exception as e:
            db.session.rollback()
            print(f"[ERROR] Error during migration: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    migrate_customer_table()


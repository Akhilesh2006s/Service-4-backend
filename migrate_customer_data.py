"""
Migrate data from old 'address' column to new 'billing_address' column
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app import create_app
from database import db

def migrate_customer_data():
    """Migrate data from address to billing_address"""
    app = create_app()
    
    with app.app_context():
        try:
            # Check if address column exists
            result = db.session.execute(db.text("PRAGMA table_info(customer)")).fetchall()
            columns = [row[1] for row in result]
            
            if 'address' not in columns:
                print("[INFO] 'address' column does not exist, skipping data migration")
                return
            
            # Count rows that need migration
            count = db.session.execute(
                db.text("SELECT COUNT(*) FROM customer WHERE (address IS NOT NULL AND address != '') AND (billing_address IS NULL OR billing_address = '')")
            ).scalar()
            
            if count == 0:
                print("[OK] No data migration needed")
                return
            
            print(f"[INFO] Migrating data for {count} customer(s)...")
            
            # Migrate address to billing_address
            db.session.execute(
                db.text("UPDATE customer SET billing_address = address WHERE (billing_address IS NULL OR billing_address = '') AND (address IS NOT NULL AND address != '')")
            )
            db.session.commit()
            
            print(f"[OK] Migrated {count} customer record(s)")
            
            # Also set default values for required fields that might be NULL
            # Set empty strings for required fields that are NULL
            updates = []
            
            # Check for NULL billing_address (required field)
            null_billing = db.session.execute(
                db.text("SELECT COUNT(*) FROM customer WHERE billing_address IS NULL OR billing_address = ''")
            ).scalar()
            
            if null_billing > 0:
                db.session.execute(
                    db.text("UPDATE customer SET billing_address = 'Not provided' WHERE billing_address IS NULL OR billing_address = ''")
                )
                updates.append(f"billing_address: {null_billing} rows")
            
            # Check for NULL state (required field)
            null_state = db.session.execute(
                db.text("SELECT COUNT(*) FROM customer WHERE state IS NULL OR state = ''")
            ).scalar()
            
            if null_state > 0:
                db.session.execute(
                    db.text("UPDATE customer SET state = 'Not provided' WHERE state IS NULL OR state = ''")
                )
                updates.append(f"state: {null_state} rows")
            
            # Check for NULL pincode (required field)
            null_pincode = db.session.execute(
                db.text("SELECT COUNT(*) FROM customer WHERE pincode IS NULL OR pincode = ''")
            ).scalar()
            
            if null_pincode > 0:
                db.session.execute(
                    db.text("UPDATE customer SET pincode = '000000' WHERE pincode IS NULL OR pincode = ''")
                )
                updates.append(f"pincode: {null_pincode} rows")
            
            if updates:
                db.session.commit()
                print(f"[OK] Set default values for: {', '.join(updates)}")
            
            print("[OK] Data migration completed successfully!")
            
        except Exception as e:
            db.session.rollback()
            print(f"[ERROR] Error during data migration: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    migrate_customer_data()


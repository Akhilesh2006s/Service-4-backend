"""
Script to add user_id column to customer table
This migration adds the missing user_id column and assigns existing customers to the first admin user
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app import create_app
from database import db

def add_user_id_column():
    """Add user_id column to customer table"""
    app = create_app()
    
    with app.app_context():
        try:
            # Check if column already exists using raw SQL
            try:
                db.session.execute(db.text("SELECT user_id FROM customer LIMIT 1"))
                print("[OK] user_id column already exists in customer table")
                return
            except Exception:
                pass  # Column doesn't exist, continue
            
            print("[INFO] Adding user_id column to customer table...")
            
            # Use raw SQL to add the column (SQLite supports ADD COLUMN)
            db.session.execute(db.text("ALTER TABLE customer ADD COLUMN user_id INTEGER"))
            db.session.commit()
            print("[OK] Added user_id column to customer table")
            
            # Get the first user ID from the user table using raw SQL
            try:
                result = db.session.execute(
                    db.text("SELECT id FROM user LIMIT 1")
                ).fetchone()
                
                if result:
                    first_user_id = result[0]
                    print(f"[INFO] Found first user ID: {first_user_id}")
                    
                    # Update all existing customers to have the first user's user_id
                    db.session.execute(
                        db.text("UPDATE customer SET user_id = :user_id WHERE user_id IS NULL"),
                        {"user_id": first_user_id}
                    )
                    db.session.commit()
                    print(f"[OK] Assigned all existing customers to user {first_user_id}")
                else:
                    print("[WARNING] No users found in database. Setting user_id to NULL for existing customers.")
                    print("[WARNING] You may need to update customer.user_id values manually after creating a user.")
            except Exception as e:
                print(f"[WARNING] Could not assign user_id to existing customers: {e}")
                print("[INFO] Column added but existing customers have NULL user_id")
            
            # Verify the update
            try:
                customers_without_user = db.session.execute(
                    db.text("SELECT COUNT(*) FROM customer WHERE user_id IS NULL")
                ).scalar()
                
                if customers_without_user == 0:
                    print("[OK] All customers now have a user_id assigned")
                else:
                    print(f"[WARNING] {customers_without_user} customers still don't have user_id")
            except Exception:
                pass
            
            print("[OK] Migration completed successfully!")
            
        except Exception as e:
            db.session.rollback()
            print(f"[ERROR] Error during migration: {e}")
            import traceback
            traceback.print_exc()
            # Check if column already exists
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                print("[INFO] Column might already exist. Checking...")
                try:
                    # Try to query with user_id
                    db.session.execute(db.text("SELECT user_id FROM customer LIMIT 1"))
                    print("[OK] Column exists and is accessible")
                except Exception as e2:
                    print(f"[ERROR] Column exists but has issues: {e2}")

if __name__ == '__main__':
    add_user_id_column()


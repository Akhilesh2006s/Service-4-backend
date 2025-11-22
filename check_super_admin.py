"""
Script to check Super Admin details in the database
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app import create_app
from database import db
from models import SuperAdmin

def check_super_admin():
    """Check Super Admin details"""
    app = create_app()
    
    with app.app_context():
        try:
            # Check if super_admin table exists
            try:
                result = db.session.execute(
                    db.text("SELECT name FROM sqlite_master WHERE type='table' AND name='super_admin'")
                ).fetchone()
                
                if not result:
                    print("[WARNING] super_admin table does not exist!")
                    print("[INFO] You may need to run: python create_tables.py")
                    return
            except Exception as e:
                print(f"[ERROR] Error checking table: {e}")
                return
            
            # Get all super admins
            try:
                # Use raw SQL to avoid model issues
                result = db.session.execute(
                    db.text("SELECT id, email, name, created_at FROM super_admin")
                ).fetchall()
                
                if not result:
                    print("[INFO] No Super Admin found in database")
                    print("\n[INFO] To create Super Admin, run one of these:")
                    print("  - python setup_super_admin.py")
                    print("  - python create_tables.py")
                    print("\n[INFO] Default credentials (from setup_super_admin.py):")
                    print("  Email: akhileshsamayamanthula@gmail.com")
                    print("  Password: Akhilesh")
                    print("  Name: Akhilesh Samayamanthula")
                    return
                
                print("=" * 60)
                print("SUPER ADMIN DETAILS")
                print("=" * 60)
                
                for row in result:
                    admin_id, email, name, created_at = row
                    print(f"\nID: {admin_id}")
                    print(f"Email: {email}")
                    print(f"Name: {name}")
                    print(f"Created At: {created_at}")
                    print("-" * 60)
                
                print("\n[INFO] Login endpoint: /api/super-admin/login")
                print("[INFO] Use POST request with JSON:")
                print('  {"email": "...", "password": "..."}')
                
            except Exception as e:
                print(f"[ERROR] Error querying Super Admin: {e}")
                import traceback
                traceback.print_exc()
                
                # Try to get column info
                try:
                    result = db.session.execute(
                        db.text("PRAGMA table_info(super_admin)")
                    ).fetchall()
                    columns = [row[1] for row in result]
                    print(f"\n[INFO] super_admin table columns: {columns}")
                except:
                    pass
                
        except Exception as e:
            print(f"[ERROR] {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    check_super_admin()


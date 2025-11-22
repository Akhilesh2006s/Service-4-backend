"""
Script to update/create Super Admin with new credentials
Email: madhavchelluri57@gmail.com
Password: 12345678
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app import create_app
from database import db
from models import SuperAdmin

def update_super_admin():
    """Update or create Super Admin with new credentials"""
    app = create_app()
    
    with app.app_context():
        try:
            # Check if super admin exists
            super_admin = SuperAdmin.query.filter_by(email='madhavchelluri57@gmail.com').first()
            
            if super_admin:
                # Update existing super admin
                super_admin.name = 'Super Admin'
                super_admin.set_password('12345678')
                super_admin.is_active = True
                db.session.commit()
                print("[OK] Super Admin updated successfully!")
                print("Email: madhavchelluri57@gmail.com")
                print("Password: 12345678")
            else:
                # Create new super admin
                super_admin = SuperAdmin(
                    email='madhavchelluri57@gmail.com',
                    name='Super Admin'
                )
                super_admin.set_password('12345678')
                super_admin.is_active = True
                db.session.add(super_admin)
                db.session.commit()
                print("[OK] Super Admin created successfully!")
                print("Email: madhavchelluri57@gmail.com")
                print("Password: 12345678")
            
            # Verify the super admin
            verified = SuperAdmin.query.filter_by(email='madhavchelluri57@gmail.com').first()
            if verified and verified.check_password('12345678'):
                print("[OK] Super Admin credentials verified!")
                print(f"[INFO] Super Admin ID: {verified.id}")
                print(f"[INFO] Super Admin Name: {verified.name}")
                print(f"[INFO] Super Admin Email: {verified.email}")
                print(f"[INFO] Super Admin Active: {verified.is_active}")
            else:
                print("[ERROR] Super Admin credentials verification failed!")
            
            print("\n[INFO] Super Admin can approve/reject admin registrations at:")
            print("  - GET /api/super-admin/dashboard (view pending/approved admins)")
            print("  - POST /api/super-admin/approve-admin/<admin_id> (approve admin)")
            print("  - POST /api/super-admin/reject-admin/<admin_id> (reject admin)")
            print("\n[INFO] Login endpoint: POST /api/super-admin/login")
            print('  Body: {"email": "madhavchelluri57@gmail.com", "password": "12345678"}')
            
        except Exception as e:
            db.session.rollback()
            print(f"[ERROR] Error updating Super Admin: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    update_super_admin()


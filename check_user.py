#!/usr/bin/env python3
"""
Script to check if a user exists in the database and verify account status
"""
from app import create_app, db
from models import User

def check_user(email):
    """Check user details"""
    app = create_app()
    with app.app_context():
        user = User.query.filter_by(email=email).first()
        
        if not user:
            print(f"[X] No user found with email: {email}")
            print("\n[TIP] You may need to register first using the registration endpoint.")
            return False
        
        print(f"[OK] User found!")
        print(f"   ID: {user.id}")
        print(f"   Username: {user.username}")
        print(f"   Email: {user.email}")
        print(f"   Business Name: {user.business_name}")
        print(f"   Is Active: {user.is_active}")
        print(f"   Is Approved: {user.is_approved}")
        print(f"   Created At: {user.created_at}")
        
        if not user.is_active:
            print("\n[WARNING] User account is not active!")
        
        if not user.is_approved:
            print("\n[WARNING] User account is not approved!")
            print("   (This may not block login depending on your settings)")
        
        return True

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: python check_user.py <email>")
        print("\nExample: python check_user.py amenityforge@gmail.com")
        sys.exit(1)
    
    email = sys.argv[1]
    check_user(email)


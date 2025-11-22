#!/usr/bin/env python3
"""
Script to reset a user's password
"""
from app import create_app, db
from models import User

def reset_password(email, new_password):
    """Reset user password"""
    app = create_app()
    with app.app_context():
        user = User.query.filter_by(email=email).first()
        
        if not user:
            print(f"[X] No user found with email: {email}")
            return False
        
        # Set new password
        user.set_password(new_password)
        db.session.commit()
        
        print(f"[OK] Password reset successfully for user: {email}")
        print(f"   Username: {user.username}")
        return True

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 3:
        print("Usage: python reset_password.py <email> <new_password>")
        print("\nExample: python reset_password.py amenityforge@gmail.com MyNewPassword123")
        sys.exit(1)
    
    email = sys.argv[1]
    new_password = sys.argv[2]
    reset_password(email, new_password)


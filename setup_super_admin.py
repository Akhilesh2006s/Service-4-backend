#!/usr/bin/env python3
"""
Setup script to create the super admin
"""

import sys
import os

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from database import db
from models import SuperAdmin

def create_super_admin():
    """Create the super admin user"""
    app = create_app()
    
    with app.app_context():
        # Check if super admin already exists
        existing_super_admin = SuperAdmin.query.filter_by(email='madhavchelluri57@gmail.com').first()
        
        if existing_super_admin:
            # Update password if exists
            existing_super_admin.set_password('12345678')
            db.session.commit()
            print("Super admin already exists! Password updated.")
            print("Email: madhavchelluri57@gmail.com")
            print("Password: 12345678")
            return
        
        # Create super admin
        super_admin = SuperAdmin(
            email='madhavchelluri57@gmail.com',
            name='Super Admin'
        )
        super_admin.set_password('12345678')
        
        db.session.add(super_admin)
        db.session.commit()
        
        print("Super admin created successfully!")
        print("Email: madhavchelluri57@gmail.com")
        print("Password: 12345678")

if __name__ == '__main__':
    create_super_admin()



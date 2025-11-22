#!/usr/bin/env python3
"""
Deployment script for GST Billing System
"""

import os
import sys
from app import create_app
from database import db
from models import User, Customer, Product, SuperAdmin

def init_database():
    """Initialize database and create tables"""
    app = create_app('production')
    
    with app.app_context():
        # Create all tables
        db.create_all()
        
        # Create super admin if not exists
        super_admin = SuperAdmin.query.filter_by(email='madhavchelluri57@gmail.com').first()
        if not super_admin:
            super_admin = SuperAdmin(
                email='madhavchelluri57@gmail.com',
                name='Super Admin'
            )
            super_admin.set_password('12345678')
            db.session.add(super_admin)
            db.session.commit()
            print("✅ Super admin created: madhavchelluri57@gmail.com / 12345678")
        else:
            # Update password if exists
            super_admin.set_password('12345678')
            db.session.commit()
            print("✅ Super admin password updated: madhavchelluri57@gmail.com / 12345678")
        
        print("✅ Database initialized successfully!")

if __name__ == '__main__':
    init_database()

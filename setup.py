#!/usr/bin/env python3
"""
Setup script for GST Billing System
This script initializes the database and creates necessary directories.
"""

import os
import sys
from flask import Flask
from config import config
from database import init_app, db
from models import User

def create_app():
    """Create Flask app for setup"""
    app = Flask(__name__)
    app.config.from_object(config['development'])
    init_app(app)
    return app

def setup_database():
    """Initialize database tables"""
    print("Setting up database...")
    app = create_app()
    
    with app.app_context():
        # Create all tables
        db.create_all()
        print("✓ Database tables created successfully")
        
        # Create upload directory
        upload_dir = app.config['UPLOAD_FOLDER']
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir)
            print(f"✓ Created upload directory: {upload_dir}")
        
        print("✓ Database setup completed")

def create_sample_data():
    """Create sample data for testing"""
    print("\nCreating sample data...")
    app = create_app()
    
    with app.app_context():
        # Check if admin user exists
        admin = User.query.filter_by(username='admin').first()
        if not admin:
            admin = User(
                username='admin',
                email='admin@example.com',
                business_name='Sample Business',
                gst_number='22AAAAA0000A1Z5',
                business_address='123 Business Street, City, State - 123456',
                business_phone='9876543210',
                business_email='admin@example.com',
                business_state='Maharashtra',
                business_pincode='123456'
            )
            admin.set_password('admin123')
            db.session.add(admin)
            db.session.commit()
            print("✓ Created admin user (username: admin, password: admin123)")
        else:
            print("✓ Admin user already exists")
        
        print("✓ Sample data created")

def main():
    """Main setup function"""
    print("🚀 GST Billing System Setup")
    print("=" * 40)
    
    try:
        setup_database()
        create_sample_data()
        
        print("\n" + "=" * 40)
        print("✅ Setup completed successfully!")
        print("\nNext steps:")
        print("1. Install dependencies: pip install -r requirements.txt")
        print("2. Run the application: python app.py")
        print("3. Open browser and go to: http://localhost:5000")
        print("4. Login with admin/admin123 or register a new account")
        
    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()


from app import create_app
from database import db
from models import User, Customer, Product, Invoice, InvoiceItem, StockMovement, GSTReport, SuperAdmin, Order, OrderItem, CustomerProductPrice

app = create_app()

with app.app_context():
    # Create all tables
    db.create_all()
    print("All database tables created successfully!")
    
    # Check if super admin exists
    from models import SuperAdmin
    existing_super_admin = SuperAdmin.query.filter_by(email='madhavchelluri57@gmail.com').first()
    
    if not existing_super_admin:
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
    else:
        # Update password if exists
        existing_super_admin.set_password('12345678')
        db.session.commit()
        print("Super admin already exists! Password updated.")
        print("Email: madhavchelluri57@gmail.com")
        print("Password: 12345678")



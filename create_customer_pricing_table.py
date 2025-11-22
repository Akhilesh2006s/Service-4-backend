"""
Script to create CustomerProductPrice table in the database
Run this after updating models.py to add the new table
"""
from app import create_app
from database import db
from models import CustomerProductPrice

app = create_app()

with app.app_context():
    # Create the CustomerProductPrice table
    try:
        db.create_all()
        print("✅ CustomerProductPrice table created successfully!")
        
        # Check if table exists
        if db.engine.dialect.has_table(db.engine, 'customer_product_price'):
            print("✅ Table 'customer_product_price' exists in database")
        else:
            print("❌ Table 'customer_product_price' does not exist")
    except Exception as e:
        print(f"❌ Error creating table: {e}")
        import traceback
        traceback.print_exc()


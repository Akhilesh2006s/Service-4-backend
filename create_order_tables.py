"""
Script to create Order and OrderItem tables
Note: 'order' is a SQL reserved word, so we need to handle it carefully
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app import create_app
from database import db
from models import Order, OrderItem

def create_order_tables():
    """Create Order and OrderItem tables"""
    app = create_app()
    
    with app.app_context():
        try:
            # Check if order table exists
            try:
                db.session.execute(db.text("SELECT 1 FROM \"order\" LIMIT 1"))
                print("[INFO] Order table already exists")
            except Exception:
                print("[INFO] Order table does not exist, creating...")
                # Create the table using SQLAlchemy
                Order.__table__.create(db.engine, checkfirst=True)
                print("[OK] Order table created successfully")
            
            # Check if order_item table exists
            try:
                db.session.execute(db.text("SELECT 1 FROM order_item LIMIT 1"))
                print("[INFO] OrderItem table already exists")
            except Exception:
                print("[INFO] OrderItem table does not exist, creating...")
                # Create the table using SQLAlchemy
                OrderItem.__table__.create(db.engine, checkfirst=True)
                print("[OK] OrderItem table created successfully")
            
            # Verify tables exist
            result = db.session.execute(db.text("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('order', 'order_item')")).fetchall()
            tables = [row[0] for row in result]
            
            if 'order' in tables:
                print("[OK] Order table verified")
            else:
                print("[ERROR] Order table not found after creation")
            
            if 'order_item' in tables:
                print("[OK] OrderItem table verified")
            else:
                print("[ERROR] OrderItem table not found after creation")
            
            print("[OK] Migration completed successfully!")
            
        except Exception as e:
            db.session.rollback()
            print(f"[ERROR] Error during migration: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    create_order_tables()


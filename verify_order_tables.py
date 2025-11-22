"""Verify that Order and OrderItem tables exist and can be queried"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app import create_app
from database import db
from models import Order, OrderItem

app = create_app()

with app.app_context():
    try:
        # Check if tables exist
        result = db.session.execute(
            db.text("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('order', 'order_item')")
        ).fetchall()
        tables = [row[0] for row in result]
        
        print("Found tables:", tables)
        
        if 'order' in tables:
            print("[OK] Order table exists")
            
            # Try to query the table
            try:
                count = db.session.execute(db.text('SELECT COUNT(*) FROM "order"')).scalar()
                print(f"[OK] Can query Order table (count: {count})")
            except Exception as e:
                print(f"[ERROR] Cannot query Order table: {e}")
        else:
            print("[ERROR] Order table does not exist")
        
        if 'order_item' in tables:
            print("[OK] OrderItem table exists")
            
            # Try to query the table
            try:
                count = db.session.execute(db.text("SELECT COUNT(*) FROM order_item")).scalar()
                print(f"[OK] Can query OrderItem table (count: {count})")
            except Exception as e:
                print(f"[ERROR] Cannot query OrderItem table: {e}")
        else:
            print("[ERROR] OrderItem table does not exist")
        
        # Try using SQLAlchemy ORM
        try:
            order_count = Order.query.count()
            print(f"[OK] Can query Order model (count: {order_count})")
        except Exception as e:
            print(f"[ERROR] Cannot query Order model: {e}")
        
        try:
            item_count = OrderItem.query.count()
            print(f"[OK] Can query OrderItem model (count: {item_count})")
        except Exception as e:
            print(f"[ERROR] Cannot query OrderItem model: {e}")
            
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()


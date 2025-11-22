#!/usr/bin/env python3
"""
Test script to generate an invoice from an order
"""
from app import create_app
from database import db
from models import Order, Invoice, InvoiceItem
from datetime import datetime, timedelta
import uuid

def test_generate_invoice():
    """Test generating an invoice from an order"""
    app = create_app()
    
    with app.app_context():
        try:
            # Get the first order
            order = Order.query.first()
            if not order:
                print("❌ No orders found in database")
                return
            
            print(f"📋 Testing with order: {order.order_number}")
            print(f"👤 Customer: {order.customer.name}")
            print(f"📦 Items: {len(order.items)}")
            print(f"💰 Total: ₹{order.total_amount}")
            
            # Check if invoice already exists for this order
            existing_invoice = Invoice.query.filter_by(order_id=order.id).first()
            if existing_invoice:
                print(f"⚠️  Invoice already exists: {existing_invoice.invoice_number}")
                return
            
            # Generate invoice number
            invoice_number = f"INV-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
            
            # Create invoice
            invoice = Invoice(
                user_id=order.customer.user_id,  # Admin user ID
                customer_id=order.customer_id,
                order_id=order.id,
                invoice_number=invoice_number,
                invoice_date=datetime.now().date(),
                due_date=(datetime.now() + timedelta(days=30)).date(),
                subtotal=order.total_amount,
                total_amount=order.total_amount,
                status='pending',
                notes=f"Invoice generated from order {order.order_number}"
            )
            
            db.session.add(invoice)
            db.session.flush()  # Get invoice ID
            
            print(f"📄 Created invoice: {invoice.invoice_number}")
            
            # Add invoice items from order items
            for order_item in order.items:
                # Calculate GST (assuming 18% for now)
                gst_rate = 18.0
                item_total = order_item.quantity * order_item.unit_price
                gst_amount = item_total * (gst_rate / 100)
                
                invoice_item = InvoiceItem(
                    invoice_id=invoice.id,
                    product_id=order_item.product_id,
                    quantity=order_item.quantity,
                    unit_price=order_item.unit_price,
                    gst_rate=gst_rate,
                    gst_amount=gst_amount,
                    total=item_total
                )
                db.session.add(invoice_item)
                
                print(f"  📦 Added item: {order_item.product.name if order_item.product else 'Unknown'} x {order_item.quantity}")
            
            # Calculate invoice totals
            invoice.calculate_totals()
            
            db.session.commit()
            
            print(f"✅ Invoice generated successfully!")
            print(f"📄 Invoice Number: {invoice.invoice_number}")
            print(f"💰 Total Amount: ₹{invoice.total_amount}")
            print(f"📅 Due Date: {invoice.due_date}")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error generating invoice: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test_generate_invoice()

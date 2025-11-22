from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from models import db, Customer, Order, OrderItem, Product, Invoice, InvoiceItem
from datetime import datetime, timedelta
import uuid

admin_bp = Blueprint('admin', __name__)

# Customer Management Routes
@admin_bp.route('/customers', methods=['GET'])
@login_required
def get_customers():
    """Get all customers for the current admin (both active and inactive)"""
    try:
        # Debug: Check authentication status
        print(f"[DEBUG] Current user: {current_user}")
        print(f"[DEBUG] Current user type: {type(current_user)}")
        print(f"[DEBUG] Has id attr: {hasattr(current_user, 'id') if current_user else False}")
        
        # Check if user is authenticated
        if not current_user:
            print("[DEBUG] No current_user - returning 401")
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        if not hasattr(current_user, 'id'):
            print("[DEBUG] current_user has no id attribute - returning 401")
            return jsonify({'success': False, 'error': 'User not authenticated - missing id'}), 401
        
        print(f"[DEBUG] User ID: {current_user.id}")
        
        # Show all customers so admin can see everyone, including those who registered via customer login
        # This includes customers created by admin and customers who registered through customer login
        # Filter by user_id if it exists, otherwise show all
        try:
            from sqlalchemy import or_
            # Get customers that belong to this user OR have no user_id (for backward compatibility)
            customers = Customer.query.filter(
                or_(
                    Customer.user_id == current_user.id,
                    Customer.user_id.is_(None)
                )
            ).all()
        except Exception as query_error:
            print(f"Query error: {str(query_error)}")
            # Fallback: try to get all customers
            try:
                customers = Customer.query.all()
            except Exception as fallback_error:
                print(f"Fallback query error: {str(fallback_error)}")
                customers = []
        
        customers_data = []
        
        for customer in customers:
            try:
                # Safely access all fields with null checks
                customers_data.append({
                    'id': customer.id,
                    'name': getattr(customer, 'name', '') or '',
                    'email': getattr(customer, 'email', '') or '',
                    'phone': getattr(customer, 'phone', '') or '',
                    'billing_address': getattr(customer, 'billing_address', '') or '',
                    'shipping_address': getattr(customer, 'shipping_address', '') or '',
                    'state': getattr(customer, 'state', '') or '',
                    'pincode': getattr(customer, 'pincode', '') or '',
                    'gstin': getattr(customer, 'gstin', '') or '',
                    'company_name': getattr(customer, 'company_name', '') or '',
                    'created_at': customer.created_at.isoformat() if customer.created_at else datetime.utcnow().isoformat(),
                    'is_active': getattr(customer, 'is_active', True) if getattr(customer, 'is_active', True) is not None else True
                })
            except Exception as customer_error:
                print(f"Error processing customer {getattr(customer, 'id', 'unknown')}: {str(customer_error)}")
                import traceback
                traceback.print_exc()
                continue
        
        return jsonify({'success': True, 'customers': customers_data})
    
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error getting customers: {str(e)}")
        print(f"Full traceback:\n{error_trace}")
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/customers', methods=['POST'])
@login_required
def create_customer():
    """Create a new customer"""
    try:
        # Debug: Check authentication
        print(f"[CREATE CUSTOMER] Current user: {current_user}")
        print(f"[CREATE CUSTOMER] User ID: {current_user.id if current_user and hasattr(current_user, 'id') else 'N/A'}")
        
        # Get request data
        data = request.get_json()
        print(f"[CREATE CUSTOMER] Received data: {data}")
        
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        # Validate required fields
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'Name is required'}), 400
        if not data.get('email'):
            return jsonify({'success': False, 'error': 'Email is required'}), 400
        
        # Check if customer with same email already exists
        existing_customer = Customer.query.filter_by(email=data['email']).first()
        if existing_customer:
            return jsonify({'success': False, 'error': 'Customer with this email already exists'}), 400
        
        # Get phone - handle both with and without country code
        # Use empty string instead of None to handle databases where phone is NOT NULL
        phone = data.get('phone', '') or ''
        
        # Ensure user_id is set
        user_id = current_user.id if current_user and hasattr(current_user, 'id') else None
        if not user_id:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        print(f"[CREATE CUSTOMER] Creating customer with user_id: {user_id}")
        
        # Create new customer with all fields - use safe defaults
        try:
            customer = Customer(
                user_id=user_id,
                name=data.get('name', '').strip(),
                email=data.get('email', '').strip(),
                phone=phone or '',  # Use empty string to handle NOT NULL constraint in some databases
                gstin=data.get('gstin', '').strip() or None,
                company_name=data.get('company_name', '').strip() or None,
                billing_address=data.get('billing_address', '').strip() or None,
                shipping_address=data.get('shipping_address', '').strip() or data.get('billing_address', '').strip() or None,
                state=data.get('state', '').strip() or None,
                pincode=data.get('pincode', '').strip() or None,
                bank_name=data.get('bank_name', '').strip() or None,
                bank_account_number=data.get('bank_account_number', '').strip() or None,
                bank_ifsc=data.get('bank_ifsc', '').strip() or None,
                opening_balance=float(data.get('opening_balance', 0)) if data.get('opening_balance') else 0.0,
                opening_balance_type=data.get('opening_balance_type', 'debit') or 'debit',
                credit_limit=float(data.get('credit_limit', 0)) if data.get('credit_limit') else 0.0,
                discount=float(data.get('discount', 0)) if data.get('discount') else 0.0,
                notes=data.get('notes', '').strip() or None,
                tags=data.get('tags', '').strip() or None,
                cc_emails=data.get('cc_emails', '').strip() or None
            )
            
            # Set password (required field)
            password = data.get('password', 'default123')
            customer.set_password(password)
            
            print(f"[CREATE CUSTOMER] Customer object created, adding to session...")
            db.session.add(customer)
            db.session.flush()  # Get the ID without committing
            print(f"[CREATE CUSTOMER] Customer ID: {customer.id}")
            
            db.session.commit()
            print(f"[CREATE CUSTOMER] Customer committed successfully")
            
        except Exception as create_error:
            db.session.rollback()
            import traceback
            error_trace = traceback.format_exc()
            print(f"[CREATE CUSTOMER] Error creating customer object: {str(create_error)}")
            print(f"[CREATE CUSTOMER] Full traceback:\n{error_trace}")
            return jsonify({'success': False, 'error': f'Database error: {str(create_error)}'}), 500
        
        return jsonify({
            'success': True,
            'message': 'Customer created successfully',
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'email': customer.email,
                'phone': customer.phone or ''
            }
        })
    
    except Exception as e:
        db.session.rollback()
        import traceback
        error_trace = traceback.format_exc()
        print(f"[CREATE CUSTOMER] Error creating customer: {str(e)}")
        print(f"[CREATE CUSTOMER] Full traceback:\n{error_trace}")
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/customers/<int:customer_id>', methods=['GET'])
@login_required
def get_customer(customer_id):
    """Get specific customer details - admins can view all customers"""
    try:
        # Allow admins to view all customers, not just their own
        customer = Customer.query.filter_by(id=customer_id).first()
        
        if not customer:
            return jsonify({'success': False, 'message': 'Customer not found'}), 404
        
        return jsonify({
            'success': True,
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'email': customer.email,
                'phone': customer.phone,
                'gstin': customer.gstin or '',
                'billing_address': customer.billing_address,
                'shipping_address': customer.shipping_address or customer.billing_address,
                'state': customer.state,
                'pincode': customer.pincode,
                'created_at': customer.created_at.isoformat(),
                'is_active': customer.is_active
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/customers/<int:customer_id>', methods=['PUT'])
@login_required
def update_customer(customer_id):
    """Update customer details - admins can edit any customer"""
    try:
        # Allow admins to edit any customer, not just their own
        customer = Customer.query.filter_by(id=customer_id).first()
        
        if not customer:
            return jsonify({'success': False, 'error': 'Customer not found'}), 404
        
        data = request.get_json()
        
        # Check if email is changed and already exists
        if data.get('email') and data['email'] != customer.email:
            existing_customer = Customer.query.filter_by(email=data['email']).first()
            if existing_customer:
                return jsonify({'success': False, 'error': 'Email already registered'}), 400
        
        # Update customer data
        if 'name' in data:
            customer.name = data['name']
        if 'email' in data:
            customer.email = data['email']
        if 'phone' in data:
            customer.phone = data['phone']
        if 'gstin' in data:
            customer.gstin = data.get('gstin', '')
        if 'billing_address' in data:
            customer.billing_address = data['billing_address']
        if 'shipping_address' in data:
            customer.shipping_address = data.get('shipping_address', '')
        if 'state' in data:
            customer.state = data['state']
        if 'pincode' in data:
            customer.pincode = data['pincode']
        if 'is_active' in data:
            customer.is_active = data['is_active']
        
        # Update password if provided
        if data.get('password') and data['password'].strip():
            customer.set_password(data['password'])
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Customer updated successfully',
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'email': customer.email,
                'phone': customer.phone,
                'gstin': customer.gstin or '',
                'billing_address': customer.billing_address,
                'shipping_address': customer.shipping_address or customer.billing_address,
                'state': customer.state,
                'pincode': customer.pincode,
                'is_active': customer.is_active
            }
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error updating customer: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/customers/<int:customer_id>', methods=['DELETE'])
@login_required
def delete_customer(customer_id):
    """Delete a customer (hard delete)"""
    try:
        # Allow admins to delete any customer
        customer = Customer.query.filter_by(id=customer_id).first()
        
        if not customer:
            return jsonify({'success': False, 'error': 'Customer not found'}), 404
        
        # Check if customer has invoices
        if customer.invoices:
            return jsonify({
                'success': False, 
                'message': 'Cannot delete customer with existing invoices. Please delete related invoices first.'
            }), 400
        
        # Check if customer has orders
        if customer.orders:
            return jsonify({
                'success': False, 
                'message': 'Cannot delete customer with existing orders. Please delete related orders first.'
            }), 400
        
        # Check if customer has product prices
        if customer.product_prices:
            # Delete customer product prices first
            for price in customer.product_prices:
                db.session.delete(price)
        
        # Hard delete the customer
        db.session.delete(customer)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Customer deleted successfully'})
    
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting customer: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/customers/<int:customer_id>/toggle-status', methods=['POST'])
@login_required
def toggle_customer_status(customer_id):
    """Toggle customer active/inactive status"""
    try:
        # Allow admins to toggle status of any customer
        customer = Customer.query.filter_by(id=customer_id).first()
        
        if not customer:
            return jsonify({'success': False, 'error': 'Customer not found'}), 404
        
        # Toggle is_active
        customer.is_active = not customer.is_active
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Customer {"activated" if customer.is_active else "deactivated"} successfully',
            'is_active': customer.is_active
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error toggling customer status: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Order Management Routes
@admin_bp.route('/orders', methods=['GET'])
@login_required
def get_orders():
    """Get all orders - admins see ALL orders from ALL customers"""
    try:
        customer_id = request.args.get('customer_id', type=int)
        
        # Get ALL orders - no filtering by admin assignment
        query = Order.query
        
        # Filter by customer if customer_id is provided
        if customer_id:
            query = query.filter(Order.customer_id == customer_id)
        
        orders = query.order_by(Order.created_at.desc()).all()
        print(f"[ADMIN ORDERS] Admin {current_user.id} requesting orders. Found {len(orders)} total orders in database")
        orders_data = []
        
        for order in orders:
            print(f"[ADMIN ORDERS] Processing order {order.id}: customer_id={order.customer_id}, order_number={order.order_number}")
            # Get customer details
            customer = Customer.query.get(order.customer_id)
            
            # Get order items
            items_data = []
            for item in order.items:
                items_data.append({
                    'id': item.id,
                    'product_id': item.product_id,
                    'product_name': item.product.name if item.product else 'Unknown Product',
                    'quantity': item.quantity,
                    'unit_price': float(item.unit_price),
                    'total': float(item.total)
                })
            
            orders_data.append({
                'id': order.id,
                'order_number': order.order_number,
                'customer_id': order.customer_id,
                'customer_name': customer.name if customer else 'Unknown Customer',
                'customer_email': customer.email if customer else '',
                'customer_phone': customer.phone if customer else '',
                'order_date': order.order_date.isoformat() if order.order_date else '',
                'status': order.status,
                'total_amount': float(order.total_amount),
                'notes': order.notes,
                'items': items_data,
                'created_at': order.created_at.isoformat()
            })
        
        return jsonify({'success': True, 'orders': orders_data})
    
    except Exception as e:
        print(f"Error getting orders: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/orders/<int:order_id>/status', methods=['PUT'])
@login_required
def update_order_status(order_id):
    """Update order status"""
    try:
        data = request.get_json()
        new_status = data.get('status')
        
        if not new_status:
            return jsonify({'success': False, 'error': 'Status is required'}), 400
        
        # Get order - admins can update any order
        order = Order.query.filter_by(id=order_id).first()
        
        if not order:
            return jsonify({'success': False, 'error': 'Order not found'}), 404
        
        order.status = new_status
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Order status updated successfully'})
    
    except Exception as e:
        db.session.rollback()
        print(f"Error updating order status: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/orders/<int:order_id>/generate-invoice', methods=['POST'])
@login_required
def generate_invoice_from_order(order_id):
    """Generate an invoice from an order"""
    try:
        # Get order - admins can generate invoices for any order
        order = Order.query.filter_by(id=order_id).first()
        
        if not order:
            return jsonify({'success': False, 'error': 'Order not found'}), 404
        
        # Check if invoice already exists for this order
        existing_invoice = Invoice.query.filter_by(order_id=order_id).first()
        if existing_invoice:
            return jsonify({'success': False, 'error': 'Invoice already exists for this order'}), 400
        
        # Generate invoice number
        invoice_number = f"INV-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        
        # Create invoice
        invoice = Invoice(
            user_id=current_user.id,
            customer_id=order.customer_id,
            invoice_number=invoice_number,
            invoice_date=datetime.now().date(),
            due_date=(datetime.now() + timedelta(days=30)).date(),  # 30 days from now
            subtotal=order.total_amount,
            total_amount=order.total_amount,
            status='pending',
            notes=f"Invoice generated from order {order.order_number}",
            order_id=order_id  # Link to the original order
        )
        
        db.session.add(invoice)
        db.session.flush()  # Get invoice ID
        
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
        
        # Calculate invoice totals
        invoice.calculate_totals()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Invoice generated successfully',
            'invoice': {
                'id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'total_amount': float(invoice.total_amount)
            }
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error generating invoice: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

from flask import Blueprint, render_template, request, flash, redirect, url_for, jsonify
from flask_login import login_required, current_user
from models import db, Customer, Product, Order, OrderItem
from forms import CustomerForm
from sqlalchemy import or_
from datetime import datetime
import uuid

customer_bp = Blueprint('customer', __name__)

@customer_bp.route('/customers')
@login_required
def index():
    """List all customers"""
    page = request.args.get('page', 1, type=int)
    search = request.args.get('search', '')
    
    query = Customer.query.filter_by(user_id=current_user.id, is_active=True)
    
    if search:
        query = query.filter(
            or_(
                Customer.name.contains(search),
                Customer.gstin.contains(search),
                Customer.email.contains(search),
                Customer.phone.contains(search)
            )
        )
    
    customers = query.order_by(Customer.name).paginate(
        page=page, per_page=20, error_out=False
    )
    
    return render_template('customers/index.html', customers=customers, search=search)

@customer_bp.route('/customers/new', methods=['GET', 'POST'])
@login_required
def new():
    """Create new customer"""
    form = CustomerForm()
    
    if form.validate_on_submit():
        customer = Customer(
            user_id=current_user.id,
            name=form.name.data,
            gstin=form.gstin.data,
            email=form.email.data,
            phone=form.phone.data,
            billing_address=form.billing_address.data,
            shipping_address=form.shipping_address.data or form.billing_address.data,
            state=form.state.data,
            pincode=form.pincode.data
        )
        
        db.session.add(customer)
        db.session.commit()
        
        flash('Customer created successfully!', 'success')
        return redirect(url_for('customer.index'))
    
    return render_template('customers/new.html', form=form)

@customer_bp.route('/customers/<int:id>')
@login_required
def show(id):
    """Show customer details"""
    customer = Customer.query.filter_by(
        id=id, user_id=current_user.id, is_active=True
    ).first_or_404()
    
    # Get customer's invoices
    invoices = customer.invoices.order_by(customer.invoices[0].created_at.desc()).limit(10).all()
    
    return render_template('customers/show.html', customer=customer, invoices=invoices)

@customer_bp.route('/customers/<int:id>/edit', methods=['GET', 'POST'])
@login_required
def edit(id):
    """Edit customer"""
    customer = Customer.query.filter_by(
        id=id, user_id=current_user.id, is_active=True
    ).first_or_404()
    
    form = CustomerForm(obj=customer)
    
    if form.validate_on_submit():
        customer.name = form.name.data
        customer.gstin = form.gstin.data
        customer.email = form.email.data
        customer.phone = form.phone.data
        customer.billing_address = form.billing_address.data
        customer.shipping_address = form.shipping_address.data or form.billing_address.data
        customer.state = form.state.data
        customer.pincode = form.pincode.data
        
        db.session.commit()
        
        flash('Customer updated successfully!', 'success')
        return redirect(url_for('customer.show', id=customer.id))
    
    return render_template('customers/edit.html', form=form, customer=customer)

@customer_bp.route('/customers/<int:id>/delete', methods=['POST'])
@login_required
def delete(id):
    """Delete customer (hard delete)"""
    customer = Customer.query.filter_by(
        id=id, user_id=current_user.id
    ).first_or_404()
    
    # Check if customer has invoices
    if customer.invoices:
        flash('Cannot delete customer with existing invoices. Please delete invoices first.', 'error')
        return redirect(url_for('customer.show', id=customer.id))
    
    # Check if customer has orders
    if customer.orders:
        flash('Cannot delete customer with existing orders. Please delete orders first.', 'error')
        return redirect(url_for('customer.show', id=customer.id))
    
    # Check if customer has product prices
    if customer.product_prices:
        # Delete customer product prices first
        for price in customer.product_prices:
            db.session.delete(price)
    
    # Hard delete the customer
    db.session.delete(customer)
    db.session.commit()
    
    flash('Customer deleted successfully!', 'success')
    return redirect(url_for('customer.index'))

@customer_bp.route('/api/customers/search')
@login_required
def search():
    """API endpoint for customer search (for invoice creation)"""
    search_term = request.args.get('q', '')
    
    if len(search_term) < 2:
        return jsonify([])
    
    customers = Customer.query.filter(
        Customer.user_id == current_user.id,
        Customer.is_active == True,
        or_(
            Customer.name.contains(search_term),
            Customer.gstin.contains(search_term),
            Customer.phone.contains(search_term)
        )
    ).limit(10).all()
    
    results = []
    for customer in customers:
        results.append({
            'id': customer.id,
            'name': customer.name,
            'gstin': customer.gstin,
            'phone': customer.phone,
            'state': customer.state,
            'billing_address': customer.billing_address
        })
    
    return jsonify(results)

@customer_bp.route('/api/customers/<int:id>')
@login_required
def get_customer(id):
    """API endpoint to get customer details"""
    customer = Customer.query.filter_by(
        id=id, user_id=current_user.id, is_active=True
    ).first_or_404()
    
    return jsonify({
        'id': customer.id,
        'name': customer.name,
        'gstin': customer.gstin,
        'email': customer.email,
        'phone': customer.phone,
        'billing_address': customer.billing_address,
        'shipping_address': customer.shipping_address,
        'state': customer.state,
        'pincode': customer.pincode
    })

@customer_bp.route('/orders', methods=['POST'])
@login_required
def create_order():
    """Create a new order for the current customer"""
    try:
        # Debug logging
        print(f"[ORDER CREATE] Customer ID: {current_user.id}, Type: {type(current_user).__name__}")
        print(f"[ORDER CREATE] Is authenticated: {current_user.is_authenticated}")
        
        data = request.get_json()
        print(f"[ORDER CREATE] Request data: {data}")
        
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        # Generate unique order number (max 20 characters as per database constraint)
        # Format: ORD-YYMMDD-XXXXXX (17 chars)
        max_attempts = 10
        order_number = None
        for attempt in range(max_attempts):
            # Use shorter date format and shorter UUID part to fit in 20 chars
            date_part = datetime.now().strftime('%y%m%d')  # YYMMDD (6 chars instead of 8)
            uuid_part = str(uuid.uuid4())[:6].upper()  # 6 chars instead of 8
            order_number = f"ORD-{date_part}-{uuid_part}"  # Total: 4 + 6 + 1 + 6 = 17 chars (fits in 20)
            
            # Check if order number already exists
            existing_order = Order.query.filter_by(order_number=order_number).first()
            if not existing_order:
                break
            if attempt == max_attempts - 1:
                return jsonify({'success': False, 'error': 'Failed to generate unique order number. Please try again.'}), 500
        
        print(f"[ORDER CREATE] Generated order number: {order_number} (length: {len(order_number)})")
        
        # Calculate subtotal from items and validate stock
        items = data.get('items', [])
        subtotal = 0.0
        
        # Validate items and check stock availability
        order_items_data = []
        stock_updates = {}  # Track products that need stock reduction
        
        for item_data in items:
            product_id = item_data.get('product_id')
            quantity = item_data.get('quantity', 0)
            unit_price = item_data.get('unit_price', 0)
            
            # Validate item data
            if not product_id:
                print(f"[ORDER CREATE] Skipping item with missing product_id: {item_data}")
                continue
            
            if quantity <= 0:
                print(f"[ORDER CREATE] Skipping item with invalid quantity: {item_data}")
                continue
            
            # Get product details
            try:
                product = Product.query.get(product_id)
                if not product:
                    return jsonify({
                        'success': False,
                        'error': f'Product with ID {product_id} not found'
                    }), 400
                
                # Ensure stock_quantity is a valid integer
                current_stock = int(product.stock_quantity) if product.stock_quantity is not None else 0
                order_quantity = int(quantity)
                
                print(f"[ORDER CREATE] Checking stock for product {product.name} (ID: {product_id}): Current stock = {current_stock}, Requested = {order_quantity}")
                
                # Check stock availability - MUST have sufficient stock
                if current_stock < order_quantity:
                    return jsonify({
                        'success': False,
                        'error': f'Insufficient stock for {product.name}. Available: {current_stock}, Requested: {order_quantity}'
                    }), 400
                
                # Track stock reduction
                if product_id not in stock_updates:
                    stock_updates[product_id] = {
                        'product': product,
                        'quantity_to_reduce': 0
                    }
                stock_updates[product_id]['quantity_to_reduce'] += order_quantity
                
            except Exception as e:
                print(f"[ORDER CREATE] Error fetching product {product_id}: {str(e)}")
                import traceback
                traceback.print_exc()
                return jsonify({
                    'success': False,
                    'error': f'Error processing product {product_id}: {str(e)}'
                }), 400
            
            item_total = quantity * unit_price
            subtotal += item_total
            
            order_items_data.append({
                'product_id': product_id,
                'quantity': quantity,
                'unit_price': unit_price,
                'total': item_total
            })
        
        # Validate that we have at least one valid item
        if len(order_items_data) == 0:
            return jsonify({'success': False, 'error': 'No valid items in order. Please check that products exist and quantities are valid.'}), 400
        
        if subtotal <= 0:
            return jsonify({'success': False, 'error': 'Order total must be greater than 0.'}), 400
        
        # Final validation: Ensure all products in stock_updates have sufficient stock
        # Query products fresh from database to ensure we have latest stock values
        for product_id, stock_info in stock_updates.items():
            try:
                # Get fresh product from database (not cached)
                # Note: with_for_update() may not work with SQLite, so we'll refresh manually
                product = Product.query.get(product_id)
                if not product:
                    return jsonify({
                        'success': False,
                        'error': f'Product with ID {product_id} not found during final validation'
                    }), 400
                
                # Refresh from database to get latest values
                db.session.refresh(product)
                
                quantity_to_reduce = int(stock_info['quantity_to_reduce'])
                current_stock = int(product.stock_quantity) if product.stock_quantity is not None else 0
                
                print(f"[ORDER CREATE] Final validation - Product: {product.name}, Stock: {current_stock}, Requested: {quantity_to_reduce}")
                
                if current_stock < quantity_to_reduce:
                    return jsonify({
                        'success': False,
                        'error': f'Insufficient stock for {product.name}. Available: {current_stock}, Requested: {quantity_to_reduce}'
                    }), 400
                
                # Update the product reference in stock_updates for later use
                stock_info['product'] = product
            except Exception as e:
                print(f"[ORDER CREATE] Error in final validation for product {product_id}: {str(e)}")
                import traceback
                traceback.print_exc()
                return jsonify({
                    'success': False,
                    'error': f'Error validating product {product_id}: {str(e)}'
                }), 500
        
        print(f"[ORDER CREATE] Stock validation passed for all {len(stock_updates)} products")
        
        # Get customer ID - handle both prefixed and numeric IDs
        customer_id = current_user.id
        if isinstance(customer_id, str) and customer_id.startswith('customer-'):
            try:
                customer_id = int(customer_id.split('-', 1)[1])
            except (ValueError, IndexError):
                # Fallback: try to get from Customer model
                from models import Customer
                customer = Customer.query.filter_by(email=getattr(current_user, 'email', None)).first()
                if customer:
                    customer_id = customer.id
                else:
                    return jsonify({'success': False, 'error': 'Invalid customer ID'}), 400
        
        print(f"[ORDER CREATE] Using customer_id: {customer_id} (type: {type(customer_id)})")
        
        # Create order
        order = Order(
            order_number=order_number,
            customer_id=customer_id,
            order_date=datetime.utcnow(),  # Use UTC for consistency
            status='pending',
            subtotal=subtotal,
            total_amount=subtotal,  # For now, total = subtotal (no tax in order, tax is in invoice)
            notes=data.get('notes', '')
        )
        
        db.session.add(order)
        db.session.flush()  # Get order ID
        
        # Add order items
        for item_data in order_items_data:
            order_item = OrderItem(
                order_id=order.id,
                product_id=item_data['product_id'],
                quantity=item_data['quantity'],
                unit_price=item_data['unit_price'],
                total=item_data['total']
            )
            db.session.add(order_item)
        
        # Reduce stock for all products in the order
        try:
            for product_id, stock_info in stock_updates.items():
                product = stock_info['product']
                quantity_to_reduce = int(stock_info['quantity_to_reduce'])
                
                # Refresh product from database to get latest stock (handle concurrent orders)
                try:
                    db.session.refresh(product)
                except Exception as refresh_error:
                    # If refresh fails, re-query the product
                    print(f"[ORDER CREATE] Refresh failed, re-querying product {product_id}: {str(refresh_error)}")
                    product = Product.query.get(product_id)
                    if not product:
                        raise Exception(f"Product {product_id} not found during stock reduction")
                
                current_stock = int(product.stock_quantity) if product.stock_quantity is not None else 0
                
                # Double-check stock availability before reducing (in case of concurrent orders)
                if current_stock < quantity_to_reduce:
                    db.session.rollback()
                    return jsonify({
                        'success': False,
                        'error': f'Insufficient stock for {product.name}. Available: {current_stock}, Requested: {quantity_to_reduce}. Please try again.'
                    }), 400
                
                # Reduce stock
                old_stock = current_stock
                product.stock_quantity = current_stock - quantity_to_reduce
                print(f"[ORDER CREATE] Reduced stock for product {product.name} (ID: {product_id}): {old_stock} -> {product.stock_quantity} (reduced by {quantity_to_reduce})")
        except Exception as stock_error:
            db.session.rollback()
            print(f"[ORDER CREATE ERROR] Error reducing stock: {str(stock_error)}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'success': False,
                'error': f'Error updating stock: {str(stock_error)}'
            }), 500
        
        # Mark customer as active since they have made a purchase
        try:
            customer = Customer.query.get(customer_id)
            if customer:
                customer.is_active = True
        except Exception as customer_error:
            print(f"[ORDER CREATE] Warning: Could not update customer status: {str(customer_error)}")
            # Don't fail the order if customer update fails
        
        # Commit all changes (order, order items, stock reduction, customer status)
        try:
            db.session.commit()
            print(f"[ORDER CREATE] Stock updated and order committed successfully")
        except Exception as commit_error:
            db.session.rollback()
            print(f"[ORDER CREATE ERROR] Database commit failed: {str(commit_error)}")
            import traceback
            traceback.print_exc()
            
            # Try to provide a user-friendly error message
            error_msg = str(commit_error)
            if 'UNIQUE constraint' in error_msg or 'unique constraint' in error_msg:
                error_msg = "Order number already exists. Please try again."
            elif 'NOT NULL constraint' in error_msg or 'NOT NULL' in error_msg:
                error_msg = "Missing required order information. Please check your order details."
            elif 'FOREIGN KEY constraint' in error_msg:
                error_msg = "Invalid product or customer reference. Please refresh and try again."
            
            return jsonify({
                'success': False,
                'error': error_msg
            }), 500
        
        print(f"[ORDER CREATE] Order created successfully: ID={order.id}, Order Number={order.order_number}, Customer ID={order.customer_id}")
        
        return jsonify({
            'success': True,
            'message': 'Order placed successfully',
            'order': {
                'id': order.id,
                'order_number': order.order_number,
                'customer_id': order.customer_id
            }
        })
    
    except Exception as e:
        db.session.rollback()
        import traceback
        error_trace = traceback.format_exc()
        
        # Safely format error message
        try:
            error_msg = str(e)
            # Ensure error message can be JSON serialized
            error_msg_safe = error_msg.encode('utf-8', errors='replace').decode('utf-8')
        except:
            error_msg_safe = "An error occurred while creating the order. Please check server logs."
        
        print(f"[ORDER CREATE ERROR] Error creating order: {error_msg_safe}")
        print(f"[ORDER CREATE ERROR] Traceback: {error_trace}")
        
        return jsonify({
            'success': False, 
            'error': error_msg_safe,
            'details': 'Check server console for detailed error information'
        }), 500

@customer_bp.route('/orders', methods=['GET'])
@login_required
def get_customer_orders():
    """Get all orders for the current customer"""
    try:
        orders = Order.query.filter_by(customer_id=current_user.id).order_by(Order.created_at.desc()).all()
        orders_data = []
        
        for order in orders:
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
                'order_date': order.order_date.isoformat() if order.order_date else '',
                'status': order.status,
                'total_amount': float(order.total_amount),
                'notes': order.notes,
                'items': items_data,
                'created_at': order.created_at.isoformat()
            })
        
        return jsonify({'success': True, 'orders': orders_data})
    
    except Exception as e:
        print(f"Error getting customer orders: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@customer_bp.route('/invoices', methods=['GET'])
@login_required
def get_customer_invoices():
    """Get all invoices for the current customer"""
    try:
        # Get invoices for the current customer
        from models import Invoice, InvoiceItem, Product
        invoices = Invoice.query.filter_by(customer_id=current_user.id).order_by(Invoice.created_at.desc()).all()
        invoices_data = []
        
        for invoice in invoices:
            # Get invoice items
            items_data = []
            for item in invoice.items:
                items_data.append({
                    'id': item.id,
                    'product_id': item.product_id,
                    'product_name': item.product.name if item.product else 'Unknown Product',
                    'quantity': item.quantity,
                    'unit_price': float(item.unit_price),
                    'gst_rate': float(item.gst_rate),
                    'gst_amount': float(item.gst_amount),
                    'total': float(item.total)
                })
            
            invoices_data.append({
                'id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'invoice_date': invoice.invoice_date.isoformat() if invoice.invoice_date else '',
                'due_date': invoice.due_date.isoformat() if invoice.due_date else '',
                'status': invoice.status,
                'subtotal': float(invoice.subtotal),
                'cgst_amount': float(invoice.cgst_amount),
                'sgst_amount': float(invoice.sgst_amount),
                'igst_amount': float(invoice.igst_amount),
                'total_amount': float(invoice.total_amount),
                'notes': invoice.notes,
                'items': items_data,
                'order_id': invoice.order_id,  # Link to order if generated from order
                'created_at': invoice.created_at.isoformat()
            })
        
        return jsonify({'success': True, 'invoices': invoices_data})
    
    except Exception as e:
        print(f"Error getting customer invoices: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


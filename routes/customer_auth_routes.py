from flask import Blueprint, request, jsonify, session
from flask_login import login_user, logout_user, login_required, current_user
from models import db, Customer, User, Product, CustomerProductPrice
from forms import CustomerRegistrationForm, CustomerLoginForm, ForgotPasswordForm, ResetPasswordForm
from sqlalchemy import or_
import re
import secrets
import string

customer_auth_bp = Blueprint('customer_auth', __name__)

@customer_auth_bp.route('/register', methods=['POST'])
def register():
    """Customer registration"""
    try:
        data = request.get_json()
        
        # Check if email already exists
        if Customer.query.filter_by(email=data['email']).first():
            return jsonify({'success': False, 'message': 'Email already registered'}), 400
        
        # Get first admin user to assign customer to (so they're visible to admin)
        first_admin = User.query.filter_by(is_approved=True, is_active=True).first()
        admin_user_id = first_admin.id if first_admin else 1  # Fallback to 1 if no admin found
        
        # Create new customer - keep active so they can access dashboard immediately
        customer = Customer(
            user_id=admin_user_id,  # Assign to first available admin
            name=data['name'],
            email=data['email'],
            phone=data['phone'],
            gstin=data.get('gstin'),
            billing_address=data['billing_address'],
            shipping_address=data.get('shipping_address'),
            state=data['state'],
            pincode=data['pincode'],
            is_active=True
        )
        customer.set_password(data['password'])
        
        db.session.add(customer)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Registration successful! Please login.',
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'email': customer.email
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@customer_auth_bp.route('/login', methods=['POST'])
def login():
    """Customer login"""
    try:
        data = request.get_json()
        
        customer = Customer.query.filter_by(email=data['email']).first()
        if customer and customer.check_password(data['password']):
            # Check if customer has made any purchases (orders or invoices)
            from models import Order, Invoice
            has_orders = Order.query.filter_by(customer_id=customer.id).count() > 0
            has_invoices = Invoice.query.filter_by(customer_id=customer.id).count() > 0
            
            # If they have any transactions, ensure the record reflects that they are active
            if has_orders or has_invoices:
                customer.is_active = True
            
            db.session.commit()
            
            login_user(customer, remember=data.get('remember_me', False))
            session.permanent = True
            
            return jsonify({
                'success': True,
                'message': 'Login successful!',
                'customer': {
                    'id': customer.id,
                    'name': customer.name,
                    'email': customer.email
                }
            })
        else:
            return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@customer_auth_bp.route('/logout')
@login_required
def logout():
    """Customer logout"""
    logout_user()
    return jsonify({'success': True, 'message': 'Logout successful'})

@customer_auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Forgot password - send reset email"""
    try:
        data = request.get_json()
        email = data['email']
        
        customer = Customer.query.filter_by(email=email).first()
        if not customer:
            return jsonify({'success': False, 'message': 'Email not found'}), 404
        
        # Generate reset token (in production, send email with reset link)
        reset_token = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
        session['reset_token'] = reset_token
        session['reset_email'] = email
        
        # For now, just return success (in production, send email)
        return jsonify({
            'success': True,
            'message': 'Password reset instructions sent to your email',
            'reset_token': reset_token  # Remove this in production
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@customer_auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Reset password with token"""
    try:
        data = request.get_json()
        reset_token = data.get('reset_token')
        new_password = data['password']
        
        # Verify reset token
        if reset_token != session.get('reset_token'):
            return jsonify({'success': False, 'message': 'Invalid reset token'}), 400
        
        email = session.get('reset_email')
        customer = Customer.query.filter_by(email=email).first()
        
        if not customer:
            return jsonify({'success': False, 'message': 'Customer not found'}), 404
        
        # Update password
        customer.set_password(new_password)
        db.session.commit()
        
        # Clear session
        session.pop('reset_token', None)
        session.pop('reset_email', None)
        
        return jsonify({'success': True, 'message': 'Password reset successful'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@customer_auth_bp.route('/profile')
@login_required
def profile():
    """Get customer profile"""
    return jsonify({
        'success': True,
        'customer': {
            'id': current_user.id,
            'name': current_user.name,
            'email': current_user.email,
            'phone': current_user.phone,
            'gstin': current_user.gstin,
            'billing_address': current_user.billing_address,
            'shipping_address': current_user.shipping_address,
            'state': current_user.state,
            'pincode': current_user.pincode
        }
    })

@customer_auth_bp.route('/products', methods=['GET'])
@login_required
def get_customer_products():
    """Get ALL active products for the logged-in customer with customer-specific prices"""
    try:
        # Verify current_user is a Customer
        if not isinstance(current_user, Customer):
            return jsonify({'success': False, 'error': 'Unauthorized - Customer login required'}), 401
        
        customer_id = current_user.id
        search = request.args.get('search', '')
        
        print(f"[DEBUG] Customer products requested by customer_id: {customer_id}, search: {search}")
        
        # Get ALL active products from ALL admins (not just the customer's assigned admin)
        # This allows customers to see products from all admins
        query = Product.query.filter_by(is_active=True)
        
        if search:
            query = query.filter(
                or_(
                    Product.name.contains(search),
                    Product.sku.contains(search),
                    Product.description.contains(search)
                )
            )
        
        products = query.order_by(Product.name).all()
        print(f"[DEBUG] Found {len(products)} active products")
        
        # Return products with customer-specific prices
        products_data = []
        for product in products:
            try:
                # Get customer-specific price for this customer
                customer_price = CustomerProductPrice.query.filter_by(
                    customer_id=customer_id,
                    product_id=product.id
                ).first()
                
                # Use customer-specific price if available, otherwise use default price
                price = float(customer_price.price) if customer_price else float(product.price)
                has_custom_price = customer_price is not None
                
                products_data.append({
                    'id': product.id,
                    'name': product.name,
                    'description': product.description or '',
                    'image_url': product.image_url or '',
                    'price': price,  # Customer-specific price
                    'default_price': float(product.price),  # Default price for reference
                    'stock_quantity': product.stock_quantity,
                    'has_custom_price': has_custom_price,
                    'sku': product.sku or '',
                    'category': product.category or ''
                })
            except Exception as product_error:
                print(f"[ERROR] Error processing product {product.id}: {str(product_error)}")
                continue  # Skip this product but continue with others
        
        print(f"[DEBUG] Returning {len(products_data)} products")
        return jsonify({'success': True, 'products': products_data})
    
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[ERROR] Error in get_customer_products: {str(e)}")
        print(f"[ERROR] Traceback: {error_trace}")
        return jsonify({'success': False, 'error': str(e)}), 500


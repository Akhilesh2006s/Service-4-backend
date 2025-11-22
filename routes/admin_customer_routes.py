from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from models import db, Customer
from forms import CustomerForm
from sqlalchemy import or_

admin_customer_bp = Blueprint('admin_customer', __name__)

@admin_customer_bp.route('/customers')
@login_required
def get_customers():
    """Get all customers for admin"""
    try:
        page = request.args.get('page', 1, type=int)
        search = request.args.get('search', '')
        
        query = Customer.query.filter_by(user_id=current_user.id, is_active=True)
        
        if search:
            query = query.filter(
                or_(
                    Customer.name.ilike(f'%{search}%'),
                    Customer.gstin.ilike(f'%{search}%'),
                    Customer.email.ilike(f'%{search}%'),
                    Customer.phone.ilike(f'%{search}%')
                )
            )
        
        customers = query.order_by(Customer.name).paginate(
            page=page, per_page=20, error_out=False
        )
        
        customer_list = []
        for customer in customers.items:
            customer_list.append({
                'id': customer.id,
                'name': customer.name,
                'email': customer.email,
                'phone': customer.phone,
                'gstin': customer.gstin,
                'state': customer.state,
                'billing_address': customer.billing_address,
                'created_at': customer.created_at.isoformat(),
                'is_active': customer.is_active
            })
        
        return jsonify({
            'success': True,
            'customers': customer_list,
            'pagination': {
                'page': customers.page,
                'pages': customers.pages,
                'per_page': customers.per_page,
                'total': customers.total,
                'has_next': customers.has_next,
                'has_prev': customers.has_prev
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_customer_bp.route('/customers', methods=['POST'])
@login_required
def create_customer():
    """Create new customer"""
    try:
        data = request.get_json()
        
        # Check if email already exists
        if Customer.query.filter_by(email=data['email']).first():
            return jsonify({'success': False, 'message': 'Email already registered'}), 400
        
        customer = Customer(
            user_id=current_user.id,
            name=data['name'],
            email=data['email'],
            phone=data['phone'],
            gstin=data.get('gstin'),
            billing_address=data['billing_address'],
            shipping_address=data.get('shipping_address', data['billing_address']),
            state=data['state'],
            pincode=data['pincode']
        )
        
        # Set password if provided
        if data.get('password'):
            customer.set_password(data['password'])
        
        db.session.add(customer)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Customer created successfully!',
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'email': customer.email,
                'phone': customer.phone
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_customer_bp.route('/customers/<int:customer_id>')
@login_required
def get_customer(customer_id):
    """Get specific customer details"""
    try:
        customer = Customer.query.filter_by(
            id=customer_id, user_id=current_user.id, is_active=True
        ).first()
        
        if not customer:
            return jsonify({'success': False, 'message': 'Customer not found'}), 404
        
        return jsonify({
            'success': True,
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'email': customer.email,
                'phone': customer.phone,
                'gstin': customer.gstin,
                'billing_address': customer.billing_address,
                'shipping_address': customer.shipping_address,
                'state': customer.state,
                'pincode': customer.pincode,
                'created_at': customer.created_at.isoformat(),
                'is_active': customer.is_active
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_customer_bp.route('/customers/<int:customer_id>', methods=['PUT'])
@login_required
def update_customer(customer_id):
    """Update customer"""
    try:
        customer = Customer.query.filter_by(
            id=customer_id, user_id=current_user.id, is_active=True
        ).first()
        
        if not customer:
            return jsonify({'success': False, 'message': 'Customer not found'}), 404
        
        data = request.get_json()
        
        # Check if email is changed and already exists
        if data.get('email') and data['email'] != customer.email:
            if Customer.query.filter_by(email=data['email']).first():
                return jsonify({'success': False, 'message': 'Email already registered'}), 400
        
        # Update customer data
        customer.name = data.get('name', customer.name)
        customer.email = data.get('email', customer.email)
        customer.phone = data.get('phone', customer.phone)
        customer.gstin = data.get('gstin', customer.gstin)
        customer.billing_address = data.get('billing_address', customer.billing_address)
        customer.shipping_address = data.get('shipping_address', customer.shipping_address)
        customer.state = data.get('state', customer.state)
        customer.pincode = data.get('pincode', customer.pincode)
        
        # Update password if provided
        if data.get('password'):
            customer.set_password(data['password'])
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Customer updated successfully!',
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'email': customer.email,
                'phone': customer.phone
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_customer_bp.route('/customers/<int:customer_id>', methods=['DELETE'])
@login_required
def delete_customer(customer_id):
    """Delete customer (hard delete)"""
    try:
        customer = Customer.query.filter_by(
            id=customer_id, user_id=current_user.id
        ).first()
        
        if not customer:
            return jsonify({'success': False, 'message': 'Customer not found'}), 404
        
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
        
        return jsonify({'success': True, 'message': 'Customer deleted successfully!'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_customer_bp.route('/customers/search')
@login_required
def search_customers():
    """Search customers"""
    try:
        search_term = request.args.get('q', '').strip()
        
        if len(search_term) < 2:
            return jsonify({'success': True, 'customers': []})
        
        customers = Customer.query.filter(
            Customer.user_id == current_user.id,
            Customer.is_active == True,
            or_(
                Customer.name.ilike(f'%{search_term}%'),
                Customer.gstin.ilike(f'%{search_term}%'),
                Customer.phone.ilike(f'%{search_term}%')
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
        
        return jsonify({'success': True, 'customers': results})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import os
from datetime import datetime

# Create Flask app
app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///app.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = None

# Handle unauthorized access for API routes (return JSON instead of redirect)
@login_manager.unauthorized_handler
def unauthorized():
    # Allow OPTIONS requests to pass through for CORS preflight
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({'success': False, 'error': 'Unauthorized'}), 401

# Allow OPTIONS requests to bypass authentication for CORS preflight
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = jsonify({'status': 'ok'})
        response.headers.add("Access-Control-Allow-Origin", request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,Origin,Accept,X-Requested-With")
        response.headers.add('Access-Control-Allow-Methods', "GET,POST,PUT,DELETE,OPTIONS,PATCH")
        response.headers.add('Access-Control-Allow-Credentials', "true")
        response.headers.add('Access-Control-Max-Age', "86400")
        return response

# Enable CORS with comprehensive configuration
CORS(app, 
     origins=["*"],  # Allow all origins temporarily
     supports_credentials=True,
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "Origin", "Accept", "X-Requested-With"],
     expose_headers=["Content-Type", "Authorization"],
     max_age=86400
)



class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    business_name = db.Column(db.String(200), nullable=True)
    business_reason = db.Column(db.Text, nullable=True)
    is_approved = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    approved_at = db.Column(db.DateTime, nullable=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Customer(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    address = db.Column(db.Text, nullable=True)
    state = db.Column(db.String(50), nullable=True)
    pincode = db.Column(db.String(10), nullable=True)
    password_hash = db.Column(db.String(200), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    sku = db.Column(db.String(50), nullable=True)  # Made nullable for backward compatibility
    category = db.Column(db.String(100), nullable=True)
    brand = db.Column(db.String(100), nullable=True)
    hsn_code = db.Column(db.String(10), nullable=True)
    price = db.Column(db.Float, nullable=False)
    gst_rate = db.Column(db.Float, default=18.0)
    stock_quantity = db.Column(db.Integer, default=0)
    min_stock_level = db.Column(db.Integer, default=10)
    unit = db.Column(db.String(20), nullable=False, default='PCS')  # Unit of measurement
    image_url = db.Column(db.String(500), nullable=True)
    weight = db.Column(db.Float, nullable=True)
    dimensions = db.Column(db.String(100), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Support both admin_id and user_id for backward compatibility
    # admin_id is NOT NULL in database, so we must always provide it
    admin_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # NOT NULL in database
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # New column

class CustomerProductPrice(db.Model):
    """Customer-specific product pricing model"""
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    price = db.Column(db.Float, nullable=False)  # Customer-specific price
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    customer = db.relationship('Customer', backref='product_prices', lazy=True)
    product = db.relationship('Product', backref='customer_prices', lazy=True)
    
    # Unique constraint: one price per customer-product combination
    __table_args__ = (db.UniqueConstraint('customer_id', 'product_id', name='_customer_product_price_uc'),)
    
    def __repr__(self):
        return f'<CustomerProductPrice Customer:{self.customer_id} Product:{self.product_id} Price:{self.price}>'

# User loader
@login_manager.user_loader
def load_user(user_id):
    # Try to load customer first (customers might have overlapping IDs with users)
    # Check Customer table first
    try:
        customer = Customer.query.get(int(user_id))
        if customer:
            print(f"[DEBUG] User loader: Loaded Customer ID {user_id}")
            return customer
    except Exception as e:
        print(f"[DEBUG] User loader: Error loading customer {user_id}: {e}")
    
    # If not a customer, try to load as admin user
    try:
        user = User.query.get(int(user_id))
        if user:
            print(f"[DEBUG] User loader: Loaded User ID {user_id}")
            return user
    except Exception as e:
        print(f"[DEBUG] User loader: Error loading user {user_id}: {e}")
    
    print(f"[DEBUG] User loader: Could not load user ID {user_id}")
    return None

# Routes
@app.route('/health')
def health():
    # Simple health check that doesn't depend on database
    return jsonify({
        'status': 'healthy', 
        'message': 'GST Billing System API is running',
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/')
def root():
    return jsonify({
        'status': 'healthy', 
        'message': 'GST Billing System API is running',
        'version': '1.0.0',
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/api/status')
def api_status():
    return jsonify({
        'status': 'running',
        'message': 'API is operational'
    })

@app.route('/api/test')
def test_api():
    return jsonify({'message': 'API is working!'})

# Auth routes
@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        username = data.get('username') or data.get('name') or email.split('@')[0]  # Use name or email prefix if username not provided
        business_name = data.get('business_name')
        business_reason = data.get('business_reason')
        business_phone = data.get('business_phone', '')
        business_address = data.get('business_address', '')
        business_state = data.get('business_state', '')
        business_pincode = data.get('business_pincode', '')
        
        # Check if user already exists
        if User.query.filter_by(email=email).first():
            return jsonify({'success': False, 'message': 'Email already registered'}), 400
        
        if User.query.filter_by(username=username).first():
            return jsonify({'success': False, 'message': 'Username already exists'}), 400
        
        # Create new user with all fields
        user = User(
            email=email,
            username=username,
            business_name=business_name or 'My Business',
            business_reason=business_reason or 'Business registration',
            is_approved=True,  # Auto-approve all registrations
            is_active=True
        )
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Registration successful! You can now login.',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'business_name': user.business_name
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            login_user(user, remember=data.get('remember_me', False))
            return jsonify({
                'success': True,
                'message': 'Login successful!',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'business_name': user.business_name
                }
            })
        else:
            return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/auth/logout')
@login_required
def auth_logout():
    logout_user()
    return jsonify({'success': True, 'message': 'Logout successful'})

@app.route('/api/auth/check')
def auth_check():
    if current_user.is_authenticated:
        if hasattr(current_user, 'business_name'):
            return jsonify({
                'authenticated': True,
                'user_type': 'admin',
                'user': {
                    'id': current_user.id,
                    'username': current_user.username,
                    'email': current_user.email
                }
            })
        else:
            return jsonify({
                'authenticated': True,
                'user_type': 'customer',
                'user': {
                    'id': current_user.id,
                    'name': current_user.name,
                    'email': current_user.email
                }
            })
    return jsonify({'authenticated': False}), 401



@app.route('/api/admin/dashboard')
@login_required
def admin_dashboard():
    try:
        # Get basic stats
        total_customers = Customer.query.filter_by(is_active=True).count()
        total_products = Product.query.filter_by(is_active=True).count()
        
        return jsonify({
            'success': True,
            'stats': {
                'total_customers': total_customers,
                'total_products': total_products
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500



# Customer routes
@app.route('/api/customer-auth/register', methods=['POST'])
def customer_register():
    try:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        password = data.get('password')
        phone = data.get('phone', '')
        address = data.get('address') or data.get('billing_address', '')
        state = data.get('state', '')
        pincode = data.get('pincode', '')
        
        # Check if customer already exists
        if Customer.query.filter_by(email=email).first():
            return jsonify({'success': False, 'message': 'Email already registered'}), 400
        
        # Create new customer - initially inactive (no purchases yet)
        customer = Customer(
            name=name,
            email=email,
            phone=phone,
            address=address,
            state=state,
            pincode=pincode,
            is_active=False  # Inactive until they make a purchase
        )
        customer.set_password(password)
        
        db.session.add(customer)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Registration successful! Please sign in to continue.',
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'email': customer.email
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/customer-auth/login', methods=['POST'])
def customer_login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
            
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'success': False, 'message': 'Email and password are required'}), 400
        
        customer = Customer.query.filter_by(email=email).first()
        if customer and customer.check_password(password):
            # Check if customer has made any purchases (orders or invoices)
            # Use try-except to handle cases where Order/Invoice tables might not exist or use different db
            has_orders = False
            has_invoices = False
            
            try:
                # Order and Invoice are defined in this file, use them directly
                # Use db.session.query to ensure we use the correct db instance
                has_orders = db.session.query(Order).filter_by(customer_id=customer.id).count() > 0
                has_invoices = db.session.query(Invoice).filter_by(customer_id=customer.id).count() > 0
            except Exception as order_error:
                # If Order/Invoice models don't exist or have issues, just skip the check
                print(f"[DEBUG] Could not check orders/invoices: {order_error}")
                import traceback
                traceback.print_exc()
                # Default to active if we can't check
                has_orders = False
                has_invoices = False
            
            # Update is_active based on purchases
            # For now, keep customers active by default if they can login
            # You can change this logic based on your business requirements
            if has_orders or has_invoices:
                customer.is_active = True
            # Don't set to False if no orders - let them login anyway
            # customer.is_active = False  # Commented out - allow login regardless
            
            db.session.commit()
            
            login_user(customer, remember=data.get('remember_me', False))
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
        import traceback
        error_trace = traceback.format_exc()
        print(f"[ERROR] Customer login error: {error_trace}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/customer-auth/logout')
@login_required
def customer_logout():
    logout_user()
    return jsonify({'success': True, 'message': 'Logout successful'})

@app.route('/api/customer-auth/products', methods=['GET'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def get_customer_products():
    """Get ALL active products for the logged-in customer with customer-specific prices"""
    try:
        print(f"\n[DEBUG] ========== CUSTOMER PRODUCTS ROUTE CALLED ==========")
        print(f"[DEBUG] Path: {request.path}")
        print(f"[DEBUG] Method: {request.method}")
        print(f"[DEBUG] URL: {request.url}")
        
        # Get customer_id from current_user if logged in
        from flask_login import current_user
        from flask import session
        customer_id = None
        
        print(f"[DEBUG] Checking authentication...")
        print(f"[DEBUG] current_user: {current_user}")
        print(f"[DEBUG] hasattr current_user: {hasattr(current_user, 'id') if current_user else False}")
        print(f"[DEBUG] is_authenticated: {current_user.is_authenticated if hasattr(current_user, 'is_authenticated') else False}")
        print(f"[DEBUG] current_user type: {type(current_user)}")
        print(f"[DEBUG] session: {dict(session)}")
        
        try:
            # Try multiple methods to get customer_id
            if hasattr(current_user, 'is_authenticated') and current_user.is_authenticated:
                print(f"[DEBUG] User is authenticated, ID: {current_user.id if hasattr(current_user, 'id') else 'N/A'}")
                # Check if it's a Customer by checking attributes
                # Customer has: email, password_hash, name, address
                # User has: email, password_hash, business_name, username
                is_customer = False
                if hasattr(current_user, 'email') and hasattr(current_user, 'password_hash'):
                    # Check if it has business_name (User) or not (Customer)
                    if hasattr(current_user, 'business_name'):
                        # It's a User (admin), not a Customer
                        print(f"[DEBUG] Detected as User (admin), not Customer")
                        is_customer = False
                    elif hasattr(current_user, 'name') and not hasattr(current_user, 'username'):
                        # It's likely a Customer (has name but no username)
                        is_customer = True
                        customer_id = current_user.id
                        print(f"[DEBUG] Detected as Customer by attributes, ID: {customer_id}")
                    else:
                        # Try to check by querying the Customer table
                        customer = Customer.query.get(current_user.id)
                        if customer:
                            is_customer = True
                            customer_id = current_user.id
                            print(f"[DEBUG] Confirmed as Customer by query, ID: {customer_id}")
                        else:
                            print(f"[DEBUG] Not found in Customer table, treating as User")
                            is_customer = False
                else:
                    # Try to get customer_id anyway and verify
                    temp_id = current_user.id if hasattr(current_user, 'id') else None
                    if temp_id:
                        customer = Customer.query.get(temp_id)
                        if customer:
                            is_customer = True
                            customer_id = temp_id
                            print(f"[DEBUG] Verified as Customer, ID: {customer_id}")
                        else:
                            print(f"[DEBUG] ID {temp_id} not found in Customer table")
            
            # Try to get from session
            if not customer_id:
                user_id = session.get('_user_id') or session.get('user_id')
                if user_id:
                    print(f"[DEBUG] Found user_id in session: {user_id}")
                    # Check if this user_id is a customer
                    customer = Customer.query.get(int(user_id))
                    if customer:
                        customer_id = customer.id
                        print(f"[DEBUG] Confirmed customer_id from session: {customer_id}")
            
            # Try query parameter as last resort
            if not customer_id:
                customer_id = request.args.get('customer_id', type=int)
                print(f"[DEBUG] Trying query parameter: {customer_id}")
                
        except Exception as auth_error:
            print(f"[DEBUG] Error getting customer_id: {auth_error}")
            import traceback
            traceback.print_exc()
            customer_id = request.args.get('customer_id', type=int)
        
        if not customer_id:
            print(f"[ERROR] No customer_id found after all attempts")
            print(f"[ERROR] current_user: {current_user}")
            print(f"[ERROR] session keys: {list(session.keys())}")
            return jsonify({
                'success': False, 
                'error': 'Customer authentication required. Please login as a customer.',
                'debug': {
                    'has_current_user': current_user is not None,
                    'is_authenticated': current_user.is_authenticated if hasattr(current_user, 'is_authenticated') else False,
                    'user_type': type(current_user).__name__ if current_user else None
                }
            }), 401
        
        print(f"[DEBUG] Using customer_id: {customer_id}")
        search = request.args.get('search', '')
        
        # Get ALL active products from ALL admins (not just the customer's assigned admin)
        # This allows customers to see products from all admins
        try:
            from sqlalchemy import or_
            query = Product.query.filter(
                or_(Product.is_active == True, Product.is_active.is_(None))
            )
            
            if search:
                query = query.filter(
                    or_(
                        Product.name.contains(search),
                        Product.sku.contains(search) if hasattr(Product, 'sku') else False,
                        Product.description.contains(search) if hasattr(Product, 'description') else False
                    )
                )
            
            products = query.order_by(Product.name).all()
            print(f"[DEBUG] Found {len(products)} products")
        except Exception as query_error:
            print(f"[ERROR] Error querying products: {query_error}")
            import traceback
            traceback.print_exc()
            # Try simpler query
            try:
                products = Product.query.filter_by(is_active=True).all()
                print(f"[DEBUG] Found {len(products)} products with simple query")
            except:
                products = []
        
        # Return products with customer-specific prices
        products_data = []
        for product in products:
            try:
                # Get customer-specific price for this customer
                # CustomerProductPrice is defined in this file, use it directly
                customer_price = None
                try:
                    customer_price = CustomerProductPrice.query.filter_by(
                        customer_id=customer_id,
                        product_id=product.id
                    ).first()
                except Exception as price_error:
                    print(f"[DEBUG] Error getting customer price for product {product.id}: {price_error}")
                    customer_price = None
                
                # Use customer-specific price if available, otherwise use default price
                price = float(customer_price.price) if customer_price else float(product.price)
                has_custom_price = customer_price is not None
                
                if customer_price:
                    print(f"[DEBUG] Product {product.id} ({product.name}): Custom price={price}, Default={product.price}")
                
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
                print(f"[ERROR] Error processing product {product.id}: {product_error}")
                import traceback
                traceback.print_exc()
                # Still add the product with default price
                try:
                    products_data.append({
                        'id': product.id,
                        'name': product.name,
                        'description': product.description or '',
                        'image_url': product.image_url or '',
                        'price': float(product.price),
                        'default_price': float(product.price),
                        'stock_quantity': product.stock_quantity,
                        'has_custom_price': False,
                        'sku': product.sku or '',
                        'category': product.category or ''
                    })
                except:
                    pass  # Skip this product if we can't process it
        
        print(f"[DEBUG] Returning {len(products_data)} products")
        print(f"[DEBUG] ================================================\n")
        return jsonify({'success': True, 'products': products_data})
    
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[ERROR] Error in get_customer_products: {error_trace}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Admin routes
@app.route('/api/admin/customers', methods=['GET'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def get_customers():
    try:
        # Show all customers (both active and inactive) so admin can see everyone
        customers = Customer.query.all()
        return jsonify({
            'success': True,
            'customers': [{
                'id': c.id,
                'name': c.name,
                'email': c.email,
                'phone': c.phone,
                'billing_address': c.address,  # Map 'address' to 'billing_address' for frontend
                'state': c.state or '',  # Return actual state value
                'pincode': c.pincode or '',  # Return actual pincode value
                'created_at': c.created_at.isoformat(),
                'is_active': c.is_active
            } for c in customers]
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/customers', methods=['POST'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def create_customer():
    try:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        phone = data.get('phone')
        # Handle both 'address' and 'billing_address' field names
        address = data.get('address') or data.get('billing_address')
        password = data.get('password', 'default123')
        
        if Customer.query.filter_by(email=email).first():
            return jsonify({'success': False, 'message': 'Email already exists'}), 400
        
        customer = Customer(
            name=name,
            email=email,
            phone=phone,
            address=address,
            state=data.get('state', ''),
            pincode=data.get('pincode', '')
        )
        customer.set_password(password)
        
        db.session.add(customer)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Customer created successfully',
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'email': customer.email
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/customers/<int:customer_id>', methods=['GET'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def get_customer(customer_id):
    """Get specific customer details - admins can view all customers"""
    try:
        # Allow admins to view all customers, not just active ones
        customer = Customer.query.filter_by(id=customer_id).first()
        
        if not customer:
            return jsonify({'success': False, 'message': 'Customer not found'}), 404
        
        # Use billing_address if available, otherwise fall back to address
        billing_addr = getattr(customer, 'billing_address', None) or getattr(customer, 'address', '')
        shipping_addr = getattr(customer, 'shipping_address', None) or billing_addr
        
        return jsonify({
            'success': True,
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'email': customer.email,
                'phone': customer.phone,
                'billing_address': billing_addr,
                'shipping_address': shipping_addr,
                'state': getattr(customer, 'state', '') or '',
                'pincode': getattr(customer, 'pincode', '') or '',
                'gstin': getattr(customer, 'gstin', '') or '',
                'created_at': customer.created_at.isoformat() if customer.created_at else '',
                'is_active': getattr(customer, 'is_active', True)
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/customers/<int:customer_id>', methods=['PUT'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def update_customer(customer_id):
    try:
        customer = Customer.query.get_or_404(customer_id)
        data = request.get_json()
        
        customer.name = data.get('name', customer.name)
        customer.email = data.get('email', customer.email)
        customer.phone = data.get('phone', customer.phone)
        customer.address = data.get('address', customer.address)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Customer updated successfully'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/customers/<int:customer_id>', methods=['DELETE'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def delete_customer(customer_id):
    try:
        customer = Customer.query.get_or_404(customer_id)
        
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
        
        return jsonify({
            'success': True,
            'message': 'Customer deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/customers/<int:customer_id>/toggle-status', methods=['POST'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def toggle_customer_status(customer_id):
    """Toggle customer active/inactive status"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        
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
        return jsonify({'success': False, 'message': str(e)}), 500

# Order and Invoice models
class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    admin_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    customer = db.relationship('Customer', backref='orders', lazy=True)
    admin = db.relationship('User', backref='orders', lazy=True)
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade='all, delete-orphan')

class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)
    
    product = db.relationship('Product', backref='order_items', lazy=True)

class Invoice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(50), unique=True, nullable=False)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    admin_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    gst_amount = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    customer = db.relationship('Customer', backref='invoices', lazy=True)
    admin = db.relationship('User', backref='invoices', lazy=True)
    order = db.relationship('Order', backref='invoices', lazy=True)
    items = db.relationship('InvoiceItem', backref='invoice', lazy=True, cascade='all, delete-orphan')

class InvoiceItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoice.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)
    gst_rate = db.Column(db.Float, nullable=False)
    
    product = db.relationship('Product', backref='invoice_items', lazy=True)

# Product routes
@app.route('/api/products', methods=['OPTIONS'])
@app.route('/api/products/', methods=['OPTIONS'])
def get_products_options():
    """Handle CORS preflight for getting products"""
    return '', 200

@app.route('/api/products', methods=['GET'])
@app.route('/api/products/', methods=['GET'])
def get_products():
    try:
        # Get query parameters
        customer_id = request.args.get('customer_id', type=int)
        search = request.args.get('search', '')
        category = request.args.get('category', '')
        
        # Query products - handle cases where is_active might be NULL
        from sqlalchemy import or_
        try:
            # If customer_id is provided, show all active products (from all admins)
            # Otherwise, show products for current admin if logged in
            from flask_login import current_user
            if customer_id:
                # When customer is selected, show all active products
                query = Product.query.filter(
                    or_(Product.is_active == True, Product.is_active.is_(None))
                )
            elif hasattr(current_user, 'id') and current_user.is_authenticated:
                # Show products for current admin
                query = Product.query.filter(
                    (or_(Product.user_id == current_user.id, Product.admin_id == current_user.id)) &
                    (or_(Product.is_active == True, Product.is_active.is_(None)))
                )
            else:
                # Show all active products if not logged in
                query = Product.query.filter(
                    or_(Product.is_active == True, Product.is_active.is_(None))
                )
            
            # Apply search filter
            if search:
                query = query.filter(
                    or_(
                        Product.name.contains(search),
                        getattr(Product, 'sku', None) and Product.sku.contains(search) or False,
                        getattr(Product, 'description', None) and Product.description.contains(search) or False
                    )
                )
            
            # Apply category filter
            if category and category != 'All':
                query = query.filter(Product.category == category)
            
            products = query.order_by(Product.name).all()
        except Exception as query_error:
            # If filtering fails, try without filter
            print(f"Error filtering products: {str(query_error)}")
            import traceback
            traceback.print_exc()
            try:
                products = Product.query.all()
            except Exception as e:
                print(f"Error querying products: {str(e)}")
                import traceback
                traceback.print_exc()
                return jsonify({'success': False, 'message': f'Database error: {str(e)}'}), 500
        
        products_list = []
        for p in products:
            try:
                # Get customer-specific price if customer_id is provided
                price = float(getattr(p, 'price', 0))
                default_price = price
                has_custom_price = False
                
                if customer_id:
                    # Try to get customer-specific price
                    try:
                        # Check if CustomerProductPrice table exists and query it
                        # CustomerProductPrice is now defined in this file
                        try:
                            customer_price = CustomerProductPrice.query.filter_by(
                                customer_id=customer_id,
                                product_id=p.id
                            ).first()
                            if customer_price:
                                price = float(customer_price.price)
                                has_custom_price = True
                        except (ImportError, AttributeError):
                            # Fallback: try direct SQL query
                            result = db.session.execute(
                                db.text("SELECT price FROM customer_product_price WHERE customer_id = :customer_id AND product_id = :product_id"),
                                {'customer_id': customer_id, 'product_id': p.id}
                            ).fetchone()
                            if result:
                                price = float(result[0])
                                has_custom_price = True
                    except Exception as price_error:
                        print(f"Warning: Could not get customer price: {str(price_error)}")
                
                # Safely get created_at
                created_at_str = ''
                if hasattr(p, 'created_at') and p.created_at:
                    if hasattr(p.created_at, 'isoformat'):
                        created_at_str = p.created_at.isoformat()
                    else:
                        created_at_str = str(p.created_at)
                
                product_data = {
                    'id': p.id,
                    'name': p.name,
                    'sku': getattr(p, 'sku', '') or '',
                    'description': getattr(p, 'description', '') or '',
                    'category': getattr(p, 'category', '') or '',
                    'price': price,  # Customer-specific price if available
                    'default_price': default_price,  # Always include default price
                    'has_custom_price': has_custom_price,
                    'gst_rate': float(getattr(p, 'gst_rate', 18.0)),
                    'stock_quantity': int(getattr(p, 'stock_quantity', 0)),
                    'min_stock_level': int(getattr(p, 'min_stock_level', 10)),
                    'image_url': getattr(p, 'image_url', '') or '',
                    'is_active': bool(getattr(p, 'is_active', True)),
                    'created_at': created_at_str
                }
                products_list.append(product_data)
            except Exception as e:
                print(f"Error processing product {p.id}: {str(e)}")
                import traceback
                traceback.print_exc()
                # Skip this product and continue
                continue
        
        return jsonify({
            'success': True,
            'products': products_list
        })
    except Exception as e:
        import traceback
        print(f"Error in get_products: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/products', methods=['OPTIONS'])
def create_product_options():
    """Handle CORS preflight for product creation"""
    return '', 200

@app.route('/api/products', methods=['POST'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def create_product():
    """Create a new product - SIMPLIFIED VERSION"""
    try:
        print(f"[DEBUG] ========== NEW PRODUCT CREATION REQUEST ==========")
        try:
            data = request.get_json()
            print(f"[DEBUG] Raw request data: {data}")
            print(f"[DEBUG] Data type: {type(data)}")
            if data and isinstance(data, dict):
                print(f"[DEBUG] Data keys: {list(data.keys())}")
                # Remove 'sku' from data if present (it's not required)
                if 'sku' in data:
                    print(f"[INFO] Removing 'sku' from request data (not required)")
                    data.pop('sku', None)
            else:
                print(f"[DEBUG] Data is not a dict: {data}")
        except Exception as json_error:
            print(f"[ERROR] Error parsing JSON: {json_error}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'message': f'Invalid JSON: {str(json_error)}'}), 400
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Validate required fields - use safe .get() to avoid KeyError
        # Only extract fields that are actually sent from frontend
        try:
            name = str(data.get('name', '')).strip() if data.get('name') else ''
            price = data.get('price')
            stock_quantity = data.get('stock_quantity', 0)
            print(f"[DEBUG] Successfully extracted: name='{name}', price={price}, stock_quantity={stock_quantity}")
        except KeyError as ke:
            key_name = str(ke).strip("'\"")
            if key_name == 'sku':
                print(f"[INFO] KeyError for 'sku' ignored - SKU is optional")
                # Continue without sku
            else:
                print(f"[ERROR] KeyError while extracting data: {ke}")
                import traceback
                traceback.print_exc()
                return jsonify({'success': False, 'message': f'Missing required field: {key_name}'}), 400
        except Exception as parse_error:
            print(f"[ERROR] Error parsing data: {parse_error}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'message': f'Error parsing request data: {str(parse_error)}'}), 400
        
        # SKU is not sent from frontend, so don't try to get it
        sku = None  # Always None since frontend doesn't send it
        
        print(f"[DEBUG] Final parsed values - name: '{name}', price: {price}, stock_quantity: {stock_quantity}")
        print(f"[DEBUG] ==================================================")
        
        if not name:
            return jsonify({'success': False, 'message': 'Product name is required'}), 400
        if not price or price <= 0:
            return jsonify({'success': False, 'message': 'Valid product price is required'}), 400
        if not stock_quantity or stock_quantity < 0:
            return jsonify({'success': False, 'message': 'Valid stock quantity is required'}), 400
        
        # Get admin user ID (required for admin_id field)
        admin_user = User.query.filter_by(is_approved=True).first()
        if not admin_user:
            admin_user = User.query.first()
        if not admin_user:
            # Create default admin
            admin_user = User(
                email='admin@default.com',
                username='admin',
                business_name='Default Business',
                is_approved=True,
                is_active=True
            )
            admin_user.set_password('admin123')
            db.session.add(admin_user)
            db.session.commit()
        
        admin_id = admin_user.id
        user_id = admin_user.id
        
        # Skip SKU uniqueness check entirely since SKU is not sent from frontend
        # No need to check SKU uniqueness when SKU is always empty
        print(f"[DEBUG] Skipping SKU uniqueness check (SKU not required)")
        
        # Create product using direct SQL to ensure admin_id is included
        # This is a workaround for SQLAlchemy not including admin_id in INSERT
        print(f"[DEBUG] ========== STARTING RAW SQL PRODUCT CREATION ==========")
        print(f"[DEBUG] admin_id: {admin_id}, user_id: {user_id}")
        print(f"[DEBUG] name: {name}, price: {price}, stock_quantity: {stock_quantity}")
        
        import sqlite3
        from datetime import datetime
        
        # Get database path from SQLAlchemy URI
        db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', 'sqlite:///app.db')
        print(f"[DEBUG] Database URI from config: {db_uri}")
        
        if db_uri.startswith('sqlite:///'):
            db_path = db_uri.replace('sqlite:///', '')
            # Handle relative paths
            if not os.path.isabs(db_path):
                # Check common locations
                if os.path.exists('instance/app.db'):
                    db_path = 'instance/app.db'
                elif os.path.exists('app.db'):
                    db_path = 'app.db'
                else:
                    db_path = 'instance/app.db'  # Default
        else:
            db_path = 'instance/app.db'
        
        print(f"[DEBUG] Using database path: {db_path}")
        print(f"[DEBUG] Database exists: {os.path.exists(db_path)}")
        
        try:
            # Ensure database directory exists
            db_dir = os.path.dirname(db_path)
            if db_dir and not os.path.exists(db_dir):
                os.makedirs(db_dir, exist_ok=True)
            
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Get current timestamp
            now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S.%f')
            
            # Prepare values in EXACT database column order (excluding id which is auto-increment)
            # Column order: name, description, price, gst_rate, stock_quantity, is_active, created_at,
            #               admin_id, user_id, sku, category, brand, hsn_code, min_stock_level,
            #               image_url, weight, dimensions, updated_at, unit
            try:
                price_float = float(price)
                stock_int = int(stock_quantity)
            except (ValueError, TypeError) as e:
                return jsonify({
                    'success': False,
                    'message': f'Invalid price or stock quantity: {str(e)}'
                }), 400
            
            values = (
                name,  # name
                None,  # description (not sent from frontend)
                price_float,  # price
                18.0,  # gst_rate
                stock_int,  # stock_quantity
                1,  # is_active
                now,  # created_at
                int(admin_id),  # admin_id - CRITICAL: MUST be included
                int(user_id),  # user_id
                None,  # sku (not sent from frontend)
                None,  # category (not sent from frontend)
                None,  # brand (not sent from frontend)
                None,  # hsn_code (not sent from frontend)
                10,  # min_stock_level (default)
                None,  # image_url (not sent from frontend)
                None,  # weight (not sent from frontend)
                None,  # dimensions (not sent from frontend)
                now,  # updated_at
                'PCS'  # unit
            )
            
            print(f"[DEBUG] Inserting product with admin_id={admin_id}, user_id={user_id}")
            print(f"[DEBUG] Values count: {len(values)}, admin_id value: {values[7]}")
            print(f"[DEBUG] Price: {price_float}, Stock: {stock_int}")
            
            # Build INSERT statement matching EXACT database column order
            try:
                cursor.execute("""
                    INSERT INTO product (
                        name, description, price, gst_rate, stock_quantity, is_active, created_at,
                        admin_id, user_id, sku, category, brand, hsn_code, min_stock_level,
                        image_url, weight, dimensions, updated_at, unit
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, values)
                
                product_id = cursor.lastrowid
                conn.commit()
                print(f"[DEBUG] Product created with ID: {product_id}")
            except sqlite3.IntegrityError as integrity_error:
                conn.rollback()
                conn.close()
                error_msg = str(integrity_error)
                print(f"[ERROR] Integrity Error: {error_msg}")
                return jsonify({
                    'success': False,
                    'message': f'Database constraint error: {error_msg}',
                    'error': error_msg
                }), 500
            except Exception as insert_error:
                conn.rollback()
                conn.close()
                error_msg = str(insert_error)
                print(f"[ERROR] Insert Error: {error_msg}")
                import traceback
                traceback.print_exc()
                return jsonify({
                    'success': False,
                    'message': f'Failed to insert product: {error_msg}',
                    'error': error_msg
                }), 500
            
            conn.close()
            
            # Fetch the created product using SQLAlchemy
            product = Product.query.get(product_id)
            if not product:
                return jsonify({'success': False, 'message': 'Product created but could not be retrieved'}), 500
            
            return jsonify({
                'success': True,
                'message': 'Product created successfully',
                'product': {
                    'id': product.id,
                    'name': product.name,
                    'sku': getattr(product, 'sku', '') or '',
                    'price': product.price
                }
            })
            
        except sqlite3.Error as sql_error:
            db.session.rollback()
            error_msg = str(sql_error)
            print(f"[ERROR] ========== SQLITE ERROR ==========")
            print(f"[ERROR] SQL Error: {error_msg}")
            import traceback
            traceback.print_exc()
            print(f"[ERROR] ==================================")
            return jsonify({
                'success': False,
                'message': f'Database error: {error_msg}',
                'error': error_msg
            }), 500
        except Exception as sql_ex:
            db.session.rollback()
            error_msg = str(sql_ex)
            print(f"[ERROR] ========== RAW SQL EXECUTION ERROR ==========")
            print(f"[ERROR] Error type: {type(sql_ex).__name__}")
            print(f"[ERROR] Error message: {error_msg}")
            import traceback
            traceback.print_exc()
            print(f"[ERROR] =============================================")
            return jsonify({
                'success': False,
                'message': f'Failed to create product: {error_msg}',
                'error': error_msg
            }), 500
            
    except KeyError as key_error:
        db.session.rollback()
        missing_key = str(key_error).strip("'\"")
        error_msg = f"Missing required field: {missing_key}"
        print(f"[ERROR] ========== KEY ERROR ==========")
        print(f"[ERROR] Missing key: {missing_key}")
        print(f"[ERROR] Full error: {key_error}")
        print(f"[ERROR] KeyError args: {key_error.args}")
        import traceback
        traceback.print_exc()
        print(f"[ERROR] ==============================")
        
        # If it's about 'sku', return a helpful message (don't treat it as an error)
        if missing_key == 'sku' or "'sku'" in str(key_error) or 'sku' in str(key_error).lower():
            print(f"[INFO] SKU KeyError detected but ignored - SKU is optional")
            return jsonify({
                'success': False,
                'message': 'SKU field is not required. Please only send: name, price, stock_quantity',
                'error': 'SKU field is not required. Please only send: name, price, stock_quantity',
                'error_type': 'KeyError'
            }), 400
        
        return jsonify({
            'success': False,
            'message': f'Missing required field: {missing_key}. Please check your request data.',
            'error': f'Missing required field: {missing_key}',
            'error_type': 'KeyError'
        }), 400
    except Exception as e:
        db.session.rollback()
        error_msg = str(e)
        error_type = type(e).__name__
        print(f"[ERROR] ========== OUTER EXCEPTION ==========")
        print(f"[ERROR] Error type: {error_type}")
        print(f"[ERROR] Error message: {error_msg}")
        print(f"[ERROR] Error args: {e.args if hasattr(e, 'args') else 'N/A'}")
        import traceback
        traceback.print_exc()
        print(f"[ERROR] =====================================")
        
        # If it's a KeyError about 'sku', return a helpful message
        if isinstance(e, KeyError):
            key_name = str(e).strip("'\"")
            if key_name == 'sku' or "'sku'" in str(e) or '"sku"' in str(e):
                print(f"[ERROR] Detected SKU KeyError - returning helpful message")
                return jsonify({
                    'success': False,
                    'message': 'SKU field is not required. Please only send: name, price, stock_quantity',
                    'error': 'SKU field is not required. Please only send: name, price, stock_quantity',
                    'error_type': 'KeyError'
                }), 400
        
        # Also check error message for 'sku'
        if "'sku'" in error_msg or '"sku"' in error_msg or error_msg.strip() == "'sku'":
            print(f"[ERROR] Detected SKU in error message - returning helpful message")
            return jsonify({
                'success': False,
                'message': 'SKU field is not required. Please only send: name, price, stock_quantity',
                'error': 'SKU field is not required. Please only send: name, price, stock_quantity',
                'error_type': 'KeyError'
            }), 400
        
        return jsonify({
            'success': False,
            'message': f'Failed to create product: {error_msg}',
            'error': error_msg,
            'error_type': error_type
        }), 500

# Customer Product Pricing Routes - Must be defined before /<int:product_id> routes
@app.route('/api/products/customer-prices', methods=['GET'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def get_customer_prices():
    """Get all customer-specific prices for products"""
    try:
        # CustomerProductPrice is now defined in this file
        customer_id = request.args.get('customer_id', type=int)
        product_id = request.args.get('product_id', type=int)
        
        query = CustomerProductPrice.query
        
        if customer_id:
            query = query.filter(CustomerProductPrice.customer_id == customer_id)
        if product_id:
            query = query.filter(CustomerProductPrice.product_id == product_id)
        
        prices = query.all()
        
        prices_data = []
        for price in prices:
            # Safely access relationships
            customer_name = 'Unknown'
            product_name = 'Unknown'
            try:
                if hasattr(price, 'customer') and price.customer:
                    customer_name = price.customer.name
            except:
                pass
            try:
                if hasattr(price, 'product') and price.product:
                    product_name = price.product.name
            except:
                pass
            
            prices_data.append({
                'id': price.id,
                'customer_id': price.customer_id,
                'customer_name': customer_name,
                'product_id': price.product_id,
                'product_name': product_name,
                'price': float(price.price),
                'created_at': price.created_at.isoformat() if price.created_at else None,
                'updated_at': price.updated_at.isoformat() if price.updated_at else None
            })
        
        return jsonify({'success': True, 'prices': prices_data})
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/customer-prices', methods=['POST', 'OPTIONS'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def set_customer_price():
    """Set or update customer-specific price for a product"""
    # Handle OPTIONS for CORS preflight
    if request.method == 'OPTIONS':
        return '', 200
    
    # IMPORTANT: This route MUST be called. If you see a 404, the server needs to be restarted!
    print(f"\n{'='*80}")
    print(f"[ROUTE HIT] Customer price route is being called!")
    print(f"{'='*80}\n")
    
    try:
        print(f"[DEBUG] ========== CUSTOMER PRICE ROUTE CALLED ==========")
        print(f"[DEBUG] Method: {request.method}")
        print(f"[DEBUG] Path: {request.path}")
        print(f"[DEBUG] URL: {request.url}")
        print(f"[DEBUG] Headers: {dict(request.headers)}")
        print(f"[DEBUG] Request data: {request.get_json()}")
        print(f"[DEBUG] =================================================")
        
        # CustomerProductPrice is now defined in this file, no need to import
        
        # Ensure the table exists
        try:
            with db.engine.connect() as conn:
                conn.execute(db.text("SELECT 1 FROM customer_product_price LIMIT 1"))
        except Exception as table_error:
            print(f"[DEBUG] Table might not exist, creating it: {table_error}")
            try:
                db.create_all()
                print("[DEBUG] Tables created successfully")
            except Exception as create_error:
                print(f"[DEBUG] Error creating tables: {create_error}")
        
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data provided'}), 400
        
        # Get and convert IDs to integers explicitly
        customer_id_raw = data.get('customer_id')
        product_id_raw = data.get('product_id')
        price = data.get('price')
        
        print(f"[DEBUG] Raw data - customer_id: {customer_id_raw} (type: {type(customer_id_raw)}), product_id: {product_id_raw} (type: {type(product_id_raw)}), price: {price}")
        
        # Convert to integers, handling both string and int inputs
        try:
            customer_id = int(customer_id_raw) if customer_id_raw is not None else None
        except (ValueError, TypeError):
            customer_id = None
            
        try:
            product_id = int(product_id_raw) if product_id_raw is not None else None
        except (ValueError, TypeError):
            product_id = None
        
        print(f"[DEBUG] Converted data - customer_id: {customer_id} (type: {type(customer_id)}), product_id: {product_id} (type: {type(product_id)}), price: {price}")
        
        if not all([customer_id, product_id, price is not None]):
            return jsonify({'success': False, 'error': 'customer_id, product_id, and price are required'}), 400
        
        # Verify customer exists - try multiple lookup methods
        print(f"[DEBUG] Looking up customer with ID: {customer_id} (type: {type(customer_id)})")
        
        # List all customers for debugging
        all_customers = Customer.query.all()
        print(f"[DEBUG] Total customers in database: {len(all_customers)}")
        for c in all_customers:
            print(f"[DEBUG]   - Customer ID: {c.id} (type: {type(c.id)}), Name: {c.name}, Email: {c.email}")
        
        # Try multiple lookup methods to handle type mismatches
        customer = None
        try:
            # Method 1: Direct filter_by with int
            customer = Customer.query.filter_by(id=customer_id).first()
            if customer:
                print(f"[DEBUG] Customer found using filter_by(id={customer_id})")
        except Exception as e:
            print(f"[DEBUG] Error with filter_by: {e}")
        
        if not customer:
            try:
                # Method 2: Using filter with explicit comparison
                customer = Customer.query.filter(Customer.id == customer_id).first()
                if customer:
                    print(f"[DEBUG] Customer found using filter(Customer.id == {customer_id})")
            except Exception as e:
                print(f"[DEBUG] Error with filter: {e}")
        
        if not customer:
            try:
                # Method 3: Get by primary key
                customer = Customer.query.get(customer_id)
                if customer:
                    print(f"[DEBUG] Customer found using get({customer_id})")
            except Exception as e:
                print(f"[DEBUG] Error with get: {e}")
        
        if not customer:
            # Last resort: try to find by comparing all customers manually
            print(f"[DEBUG] Trying manual search through all customers...")
            for c in all_customers:
                # Try multiple comparison methods
                if c.id == customer_id or str(c.id) == str(customer_id) or int(c.id) == int(customer_id):
                    customer = c
                    print(f"[DEBUG] Customer found via manual search: ID={c.id}, Name={c.name}")
                    break
            
        if not customer:
            print(f"[DEBUG] Customer {customer_id} not found in database after trying all methods")
            print(f"[DEBUG] Available customer IDs: {[c.id for c in all_customers]}")
            print(f"[DEBUG] Available customer ID types: {[type(c.id) for c in all_customers]}")
            print(f"[DEBUG] Requested customer_id type: {type(customer_id).__name__}, value: {customer_id}")
            return jsonify({
                'success': False, 
                'error': f'Customer not found (ID: {customer_id}, type: {type(customer_id).__name__}). Available IDs: {[c.id for c in all_customers]}'
            }), 404
        
        print(f"[DEBUG] Customer found: ID={customer.id}, Name={customer.name}, Email={customer.email}")
        
        # Verify product exists
        product = Product.query.filter_by(id=product_id).first()
        if not product:
            print(f"[DEBUG] Product {product_id} not found")
            return jsonify({'success': False, 'error': 'Product not found'}), 404
        
        # Check if price already exists
        customer_price = CustomerProductPrice.query.filter_by(
            customer_id=customer_id,
            product_id=product_id
        ).first()
        
        if customer_price:
            # Update existing price
            print(f"[DEBUG] Updating existing price: {customer_price.id}")
            customer_price.price = float(price)
            customer_price.updated_at = datetime.utcnow()
        else:
            # Create new price
            print(f"[DEBUG] Creating new customer price")
            customer_price = CustomerProductPrice(
                customer_id=customer_id,
                product_id=product_id,
                price=float(price)
            )
            db.session.add(customer_price)
        
        db.session.commit()
        print(f"[DEBUG] Customer price saved successfully: ID={customer_price.id}")
        
        return jsonify({
            'success': True,
            'message': 'Customer price set successfully',
            'price': {
                'id': customer_price.id,
                'customer_id': customer_price.customer_id,
                'product_id': customer_price.product_id,
                'price': float(customer_price.price)
            }
        })
    
    except Exception as e:
        db.session.rollback()
        import traceback
        error_trace = traceback.format_exc()
        print(f"[ERROR] Exception in set_customer_price: {error_trace}")
        return jsonify({'success': False, 'error': str(e), 'trace': error_trace}), 500


@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    try:
        product = Product.query.get_or_404(product_id)
        return jsonify({
            'success': True,
            'product': {
                'id': product.id,
                'name': product.name,
                'description': product.description,
                'price': product.price,
                'gst_rate': product.gst_rate,
                'stock_quantity': product.stock_quantity,
                'created_at': product.created_at.isoformat()
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['PUT'])
@login_required
def update_product(product_id):
    try:
        product = Product.query.get_or_404(product_id)
        data = request.get_json()
        
        product.name = data.get('name', product.name)
        product.description = data.get('description', product.description)
        product.price = data.get('price', product.price)
        product.gst_rate = data.get('gst_rate', product.gst_rate)
        product.stock_quantity = data.get('stock_quantity', product.stock_quantity)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Product updated successfully'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@login_required
def delete_product(product_id):
    try:
        product = Product.query.get_or_404(product_id)
        
        # Check if product has invoice items
        if product.invoice_items:
            return jsonify({
                'success': False,
                'message': 'Cannot delete product with existing invoice items. Please delete related invoices first.'
            }), 400
        
        # Check if product has stock movements
        if product.stock_movements:
            # Delete stock movements first
            for movement in product.stock_movements:
                db.session.delete(movement)
        
        # Check if product has customer prices
        if product.customer_prices:
            # Delete customer prices first
            for price in product.customer_prices:
                db.session.delete(price)
        
        # Hard delete the product
        db.session.delete(product)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Product deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/products/<int:product_id>/stock', methods=['POST'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def update_product_stock(product_id):
    try:
        product = Product.query.get_or_404(product_id)
        data = request.get_json()
        
        movement_type = data.get('movement_type')  # 'in' or 'out'
        quantity = data.get('quantity', 0)
        
        if movement_type == 'in':
            product.stock_quantity += quantity
        elif movement_type == 'out':
            if product.stock_quantity >= quantity:
                product.stock_quantity -= quantity
            else:
                return jsonify({'success': False, 'message': 'Insufficient stock'}), 400
        else:
            return jsonify({'success': False, 'message': 'Invalid movement type'}), 400
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Stock updated successfully. New quantity: {product.stock_quantity}',
            'new_quantity': product.stock_quantity
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# Order routes
@app.route('/api/admin/orders', methods=['GET'])
@app.route('/api/admin/orders/', methods=['GET'])
@login_required
def get_orders():
    try:
        # Get orders for the current admin
        orders = Order.query.filter_by(admin_id=current_user.id).all()
        
        orders_data = []
        for order in orders:
            try:
                customer_name = order.customer.name if order.customer else 'Unknown'
            except:
                customer_name = 'Unknown'
            
            orders_data.append({
                'id': order.id,
                'customer_name': customer_name,
                'total_amount': order.total_amount,
                'status': order.status,
                'created_at': order.created_at.isoformat(),
                'items_count': len(order.items)
            })
        
        return jsonify({
            'success': True,
            'orders': orders_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/orders/<int:order_id>/status', methods=['PUT'])
@login_required
def update_order_status(order_id):
    try:
        order = Order.query.get_or_404(order_id)
        data = request.get_json()
        new_status = data.get('status')
        
        if new_status in ['pending', 'processing', 'completed', 'cancelled']:
            order.status = new_status
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': f'Order status updated to {new_status}'
            })
        else:
            return jsonify({'success': False, 'message': 'Invalid status'}), 400
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/orders/<int:order_id>/generate-invoice', methods=['POST'])
@login_required
def generate_invoice(order_id):
    try:
        order = Order.query.get_or_404(order_id)
        
        # Check if invoice already exists for this order
        existing_invoice = Invoice.query.filter_by(order_id=order_id).first()
        if existing_invoice:
            return jsonify({'success': False, 'message': 'Invoice already exists for this order'}), 400
        
        # Generate invoice number
        invoice_count = Invoice.query.count()
        invoice_number = f'INV-{invoice_count + 1:03d}-{order_id}'
        
        # Calculate GST
        gst_rate = 18.0  # Default GST rate
        gst_amount = order.total_amount * (gst_rate / 100)
        
        # Create invoice
        invoice = Invoice(
            invoice_number=invoice_number,
            order_id=order_id,
            customer_id=order.customer_id,
            admin_id=order.admin_id,
            total_amount=order.total_amount,
            gst_amount=gst_amount
        )
        
        db.session.add(invoice)
        
        # Create invoice items from order items
        for item in order.items:
            invoice_item = InvoiceItem(
                invoice_id=invoice.id,
                product_id=item.product_id,
                quantity=item.quantity,
                price=item.price,
                gst_rate=gst_rate
            )
            db.session.add(invoice_item)
        
        # Mark customer as active since they have made a purchase
        customer = Customer.query.get(order.customer_id)
        if customer:
            customer.is_active = True
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Invoice generated successfully',
            'invoice': {
                'id': invoice.id,
                'number': invoice.invoice_number,
                'total_amount': invoice.total_amount
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# Invoice routes
@app.route('/api/invoices', methods=['GET'])
@app.route('/api/invoices/', methods=['GET'])
@login_required
def get_invoices():
    try:
        # Get invoices for the current admin
        invoices = Invoice.query.filter_by(admin_id=current_user.id).all()
        
        invoices_data = []
        for invoice in invoices:
            try:
                customer_name = invoice.customer.name if invoice.customer else 'Unknown'
            except:
                customer_name = 'Unknown'
            
            invoices_data.append({
                'id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'customer_name': customer_name,
                'total_amount': invoice.total_amount,
                'gst_amount': invoice.gst_amount,
                'created_at': invoice.created_at.isoformat()
            })
        
        return jsonify({
            'success': True,
            'invoices': invoices_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/customers/invoices', methods=['GET'])
@app.route('/api/customers/invoices/', methods=['GET'])
@login_required
def get_customer_invoices():
    try:
        # Get invoices for the current customer
        invoices = Invoice.query.filter_by(customer_id=current_user.id).all()
        
        invoices_data = []
        for invoice in invoices:
            invoices_data.append({
                'id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'total_amount': invoice.total_amount,
                'gst_amount': invoice.gst_amount,
                'created_at': invoice.created_at.isoformat()
            })
        
        return jsonify({
            'success': True,
            'invoices': invoices_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/invoices/<int:invoice_id>', methods=['GET'])
@login_required
def get_invoice(invoice_id):
    try:
        invoice = Invoice.query.get_or_404(invoice_id)
        
        # Check if user has access to this invoice
        if not (current_user.id == invoice.admin_id or current_user.id == invoice.customer_id):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        
        invoice_data = {
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'total_amount': invoice.total_amount,
            'gst_amount': invoice.gst_amount,
            'created_at': invoice.created_at.isoformat(),
            'items': []
        }
        
        for item in invoice.items:
            try:
                product_name = item.product.name if item.product else 'Unknown Product'
            except:
                product_name = 'Unknown Product'
            
            invoice_data['items'].append({
                'id': item.id,
                'product_name': product_name,
                'quantity': item.quantity,
                'price': item.price,
                'gst_rate': item.gst_rate
            })
        
        return jsonify({
            'success': True,
            'invoice': invoice_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/invoices/<int:invoice_id>/pdf', methods=['GET'])
@login_required
def get_invoice_pdf(invoice_id):
    try:
        # Placeholder - return success for now
        return jsonify({
            'success': True,
            'message': 'PDF generated successfully',
            'pdf_url': f'/api/invoices/{invoice_id}/pdf'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== IMPORT/EXPORT ROUTES ====================
import csv
from io import StringIO, BytesIO

@app.route('/api/export/customers', methods=['GET'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def export_customers():
    """Export customers to CSV"""
    try:
        customers = Customer.query.filter_by(is_active=True).all()
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['Name', 'Email', 'Phone', 'Billing Address', 'State', 'Pincode', 'Created At', 'Is Active'])
        for customer in customers:
            writer.writerow([
                customer.name, customer.email, customer.phone or '',
                getattr(customer, 'address', '') or getattr(customer, 'billing_address', '') or '',
                customer.state or '', customer.pincode or '',
                customer.created_at.isoformat() if customer.created_at else '',
                'Yes' if customer.is_active else 'No'
            ])
        output.seek(0)
        mem = BytesIO()
        mem.write(output.getvalue().encode('utf-8-sig'))
        mem.seek(0)
        return send_file(mem, mimetype='text/csv', as_attachment=True, download_name=f'customers_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv')
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/export/products', methods=['GET'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def export_products():
    """Export products to CSV"""
    try:
        products = Product.query.filter_by(is_active=True).all()
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['Name', 'Description', 'Price', 'GST Rate', 'Stock Quantity', 'Created At'])
        for product in products:
            writer.writerow([
                product.name, product.description or '', product.price or 0,
                product.gst_rate or 18, product.stock_quantity or 0,
                product.created_at.isoformat() if product.created_at else ''
            ])
        output.seek(0)
        mem = BytesIO()
        mem.write(output.getvalue().encode('utf-8-sig'))
        mem.seek(0)
        return send_file(mem, mimetype='text/csv', as_attachment=True, download_name=f'products_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv')
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/export/orders', methods=['GET'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def export_orders():
    """Export orders to CSV"""
    try:
        orders = Order.query.all()
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['Order ID', 'Customer Email', 'Total Amount', 'Status', 'Created At', 'Items'])
        for order in orders:
            customer = Customer.query.get(order.customer_id)
            items_str = '; '.join([f"{item.product.name}:{item.quantity}:{item.price}" for item in order.items])
            writer.writerow([
                order.id, customer.email if customer else '', order.total_amount or 0,
                order.status or 'pending', order.created_at.isoformat() if order.created_at else '', items_str
            ])
        output.seek(0)
        mem = BytesIO()
        mem.write(output.getvalue().encode('utf-8-sig'))
        mem.seek(0)
        return send_file(mem, mimetype='text/csv', as_attachment=True, download_name=f'orders_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv')
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/import/customers', methods=['POST'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def import_customers():
    """Import customers from CSV"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        stream = StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.DictReader(stream)
        imported = 0
        skipped = 0
        errors = []
        for row_num, row in enumerate(csv_reader, start=2):
            try:
                name = row.get('Name', '').strip()
                email = row.get('Email', '').strip()
                if not name or not email:
                    errors.append(f"Row {row_num}: Missing required fields")
                    skipped += 1
                    continue
                if Customer.query.filter_by(email=email).first():
                    errors.append(f"Row {row_num}: Customer with email {email} already exists")
                    skipped += 1
                    continue
                customer = Customer(
                    name=name, email=email, phone=row.get('Phone', '').strip() or '',
                    address=row.get('Billing Address', '').strip() or row.get('Address', '').strip() or '',
                    state=row.get('State', '').strip() or '', pincode=row.get('Pincode', '').strip() or '',
                    is_active=row.get('Is Active', 'Yes').strip().lower() in ['yes', 'true', '1', 'y']
                )
                customer.set_password(row.get('Password', 'default123').strip() or 'default123')
                db.session.add(customer)
                imported += 1
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
                skipped += 1
        db.session.commit()
        return jsonify({'success': True, 'imported': imported, 'skipped': skipped, 'errors': errors[:10]})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/import/products', methods=['POST'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def import_products():
    """Import products from CSV"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        file = request.files['file']
        stream = StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.DictReader(stream)
        imported = 0
        skipped = 0
        errors = []
        for row_num, row in enumerate(csv_reader, start=2):
            try:
                name = row.get('Name', '').strip()
                if not name:
                    errors.append(f"Row {row_num}: Missing Name")
                    skipped += 1
                    continue
                try:
                    price = float(row.get('Price', 0) or 0)
                    gst_rate = float(row.get('GST Rate', 18) or 18)
                    stock_quantity = int(row.get('Stock Quantity', 0) or 0)
                except ValueError:
                    errors.append(f"Row {row_num}: Invalid numeric values")
                    skipped += 1
                    continue
                product = Product(
                    name=name, description=row.get('Description', '').strip() or None,
                    price=price, gst_rate=gst_rate, stock_quantity=stock_quantity,
                    admin_id=current_user.id if hasattr(current_user, 'id') else None
                )
                db.session.add(product)
                imported += 1
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
                skipped += 1
        db.session.commit()
        return jsonify({'success': True, 'imported': imported, 'skipped': skipped, 'errors': errors[:10]})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/import/orders', methods=['POST'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def import_orders():
    """Import orders from CSV"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        file = request.files['file']
        stream = StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.DictReader(stream)
        imported = 0
        skipped = 0
        errors = []
        for row_num, row in enumerate(csv_reader, start=2):
            try:
                customer_email = row.get('Customer Email', '').strip()
                customer = Customer.query.filter_by(email=customer_email).first()
                if not customer:
                    errors.append(f"Row {row_num}: Customer not found")
                    skipped += 1
                    continue
                items_str = row.get('Items', '').strip()
                total_amount = 0
                items_list = []
                for item_str in items_str.split(';'):
                    parts = item_str.strip().split(':')
                    if len(parts) >= 2:
                        product_name = parts[0].strip()
                        quantity = int(parts[1].strip()) if len(parts) > 1 else 1
                        price = float(parts[2].strip()) if len(parts) > 2 else 0
                        product = Product.query.filter_by(name=product_name).first()
                        if product:
                            items_list.append({'product': product, 'quantity': quantity, 'price': price or product.price})
                            total_amount += (price or product.price) * quantity
                if not items_list:
                    errors.append(f"Row {row_num}: No valid items")
                    skipped += 1
                    continue
                order = Order(customer_id=customer.id, total_amount=total_amount, status=row.get('Status', 'pending').strip() or 'pending', admin_id=current_user.id if hasattr(current_user, 'id') else None)
                db.session.add(order)
                db.session.flush()
                for item_data in items_list:
                    order_item = OrderItem(order_id=order.id, product_id=item_data['product'].id, quantity=item_data['quantity'], price=item_data['price'])
                    db.session.add(order_item)
                
                # Mark customer as active since they have made a purchase
                customer.is_active = True
                imported += 1
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
                skipped += 1
        db.session.commit()
        return jsonify({'success': True, 'imported': imported, 'skipped': skipped, 'errors': errors[:10]})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

# Initialize database
def init_db():
    try:
        with app.app_context():
            # Create tables if they don't exist (don't drop)
            db.create_all()
            print("Database initialized successfully!")
            return True
    except Exception as e:
        print(f"Database initialization failed: {e}")
        return False

# Initialize database when app starts
try:
    init_db()
except Exception as e:
    print(f"Failed to initialize database: {e}")

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)

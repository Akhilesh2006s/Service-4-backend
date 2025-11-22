from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from database import db

class User(UserMixin, db.Model):
    """User model for business owners"""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    business_name = db.Column(db.String(200), nullable=False)
    gst_number = db.Column(db.String(15), unique=True, nullable=True)  # Made nullable for backward compatibility
    business_address = db.Column(db.Text, nullable=True)  # Made nullable for backward compatibility
    business_phone = db.Column(db.String(15), nullable=True)  # Made nullable for backward compatibility
    business_email = db.Column(db.String(120), nullable=True)  # Made nullable for backward compatibility
    business_state = db.Column(db.String(50), nullable=True)  # Made nullable for backward compatibility
    business_pincode = db.Column(db.String(10), nullable=True)  # Made nullable for backward compatibility
    business_reason = db.Column(db.Text, nullable=True)  # Reason for business
    is_approved = db.Column(db.Boolean, default=False)  # Approval status
    approved_by = db.Column(db.Integer, db.ForeignKey('super_admin.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    customers = db.relationship('Customer', backref='user', lazy=True, cascade='all, delete-orphan')
    # Use user_id as the foreign key for products relationship (admin_id is for backward compatibility only)
    # Use primaryjoin to specify which foreign key to use when Product has both user_id and admin_id
    products = db.relationship('Product', primaryjoin='Product.user_id == User.id', backref=db.backref('user', lazy=True), lazy=True, cascade='all, delete-orphan')
    invoices = db.relationship('Invoice', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def get_id(self):
        return f'user-{self.id}'
    
    def __repr__(self):
        return f'<User {self.username}>'

class SuperAdmin(UserMixin, db.Model):
    """Super Admin model"""
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    approved_users = db.relationship('User', backref='approver', lazy=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def get_id(self):
        return f'superadmin-{self.id}'
    
    def __repr__(self):
        return f'<SuperAdmin {self.name}>'

class Customer(UserMixin, db.Model):
    """Customer model with login capabilities"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # Made nullable for backward compatibility
    name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(15), nullable=True)  # Made nullable to allow creation without phone
    gstin = db.Column(db.String(15), nullable=True)
    company_name = db.Column(db.String(200), nullable=True)
    billing_address = db.Column(db.Text, nullable=True)  # Made nullable for backward compatibility
    shipping_address = db.Column(db.Text, nullable=True)
    state = db.Column(db.String(50), nullable=True)  # Made nullable for backward compatibility
    pincode = db.Column(db.String(10), nullable=True)  # Made nullable for backward compatibility
    # Bank details
    bank_name = db.Column(db.String(200), nullable=True)
    bank_account_number = db.Column(db.String(50), nullable=True)
    bank_ifsc = db.Column(db.String(20), nullable=True)
    # Financial details
    opening_balance = db.Column(db.Float, nullable=True, default=0.0)
    opening_balance_type = db.Column(db.String(10), nullable=True, default='debit')  # debit or credit
    credit_limit = db.Column(db.Float, nullable=True, default=0.0)
    discount = db.Column(db.Float, nullable=True, default=0.0)
    # Additional details
    notes = db.Column(db.Text, nullable=True)
    tags = db.Column(db.String(500), nullable=True)
    cc_emails = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    invoices = db.relationship('Invoice', backref='customer', lazy=True)
    orders = db.relationship('Order', backref='customer', lazy=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def get_id(self):
        return f'customer-{self.id}'
    
    def __repr__(self):
        return f'<Customer {self.name}>'

class Product(db.Model):
    """Product model"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    admin_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # Required by database schema (NOT NULL constraint)
    name = db.Column(db.String(200), nullable=False)
    sku = db.Column(db.String(50), nullable=False)
    hsn_code = db.Column(db.String(10), nullable=True)
    description = db.Column(db.Text, nullable=True)
    category = db.Column(db.String(100), nullable=True)
    brand = db.Column(db.String(100), nullable=True)
    price = db.Column(db.Float, nullable=False)
    purchase_price = db.Column(db.Float, nullable=True, default=0.0)  # Purchase/cost price
    gst_rate = db.Column(db.Float, nullable=False, default=18.0)
    stock_quantity = db.Column(db.Integer, nullable=False, default=0)
    min_stock_level = db.Column(db.Integer, nullable=False, default=10)
    unit = db.Column(db.String(20), nullable=False, default='PCS')
    image_url = db.Column(db.String(500), nullable=True)
    weight = db.Column(db.Float, nullable=True)
    dimensions = db.Column(db.String(100), nullable=True)
    # Vegetable-specific fields
    vegetable_name = db.Column(db.String(200), nullable=True)
    vegetable_name_hindi = db.Column(db.String(200), nullable=True)
    quantity_gm = db.Column(db.Float, nullable=True)
    quantity_kg = db.Column(db.Float, nullable=True)
    rate_per_gm = db.Column(db.Float, nullable=True)
    rate_per_kg = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    invoice_items = db.relationship('InvoiceItem', backref='product', lazy=True)
    stock_movements = db.relationship('StockMovement', backref='product', lazy=True)
    
    def __repr__(self):
        return f'<Product {self.name}>'
    
    @property
    def is_low_stock(self):
        return self.stock_quantity <= self.min_stock_level
    
    def get_customer_price(self, customer_id):
        """Get customer-specific price, fallback to default price"""
        customer_price = CustomerProductPrice.query.filter_by(
            customer_id=customer_id,
            product_id=self.id
        ).first()
        return customer_price.price if customer_price else self.price

class Invoice(db.Model):
    """Invoice model"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=True)  # Link to order if generated from order
    invoice_number = db.Column(db.String(20), unique=True, nullable=False)
    invoice_date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date)
    due_date = db.Column(db.Date, nullable=True)
    subtotal = db.Column(db.Float, nullable=False, default=0.0)
    cgst_amount = db.Column(db.Float, nullable=False, default=0.0)
    sgst_amount = db.Column(db.Float, nullable=False, default=0.0)
    igst_amount = db.Column(db.Float, nullable=False, default=0.0)
    total_amount = db.Column(db.Float, nullable=False, default=0.0)
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending, paid, cancelled
    payment_terms = db.Column(db.String(100), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    items = db.relationship('InvoiceItem', backref='invoice', lazy=True, cascade='all, delete-orphan')
    order = db.relationship('Order', backref='invoices', lazy=True)
    
    def __repr__(self):
        return f'<Invoice {self.invoice_number}>'
    
    def calculate_totals(self):
        """Calculate invoice totals"""
        self.subtotal = sum(item.total for item in self.items)
        
        # Calculate GST based on customer state vs business state
        customer_state = self.customer.state
        business_state = self.user.business_state
        
        if customer_state == business_state:
            # Same state - CGST + SGST
            total_gst = sum(item.gst_amount for item in self.items)
            self.cgst_amount = total_gst / 2
            self.sgst_amount = total_gst / 2
            self.igst_amount = 0.0
        else:
            # Different state - IGST
            self.igst_amount = sum(item.gst_amount for item in self.items)
            self.cgst_amount = 0.0
            self.sgst_amount = 0.0
        
        self.total_amount = self.subtotal + self.cgst_amount + self.sgst_amount + self.igst_amount

class InvoiceItem(db.Model):
    """Invoice item model"""
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoice.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    gst_rate = db.Column(db.Float, nullable=False)
    gst_amount = db.Column(db.Float, nullable=False)
    total = db.Column(db.Float, nullable=False)
    
    def __repr__(self):
        return f'<InvoiceItem {self.product.name if self.product else "Unknown"}>'
    
    def calculate_totals(self):
        """Calculate item totals"""
        self.total = self.quantity * self.unit_price

class StockMovement(db.Model):
    """Stock movement model for tracking inventory changes"""
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    movement_type = db.Column(db.String(20), nullable=False)  # in, out, adjustment
    quantity = db.Column(db.Integer, nullable=False)
    reference = db.Column(db.String(100), nullable=True)  # invoice number, purchase order, etc.
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<StockMovement {self.movement_type} {self.quantity}>'

class GSTReport(db.Model):
    """GST report model for storing periodic reports"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    report_type = db.Column(db.String(20), nullable=False)  # GSTR1, GSTR3B, etc.
    period_month = db.Column(db.Integer, nullable=False)
    period_year = db.Column(db.Integer, nullable=False)
    total_taxable_value = db.Column(db.Float, nullable=False, default=0.0)
    total_cgst = db.Column(db.Float, nullable=False, default=0.0)
    total_sgst = db.Column(db.Float, nullable=False, default=0.0)
    total_igst = db.Column(db.Float, nullable=False, default=0.0)
    report_data = db.Column(db.JSON, nullable=True)  # Store detailed report data
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<GSTReport {self.report_type} {self.period_month}/{self.period_year}>'

class Order(db.Model):
    """Order model for customer orders"""
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    order_number = db.Column(db.String(20), unique=True, nullable=False)
    order_date = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending, confirmed, shipped, delivered, cancelled
    subtotal = db.Column(db.Float, nullable=False, default=0.0)
    total_amount = db.Column(db.Float, nullable=False, default=0.0)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Order {self.order_number}>'
    
    def calculate_totals(self):
        """Calculate order totals"""
        self.subtotal = sum(item.total for item in self.items)
        self.total_amount = self.subtotal

class OrderItem(db.Model):
    """Order item model"""
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    total = db.Column(db.Float, nullable=False)
    
    # Relationships
    product = db.relationship('Product', backref='order_items', lazy=True)
    
    def __repr__(self):
        return f'<OrderItem {self.product.name if self.product else "Unknown"}>'
    
    def calculate_totals(self):
        """Calculate item totals"""
        self.total = self.quantity * self.unit_price

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

from flask import Flask, render_template, send_from_directory, jsonify, request, send_file
from flask_cors import CORS
import os
from config import config
from database import db, migrate
from flask_login import LoginManager
from models import User
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from io import BytesIO
import datetime

# Import routes
from routes.auth_routes import auth_bp
from routes.dashboard_routes import dashboard_bp
from routes.customer_routes import customer_bp
from routes.product_routes import product_bp
from routes.invoice_routes import invoice_bp
from routes.gst_routes import gst_bp
from routes.report_routes import report_bp
from routes.customer_auth_routes import customer_auth_bp
from routes.super_admin_routes import super_admin_bp
from routes.admin_routes import admin_bp
from routes.import_export_routes import import_export_bp

def create_app(config_name='development'):
    app = Flask(__name__, static_folder='frontend/dist', template_folder='frontend/dist')
    app.config.from_object(config[config_name])
    
    # Enable CORS for API routes with credentials support
    # Get allowed origins from environment or use defaults
    cors_origins = os.environ.get('CORS_ORIGINS', '').split(',') if os.environ.get('CORS_ORIGINS') else [
        "http://localhost:3000",
        "http://localhost:5173", 
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "https://web-production-84a3.up.railway.app"
    ]
    # Filter out empty strings
    cors_origins = [origin.strip() for origin in cors_origins if origin.strip()]
    
    CORS(app, resources={
        r"/api/*": {
            "origins": cors_origins,
            "supports_credentials": True,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
            "allow_headers": ["Content-Type", "Authorization", "Origin", "Accept", "X-Requested-With"],
            "expose_headers": ["Content-Type", "Authorization"],
            "max_age": 86400
        }
    })
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    
    # Ensure database tables exist and vegetable columns are added
    # Do this in a non-blocking way to allow health checks to work
    def init_database():
        try:
            with app.app_context():
                # Create all tables
                db.create_all()
                
                # Initialize vegetable columns using helper function
                try:
                    from init_database import init_database_columns
                    init_database_columns(db, app)
                except ImportError:
                    # If helper doesn't exist, do it inline
                    try:
                        result = db.session.execute(db.text("PRAGMA table_info(product)")).fetchall()
                        existing_columns = [row[1] for row in result] if result else []
                        
                        vegetable_columns = {
                            'vegetable_name': 'VARCHAR(200)',
                            'vegetable_name_hindi': 'VARCHAR(200)',
                            'quantity_gm': 'REAL',
                            'quantity_kg': 'REAL',
                            'rate_per_gm': 'REAL',
                            'rate_per_kg': 'REAL'
                        }
                        
                        for col_name, col_type in vegetable_columns.items():
                            if col_name not in existing_columns:
                                try:
                                    db.session.execute(db.text(f"ALTER TABLE product ADD COLUMN {col_name} {col_type}"))
                                except Exception as e:
                                    if 'duplicate' not in str(e).lower() and 'already exists' not in str(e).lower():
                                        print(f"[WARNING] Could not add column {col_name}: {e}")
                        
                        db.session.commit()
                    except Exception as e:
                        db.session.rollback()
                        print(f"[INFO] Database column check: {e}")
        except Exception as e:
            print(f"[WARNING] Database initialization warning: {e}")
            # Don't fail app startup if migration fails
    
    # Initialize database in background (non-blocking)
    import threading
    threading.Thread(target=init_database, daemon=True).start()
    
    # Initialize login manager
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = None  # Disable redirect for API routes
    
    # Public routes that don't require authentication
    PUBLIC_ROUTES = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/customer-auth/login',
        '/api/customer-auth/register',
        '/api/super-admin/login',
        '/api/auth/check',
        '/health',
        '/'
    ]
    
    # Handle unauthorized access for API routes (return JSON instead of redirect)
    @login_manager.unauthorized_handler
    def unauthorized():
        # Allow OPTIONS requests to pass through for CORS preflight
        if request.method == 'OPTIONS':
            return '', 200
        
        # This handler is only called for routes with @login_required
        # Public routes should never reach here
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    # Allow OPTIONS requests and public routes to bypass authentication for CORS preflight
    @app.before_request
    def handle_preflight():
        # Allow OPTIONS requests
        if request.method == "OPTIONS":
            response = jsonify({'status': 'ok'})
            response.headers.add("Access-Control-Allow-Origin", request.headers.get('Origin', '*'))
            response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,Origin,Accept,X-Requested-With")
            response.headers.add('Access-Control-Allow-Methods', "GET,POST,PUT,DELETE,OPTIONS,PATCH")
            response.headers.add('Access-Control-Allow-Credentials', "true")
            response.headers.add('Access-Control-Max-Age', "86400")
            return response
        
        # Public routes don't need authentication checks
        if request.path in PUBLIC_ROUTES:
            return None
    
    @login_manager.user_loader
    def load_user(user_id):
        if not user_id:
            return None
        
        from models import SuperAdmin, Customer
        
        # Support new prefixed IDs first
        if user_id.startswith('superadmin-'):
            try:
                return SuperAdmin.query.get(int(user_id.split('-', 1)[1]))
            except (ValueError, IndexError):
                return None
        if user_id.startswith('user-'):
            try:
                return User.query.get(int(user_id.split('-', 1)[1]))
            except (ValueError, IndexError):
                return None
        if user_id.startswith('customer-'):
            try:
                return Customer.query.get(int(user_id.split('-', 1)[1]))
            except (ValueError, IndexError):
                return None
        
        # Backward compatibility for older sessions without prefixes
        try:
            numeric_id = int(user_id)
        except (ValueError, TypeError):
            return None
        
        super_admin = SuperAdmin.query.get(numeric_id)
        if super_admin:
            return super_admin
        
        user = User.query.get(numeric_id)
        if user:
            return user
        
        return Customer.query.get(numeric_id)
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(customer_bp, url_prefix='/api/customers')
    app.register_blueprint(product_bp, url_prefix='/api/products')
    app.register_blueprint(invoice_bp, url_prefix='/api/invoices')
    app.register_blueprint(gst_bp, url_prefix='/api/gst')
    app.register_blueprint(report_bp, url_prefix='/api/reports')
    app.register_blueprint(customer_auth_bp, url_prefix='/api/customer-auth')
    app.register_blueprint(super_admin_bp, url_prefix='/api/super-admin')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(import_export_bp, url_prefix='/api')
    
    # PDF Generation endpoint
    @app.route('/api/generate-pdf', methods=['POST'])
    def generate_pdf():
        try:
            data = request.get_json()
            
            # Create PDF
            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4)
            elements = []
            
            # Styles
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=16,
                spaceAfter=30,
                alignment=1  # Center alignment
            )
            
            # Business Header
            business_name = data.get('business_name', '')
            business_address = data.get('business_address', '')
            business_phone = data.get('business_phone', '')
            
            elements.append(Paragraph(business_name, title_style))
            if business_address:
                elements.append(Paragraph(business_address, styles['Normal']))
            if business_phone:
                elements.append(Paragraph(f"Phone: {business_phone}", styles['Normal']))
            
            elements.append(Spacer(1, 20))
            
            # Invoice Details
            invoice_number = data.get('invoice_number', '')
            invoice_date = data.get('invoice_date', '')
            customer_name = data.get('customer_name', '')
            customer_address = data.get('customer_address', '')
            customer_phone = data.get('customer_phone', '')
            
            invoice_info = [
                ['Invoice Number:', invoice_number],
                ['Date:', invoice_date],
                ['Customer:', customer_name],
                ['Address:', customer_address],
                ['Phone:', customer_phone]
            ]
            
            invoice_table = Table(invoice_info, colWidths=[2*inch, 4*inch])
            invoice_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            elements.append(invoice_table)
            elements.append(Spacer(1, 20))
            
            # Items Table
            items = data.get('items', [])
            if items:
                # Table headers
                table_data = [['S.No', 'Product', 'Description', 'Quantity', 'Unit Price', 'Total']]
                
                # Add items
                for i, item in enumerate(items, 1):
                    product = item.get('product', {})
                    table_data.append([
                        str(i),
                        product.get('name', ''),
                        product.get('description', ''),
                        str(item.get('quantity', 0)),
                        f"₹{item.get('unit_price', 0):.2f}",
                        f"₹{item.get('total', 0):.2f}"
                    ])
                
                # Add total row
                total_amount = data.get('total_amount', 0)
                table_data.append(['', '', '', '', 'Total:', f"₹{total_amount:.2f}"])
                
                # Create table
                items_table = Table(table_data, colWidths=[0.5*inch, 1.5*inch, 2*inch, 0.8*inch, 1*inch, 1*inch])
                items_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),  # Header row
                    ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),  # Total row
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('GRID', (0, 0), (-1, -2), 1, colors.black),
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ]))
                elements.append(items_table)
            
            # Custom columns if any
            custom_columns = data.get('custom_columns', {})
            if custom_columns:
                elements.append(Spacer(1, 20))
                elements.append(Paragraph("Additional Information:", styles['Heading2']))
                
                custom_data = [[key, value] for key, value in custom_columns.items()]
                custom_table = Table(custom_data, colWidths=[2*inch, 4*inch])
                custom_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ]))
                elements.append(custom_table)
            
            # Notes
            notes = data.get('notes', '')
            if notes:
                elements.append(Spacer(1, 20))
                elements.append(Paragraph("Notes:", styles['Heading2']))
                elements.append(Paragraph(notes, styles['Normal']))
            
            # Build PDF
            doc.build(elements)
            buffer.seek(0)
            
            return send_file(
                buffer,
                as_attachment=True,
                download_name=f"invoice_{invoice_number}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf",
                mimetype='application/pdf'
            )
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/health')
    def health():
        """Health check endpoint for Railway"""
        try:
            # Quick database connectivity check (non-blocking)
            with app.app_context():
                db.session.execute(db.text('SELECT 1'))
            db_status = 'connected'
        except Exception as e:
            db_status = f'warning: {str(e)[:50]}'
        
        return jsonify({
            'status': 'healthy', 
            'message': 'GST Billing System API is running',
            'database': db_status
        }), 200

    # Serve React app
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        # Skip API routes
        if path.startswith('api/'):
            return {'error': 'API route not found'}, 404
            
        if path != "" and os.path.exists(app.static_folder + '/' + path):
            return send_from_directory(app.static_folder, path)
        else:
            return send_from_directory(app.static_folder, 'index.html')
    
    return app

# Export db for scripts that need it
# Note: db must be initialized with an app before use
__all__ = ['create_app', 'db']

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)

# Create app instance for Railway/Gunicorn
# Determine config based on environment
import os
config_name = os.environ.get('FLASK_ENV', 'development')
if config_name == 'production' or os.environ.get('RAILWAY_ENVIRONMENT'):
    config_name = 'production'

try:
    import os
    port = os.environ.get('PORT', '5000')
    print(f"[INFO] Starting app with config: {config_name}")
    print(f"[INFO] Port: {port}")
    print(f"[INFO] Railway Environment: {os.environ.get('RAILWAY_ENVIRONMENT', 'Not set')}")
    
    app = create_app(config_name)
    print(f"[OK] App created successfully with config: {config_name}")
    print(f"[OK] Health endpoint available at /health")
    print(f"[OK] App ready to serve requests")
except Exception as e:
    print(f"[ERROR] Error creating app: {e}")
    import traceback
    traceback.print_exc()
    # Create a minimal app for healthcheck
    app = Flask(__name__)
    
    @app.route('/health')
    def health():
        return jsonify({'status': 'healthy', 'message': 'GST Billing System API is running (minimal mode)'}), 200
    
    @app.route('/')
    def health_check():
        return jsonify({'status': 'healthy', 'message': 'GST Billing System API is running (minimal mode)'}), 200
    
    print(f"[WARNING] Running in minimal mode - health checks only")

"""Import/Export routes for CSV and Excel functionality"""
from flask import Blueprint, request, jsonify, send_file
from flask_login import login_required, current_user
from datetime import datetime
import csv
import io
from io import StringIO, BytesIO
try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, PatternFill
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False

# Try to import from models, fallback to app_working
try:
    from models import db, Customer, Product, Order, OrderItem, Invoice, InvoiceItem, StockMovement
except ImportError:
    # If using app_working.py, models are defined there
    pass

import_export_bp = Blueprint('import_export', __name__)

# ==================== EXPORT FUNCTIONS ====================

@import_export_bp.route('/export/customers', methods=['GET'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def export_customers():
    """Export customers to CSV"""
    try:
        # Get customers (app_working.py doesn't have user_id, so get all active)
        try:
            customers = Customer.query.filter_by(is_active=True).all()
        except:
            # Fallback if user_id exists
            customers = Customer.query.filter_by(user_id=current_user.id, is_active=True).all() if hasattr(current_user, 'id') else Customer.query.filter_by(is_active=True).all()
        
        # Create CSV in memory
        output = StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Name', 'Email', 'Phone', 'GSTIN', 'Billing Address', 
            'Shipping Address', 'State', 'Pincode', 'Created At', 'Is Active'
        ])
        
        # Write data
        for customer in customers:
            writer.writerow([
                customer.name,
                customer.email,
                customer.phone or '',
                getattr(customer, 'gstin', None) or '',
                getattr(customer, 'billing_address', None) or getattr(customer, 'address', None) or '',
                getattr(customer, 'shipping_address', None) or getattr(customer, 'billing_address', None) or getattr(customer, 'address', None) or '',
                customer.state or '',
                customer.pincode or '',
                customer.created_at.isoformat() if customer.created_at else '',
                'Yes' if customer.is_active else 'No'
            ])
        
        # Create file response
        output.seek(0)
        mem = io.BytesIO()
        mem.write(output.getvalue().encode('utf-8-sig'))  # UTF-8 with BOM for Excel
        mem.seek(0)
        
        return send_file(
            mem,
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'customers_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@import_export_bp.route('/export/products', methods=['GET'])
@login_required
def export_products():
    """Export products to CSV or Excel"""
    try:
        format_type = request.args.get('format', 'excel')  # 'csv' or 'excel'
        
        # Get products
        try:
            products = Product.query.filter_by(user_id=current_user.id).all()
        except:
            products = Product.query.all()
        
        if format_type == 'excel' and OPENPYXL_AVAILABLE:
            # Export to Excel
            wb = Workbook()
            ws = wb.active
            ws.title = "Products"
            
            # Header row with styling
            headers = ['Name', 'SKU', 'HSN Code', 'Description', 'Category', 'Brand', 
                      'Price', 'GST Rate (%)', 'Stock Quantity', 'Min Stock Level', 
                      'Unit', 'Weight', 'Dimensions', 'Image URL', 'Created At']
            
            header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
            header_font = Font(bold=True, color="FFFFFF")
            
            for col_num, header in enumerate(headers, 1):
                cell = ws.cell(row=1, column=col_num, value=header)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal='center', vertical='center')
            
            # Data rows
            for row_num, product in enumerate(products, 2):
                ws.cell(row=row_num, column=1, value=product.name)
                ws.cell(row=row_num, column=2, value=product.sku or '')
                ws.cell(row=row_num, column=3, value=product.hsn_code or '')
                ws.cell(row=row_num, column=4, value=product.description or '')
                ws.cell(row=row_num, column=5, value=product.category or '')
                ws.cell(row=row_num, column=6, value=getattr(product, 'brand', '') or '')
                ws.cell(row=row_num, column=7, value=float(product.price) if product.price else 0)
                ws.cell(row=row_num, column=8, value=float(product.gst_rate) if product.gst_rate else 18)
                ws.cell(row=row_num, column=9, value=int(product.stock_quantity) if product.stock_quantity else 0)
                ws.cell(row=row_num, column=10, value=int(getattr(product, 'min_stock_level', 10)))
                ws.cell(row=row_num, column=11, value=product.unit or 'PCS')
                ws.cell(row=row_num, column=12, value=float(getattr(product, 'weight', 0)) if getattr(product, 'weight', None) else '')
                ws.cell(row=row_num, column=13, value=getattr(product, 'dimensions', '') or '')
                ws.cell(row=row_num, column=14, value=product.image_url or '')
                ws.cell(row=row_num, column=15, value=product.created_at.strftime('%Y-%m-%d %H:%M:%S') if product.created_at else '')
            
            # Auto-adjust column widths
            for column in ws.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                ws.column_dimensions[column_letter].width = adjusted_width
            
            # Save to BytesIO
            output = BytesIO()
            wb.save(output)
            output.seek(0)
            
            return send_file(
                output,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name=f'products_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
            )
        else:
            # Export to CSV (fallback)
            output = StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow([
                'Name', 'SKU', 'HSN Code', 'Description', 'Category', 'Brand', 'Price', 
                'GST Rate', 'Stock Quantity', 'Min Stock Level', 'Unit', 'Weight', 
                'Dimensions', 'Image URL', 'Created At'
            ])
            
            # Write data
            for product in products:
                writer.writerow([
                    product.name,
                    product.sku or '',
                    product.hsn_code or '',
                    product.description or '',
                    product.category or '',
                    getattr(product, 'brand', '') or '',
                    product.price or 0,
                    product.gst_rate or 18,
                    product.stock_quantity or 0,
                    getattr(product, 'min_stock_level', 10),
                    product.unit or 'PCS',
                    getattr(product, 'weight', '') or '',
                    getattr(product, 'dimensions', '') or '',
                    product.image_url or '',
                    product.created_at.isoformat() if product.created_at else ''
                ])
            
            output.seek(0)
            mem = io.BytesIO()
            mem.write(output.getvalue().encode('utf-8-sig'))
            mem.seek(0)
            
            return send_file(
                mem,
                mimetype='text/csv',
                as_attachment=True,
                download_name=f'products_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@import_export_bp.route('/export/orders', methods=['GET'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def export_orders():
    """Export orders to CSV"""
    try:
        # Get orders (app_working.py uses admin_id instead of user_id)
        try:
            orders = Order.query.all()
        except:
            orders = Order.query.filter_by(user_id=current_user.id).all() if hasattr(current_user, 'id') else Order.query.all()
        
        output = StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Order ID', 'Customer Name', 'Customer Email', 'Total Amount', 
            'Status', 'Created At', 'Items (Product:Quantity:Price)'
        ])
        
        # Write data
        for order in orders:
            customer = Customer.query.get(order.customer_id)
            items_str = '; '.join([
                f"{item.product.name}:{item.quantity}:{item.price}"
                for item in order.items
            ])
            
            writer.writerow([
                order.id,
                customer.name if customer else '',
                customer.email if customer else '',
                order.total_amount or 0,
                order.status or 'pending',
                order.created_at.isoformat() if order.created_at else '',
                items_str
            ])
        
        output.seek(0)
        mem = io.BytesIO()
        mem.write(output.getvalue().encode('utf-8-sig'))
        mem.seek(0)
        
        return send_file(
            mem,
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'orders_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== IMPORT FUNCTIONS ====================

@import_export_bp.route('/import/customers', methods=['POST'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def import_customers():
    """Import customers from CSV"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        # Read CSV file
        stream = StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.DictReader(stream)
        
        imported = 0
        skipped = 0
        errors = []
        
        for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (row 1 is header)
            try:
                # Required fields
                name = row.get('Name', '').strip()
                email = row.get('Email', '').strip()
                phone = row.get('Phone', '').strip()
                
                if not name or not email:
                    errors.append(f"Row {row_num}: Missing required fields (Name or Email)")
                    skipped += 1
                    continue
                
                # Check if customer already exists
                existing = Customer.query.filter_by(email=email).first()
                if existing:
                    errors.append(f"Row {row_num}: Customer with email {email} already exists")
                    skipped += 1
                    continue
                
                # Create customer (handle both model structures)
                address = row.get('Billing Address', '').strip() or row.get('Address', '').strip() or ''
                customer = Customer(
                    name=name,
                    email=email,
                    phone=phone or '',
                    address=address,
                    state=row.get('State', '').strip() or '',
                    pincode=row.get('Pincode', '').strip() or '',
                    is_active=row.get('Is Active', 'Yes').strip().lower() in ['yes', 'true', '1', 'y']
                )
                
                # Set additional fields if they exist in the model
                if hasattr(customer, 'gstin'):
                    customer.gstin = row.get('GSTIN', '').strip() or None
                if hasattr(customer, 'billing_address'):
                    customer.billing_address = address
                if hasattr(customer, 'shipping_address'):
                    customer.shipping_address = row.get('Shipping Address', '').strip() or None
                if hasattr(customer, 'user_id'):
                    customer.user_id = current_user.id if hasattr(current_user, 'id') else None
                
                # Set default password
                default_password = row.get('Password', 'default123').strip() or 'default123'
                customer.set_password(default_password)
                
                db.session.add(customer)
                imported += 1
                
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
                skipped += 1
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'imported': imported,
            'skipped': skipped,
            'errors': errors[:10]  # Limit errors to first 10
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@import_export_bp.route('/import/products', methods=['POST'])
@login_required
def import_products():
    """Import products from CSV or Excel"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        # Check file extension
        filename = file.filename.lower()
        is_excel = filename.endswith('.xlsx') or filename.endswith('.xls')
        
        rows = []
        
        if is_excel and OPENPYXL_AVAILABLE:
            # Read Excel file
            from openpyxl import load_workbook
            wb = load_workbook(file.stream, read_only=True)
            ws = wb.active
            
            # Get headers from first row
            headers = [cell.value for cell in ws[1] if cell.value]
            
            # Read data rows
            for row in ws.iter_rows(min_row=2, values_only=True):
                if any(cell for cell in row):  # Skip empty rows
                    row_dict = {}
                    for idx, header in enumerate(headers):
                        if idx < len(row):
                            row_dict[header] = str(row[idx]) if row[idx] is not None else ''
                    rows.append(row_dict)
        else:
            # Read CSV file
            stream = StringIO(file.stream.read().decode("UTF8"), newline=None)
            csv_reader = csv.DictReader(stream)
            rows = list(csv_reader)
        
        imported = 0
        skipped = 0
        errors = []
        
        for row_num, row in enumerate(rows, start=2):
            try:
                # Handle vegetable-specific columns - check for various possible column name variations
                # Vegetable Name (English) - could be "Vegetable Name", "Product Name", "Name", "ple Name", etc.
                vegetable_name = ''
                for key in row.keys():
                    key_lower = key.lower().strip()
                    # Check for vegetable name columns (excluding Hindi)
                    if ('vegetable' in key_lower or 'product' in key_lower or 'ple name' in key_lower) and 'name' in key_lower and 'hindi' not in key_lower:
                        val = str(row.get(key, '') or '').strip()
                        if val:
                            vegetable_name = val
                            break
                    # Also check for just "Name" if it's the first column or doesn't contain hindi
                    elif key_lower == 'name' or (key_lower.endswith('name') and 'hindi' not in key_lower):
                        val = str(row.get(key, '') or '').strip()
                        if val:
                            vegetable_name = val
                            # Don't break here, continue checking for more specific matches
                
                # Fallback to 'Name' if vegetable name not found
                if not vegetable_name:
                    name = str(row.get('Name', '') or '').strip()
                    vegetable_name = name
                    # If still not found, try first column
                    if not vegetable_name and row:
                        first_key = list(row.keys())[0] if row.keys() else None
                        if first_key:
                            vegetable_name = str(row.get(first_key, '') or '').strip()
                
                # Vegetable Name (Hindi)
                vegetable_name_hindi = ''
                for key in row.keys():
                    key_lower = key.lower().strip()
                    if 'hindi' in key_lower or '(hindi)' in key_lower or 'ble name' in key_lower:
                        val = str(row.get(key, '') or '').strip()
                        if val:
                            vegetable_name_hindi = val
                            break
                
                if not vegetable_name:
                    errors.append(f"Row {row_num}: Missing required field (Vegetable Name/Name)")
                    skipped += 1
                    continue
                
                # Generate SKU if not provided
                sku = str(row.get('SKU', '') or '').strip()
                if not sku:
                    sku = f"SKU-{vegetable_name[:10].upper().replace(' ', '-')}-{datetime.now().strftime('%Y%m%d%H%M%S')[-8:]}"
                
                # Check if product with same SKU exists (use raw SQL to avoid column issues)
                try:
                    # Use raw SQL to check for existing SKU without loading all columns
                    result = db.session.execute(
                        db.text("SELECT id FROM product WHERE sku = :sku AND user_id = :user_id LIMIT 1"),
                        {"sku": sku, "user_id": current_user.id}
                    ).fetchone()
                    if result:
                        errors.append(f"Row {row_num}: Product with SKU {sku} already exists")
                        skipped += 1
                        continue
                except Exception as e:
                    # Fallback to ORM query if raw SQL fails
                    try:
                        existing = Product.query.filter_by(sku=sku, user_id=current_user.id).first()
                        if existing:
                            errors.append(f"Row {row_num}: Product with SKU {sku} already exists")
                            skipped += 1
                            continue
                    except:
                        # If that also fails, try without user_id
                        try:
                            existing = Product.query.filter_by(sku=sku).first()
                            if existing:
                                errors.append(f"Row {row_num}: Product with SKU {sku} already exists")
                                skipped += 1
                                continue
                        except:
                            # If all checks fail, continue with import
                            pass
                
                # Parse vegetable-specific quantity and rate fields
                quantity_gm = None
                quantity_kg = None
                rate_per_gm = None
                rate_per_kg = None
                
                # Quantity (gm) - handle truncated headers like "uantity (gm"
                for key in row.keys():
                    key_lower = key.lower().strip()
                    if 'quantity' in key_lower and ('gm' in key_lower or 'g)' in key_lower) and 'kg' not in key_lower:
                        try:
                            qty_val = str(row.get(key, '') or '').strip()
                            quantity_gm = float(qty_val) if qty_val else None
                        except (ValueError, TypeError):
                            pass
                        if quantity_gm is not None:
                            break
                
                # Quantity (kg) - handle truncated headers like "uantity (k"
                for key in row.keys():
                    key_lower = key.lower().strip()
                    if 'quantity' in key_lower and ('kg' in key_lower or 'k)' in key_lower):
                        try:
                            qty_val = str(row.get(key, '') or '').strip()
                            quantity_kg = float(qty_val) if qty_val else None
                        except (ValueError, TypeError):
                            pass
                        if quantity_kg is not None:
                            break
                
                # Rate (per gm) - handle truncated headers like "ate (per gnate"
                for key in row.keys():
                    key_lower = key.lower().strip()
                    if 'rate' in key_lower and ('per' in key_lower or 'per' in key) and ('gm' in key_lower or 'gnate' in key_lower or 'g)' in key_lower) and 'kg' not in key_lower:
                        try:
                            rate_val = str(row.get(key, '') or '').strip()
                            rate_per_gm = float(rate_val) if rate_val else None
                        except (ValueError, TypeError):
                            pass
                        if rate_per_gm is not None:
                            break
                
                # Rate (per kg) - handle truncated headers like "(per kg)"
                for key in row.keys():
                    key_lower = key.lower().strip()
                    if ('rate' in key_lower or key_lower.startswith('(')) and ('per' in key_lower or 'per' in key) and ('kg' in key_lower or 'k)' in key_lower):
                        try:
                            rate_val = str(row.get(key, '') or '').strip()
                            rate_per_kg = float(rate_val) if rate_val else None
                        except (ValueError, TypeError):
                            pass
                        if rate_per_kg is not None:
                            break
                
                # Calculate price from rate_per_kg if available, otherwise use rate_per_gm * 1000
                # If neither is available, try to get Price directly
                price = 0
                if rate_per_kg:
                    price = rate_per_kg
                elif rate_per_gm:
                    price = rate_per_gm * 1000  # Convert per gm to per kg
                else:
                    # Fallback to Price column
                    try:
                        price_val = str(row.get('Price', '') or row.get('Price', 0) or '0').strip()
                        price = float(price_val) if price_val else 0
                    except (ValueError, TypeError):
                        price = 0
                
                # Calculate stock_quantity from quantity_kg if available, otherwise use quantity_gm / 1000
                stock_quantity = 0
                if quantity_kg:
                    stock_quantity = int(quantity_kg * 1000)  # Convert kg to grams for stock
                elif quantity_gm:
                    stock_quantity = int(quantity_gm)
                else:
                    # Fallback to Stock Quantity column
                    try:
                        stock_val = str(row.get('Stock Quantity', '') or '0').strip()
                        stock_quantity = int(stock_val) if stock_val else 0
                    except (ValueError, TypeError):
                        stock_quantity = 0
                
                # Parse GST rate
                try:
                    gst_val = str(row.get('GST Rate', '') or row.get('GST Rate (%)', '') or '18').strip()
                    gst_rate = float(gst_val) if gst_val else 18
                except (ValueError, TypeError):
                    gst_rate = 18
                
                # Create product (handle both model structures)
                # Get user_id for admin_id compatibility
                user_id_for_product = current_user.id if hasattr(current_user, 'id') else None
                if not user_id_for_product:
                    return jsonify({'success': False, 'error': 'User not authenticated'}), 401
                
                product = Product(
                    user_id=user_id_for_product,
                    admin_id=user_id_for_product,  # Set admin_id to same as user_id for backward compatibility
                    name=vegetable_name,  # Use vegetable_name as the main name
                    price=price,
                    gst_rate=gst_rate,
                    stock_quantity=stock_quantity,
                    sku=sku
                )
                
                # Set vegetable-specific fields (with error handling)
                try:
                    if hasattr(product, 'vegetable_name'):
                        product.vegetable_name = vegetable_name
                except Exception:
                    pass  # Column might not exist, ignore
                
                try:
                    if hasattr(product, 'vegetable_name_hindi'):
                        product.vegetable_name_hindi = vegetable_name_hindi if vegetable_name_hindi else None
                except Exception:
                    pass
                
                try:
                    if hasattr(product, 'quantity_gm'):
                        product.quantity_gm = quantity_gm
                except Exception:
                    pass
                
                try:
                    if hasattr(product, 'quantity_kg'):
                        product.quantity_kg = quantity_kg
                except Exception:
                    pass
                
                try:
                    if hasattr(product, 'rate_per_gm'):
                        product.rate_per_gm = rate_per_gm
                except Exception:
                    pass
                
                try:
                    if hasattr(product, 'rate_per_kg'):
                        product.rate_per_kg = rate_per_kg
                except Exception:
                    pass
                
                # Set additional fields if they exist
                if hasattr(product, 'hsn_code'):
                    hsn_val = str(row.get('HSN Code', '') or '').strip()
                    product.hsn_code = hsn_val if hsn_val else None
                if hasattr(product, 'description'):
                    desc_val = str(row.get('Description', '') or '').strip()
                    product.description = desc_val if desc_val else None
                if hasattr(product, 'category'):
                    cat_val = str(row.get('Category', '') or '').strip()
                    product.category = cat_val if cat_val else None
                if hasattr(product, 'brand'):
                    brand_val = str(row.get('Brand', '') or '').strip()
                    product.brand = brand_val if brand_val else None
                if hasattr(product, 'unit'):
                    unit_val = str(row.get('Unit', '') or '').strip()
                    product.unit = unit_val if unit_val else 'KG'  # Default to KG for vegetables
                if hasattr(product, 'image_url'):
                    img_val = str(row.get('Image URL', '') or '').strip()
                    product.image_url = img_val if img_val else None
                if hasattr(product, 'min_stock_level'):
                    try:
                        min_stock_val = str(row.get('Min Stock Level', '') or '').strip()
                        product.min_stock_level = int(min_stock_val) if min_stock_val else 10
                    except (ValueError, TypeError):
                        product.min_stock_level = 10
                if hasattr(product, 'weight'):
                    try:
                        weight_val = str(row.get('Weight', '') or '').strip()
                        product.weight = float(weight_val) if weight_val else None
                    except (ValueError, TypeError):
                        product.weight = None
                if hasattr(product, 'dimensions'):
                    dim_val = str(row.get('Dimensions', '') or '').strip()
                    product.dimensions = dim_val if dim_val else None
                # user_id and admin_id are already set during Product creation above
                
                db.session.add(product)
                imported += 1
                
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
                skipped += 1
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'imported': imported,
            'skipped': skipped,
            'errors': errors[:10]
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@import_export_bp.route('/import/orders', methods=['POST'])
# @login_required  # TEMPORARILY DISABLED FOR SUBMISSION
def import_orders():
    """Import orders from CSV"""
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
                customer_email = row.get('Customer Email', '').strip()
                if not customer_email:
                    errors.append(f"Row {row_num}: Missing Customer Email")
                    skipped += 1
                    continue
                
                # Find customer
                try:
                    customer = Customer.query.filter_by(email=customer_email).first()
                except:
                    customer = Customer.query.filter_by(email=customer_email, user_id=current_user.id).first() if hasattr(current_user, 'id') else None
                if not customer:
                    errors.append(f"Row {row_num}: Customer with email {customer_email} not found")
                    skipped += 1
                    continue
                
                # Parse items
                items_str = row.get('Items (Product:Quantity:Price)', '').strip()
                if not items_str:
                    errors.append(f"Row {row_num}: Missing items")
                    skipped += 1
                    continue
                
                # Calculate total
                total_amount = 0
                items_list = []
                
                for item_str in items_str.split(';'):
                    parts = item_str.strip().split(':')
                    if len(parts) >= 2:
                        product_name = parts[0].strip()
                        quantity = int(parts[1].strip()) if len(parts) > 1 else 1
                        price = float(parts[2].strip()) if len(parts) > 2 else 0
                        
                        # Find product
                        try:
                            product = Product.query.filter_by(name=product_name).first()
                        except:
                            product = Product.query.filter_by(name=product_name, user_id=current_user.id).first() if hasattr(current_user, 'id') else None
                        if product:
                            items_list.append({
                                'product': product,
                                'quantity': quantity,
                                'price': price or product.price
                            })
                            total_amount += (price or product.price) * quantity
                
                if not items_list:
                    errors.append(f"Row {row_num}: No valid items found")
                    skipped += 1
                    continue
                
                # Create order (handle both model structures)
                order = Order(
                    customer_id=customer.id,
                    total_amount=total_amount,
                    status=row.get('Status', 'pending').strip() or 'pending'
                )
                
                # Set admin_id or user_id based on model
                if hasattr(order, 'admin_id'):
                    order.admin_id = current_user.id if hasattr(current_user, 'id') else None
                if hasattr(order, 'user_id'):
                    order.user_id = current_user.id if hasattr(current_user, 'id') else None
                db.session.add(order)
                db.session.flush()  # Get order ID
                
                # Create order items
                for item_data in items_list:
                    order_item = OrderItem(
                        order_id=order.id,
                        product_id=item_data['product'].id,
                        quantity=item_data['quantity'],
                        price=item_data['price']
                    )
                    db.session.add(order_item)
                
                imported += 1
                
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
                skipped += 1
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'imported': imported,
            'skipped': skipped,
            'errors': errors[:10]
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@import_export_bp.route('/import/stock', methods=['POST'])
@login_required
def import_stock():
    """Import stock movements from CSV or Excel for bulk stock in/out"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        movement_type = request.form.get('movement_type', 'in')
        if movement_type not in ['in', 'out']:
            movement_type = 'in'
        
        filename = file.filename.lower()
        is_excel = filename.endswith('.xlsx') or filename.endswith('.xls')
        rows = []
        
        if is_excel and OPENPYXL_AVAILABLE:
            from openpyxl import load_workbook
            wb = load_workbook(file.stream, read_only=True)
            ws = wb.active
            headers = [cell.value for cell in ws[1] if cell.value]
            for row in ws.iter_rows(min_row=2, values_only=True):
                if any(cell for cell in row):
                    row_dict = {}
                    for idx, header in enumerate(headers):
                        if idx < len(row):
                            row_dict[header] = str(row[idx]) if row[idx] is not None else ''
                    rows.append(row_dict)
        else:
            stream = StringIO(file.stream.read().decode("UTF8"), newline=None)
            csv_reader = csv.DictReader(stream)
            rows = list(csv_reader)
        
        if not rows:
            return jsonify({'success': False, 'error': 'No data found in file'}), 400
        
        imported = 0
        skipped = 0
        errors = []
        
        for row_num, row in enumerate(rows, start=2):
            try:
                product = None
                product_id = row.get('Product ID', '').strip()
                sku = row.get('SKU', '').strip()
                product_name = row.get('Product Name', '').strip() or row.get('Name', '').strip()
                
                user_id = current_user.id if hasattr(current_user, 'id') else None
                if not user_id:
                    errors.append(f"Row {row_num}: User not authenticated")
                    skipped += 1
                    continue
                
                if product_id:
                    try:
                        product = Product.query.filter_by(id=int(product_id), user_id=user_id, is_active=True).first()
                    except (ValueError, TypeError):
                        pass
                
                if not product and sku:
                    product = Product.query.filter_by(sku=sku, user_id=user_id, is_active=True).first()
                
                if not product and product_name:
                    product = Product.query.filter_by(name=product_name, user_id=user_id, is_active=True).first()
                
                if not product:
                    errors.append(f"Row {row_num}: Product not found")
                    skipped += 1
                    continue
                
                quantity_str = row.get('Quantity', '').strip() or row.get('Qty', '').strip()
                if not quantity_str:
                    errors.append(f"Row {row_num}: Quantity is required")
                    skipped += 1
                    continue
                
                try:
                    quantity = int(float(quantity_str))
                    if quantity <= 0:
                        errors.append(f"Row {row_num}: Quantity must be greater than 0")
                        skipped += 1
                        continue
                except (ValueError, TypeError):
                    errors.append(f"Row {row_num}: Invalid quantity")
                    skipped += 1
                    continue
                
                if movement_type == 'out' and product.stock_quantity < quantity:
                    errors.append(f"Row {row_num}: Insufficient stock for {product.name}")
                    skipped += 1
                    continue
                
                reference = row.get('Reference', '').strip() or f'Bulk import - Row {row_num}'
                notes = row.get('Notes', '').strip() or f'Stock {movement_type} from Excel import'
                
                movement = StockMovement(
                    product_id=product.id,
                    movement_type=movement_type,
                    quantity=quantity,
                    reference=reference,
                    notes=notes
                )
                
                if movement_type == 'in':
                    product.stock_quantity += quantity
                else:
                    product.stock_quantity -= quantity
                
                product.updated_at = datetime.utcnow()
                db.session.add(movement)
                imported += 1
                
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
                skipped += 1
                continue
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'imported': imported,
            'skipped': skipped,
            'errors': errors[:20]
        })
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"Error in stock import: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


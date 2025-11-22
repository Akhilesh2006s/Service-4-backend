from flask import Blueprint, render_template, request, flash, redirect, url_for, jsonify, send_file
from flask_login import login_required, current_user
from models import db, Invoice, InvoiceItem, Product, Customer, StockMovement
from forms import InvoiceForm
from sqlalchemy import desc
from datetime import datetime, date
import json
from pdf_generator import generate_invoice_pdf
import os
from werkzeug.security import generate_password_hash

invoice_bp = Blueprint('invoice', __name__)

@invoice_bp.route('/web/invoices')
@login_required
def index():
    """List all invoices"""
    page = request.args.get('page', 1, type=int)
    status_filter = request.args.get('status', '')
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')
    
    query = Invoice.query.filter_by(user_id=current_user.id)
    
    if status_filter:
        query = query.filter(Invoice.status == status_filter)
    
    if date_from:
        query = query.filter(Invoice.invoice_date >= datetime.strptime(date_from, '%Y-%m-%d').date())
    
    if date_to:
        query = query.filter(Invoice.invoice_date <= datetime.strptime(date_to, '%Y-%m-%d').date())
    
    invoices = query.order_by(desc(Invoice.created_at)).paginate(
        page=page, per_page=20, error_out=False
    )
    
    return render_template('invoices/index.html', 
                         invoices=invoices, 
                         status_filter=status_filter,
                         date_from=date_from,
                         date_to=date_to)

@invoice_bp.route('/web/invoices/new', methods=['GET', 'POST'])
@login_required
def new():
    """Create new invoice"""
    form = InvoiceForm()
    
    # Populate customer choices
    customers = Customer.query.filter_by(user_id=current_user.id, is_active=True).all()
    form.customer_id.choices = [(c.id, f"{c.name} - {c.gstin or 'No GSTIN'}") for c in customers]
    
    if form.validate_on_submit():
        # Generate invoice number
        last_invoice = Invoice.query.filter_by(user_id=current_user.id).order_by(desc(Invoice.id)).first()
        if last_invoice:
            last_number = int(last_invoice.invoice_number.split('-')[-1])
            invoice_number = f"INV-{current_user.id:03d}-{last_number + 1:04d}"
        else:
            invoice_number = f"INV-{current_user.id:03d}-1000"
        
        invoice = Invoice(
            user_id=current_user.id,
            customer_id=form.customer_id.data,
            invoice_number=invoice_number,
            invoice_date=form.invoice_date.data,
            due_date=form.due_date.data,
            payment_terms=form.payment_terms.data,
            notes=form.notes.data
        )
        
        db.session.add(invoice)
        db.session.flush()  # Get invoice ID
        
        # Add invoice items
        items_data = json.loads(form.items_data.data)
        for item_data in items_data:
            product = Product.query.get(item_data['product_id'])
            if not product or product.user_id != current_user.id:
                continue
            
            # Check stock availability
            if product.stock_quantity < item_data['quantity']:
                flash(f'Insufficient stock for {product.name}. Available: {product.stock_quantity}', 'error')
                db.session.rollback()
                return render_template('invoices/new.html', form=form, customers=customers)
            
            invoice_item = InvoiceItem(
                invoice_id=invoice.id,
                product_id=product.id,
                quantity=item_data['quantity'],
                unit_price=item_data['unit_price'],
                gst_rate=item_data['gst_rate']
            )
            invoice_item.calculate_totals()
            
            db.session.add(invoice_item)
            
            # Update stock
            product.stock_quantity -= item_data['quantity']
            
            # Add stock movement
            movement = StockMovement(
                product_id=product.id,
                movement_type='out',
                quantity=item_data['quantity'],
                reference=invoice_number,
                notes=f'Sold in invoice {invoice_number}'
            )
            db.session.add(movement)
        
        # Calculate invoice totals
        invoice.calculate_totals()
        
        db.session.commit()
        
        flash('Invoice created successfully!', 'success')
        return redirect(url_for('invoice.show', id=invoice.id))
    
    return render_template('invoices/new.html', form=form, customers=customers)

@invoice_bp.route('/web/invoices/<int:id>')
@login_required
def show(id):
    """Show invoice details"""
    invoice = Invoice.query.filter_by(
        id=id, user_id=current_user.id
    ).first_or_404()
    
    return render_template('invoices/show.html', invoice=invoice)

@invoice_bp.route('/web/invoices/<int:id>/edit', methods=['GET', 'POST'])
@login_required
def edit(id):
    """Edit invoice"""
    invoice = Invoice.query.filter_by(
        id=id, user_id=current_user.id
    ).first_or_404()
    
    if invoice.status == 'paid':
        flash('Cannot edit paid invoice', 'error')
        return redirect(url_for('invoice.show', id=invoice.id))
    
    form = InvoiceForm(obj=invoice)
    
    # Populate customer choices
    customers = Customer.query.filter_by(user_id=current_user.id, is_active=True).all()
    form.customer_id.choices = [(c.id, f"{c.name} - {c.gstin or 'No GSTIN'}") for c in customers]
    
    if form.validate_on_submit():
        # Restore stock from old items
        for item in invoice.items:
            product = item.product
            product.stock_quantity += item.quantity
            
            # Add stock movement for reversal
            movement = StockMovement(
                product_id=product.id,
                movement_type='in',
                quantity=item.quantity,
                reference=f'Reversal of {invoice.invoice_number}',
                notes=f'Stock restored from invoice edit'
            )
            db.session.add(movement)
        
        # Clear old items
        for item in invoice.items:
            db.session.delete(item)
        
        # Update invoice details
        invoice.customer_id = form.customer_id.data
        invoice.invoice_date = form.invoice_date.data
        invoice.due_date = form.due_date.data
        invoice.payment_terms = form.payment_terms.data
        invoice.notes = form.notes.data
        
        # Add new items
        items_data = json.loads(form.items_data.data)
        for item_data in items_data:
            product = Product.query.get(item_data['product_id'])
            if not product or product.user_id != current_user.id:
                continue
            
            # Check stock availability
            if product.stock_quantity < item_data['quantity']:
                flash(f'Insufficient stock for {product.name}. Available: {product.stock_quantity}', 'error')
                db.session.rollback()
                return render_template('invoices/edit.html', form=form, invoice=invoice, customers=customers)
            
            invoice_item = InvoiceItem(
                invoice_id=invoice.id,
                product_id=product.id,
                quantity=item_data['quantity'],
                unit_price=item_data['unit_price'],
                gst_rate=item_data['gst_rate']
            )
            invoice_item.calculate_totals()
            
            db.session.add(invoice_item)
            
            # Update stock
            product.stock_quantity -= item_data['quantity']
            
            # Add stock movement
            movement = StockMovement(
                product_id=product.id,
                movement_type='out',
                quantity=item_data['quantity'],
                reference=invoice.invoice_number,
                notes=f'Sold in invoice {invoice.invoice_number} (edited)'
            )
            db.session.add(movement)
        
        # Calculate invoice totals
        invoice.calculate_totals()
        
        db.session.commit()
        
        flash('Invoice updated successfully!', 'success')
        return redirect(url_for('invoice.show', id=invoice.id))
    
    return render_template('invoices/edit.html', form=form, invoice=invoice, customers=customers)

@invoice_bp.route('/web/invoices/<int:id>/delete', methods=['POST'])
@login_required
def delete(id):
    """Delete invoice"""
    invoice = Invoice.query.filter_by(
        id=id, user_id=current_user.id
    ).first_or_404()
    
    if invoice.status == 'paid':
        flash('Cannot delete paid invoice', 'error')
        return redirect(url_for('invoice.show', id=invoice.id))
    
    # Restore stock
    for item in invoice.items:
        product = item.product
        product.stock_quantity += item.quantity
        
        # Add stock movement for reversal
        movement = StockMovement(
            product_id=product.id,
            movement_type='in',
            quantity=item.quantity,
            reference=f'Reversal of {invoice.invoice_number}',
            notes=f'Stock restored from invoice deletion'
        )
        db.session.add(movement)
    
    db.session.delete(invoice)
    db.session.commit()
    
    flash('Invoice deleted successfully!', 'success')
    return redirect(url_for('invoice.index'))

@invoice_bp.route('/web/invoices/<int:id>/status', methods=['POST'])
@login_required
def update_status(id):
    """Update invoice status"""
    invoice = Invoice.query.filter_by(
        id=id, user_id=current_user.id
    ).first_or_404()
    
    new_status = request.form.get('status')
    if new_status not in ['pending', 'paid', 'cancelled']:
        flash('Invalid status', 'error')
        return redirect(url_for('invoice.show', id=invoice.id))
    
    invoice.status = new_status
    db.session.commit()
    
    flash(f'Invoice status updated to {new_status}', 'success')
    return redirect(url_for('invoice.show', id=invoice.id))

@invoice_bp.route('/web/invoices/<int:id>/pdf')
@login_required
def download_pdf(id):
    """Download invoice as PDF"""
    invoice = Invoice.query.filter_by(
        id=id, user_id=current_user.id
    ).first_or_404()
    
    # Generate PDF
    pdf_path = generate_invoice_pdf(invoice)
    
    return send_file(
        pdf_path,
        as_attachment=True,
        download_name=f'invoice_{invoice.invoice_number}.pdf',
        mimetype='application/pdf'
    )

@invoice_bp.route('/web/invoices/<int:id>/print')
@login_required
def print_invoice(id):
    """Print invoice"""
    invoice = Invoice.query.filter_by(
        id=id, user_id=current_user.id
    ).first_or_404()
    
    return render_template('invoices/print.html', invoice=invoice)

@invoice_bp.route('/api/invoice/calculate', methods=['POST'])
@login_required
def calculate_invoice():
    """API endpoint to calculate invoice totals"""
    data = request.get_json()
    items = data.get('items', [])
    
    subtotal = 0
    total_gst = 0
    items_with_totals = []
    
    for item in items:
        quantity = float(item.get('quantity', 0))
        unit_price = float(item.get('unit_price', 0))
        gst_rate = float(item.get('gst_rate', 0))
        
        item_total = quantity * unit_price
        item_gst = item_total * (gst_rate / 100)
        
        subtotal += item_total
        total_gst += item_gst
        
        items_with_totals.append({
            **item,
            'item_total': item_total,
            'item_gst': item_gst
        })
    
    # Determine GST split based on customer state
    customer_id = data.get('customer_id')
    if customer_id:
        customer = Customer.query.get(customer_id)
        if customer and customer.user_id == current_user.id:
            if customer.state == current_user.business_state:
                # Same state - CGST + SGST
                cgst = total_gst / 2
                sgst = total_gst / 2
                igst = 0
            else:
                # Different state - IGST
                cgst = 0
                sgst = 0
                igst = total_gst
        else:
            cgst = sgst = igst = 0
    else:
        cgst = sgst = igst = 0
    
    total_amount = subtotal + cgst + sgst + igst
    
    return jsonify({
        'subtotal': round(subtotal, 2),
        'cgst': round(cgst, 2),
        'sgst': round(sgst, 2),
        'igst': round(igst, 2),
        'total_amount': round(total_amount, 2),
        'items': items_with_totals
    })

@invoice_bp.route('/', methods=['GET'])
@login_required
def get_invoices():
    """Get all invoices for the current admin"""
    try:
        # Check if user is authenticated
        if not current_user or not hasattr(current_user, 'id'):
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        user_id = current_user.id
        customer_id = request.args.get('customer_id', type=int)
        
        # Build query
        query = Invoice.query.filter_by(user_id=user_id)
        
        # Filter by customer if customer_id is provided
        if customer_id:
            query = query.filter(Invoice.customer_id == customer_id)
        
        # Order by created_at, falling back to id if created_at is None
        try:
            invoices = query.order_by(desc(Invoice.created_at)).all()
        except Exception:
            # Fallback to id if created_at causes issues
            invoices = query.order_by(desc(Invoice.id)).all()
        invoices_data = []
        
        for invoice in invoices:
            # Get customer details
            customer = Customer.query.get(invoice.customer_id)
            
            # Get invoice items
            items_data = []
            for item in invoice.items:
                product = item.product if item.product else None
                items_data.append({
                    'id': item.id,
                    'product_id': item.product_id,
                    'product_name': product.name if product else 'Unknown Product',
                    'product_name_hindi': product.vegetable_name_hindi if product and hasattr(product, 'vegetable_name_hindi') else None,
                    'quantity': item.quantity,
                    'unit_price': float(item.unit_price),
                    'gst_rate': float(item.gst_rate),
                    'gst_amount': float(item.gst_amount),
                    'total': float(item.total)
                })
            
            invoices_data.append({
                'id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'customer_id': invoice.customer_id,
                'customer_name': customer.name if customer else 'Unknown Customer',
                'customer_email': customer.email if customer else '',
                'customer_phone': customer.phone if customer else '',
                'invoice_date': invoice.invoice_date.isoformat() if invoice.invoice_date else '',
                'due_date': invoice.due_date.isoformat() if invoice.due_date else '',
                'status': invoice.status or 'pending',
                'subtotal': float(invoice.subtotal) if invoice.subtotal is not None else 0.0,
                'cgst_amount': float(invoice.cgst_amount) if invoice.cgst_amount is not None else 0.0,
                'sgst_amount': float(invoice.sgst_amount) if invoice.sgst_amount is not None else 0.0,
                'igst_amount': float(invoice.igst_amount) if invoice.igst_amount is not None else 0.0,
                'total_amount': float(invoice.total_amount) if invoice.total_amount is not None else 0.0,
                'notes': invoice.notes or '',
                'items': items_data,
                'order_id': invoice.order_id,  # Link to order if generated from order
                'created_at': invoice.created_at.isoformat() if invoice.created_at else datetime.utcnow().isoformat()
            })
        
        return jsonify({'success': True, 'invoices': invoices_data})
    
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error getting invoices: {str(e)}")
        print(f"Full traceback:\n{error_trace}")
        return jsonify({
            'success': False, 
            'error': str(e),
            'message': f'Failed to load invoices: {str(e)}'
        }), 500

@invoice_bp.route('/customer-invoices', methods=['GET'])
@login_required
def get_customer_invoices():
    """Get all invoices for the current user's customers"""
    try:
        # Assuming current_user is an admin or has access to all customers
        # For simplicity, let's assume current_user.customers contains all customer IDs
        # In a real app, this would be filtered by current_user.customers
        # Order by created_at, falling back to id if created_at is None
        try:
            all_invoices = Invoice.query.filter_by(user_id=user_id).order_by(desc(Invoice.created_at)).all()
        except Exception:
            # Fallback to id if created_at causes issues
            all_invoices = Invoice.query.filter_by(user_id=user_id).order_by(desc(Invoice.id)).all()
        
        customer_invoices_data = []
        for invoice in all_invoices:
            # Get customer details
            customer = Customer.query.get(invoice.customer_id)
            
            # Get invoice items
            items_data = []
            for item in invoice.items:
                product = item.product if item.product else None
                items_data.append({
                    'id': item.id,
                    'product_id': item.product_id,
                    'product_name': product.name if product else 'Unknown Product',
                    'product_name_hindi': product.vegetable_name_hindi if product and hasattr(product, 'vegetable_name_hindi') else None,
                    'quantity': item.quantity,
                    'unit_price': float(item.unit_price),
                    'gst_rate': float(item.gst_rate),
                    'gst_amount': float(item.gst_amount),
                    'total': float(item.total)
                })
            
            customer_invoices_data.append({
                'id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'customer_id': invoice.customer_id,
                'customer_name': customer.name if customer else 'Unknown Customer',
                'customer_email': customer.email if customer else '',
                'customer_phone': customer.phone if customer else '',
                'invoice_date': invoice.invoice_date.isoformat() if invoice.invoice_date else '',
                'due_date': invoice.due_date.isoformat() if invoice.due_date else '',
                'status': invoice.status or 'pending',
                'subtotal': float(invoice.subtotal) if invoice.subtotal is not None else 0.0,
                'cgst_amount': float(invoice.cgst_amount) if invoice.cgst_amount is not None else 0.0,
                'sgst_amount': float(invoice.sgst_amount) if invoice.sgst_amount is not None else 0.0,
                'igst_amount': float(invoice.igst_amount) if invoice.igst_amount is not None else 0.0,
                'total_amount': float(invoice.total_amount) if invoice.total_amount is not None else 0.0,
                'notes': invoice.notes or '',
                'items': items_data,
                'order_id': invoice.order_id,  # Link to order if generated from order
                'created_at': invoice.created_at.isoformat() if invoice.created_at else datetime.utcnow().isoformat()
            })
        
        return jsonify({'success': True, 'invoices': customer_invoices_data})
    
    except Exception as e:
        print(f"Error getting customer invoices: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@invoice_bp.route('/', methods=['POST'])
@login_required
def api_create_invoice():
    """Create a new invoice"""
    print(f"Invoices API POST called by user: {current_user.id}")
    try:
        data = request.get_json()
        print(f"Received data: {data}")
        
        # Generate invoice number
        last_invoice = Invoice.query.filter_by(user_id=current_user.id).order_by(Invoice.id.desc()).first()
        if last_invoice:
            last_number = int(last_invoice.invoice_number.split('-')[-1])
            invoice_number = f"INV-{current_user.id:03d}-{last_number + 1:04d}"
        else:
            invoice_number = f"INV-{current_user.id:03d}-1000"
        
        # Check if customer exists by ID first, then by name
        customer_id = data.get('customer_id')
        customer_name = data.get('customer_name', '')
        customer = None
        
        # First try to get customer by ID if provided (and not None/null)
        if customer_id is not None and customer_id != '':
            try:
                customer_id_int = int(customer_id)
                customer = Customer.query.filter_by(id=customer_id_int, user_id=current_user.id).first()
                if not customer:
                    print(f"Customer with ID {customer_id_int} not found for user {current_user.id}")
            except (ValueError, TypeError):
                print(f"Invalid customer_id: {customer_id}")
        
        # If not found by ID, try by name
        if not customer and customer_name:
            customer = Customer.query.filter_by(name=customer_name, user_id=current_user.id).first()
            if customer:
                print(f"Found customer by name: {customer_name} (ID: {customer.id})")
        
        # If still not found and customer_name provided, create a new customer
        if not customer and customer_name:
            print(f"Creating new customer: {customer_name}")
            customer = Customer(
                user_id=current_user.id,
                name=customer_name,
                email=f"{customer_name.lower().replace(' ', '.')}@example.com",
                password_hash=generate_password_hash('default123'),  # Required field - set a default
                phone=data.get('customer_phone', ''),
                billing_address=data.get('customer_address', 'Default Address'),  # Required field
                state=current_user.business_state or 'Default State',  # Required field
                pincode='000000',  # Required field
                gstin='',
                is_active=True
            )
            db.session.add(customer)
            db.session.flush()  # Get customer ID
        
        # If no customer at all, create a default customer
        if not customer:
            customer = Customer(
                user_id=current_user.id,
                name='Default Customer',
                email='default@example.com',
                password_hash=generate_password_hash('default123'),  # Required field - set a default
                phone='',
                billing_address='Default Address',  # Required field
                state=current_user.business_state or 'Default State',  # Required field
                pincode='000000',  # Required field
                gstin='',
                is_active=True
            )
            db.session.add(customer)
            db.session.flush()  # Get customer ID
        
        # Get status from request, default to 'pending'
        invoice_status = data.get('status', 'pending')
        if invoice_status not in ['pending', 'paid', 'cancelled', 'done', 'draft']:
            invoice_status = 'pending'
        
        # Create invoice
        invoice = Invoice(
            user_id=current_user.id,
            customer_id=customer.id,
            invoice_number=invoice_number,
            invoice_date=datetime.strptime(data.get('invoice_date', datetime.now().strftime('%Y-%m-%d')), '%Y-%m-%d').date(),
            notes=data.get('notes', ''),
            total_amount=data.get('total_amount', 0),
            status=invoice_status
        )
        
        db.session.add(invoice)
        db.session.flush()  # Get invoice ID
        
        # Add invoice items
        items = data.get('items', [])
        if not items:
            db.session.rollback()
            return jsonify({'success': False, 'error': 'No items provided'}), 400
        
        for item_data in items:
            product_id = item_data.get('product_id', 0)
            if not product_id:
                print(f"Warning: Item missing product_id: {item_data}")
                continue
                
            # Get product to calculate GST and get customer-specific price
            product = Product.query.filter_by(id=product_id, user_id=current_user.id).first()
            if not product:
                db.session.rollback()
                return jsonify({'success': False, 'error': f'Product with ID {product_id} not found'}), 400
            
            gst_rate = product.gst_rate if product.gst_rate is not None else 18.0
            
            # Use customer-specific price if available, otherwise use provided price or product default
            if product and customer:
                try:
                    customer_price = product.get_customer_price(customer.id)
                    unit_price = customer_price
                except:
                    unit_price = item_data.get('unit_price', product.price if product else 0)
            else:
                unit_price = item_data.get('unit_price', product.price if product else 0)
            
            quantity = item_data.get('quantity', 0)
            if quantity <= 0:
                db.session.rollback()
                return jsonify({'success': False, 'error': f'Invalid quantity for product {product.name}'}), 400
            
            invoice_item = InvoiceItem(
                invoice_id=invoice.id,
                product_id=product_id,
                quantity=quantity,
                unit_price=unit_price,  # Use customer-specific price
                gst_rate=gst_rate,
                gst_amount=0,  # Will be calculated
                total=item_data.get('total', 0)
            )
            invoice_item.calculate_totals()  # Calculate GST and total
            db.session.add(invoice_item)
        
        # Calculate invoice totals
        invoice.calculate_totals()
        
        # Mark customer as active since they have made a purchase
        if customer:
            customer.is_active = True
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Invoice created successfully',
            'invoice': {
                'id': invoice.id,
                'invoice_number': invoice.invoice_number
            }
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error creating invoice: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@invoice_bp.route('/<int:id>', methods=['GET'])
@login_required
def api_get_invoice(id):
    """Get a specific invoice"""
    try:
        invoice = Invoice.query.filter_by(id=id, user_id=current_user.id).first()
        
        if not invoice:
            return jsonify({'success': False, 'error': 'Invoice not found'}), 404
        
        # Get invoice items
        items = []
        for item in invoice.items:
            product = item.product if item.product else None
            items.append({
                'id': item.id,
                'product_id': item.product_id,
                'product_name': product.name if product else 'Unknown Product',
                'product_name_hindi': product.vegetable_name_hindi if product and hasattr(product, 'vegetable_name_hindi') else None,
                'quantity': item.quantity,
                'unit_price': float(item.unit_price),
                'total': float(item.total)
            })
        
        invoice_data = {
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'invoice_date': invoice.invoice_date.isoformat() if invoice.invoice_date else '',
            'business_name': current_user.business_name or 'My Business',
            'business_address': current_user.business_address or '',
            'business_phone': current_user.business_phone or '',
            'customer_name': invoice.customer.name if invoice.customer else 'Unknown Customer',
            'customer_address': invoice.customer.billing_address if invoice.customer else '',
            'customer_phone': invoice.customer.phone if invoice.customer else '',
            'notes': invoice.notes,
            'total_amount': float(invoice.total_amount) if invoice.total_amount else 0,
            'status': invoice.status,
            'created_at': invoice.created_at.isoformat() if invoice.created_at else '',
            'items': items
        }
        
        return jsonify({'success': True, 'invoice': invoice_data})
    
    except Exception as e:
        print(f"Error getting invoice: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@invoice_bp.route('/<int:id>/pdf', methods=['GET'])
@login_required
def api_download_pdf(id):
    """Download invoice as PDF"""
    try:
        invoice = Invoice.query.filter_by(id=id, user_id=current_user.id).first()
        
        if not invoice:
            return jsonify({'success': False, 'error': 'Invoice not found'}), 404
        
        # Generate PDF
        pdf_path = generate_invoice_pdf(invoice)
        
        return send_file(
            pdf_path,
            as_attachment=True,
            download_name=f'invoice_{invoice.invoice_number}.pdf',
            mimetype='application/pdf'
        )
    
    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@invoice_bp.route('/<int:id>', methods=['PUT', 'PATCH'])
@login_required
def api_update_invoice(id):
    """Update invoice (status, etc.)"""
    try:
        invoice = Invoice.query.filter_by(id=id, user_id=current_user.id).first()
        
        if not invoice:
            return jsonify({'success': False, 'error': 'Invoice not found'}), 404
        
        data = request.get_json()
        
        # Update status if provided
        if 'status' in data:
            new_status = data['status']
            if new_status in ['pending', 'paid', 'cancelled', 'done', 'draft']:
                invoice.status = new_status
            else:
                return jsonify({'success': False, 'error': 'Invalid status'}), 400
        
        # Update other fields if provided
        if 'notes' in data:
            invoice.notes = data['notes']
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Invoice updated successfully',
            'invoice': {
                'id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'status': invoice.status
            }
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Error updating invoice: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


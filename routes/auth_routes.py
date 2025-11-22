from flask import Blueprint, render_template, request, flash, redirect, url_for, session, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash
from models import db, User
from forms import LoginForm, RegistrationForm, ProfileForm
import re

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/')
def index():
    """Landing page - bypassed for now"""
    return jsonify({
        'success': True,
        'message': 'Landing page bypassed for development'
    })

@auth_bp.route('/login', methods=['POST', 'OPTIONS'])
def login():
    """Admin login"""
    # Handle OPTIONS for CORS preflight
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        # Check if request has JSON data
        if not request.is_json:
            return jsonify({'success': False, 'message': 'Content-Type must be application/json'}), 400
        
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'success': False, 'message': 'Email and password are required'}), 400
        
        # Check if it's an admin user
        try:
            user = User.query.filter_by(email=email).first()
        except Exception as db_error:
            import traceback
            traceback.print_exc()
            return jsonify({
                'success': False,
                'message': f'Database error: {str(db_error)}'
            }), 500
        
        # Debug logging (remove in production)
        if not user:
            return jsonify({
                'success': False, 
                'message': 'No account found with this email address. Please check your email or register first.'
            }), 401
        
        # Check if user is active
        if not user.is_active:
            return jsonify({
                'success': False,
                'message': 'Your account has been deactivated. Please contact support.'
            }), 401
        
        # Check password
        try:
            password_valid = user.check_password(password)
        except Exception as pwd_error:
            import traceback
            traceback.print_exc()
            return jsonify({
                'success': False,
                'message': f'Password verification error: {str(pwd_error)}'
            }), 500
        
        if not password_valid:
            return jsonify({
                'success': False,
                'message': 'Invalid password. Please check your password and try again.'
            }), 401
        
        # Check if user is approved (optional - you may want to allow unapproved users)
        # For now, we'll allow login but you can uncomment this if needed:
        # if not user.is_approved:
        #     return jsonify({
        #         'success': False,
        #         'message': 'Your account is pending approval. Please wait for admin approval.'
        #     }), 401
        
        # All checks passed - log in the user
        login_user(user, remember=data.get('remember_me', False))
        session.permanent = True
        
        # Build user response safely
        user_data = {
            'id': user.id,
            'username': getattr(user, 'username', ''),
            'email': getattr(user, 'email', ''),
            'business_name': getattr(user, 'business_name', '') or ''
        }
        
        return jsonify({
            'success': True,
            'message': 'Login successful!',
            'user': user_data
        })
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@auth_bp.route('/register', methods=['POST'])
def register():
    """Admin registration"""
    try:
        data = request.get_json()
        
        # Check if username or email already exists
        if User.query.filter_by(username=data.get('name', '')).first():
            return jsonify({'success': False, 'message': 'Username already exists'}), 400
        
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'success': False, 'message': 'Email already registered'}), 400
        
        # Create new admin user - auto-approved
        user = User(
            username=data.get('username') or data.get('name') or data['email'].split('@')[0],
            email=data['email'],
            business_name=data.get('business_name', 'My Business'),
            gst_number=data.get('gst_number', '00AAAAA0000A1Z5'),
            business_address=data.get('business_address', 'Business Address'),
            business_phone=data.get('business_phone', '1234567890'),
            business_email=data['email'],
            business_state=data.get('business_state', 'Delhi'),
            business_pincode=data.get('business_pincode', '110001'),
            business_reason=data.get('business_reason', 'Business reason not provided'),
            is_approved=True,  # Auto-approve all admin registrations
            is_active=True
        )
        user.set_password(data['password'])
        
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

@auth_bp.route('/logout')
def logout():
    """User logout - bypassed for now"""
    return jsonify({
        'success': True,
        'message': 'Logout successful'
    })

@auth_bp.route('/profile', methods=['GET', 'POST'])
def profile():
    """User profile management - bypassed for now"""
    return jsonify({
        'success': True,
        'message': 'Profile management bypassed for development',
        'user': {
            'id': 1,
            'username': 'demo',
            'email': 'demo@example.com',
            'business_name': 'Demo Business'
        }
    })

@auth_bp.route('/check', methods=['GET'])
def check_auth():
    """Check if user is authenticated and return user type"""
    try:
        # Safely check if user is authenticated
        is_authenticated = False
        user_type = None
        user_id = None
        
        try:
            # Check if current_user exists and is authenticated
            if hasattr(current_user, 'is_authenticated') and current_user.is_authenticated:
                is_authenticated = True
                user_id = current_user.id if hasattr(current_user, 'id') else None
                
                # Determine user type
                if hasattr(current_user, 'is_admin') and current_user.is_admin:
                    user_type = 'admin'
                else:
                    user_type = 'admin'  # Default to admin for User model
        except Exception as auth_check_error:
            # If there's an error checking authentication, user is not authenticated
            is_authenticated = False
            user_type = None
        
        return jsonify({
            'authenticated': is_authenticated,
            'user_type': user_type,
            'user_id': user_id
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'authenticated': False,
            'user_type': None,
            'error': str(e)
        }), 500

def is_valid_gst(gst_number):
    """Validate GST number format"""
    # GST number should be 15 characters: 2 digits + 10 digits + 1 digit + 1 digit + 1 digit
    pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
    return bool(re.match(pattern, gst_number))


import os
import jwt
import secrets
import urllib.request
import json
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User

auth_bp = Blueprint('auth', __name__)
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-retail-key-2026")

def get_client_ip():
    if request.headers.getlist("X-Forwarded-For"):
        return request.headers.getlist("X-Forwarded-For")[0].split(',')[0].strip()
    return request.remote_addr or '127.0.0.1'

# Import Flask-Limiter for rate limiting
try:
    from flask_limiter import Limiter
    limiter = Limiter(
        key_func=get_client_ip,
        storage_uri="memory://",
        headers_enabled=True,
        swallow_errors=True
    )
except ImportError:
    class DummyLimiter:
        def limit(self, *args, **kwargs):
            def decorator(f):
                return f
            return decorator
        def init_app(self, app):
            pass
    limiter = DummyLimiter()

# Helper to verify Cloudflare Turnstile token
def verify_turnstile(token):
    secret_key = os.getenv("TURNSTILE_SECRET_KEY")
    if not secret_key:
        print("[TURNSTILE] Warning: TURNSTILE_SECRET_KEY not set. Skipping Turnstile verification.")
        return True
    
    if not token:
        return False
        
    try:
        url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
        data = urllib.parse.urlencode({
            'secret': secret_key,
            'response': token,
            'remoteip': request.remote_addr
        }).encode('utf-8')
        
        req = urllib.request.Request(url, data=data, method='POST')
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            return res_data.get('success', False)
    except Exception as e:
        print("[TURNSTILE] Error verifying token:", e)
        return False

# Helper for authentication token check
def get_current_user():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    if token.startswith('clerk_auth_'):
        clerk_id = token.replace('clerk_auth_', '')
        # Auto-create or fetch Clerk user record in Neon database
        try:
            user_email = request.headers.get('X-Clerk-User-Email') or f"{clerk_id}@clerk.user"
            user_name = request.headers.get('X-Clerk-User-Name') or f"clerk_{clerk_id[:8]}"
            user = User.query.filter((User.email == user_email) | (User.username == user_name)).first()
            if not user:
                user = User(
                    username=user_name,
                    email=user_email,
                    password_hash=generate_password_hash(secrets.token_hex(16)),
                    role='customer',
                    is_verified=True
                )
                db.session.add(user)
                db.session.commit()
            elif not user.is_verified:
                user.is_verified = True
                db.session.commit()
            return {'user_id': user.id, 'username': user.username, 'email': user.email, 'role': user.role, 'clerk_id': clerk_id}
        except Exception as e:
            print("Error syncing Clerk user to database:", e)
            db.session.rollback()
            return {'user_id': 9999, 'username': 'Clerk Customer', 'email': 'clerk@store.com', 'role': 'customer', 'clerk_id': clerk_id}
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except Exception as e:
        print("JWT Decode Error:", e)
        return None

@auth_bp.route('/api/auth/register', methods=['POST'])
@limiter.limit("5 per minute")
def register():
    data = request.get_json() or {}
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'customer') # 'customer' or 'admin'
    turnstile_token = data.get('turnstile_token')
    
    # 1. Turnstile Bot Protection Check
    if os.getenv("TURNSTILE_SECRET_KEY") and not verify_turnstile(turnstile_token):
        return jsonify({'error': 'Bot verification failed. Please try again.'}), 400
        
    if not username or not email or not password:
        return jsonify({'error': 'Missing required registration fields'}), 400
        
    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify({'error': 'Username or Email already registered'}), 400
        
    pw_hash = generate_password_hash(password)
    
    # 2. Email Verification Setup
    verification_token = secrets.token_hex(32)
    # Admin users are verified automatically to avoid disrupting demo setup
    is_verified = (role == 'admin')
    
    user = User(
        username=username, 
        email=email, 
        password_hash=pw_hash, 
        role=role,
        is_verified=is_verified,
        verification_token=verification_token
    )
    db.session.add(user)
    db.session.commit()
    
    # Send mock verification email
    if not is_verified:
        print(f"\n==================================================")
        print(f"[MOCK EMAIL DISPATCH]")
        print(f"To: {email}")
        print(f"Subject: Verify your TEGL Retail Account")
        print(f"Verification Link: http://localhost:5173/verify-email?token={verification_token}")
        print(f"==================================================\n")
    
    return jsonify(user.to_dict()), 201

@auth_bp.route('/api/auth/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    data = request.get_json() or {}
    username_or_email = data.get('username')
    password = data.get('password')
    turnstile_token = data.get('turnstile_token')
    
    # 1. Turnstile Bot Protection Check
    if os.getenv("TURNSTILE_SECRET_KEY") and not verify_turnstile(turnstile_token):
        return jsonify({'error': 'Bot verification failed. Please try again.'}), 400
        
    if not username_or_email or not password:
        return jsonify({'error': 'Username/Email and Password are required'}), 400
        
    user = User.query.filter((User.username == username_or_email) | (User.email == username_or_email)).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid username/email or password'}), 401
        
    # 2. Prevent Login for Unverified Users
    if not user.is_verified:
        return jsonify({
            'error': 'Your email address is not verified. Please verify your email first.',
            'unverified': True,
            'email': user.email
        }), 403
        
    # Generate token
    payload = {
        'user_id': user.id,
        'username': user.username,
        'role': user.role,
        'exp': datetime.utcnow() + timedelta(days=1)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    
    return jsonify({
        'token': token,
        'user': user.to_dict()
    }), 200

@auth_bp.route('/api/auth/change-password', methods=['POST'])
@limiter.limit("3 per minute")
def change_password():
    data = request.get_json() or {}
    username_or_email = data.get('username')
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    
    if not username_or_email or not old_password or not new_password:
        return jsonify({'error': 'All fields are required'}), 400
        
    user = User.query.filter((User.username == username_or_email) | (User.email == username_or_email)).first()
    if not user or not check_password_hash(user.password_hash, old_password):
        return jsonify({'error': 'Invalid username/email or old password'}), 401
        
    user.password_hash = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({'message': 'Password changed successfully'}), 200

@auth_bp.route('/api/auth/verify', methods=['POST'])
def verify_email():
    data = request.get_json() or {}
    token = data.get('token')
    
    if not token:
        return jsonify({'error': 'Verification token is required'}), 400
        
    user = User.query.filter_by(verification_token=token).first()
    if not user:
        return jsonify({'error': 'Invalid or expired verification token'}), 400
        
    user.is_verified = True
    user.verification_token = None
    db.session.commit()
    
    return jsonify({'message': 'Email verified successfully! You can now log in.'}), 200

@auth_bp.route('/api/auth/resend-verification', methods=['POST'])
@limiter.limit("3 per minute")
def resend_verification():
    data = request.get_json() or {}
    email = data.get('email')
    
    if not email:
        return jsonify({'error': 'Email is required'}), 400
        
    user = User.query.filter_by(email=email).first()
    if not user:
        # Avoid user enumeration by returning a generic success message
        return jsonify({'message': 'If the email exists, a new verification link has been sent.'}), 200
        
    if user.is_verified:
        return jsonify({'message': 'Email is already verified.'}), 200
        
    new_token = secrets.token_hex(32)
    user.verification_token = new_token
    db.session.commit()
    
    print(f"\n==================================================")
    print(f"[MOCK EMAIL DISPATCH - RESEND]")
    print(f"To: {email}")
    print(f"Subject: Verify your TEGL Retail Account")
    print(f"Verification Link: http://localhost:5173/verify-email?token={new_token}")
    print(f"==================================================\n")
    
    return jsonify({'message': 'If the email exists, a new verification link has been sent.'}), 200

@auth_bp.route('/api/auth/google', methods=['POST'])
@limiter.limit("10 per minute")
def google_signin():
    data = request.get_json() or {}
    credential = data.get('credential')
    
    if not credential:
        return jsonify({'error': 'Google credential token is required'}), 400
        
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    
    try:
        # In a test environment without a client_id configured, we can decode JWT insecurely for ease of demonstration,
        # but in production/proper configuration we require validation.
        if client_id:
            idinfo = id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)
        else:
            # Fallback decoding without verification for development/testing if no CLIENT ID is set
            print("[GOOGLE AUTH] Warning: GOOGLE_CLIENT_ID not set. Decoding token insecurely for development/testing.")
            # JWT format: Header.Payload.Signature
            payload_part = credential.split('.')[1]
            # Add padding if needed
            payload_part += '=' * (4 - len(payload_part) % 4)
            import base64
            idinfo = json.loads(base64.b64decode(payload_part).decode('utf-8'))
            
        email = idinfo.get('email')
        name = idinfo.get('name', email.split('@')[0] if email else 'Google User')
        
        if not email:
            return jsonify({'error': 'Email not provided by Google account'}), 400
            
    except Exception as e:
        print("[GOOGLE AUTH] Error verifying Google credential:", e)
        return jsonify({'error': 'Invalid Google credential token'}), 400
        
    # Check if user already exists
    user = User.query.filter_by(email=email).first()
    
    if not user:
        # Create user automatically
        # Base username on email name
        base_username = email.split('@')[0]
        username = base_username
        suffix = 1
        while User.query.filter_by(username=username).first():
            username = f"{base_username}{suffix}"
            suffix += 1
            
        random_pw = secrets.token_hex(16)
        pw_hash = generate_password_hash(random_pw)
        
        user = User(
            username=username,
            email=email,
            password_hash=pw_hash,
            role='customer',
            is_verified=True, # Google Sign-In emails are pre-verified
            verification_token=None
        )
        db.session.add(user)
        db.session.commit()
    else:
        # Ensure user is verified if signing in via Google
        if not user.is_verified:
            user.is_verified = True
            user.verification_token = None
            db.session.commit()
            
    # Generate app JWT token
    payload = {
        'user_id': user.id,
        'username': user.username,
        'role': user.role,
        'exp': datetime.utcnow() + timedelta(days=1)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    
    return jsonify({
        'token': token,
        'user': user.to_dict()
    }), 200

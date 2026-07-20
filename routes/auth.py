import os
import jwt
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User

auth_bp = Blueprint('auth', __name__)
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-retail-key-2026")

# Helper for authentication token check
def get_current_user():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except Exception as e:
        print("JWT Decode Error:", e)
        return None

@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'customer') # 'customer' or 'admin'
    
    if not username or not email or not password:
        return jsonify({'error': 'Missing required registration fields'}), 400
        
    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify({'error': 'Username or Email already registered'}), 400
        
    pw_hash = generate_password_hash(password)
    user = User(username=username, email=email, password_hash=pw_hash, role=role)
    db.session.add(user)
    db.session.commit()
    
    return jsonify(user.to_dict()), 201

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username_or_email = data.get('username')
    password = data.get('password')
    
    if not username_or_email or not password:
        return jsonify({'error': 'Username/Email and Password are required'}), 400
        
    user = User.query.filter((User.username == username_or_email) | (User.email == username_or_email)).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid username/email or password'}), 401
        
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


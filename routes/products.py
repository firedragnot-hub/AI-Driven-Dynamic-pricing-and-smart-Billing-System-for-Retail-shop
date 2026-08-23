from flask import Blueprint, request, jsonify
from models import db, Product, TransactionItem, Review
from datetime import datetime
from sqlalchemy import func
from extensions import dashboard_cache
from routes.auth import get_current_user
import os
import urllib.request
import json

def generate_product_description(product_name):
    api_key = os.getenv('GROQ_API_KEY')
    if not api_key:
        return ""
        
    prompt = f"You are a helpful product description assistant. The user wants to add a product named '{product_name}' to their store.\n\nIf you know this product and it is a real product (like a phone, electronics, etc.), provide a short, factual description (under 40 words) listing its main features (e.g. processor, camera, battery, etc.).\n\nIf you do not recognize the product, or it sounds like a generic/fake name, you MUST reply with EXACTLY this string and nothing else: 'It may be a copy so description not available'."
    
    payload = {
        'model': 'llama-3.3-70b-versatile',
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.3,
        'max_tokens': 100
    }
    
    try:
        req = urllib.request.Request(
            'https://api.groq.com/openai/v1/chat/completions',
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            method='POST'
        )
        response = urllib.request.urlopen(req, timeout=5)
        response_data = json.loads(response.read().decode('utf-8'))
        content = response_data['choices'][0]['message']['content'].strip()
        if content.startswith('"') and content.endswith('"'):
            content = content[1:-1]
        if content.startswith("'") and content.endswith("'"):
            content = content[1:-1]
        return content
    except Exception as e:
        print(f"Error generating description: {e}")
        return ""

products_bp = Blueprint("products", __name__)

def require_admin(payload):
    return payload and payload.get("role") == "admin"

@products_bp.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    return jsonify(product.to_dict()), 200

@products_bp.route('/api/products', methods=['POST'])
def create_product():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    data = request.get_json() or {}
    if not all(k in data for k in ('name', 'category', 'base_cost', 'stock_level')):
        return jsonify({'error': 'Missing required fields'}), 400
    
    if Product.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'Product with this name already exists'}), 400
        
    base_cost = float(data['base_cost'])
    current_price = data.get('current_price', round(base_cost * 1.25, 2))
    
    description = data.get('description', '').strip()
    if not description:
        description = generate_product_description(data['name'])
    
    product = Product(
        name=data['name'],
        category=data['category'],
        base_cost=base_cost,
        current_price=float(current_price),
        stock_level=int(data['stock_level']),
        hsn_code=data.get('hsn_code', '84733099'),
        gst_rate=float(data.get('gst_rate', 18.0)),
        description=description
    )
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201

@products_bp.route('/api/products/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found'}), 404
        
    data = request.get_json() or {}
    
    if 'name' in data:
        product.name = data['name']
    if 'category' in data:
        product.category = data['category']
    if 'base_cost' in data:
        product.base_cost = float(data['base_cost'])
    if 'current_price' in data:
        product.current_price = float(data['current_price'])
    if 'stock_level' in data:
        product.stock_level = int(data['stock_level'])
    if 'hsn_code' in data:
        product.hsn_code = data['hsn_code']
    if 'gst_rate' in data:
        product.gst_rate = float(data['gst_rate'])
    if 'description' in data:
        product.description = data['description']
        
    db.session.commit()
    return jsonify(product.to_dict()), 200

@products_bp.route('/api/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    db.session.delete(product)
    db.session.commit()
    return jsonify({'message': f'Product {product_id} deleted successfully'}), 200

@products_bp.route('/api/products', methods=['GET'])
def get_products():
    from ml_models import predict_dynamic_price
    since_str = request.args.get('since')
    since_dt = None
    if since_str:
        try:
            # Handle ISO formatting with Z or offset
            clean_str = since_str.replace('Z', '+00:00')
            since_dt = datetime.fromisoformat(clean_str)
        except Exception:
            pass

    sales_query = db.session.query(
        Product.category,
        func.sum(TransactionItem.quantity).label('sales_count')
    ).join(TransactionItem, Product.id == TransactionItem.product_id).group_by(Product.category).all()
    
    sales_map = {category: int(qty or 0) for category, qty in sales_query}
    
    now = datetime.now()
    hour_of_day = now.hour
    day_of_week = now.weekday()
    
    if since_dt:
        # Fetch updated products since timestamp
        products = Product.query.filter(Product.updated_at >= since_dt).all()
    else:
        products = Product.query.all()
        
    result = []
    for p in products:
        sales_count = sales_map.get(p.category, 0)
        predicted = predict_dynamic_price(
            base_cost=p.base_cost,
            stock_level=p.stock_level,
            hour_of_day=hour_of_day,
            day_of_week=day_of_week,
            sales_count=sales_count
        )
        
        # Stock market continuous automatic price change:
        # Simulates a real-time price fluctuation based on a small random walk
        # that changes on every check to maximize profit with high demand/scarcity.
        import random
        fluctuation = random.uniform(-0.025, 0.035)  # -2.5% to +3.5% variation
        if p.stock_level < 5 and p.stock_level > 0:
            fluctuation += 0.08  # 8% scarcity hike
        elif p.stock_level == 0:
            fluctuation = 0.0
            
        final_price = round(predicted * (1 + fluctuation), 2)
        # Ensure we never sell below base cost + 5% markup
        p.current_price = max(round(p.base_cost * 1.05, 2), final_price)
        
        db.session.add(p)
        
        d = p.to_dict()
        d['sales_count'] = sales_count
        
        ratings = [r.rating for r in p.reviews] if hasattr(p, 'reviews') else []
        d['avg_rating'] = round(sum(ratings) / len(ratings), 1) if ratings else 4.0
        d['total_reviews'] = len(ratings)
        result.append(d)
        
    db.session.commit()
    
    if since_str is not None:
        return jsonify({
            'products': result,
            'server_time': datetime.utcnow().isoformat()
        }), 200
        
    return jsonify(result), 200

@products_bp.route('/api/products/<int:product_id>/reviews', methods=['GET'])
def get_product_reviews(product_id):
    reviews = Review.query.filter_by(product_id=product_id).order_by(Review.timestamp.desc()).all()
    return jsonify([r.to_dict() for r in reviews]), 200

@products_bp.route('/api/products/<int:product_id>/reviews', methods=['POST'])
def add_product_review(product_id):
    user_payload = get_current_user()
    data = request.get_json() or {}
    rating = data.get('rating')
    comment = data.get('comment')
    username = data.get('username')
    
    if not rating or not comment:
        return jsonify({'error': 'Rating and comment are required'}), 400
        
    if user_payload:
        user_id = user_payload['user_id']
        username = user_payload.get('username', username or 'Authenticated User')
    else:
        user_id = None
        username = username or 'Anonymous'
        
    review = Review(
        product_id=product_id,
        user_id=user_id,
        username=username,
        rating=int(rating),
        comment=comment
    )
    db.session.add(review)
    db.session.commit()
    return jsonify(review.to_dict()), 201


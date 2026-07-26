import os
from dotenv import load_dotenv
load_dotenv() # Load environment variables from .env file

import random
import io
import urllib.request

import json
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from models import db, Product, Transaction, TransactionItem, Order, OrderItem, User, Review, Wishlist, AddressBook, BusinessConfig, Purchase, PurchaseItem, Expense, DynamicPricingPrediction, BudgetPredictionResult, ReturnLog, PurchaseBill, Discrepancy
from datetime import datetime, timedelta
from sqlalchemy import func
from werkzeug.security import generate_password_hash, check_password_hash
import jwt

def db_strftime(fmt, column):
    dialect = db.engine.dialect.name
    if dialect == 'postgresql':
        pg_fmt = fmt.replace('%Y', 'YYYY').replace('%m', 'MM').replace('%d', 'DD')
        return func.to_char(column, pg_fmt)
    else:
        return func.strftime(fmt, column)

# ML imports
# PDF imports

from flask_socketio import SocketIO, emit

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

from routes.auth import auth_bp, get_current_user
app.register_blueprint(auth_bp)

import threading
import time

class SimpleCache:
    def __init__(self, ttl=60):
        self.ttl = ttl
        self.data = {}
        self.lock = threading.Lock()

    def get(self, key):
        with self.lock:
            if key in self.data:
                val, expires = self.data[key]
                if time.time() < expires:
                    return val
                else:
                    del self.data[key]
            return None

    def set(self, key, value):
        with self.lock:
            self.data[key] = (value, time.time() + self.ttl)

    def clear(self):
        with self.lock:
            self.data.clear()

dashboard_cache = SimpleCache(ttl=60)

from sqlalchemy import event
@event.listens_for(db.session, 'after_commit')
def clear_dashboard_cache(session):
    dashboard_cache.clear()

# Configure SQLite database
if os.getenv('VERCEL') == '1':
    db_path = '/tmp/retail.db'
else:
    db_path = os.path.join(os.path.dirname(__file__), 'retail.db')

db_url = os.getenv('DATABASE_URL')
if db_url:
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False


db.init_app(app)
with app.app_context():
    # Optimize cold start by checking if database is already initialized
    try:
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        db_initialized = inspector.has_table("users")
    except Exception:
        db_initialized = False

    try:
        db.create_all()
    except Exception as e:
        print("Error during db.create_all():", e)
        
        # PostgreSQL migration helper for password_hash size increase
        if db_url and ("postgresql" in db_url or "postgres" in db_url):
            try:
                db.session.execute(db.text("ALTER TABLE users ALTER COLUMN password_hash TYPE VARCHAR(255);"))
                db.session.commit()
            except Exception as mig_err:
                db.session.rollback()
                print("Migration warning (password_hash length):", str(mig_err))
                
        try:
            from models import User
            if not User.query.filter_by(username='admin').first():
                print("Admin user not found. Seeding default demo data...")
                from seed_data import seed_database_and_train
                # Skip model training if running on Vercel to prevent request timeout
                train = os.getenv('VERCEL') != '1'
                seed_database_and_train(drop_tables=False, train_models=train)
                print("Database successfully seeded with default credentials (admin/customer)!")
        except Exception as seed_err:
            print("Database seeding error:", str(seed_err))

    # PostgreSQL migration helper to add missing columns to existing tables
    if db_url and ("postgresql" in db_url or "postgres" in db_url):
        try:
            db.session.execute(db.text("ALTER TABLE purchases ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'Pending Receipt';"))
            db.session.execute(db.text("ALTER TABLE purchases ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;"))
            db.session.execute(db.text("ALTER TABLE purchases ADD COLUMN IF NOT EXISTS verified_by VARCHAR(80);"))
            db.session.execute(db.text("ALTER TABLE purchases ADD COLUMN IF NOT EXISTS discrepancy_count INTEGER DEFAULT 0;"))
            db.session.execute(db.text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS sale_type VARCHAR(20) DEFAULT 'online';"))
            db.session.execute(db.text("ALTER TABLE return_logs ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id);"))
            db.session.commit()
            print("PostgreSQL migrations applied successfully!")
        except Exception as pg_mig_err:
            db.session.rollback()
            print("PostgreSQL migration warning:", str(pg_mig_err))

    # Migration helper to add missing columns to purchases (SQLite only)
    if not db_url or "sqlite" in db_url:
        try:
            # Check if purchases table needs columns
            import sqlite3
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(purchases)")
            columns = [row[1] for row in cursor.fetchall()]
            
            # Add columns if they do not exist
            if 'verification_status' not in columns:
                cursor.execute("ALTER TABLE purchases ADD COLUMN verification_status VARCHAR(30) DEFAULT 'Pending Receipt'")
            if 'verified_at' not in columns:
                cursor.execute("ALTER TABLE purchases ADD COLUMN verified_at DATETIME")
            if 'verified_by' not in columns:
                cursor.execute("ALTER TABLE purchases ADD COLUMN verified_by VARCHAR(80)")
            if 'discrepancy_count' not in columns:
                cursor.execute("ALTER TABLE purchases ADD COLUMN discrepancy_count INTEGER DEFAULT 0")
            # Check if orders table needs columns
            cursor.execute("PRAGMA table_info(orders)")
            order_columns = [row[1] for row in cursor.fetchall()]
            if 'sale_type' not in order_columns:
                cursor.execute("ALTER TABLE orders ADD COLUMN sale_type VARCHAR(20) DEFAULT 'online'")
                
            # Check if return_logs table needs columns
            cursor.execute("PRAGMA table_info(return_logs)")
            return_logs_columns = [row[1] for row in cursor.fetchall()]
            if 'order_id' not in return_logs_columns:
                try:
                    cursor.execute("DROP TABLE IF EXISTS return_logs_old")
                    cursor.execute("ALTER TABLE return_logs RENAME TO return_logs_old")
                    cursor.execute("""
                        CREATE TABLE return_logs (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            transaction_id INTEGER REFERENCES transactions(id),
                            order_id INTEGER REFERENCES orders(id),
                            product_id INTEGER NOT NULL REFERENCES products(id),
                            quantity INTEGER NOT NULL,
                            refund_amount FLOAT NOT NULL,
                            reason VARCHAR(255),
                            timestamp DATETIME NOT NULL
                        )
                    """)
                    # Try to copy existing rows
                    try:
                        cursor.execute("""
                            INSERT INTO return_logs (id, transaction_id, product_id, quantity, refund_amount, reason, timestamp)
                            SELECT id, transaction_id, product_id, quantity, refund_amount, reason, timestamp FROM return_logs_old
                        """)
                    except Exception as copy_err:
                        print("Error copying old return_logs data:", str(copy_err))
                    cursor.execute("DROP TABLE return_logs_old")
                except Exception as migrate_err:
                    print("Error creating return_logs table:", str(migrate_err))
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS return_logs (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            transaction_id INTEGER REFERENCES transactions(id),
                            order_id INTEGER REFERENCES orders(id),
                            product_id INTEGER NOT NULL REFERENCES products(id),
                            quantity INTEGER NOT NULL,
                            refund_amount FLOAT NOT NULL,
                            reason VARCHAR(255),
                            timestamp DATETIME NOT NULL
                        )
                    """)
                
            conn.commit()
            conn.close()
        except Exception as e:
            print("Database migration error:", str(e))


@app.route('/api/diag', methods=['GET'])
def diagnostic_route():
    try:
        from models import User, Product, Transaction
        db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
        safe_uri = db_uri
        if "@" in safe_uri:
            parts = safe_uri.split("@")
            safe_uri = "postgresql://***@***" + parts[1]
            
        users_count = User.query.count()
        products_count = Product.query.count()
        transactions_count = Transaction.query.count()
        admin_user = User.query.filter_by(username='admin').first()
        
        return jsonify({
            'database_uri': safe_uri,
            'users_count': users_count,
            'products_count': products_count,
            'transactions_count': transactions_count,
            'admin_exists': admin_user is not None,
            'admin_email': admin_user.email if admin_user else None,
            'vercel_env': os.getenv('VERCEL') == '1'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- Helper to check admin access ---
def require_admin(payload):
    return payload and payload.get('role') == 'admin'

# --- Products Endpoints (CRUD & Delta-Sync) ---

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    return jsonify(product.to_dict()), 200

@app.route('/api/products', methods=['POST'])
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
    
    product = Product(
        name=data['name'],
        category=data['category'],
        base_cost=base_cost,
        current_price=float(current_price),
        stock_level=int(data['stock_level']),
        hsn_code=data.get('hsn_code', '84733099'),
        gst_rate=float(data.get('gst_rate', 18.0))
    )
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201

@app.route('/api/products/<int:product_id>', methods=['PUT'])
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
        
    db.session.commit()
    return jsonify(product.to_dict()), 200

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
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

@app.route('/api/ping', methods=['GET'])
def ping():
    return jsonify({'status': 'ok', 'server_time': datetime.utcnow().isoformat()}), 200

@app.route('/api/products', methods=['GET'])
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
        TransactionItem.product_id,
        func.sum(TransactionItem.quantity).label('sales_count')
    ).group_by(TransactionItem.product_id).all()
    
    sales_map = {prod_id: qty for prod_id, qty in sales_query}
    
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
        sales_count = int(sales_map.get(p.id, 0))
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


# --- POS Checkout Endpoint ---

@app.route('/api/checkout', methods=['POST'])
def checkout():
    from ml_models import predict_dynamic_price
    data = request.get_json() or {}
    items_to_checkout = data.get('items', [])
    uuid_val = data.get('uuid')
    pay_method = data.get('payment_method', 'Cash')
    cust_name = data.get('customer_name', 'Counter Customer')
    notes_val = data.get('notes', None)
    cashier_val = data.get('cashier', 'Admin')
    force_sync = data.get('force', False)
    
    # 1. Idempotency Check
    if uuid_val:
        existing_tx = Transaction.query.filter_by(uuid=uuid_val).first()
        if existing_tx:
            # Deduplicated: return existing transaction details
            return jsonify(existing_tx.to_dict()), 200

    if not items_to_checkout:
        return jsonify({'error': 'No items in checkout request'}), 400
        
    now = datetime.now()
    hour_of_day = now.hour
    day_of_week = now.weekday()
    
    total_amount = 0.0
    products_updates = []
    
    for item in items_to_checkout:
        prod_id = item.get('product_id')
        barcode_val = item.get('barcode')
        qty = item.get('quantity')
        
        if not qty or qty <= 0:
            return jsonify({'error': f'Invalid quantity: {item}'}), 400
            
        product = None
        if prod_id:
            product = Product.query.get(prod_id)
        elif barcode_val:
            product = Product.query.filter_by(barcode=barcode_val).first()
            
        if not product:
            return jsonify({'error': f'Product not found (ID: {prod_id}, Barcode: {barcode_val})'}), 404
            
        if product.stock_level < qty and not force_sync:
            return jsonify({
                'error': f'Insufficient stock for {product.name}. Available: {product.stock_level}',
                'conflict': True,
                'product_id': product.id,
                'available_stock': product.stock_level
            }), 409
            
        sales_count = db.session.query(func.sum(TransactionItem.quantity)).filter(TransactionItem.product_id == product.id).scalar() or 0
        price_at_sale = predict_dynamic_price(
            base_cost=product.base_cost,
            stock_level=product.stock_level,
            hour_of_day=hour_of_day,
            day_of_week=day_of_week,
            sales_count=int(sales_count)
        )
        product.current_price = price_at_sale
        
        total_amount += price_at_sale * qty
        products_updates.append((product, qty, price_at_sale))
    db_transaction = Transaction(
        timestamp=datetime.utcnow(),
        total_amount=round(total_amount, 2),
        uuid=uuid_val,
        payment_method=pay_method,
        customer_name=cust_name,
        notes=notes_val,
        cashier=cashier_val
    )
    db.session.add(db_transaction)
    
    # Create corresponding Order for Manage Orders with 'offline' tag
    db_order = Order(
        customer_name=cust_name,
        email='pos@store.com',
        phone='0000000000',
        address='In-Store Counter',
        timestamp=datetime.utcnow(),
        total_amount=round(total_amount, 2),
        status='Delivered', # Immediately Completed
        sale_type='offline'
    )
    db.session.add(db_order)
    db.session.flush()
    
    for product, qty, price_at_sale in products_updates:
        product.stock_level -= qty
        
        tx_item = TransactionItem(
            transaction_id=db_transaction.id,
            product_id=product.id,
            quantity=qty,
            price_at_sale=price_at_sale
        )
        db.session.add(tx_item)
        
        order_item = OrderItem(
            order_id=db_order.id,
            product_id=product.id,
            quantity=qty,
            price_at_sale=price_at_sale
        )
        db.session.add(order_item)
        
    db.session.commit()
    return jsonify(db_transaction.to_dict()), 201
# --- Transactions & Returns Endpoints ---

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    txs = Transaction.query.order_by(Transaction.timestamp.desc()).all()
    return jsonify([tx.to_dict() for tx in txs]), 200

@app.route('/api/returns', methods=['POST'])
def process_return():
    data = request.get_json() or {}
    transaction_id = data.get('transaction_id')
    product_id = data.get('product_id')
    qty_to_return = data.get('quantity')
    reason = data.get('reason', 'Customer Return')

    if not transaction_id or not product_id or not qty_to_return or qty_to_return <= 0:
        return jsonify({'error': 'Invalid request parameters'}), 400

    transaction = Transaction.query.get(transaction_id)
    if not transaction:
        return jsonify({'error': 'Transaction not found'}), 404

    tx_item = TransactionItem.query.filter_by(transaction_id=transaction_id, product_id=product_id).first()
    if not tx_item:
        return jsonify({'error': 'Product not found in this transaction'}), 404

    # Calculate already returned quantity from ReturnLogs
    already_returned = db.session.query(func.sum(ReturnLog.quantity)).filter(
        ReturnLog.transaction_id == transaction_id, 
        ReturnLog.product_id == product_id
    ).scalar() or 0

    available_to_return = tx_item.quantity

    if qty_to_return > available_to_return:
        return jsonify({'error': f'Cannot return {qty_to_return} items. Only {available_to_return} items available to return.'}), 400

    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found in database'}), 404

    refund_amount = round(tx_item.price_at_sale * qty_to_return, 2)

    # Create Return Log
    return_log = ReturnLog(
        transaction_id=transaction_id,
        product_id=product_id,
        quantity=qty_to_return,
        refund_amount=refund_amount,
        reason=reason,
        timestamp=datetime.utcnow()
    )
    db.session.add(return_log)

    # Restock product
    product.stock_level += qty_to_return

    # Deduct transaction financials
    tx_item.quantity -= qty_to_return
    transaction.total_amount = round(max(0.0, transaction.total_amount - refund_amount), 2)

    # If quantity is now 0, optionally keep the item or remove it.
    # We keep the item with 0 quantity so that it is clear it was returned.
    # If the total amount is 0, we can also set it to 0.

    db.session.commit()

    return jsonify({
        'message': 'Return processed successfully',
        'return_log': return_log.to_dict(),
        'transaction': transaction.to_dict()
    }), 200

@app.route('/api/returns', methods=['GET'])
def get_returns():
    user_payload = get_current_user()
    if user_payload:
        if user_payload.get('role') == 'admin':
            returns = ReturnLog.query.order_by(ReturnLog.timestamp.desc()).all()
        else:
            user_order_ids = [o.id for o in Order.query.filter_by(user_id=user_payload['user_id']).all()]
            if user_order_ids:
                returns = ReturnLog.query.filter(ReturnLog.order_id.in_(user_order_ids)).order_by(ReturnLog.timestamp.desc()).all()
            else:
                returns = []
    else:
        returns = ReturnLog.query.order_by(ReturnLog.timestamp.desc()).all()
    return jsonify([ret.to_dict() for ret in returns]), 200


# --- PDF Invoice Endpoint ---

@app.route('/api/transactions/<int:transaction_id>/invoice', methods=['GET'])
def get_invoice(transaction_id):
    from pdf_generator import generate_invoice_pdf
    transaction = Transaction.query.get(transaction_id)
    if not transaction:
        return jsonify({'error': 'Transaction not found'}), 404
        
    pdf_buffer = generate_invoice_pdf(transaction)
    return send_file(
        pdf_buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'invoice_{transaction_id}.pdf'
    )

@app.route('/api/orders/<int:order_id>/invoice', methods=['GET'])
def get_order_invoice(order_id):
    from pdf_generator import generate_invoice_pdf
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
        
    pdf_buffer = generate_invoice_pdf(order)
    return send_file(
        pdf_buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'invoice_order_{order_id}.pdf'
    )



# --- ML / Price & Demand Forecasting Endpoints ---

@app.route('/api/ml/pricing-recommendations', methods=['GET'])
def get_pricing_recommendations():
    from ml_models import predict_dynamic_price
    """
    Returns dynamic pricing details for all products, and saves predictions to the database.
    """
    products = Product.query.all()
    now = datetime.now()
    hour_of_day = now.hour
    day_of_week = now.weekday()
    
    recommendations = []
    for p in products:
        suggested = predict_dynamic_price(
            base_cost=p.base_cost,
            stock_level=p.stock_level,
            hour_of_day=hour_of_day,
            day_of_week=day_of_week
        )
        
        # Build reason
        reason = "Competitive baseline: Normal stock and traffic. Standard competitive markup applied."
        if p.stock_level < 10:
            reason = "Scarcity pricing: Stock is very low (< 10 units). Markup adjusted upward."
        elif p.stock_level < 30:
            reason = "Scarcity pricing: Stock is moderately low (< 30 units). Markup applied."
        elif 17 <= hour_of_day <= 21:
            reason = "Peak hours: High shopping hours (5 PM - 9 PM). Demand markup applied."
        elif day_of_week in [4, 5, 6]:
            reason = "Weekend demand: Sales volume is historically higher on weekends. Price adjusted for demand."
            
        profit = round(suggested - p.base_cost, 2)
        
        # Save prediction history
        pred = DynamicPricingPrediction(
            product_id=p.id,
            timestamp=now,
            base_cost=p.base_cost,
            stock_level=p.stock_level,
            suggested_price=suggested,
            current_price=p.current_price,
            expected_profit=profit,
            recommendation_reason=reason
        )
        db.session.add(pred)
        
        recommendations.append({
            'product_id': p.id,
            'name': p.name,
            'category': p.category,
            'base_cost': p.base_cost,
            'current_price': p.current_price,
            'suggested_price': suggested,
            'expected_profit': profit,
            'reason': reason
        })
        
    db.session.commit()
    return jsonify(recommendations), 200

@app.route('/api/ml/budget-recommendation', methods=['POST'])
def get_budget_recommendation():
    from ml_models import recommend_budget_allocation
    """
    Calculates allocation of a budget across products in a category using Linear Regression predictions.
    """
    data = request.get_json() or {}
    budget = float(data.get('budget', 1000.0))
    category = data.get('category', 'All')
    period_days = int(data.get('period_days', 30))
    
    result = recommend_budget_allocation(budget, category, period_days, db.session)
    
    # Save budget recommendation summary
    if result['recommended_quantity'] > 0:
        rec = BudgetPredictionResult(
            budget=budget,
            category=category,
            period_days=period_days,
            recommended_quantity=result['recommended_quantity'],
            estimated_sales=result['estimated_sales'],
            estimated_profit=result['estimated_profit']
        )
        db.session.add(rec)
        db.session.commit()
        
    return jsonify(result), 200

def get_festival_for_month(month_num):
    festivals = {
        1: ("Makar Sankranti & Republic Day", "January 14 / January 26", "15% hike"),
        2: ("Valentine's Season", "February 14", "10% hike"),
        3: ("Holi Festival", "March 15", "25% hike"),
        4: ("Eid-ul-Fitr", "April 10", "20% hike"),
        5: ("Summer Sales Peak", "May", "12% hike"),
        6: ("Monsoon Kickoff", "June", "10% hike"),
        7: ("Mid-Year Clearance", "July", "15% hike"),
        8: ("Independence Day & Raksha Bandhan", "August 15 / August 28", "25% hike"),
        9: ("Ganesh Chaturthi & Janmashtami", "September 3 / September 14", "20% hike"),
        10: ("Dussehra Festival", "October 20", "30% hike"),
        11: ("Diwali (Festival of Lights)", "November 8", "50% hike"),
        12: ("Christmas & New Year Eve", "December 25 / December 31", "35% hike")
    }
    return festivals.get(month_num, ("General Season", "Various Dates", "10% hike"))

def explain_demand_prediction(date_str, predicted_demand_volume, day_of_week, month):
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    day_name = days[day_of_week] if 0 <= day_of_week < 7 else 'Unknown'
    
    current_fest_name, current_fest_date, current_fest_hike = get_festival_for_month(month)
    next_month = (month % 12) + 1
    next_fest_name, next_fest_date, next_fest_hike = get_festival_for_month(next_month)
    api_key = os.getenv("GROQ_API_KEY", "")
    url = "https://api.groq.com/openai/v1/chat/completions"
    
    prompt = (
        f"You are an intelligent business analytics engine. Analyze the sales data and return a single, well-written paragraph explaining the business reasons behind any expected increase or decrease in sales.\n\n"
        f"### Input Context:\n"
        f"- Target Date: {date_str} ({day_name}, month {month})\n"
        f"- Predicted Daily Demand Volume: {predicted_demand_volume} units\n"
        f"- Current Month Festival/Event: {current_fest_name} ({current_fest_date}), which typically brings a {current_fest_hike}.\n"
        f"- Next Month Festival/Event: {next_fest_name} ({next_fest_date}), which typically brings a {next_fest_hike}.\n\n"
        f"### Requirements:\n"
        f"1. Explain whether sales are expected to increase, decrease, or remain stable compared to normal days.\n"
        f"2. Provide likely reasons for the change based on available data (festivals, seasonality, etc.).\n"
        f"3. Keep the response to a single, concise paragraph without any bullet points, lists, or JSON formatting.\n"
    )
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": "You are a business intelligence agent. You must output a single paragraph of text only."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "max_tokens": 800
    }
    
    import urllib.request
    import json
    
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            content = res_data['choices'][0]['message']['content'].strip()
            return content
    except Exception as e:
        return f"Fallback: AI forecast analysis is currently unavailable ({str(e)}). Please verify internet connectivity and Groq API key."

@app.route('/api/ml/predict-demand', methods=['GET'])
def get_predicted_demand():
    from ml_models import predict_demand
    date_str = request.args.get('date')
    if date_str:
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD.'}), 400
    else:
        target_date = datetime.now()
        
    day_of_week = target_date.weekday()
    month = target_date.month
    
    predicted = predict_demand(day_of_week, month)
    explanation = explain_demand_prediction(target_date.strftime('%Y-%m-%d'), predicted, day_of_week, month)
    fest_name, fest_date, fest_hike = get_festival_for_month(month)
    next_month_num = (month % 12) + 1
    next_fest_name, next_fest_date, next_fest_hike = get_festival_for_month(next_month_num)
    
    return jsonify({
        'date': target_date.strftime('%Y-%m-%d'),
        'day_of_week': day_of_week,
        'month': month,
        'predicted_demand_volume': predicted,
        'explanation': explanation,
        'current_festival': {
            'name': fest_name,
            'date': fest_date,
            'hike': fest_hike
        },
        'next_festival': {
            'name': next_fest_name,
            'date': next_fest_date,
            'hike': next_fest_hike
        }
    }), 200

@app.route('/api/ml/train', methods=['POST'])
def train_models():
    items = TransactionItem.query.all()
    if len(items) < 10:
        return jsonify({'error': 'Insufficient sales history to train pricing model. Need at least 10 items.'}), 400
        
    pricing_records = []
    for item in items:
        tx = item.transaction
        if tx:
            hour_of_day = tx.timestamp.hour
            day_of_week = tx.timestamp.weekday()
            pricing_records.append({
                'base_cost': item.product.base_cost if item.product else 10.0,
                'stock_level': random.randint(10, 100),
                'hour_of_day': hour_of_day,
                'day_of_week': day_of_week,
                'price_sold': item.price_at_sale
            })
            
    df_pricing = pd.DataFrame(pricing_records)
    
    db_demand = db.session.query(
        db_strftime('%Y-%m-%d', Transaction.timestamp).label('date'),
        func.sum(TransactionItem.quantity).label('total_items_sold')
    ).join(TransactionItem).group_by('date').all()
    
    if len(db_demand) < 5:
        return jsonify({'error': 'Insufficient daily history to train demand model. Need at least 5 days of data.'}), 400
        
    demand_records = []
    for day_str, total_qty in db_demand:
        dt = datetime.strptime(day_str, '%Y-%m-%d')
        demand_records.append({
            'day_of_week': dt.weekday(),
            'month': dt.month,
            'total_items_sold': total_qty
        })
        
    df_demand = pd.DataFrame(demand_records)
    
    train_dynamic_pricing_model(df_pricing)
    train_demand_prediction_model(df_demand)
    
    return jsonify({
        'message': 'Models retrained successfully.',
        'pricing_records_count': len(df_pricing),
        'demand_days_count': len(df_demand)
    }), 200


# --- Sales & Revenue Tracking ---

@app.route('/api/sales/daily', methods=['GET'])
def get_daily_sales():
    results = db.session.query(
        db_strftime('%Y-%m-%d', Transaction.timestamp).label('date'),
        func.sum(Transaction.total_amount).label('revenue'),
        func.count(Transaction.id).label('transaction_count')
    ).group_by('date').order_by(Transaction.timestamp.desc()).limit(30).all()
    
    sales_history = []
    for date_str, revenue, count in results:
        sales_history.append({
            'date': date_str,
            'revenue': round(float(revenue), 2),
            'transaction_count': count
        })
        
    return jsonify(sales_history), 200

@app.route('/api/sales/monthly', methods=['GET'])
def get_monthly_sales():
    results = db.session.query(
        db_strftime('%Y-%m', Transaction.timestamp).label('month'),
        func.sum(Transaction.total_amount).label('revenue'),
        func.count(Transaction.id).label('transaction_count')
    ).group_by('month').order_by(db_strftime('%Y-%m', Transaction.timestamp).desc()).all()
    
    sales_history = []
    for month_str, revenue, count in results:
        sales_history.append({
            'month': month_str,
            'revenue': round(float(revenue), 2),
            'transaction_count': count
        })
        
    return jsonify(sales_history), 200


# --- E-commerce Orders Endpoints ---
@app.route('/api/orders', methods=['GET'])
def get_orders():
    search = request.args.get('search')
    status = request.args.get('status')
    sort_by = request.args.get('sort_by', 'date_desc')
    sale_type = request.args.get('sale_type')
    
    user_payload = get_current_user()
    query = Order.query
    if user_payload and user_payload.get('role') == 'customer':
        query = query.filter_by(user_id=user_payload['user_id'])
        
    if search:
        query = query.filter(
            (Order.customer_name.like(f'%{search}%')) | 
            (Order.email.like(f'%{search}%')) |
            (Order.id.like(f'%{search}%'))
        )
        
    if status and status != 'All':
        query = query.filter_by(status=status)
        
    if sale_type and sale_type != 'All':
        query = query.filter_by(sale_type=sale_type)

    if sort_by == 'date_desc':
        query = query.order_by(Order.id.desc())
    elif sort_by == 'date_asc':
        query = query.order_by(Order.id.asc())
    elif sort_by == 'customer':
        query = query.order_by(Order.customer_name.asc())
    elif sort_by == 'status':
        query = query.order_by(Order.status.asc())
    elif sort_by == 'total':
        query = query.order_by(Order.total_amount.desc())
        
    orders = query.all()
    return jsonify([o.to_dict() for o in orders]), 200

def send_order_email_notification(order_id, customer_name, email, phone, address, items_summary, total_amount):
    def run():
        import urllib.request
        import json
        try:
            payload = {
                "access_key": "aa8acc90-e57a-4c4b-820b-94d5c588a1a6",
                "subject": f"New Order Placed - Order #{order_id}",
                "from_name": "TEGL Retail Solutions",
                "name": "System Notification",
                "email": "noreply@teglretail.com",
                "message": (
                    f"New online order received!\n\n"
                    f"Order Details:\n"
                    f"  Order ID: {order_id}\n"
                    f"  Customer: {customer_name}\n"
                    f"  Email: {email}\n"
                    f"  Phone: {phone}\n"
                    f"  Delivery Address: {address}\n"
                    f"  Total Amount: INR {total_amount}\n\n"
                    f"Items Ordered:\n"
                    f"{items_summary}"
                )
            }
            req = urllib.request.Request(
                "https://api.web3forms.com/submit",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                print("Web3Forms email response status:", response.status)
        except Exception as err:
            print("Failed to send order email via Web3Forms:", str(err))

    threading.Thread(target=run, daemon=True).start()

@app.route('/api/orders', methods=['POST'])
def create_order():
    from ml_models import predict_dynamic_price
    user_payload = get_current_user()
    
    data = request.get_json() or {}
    customer_name = data.get('customer_name')
    email = data.get('email')
    phone = data.get('phone')
    address = data.get('address')
    items_to_order = data.get('items', [])
    
    if not all([customer_name, email, phone, address, items_to_order]):
        return jsonify({'error': 'Missing required checkout details'}), 400
        
    now = datetime.now()
    hour_of_day = now.hour
    day_of_week = now.weekday()
    
    total_amount = 0.0
    products_updates = []
    
    for item in items_to_order:
        prod_id = item.get('product_id')
        qty = item.get('quantity')
        
        if not prod_id or not qty or qty <= 0:
            return jsonify({'error': f'Invalid product_id or quantity: {item}'}), 400
            
        product = Product.query.get(prod_id)
        if not product:
            return jsonify({'error': f'Product with ID {prod_id} not found'}), 404
            
        if product.stock_level < qty:
            return jsonify({'error': f'Insufficient stock for {product.name}. Available: {product.stock_level}'}), 400
            
        sales_count = db.session.query(func.sum(TransactionItem.quantity)).filter(TransactionItem.product_id == product.id).scalar() or 0
        price_at_sale = predict_dynamic_price(
            base_cost=product.base_cost,
            stock_level=product.stock_level,
            hour_of_day=hour_of_day,
            day_of_week=day_of_week,
            sales_count=int(sales_count)
        )
        product.current_price = price_at_sale
        
        total_amount += price_at_sale * qty
        products_updates.append((product, qty, price_at_sale))
        
    db_order = Order(
        user_id=user_payload['user_id'] if user_payload else None,
        customer_name=customer_name,
        email=email,
        phone=phone,
        address=address,
        timestamp=datetime.utcnow(),
        total_amount=round(total_amount, 2),
        status='Pending',
        sale_type='online'
    )
    db.session.add(db_order)
    db.session.flush()
    
    items_summary = ""
    for product, qty, price_at_sale in products_updates:
        product.stock_level -= qty
        
        order_item = OrderItem(
            order_id=db_order.id,
            product_id=product.id,
            quantity=qty,
            price_at_sale=price_at_sale
        )
        db.session.add(order_item)
        items_summary += f"  - {product.name} (Qty: {qty}) @ INR {price_at_sale} each\n"
        
    db.session.commit()
    
    # Send email notification to owner asynchronously
    send_order_email_notification(
        order_id=db_order.id,
        customer_name=customer_name,
        email=email,
        phone=phone,
        address=address,
        items_summary=items_summary,
        total_amount=round(total_amount, 2)
    )
    
    # Emit dynamic socket event for real-time dashboard updates
    try:
        socketio.emit('new_order', db_order.to_dict())
    except Exception as e:
        print("WebSocket emit failed:", str(e))
        
    return jsonify(db_order.to_dict()), 201

@app.route('/api/orders/<int:order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
        
    data = request.get_json() or {}
    status = data.get('status')
    if status not in ('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'):
        return jsonify({'error': f'Invalid status: {status}'}), 400
        
    order.status = status
    db.session.commit()
    return jsonify(order.to_dict()), 200

@app.route('/api/orders/<int:order_id>', methods=['GET'])
def get_order_by_id(order_id):
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    return jsonify(order.to_dict()), 200

@app.route('/api/orders/track', methods=['GET'])
def track_orders():
    phone = request.args.get('phone')
    email = request.args.get('email')
    
    if not phone and not email:
        return jsonify({'error': 'Please provide email or phone number for tracking'}), 400
        
    query = Order.query
    if phone:
        query = query.filter_by(phone=phone)
    if email:
        query = query.filter_by(email=email)
        
    orders = query.order_by(Order.timestamp.desc()).all()
    return jsonify([o.to_dict() for o in orders]), 200


# --- Reporting & Excel/PDF Download Endpoint ---

@app.route('/api/reports/download', methods=['GET'])
def download_report():
    report_type = request.args.get('type', 'sales')
    report_format = request.args.get('format', 'pdf')
    
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    df = None
    title = ""
    headers = []
    rows = []
    
    if report_type == 'sales':
        title = "SALES REPORT"
        headers = ["Order ID", "Customer", "Date", "Items Count", "Revenue (Rs.)", "Status"]
        orders = Order.query.order_by(Order.timestamp.desc()).all()
        
        records = []
        for o in orders:
            records.append({
                'Order ID': o.id,
                'Customer': o.customer_name,
                'Email': o.email,
                'Date': o.timestamp.strftime('%Y-%m-%d %H:%M'),
                'Total Amount': o.total_amount,
                'Status': o.status
            })
        df = pd.DataFrame(records)
        
        for o in orders:
            rows.append([
                str(o.id),
                o.customer_name[:15],
                o.timestamp.strftime('%Y-%m-%d'),
                str(len(o.items)),
                f"{o.total_amount:.2f}",
                o.status
            ])
            
    elif report_type == 'inventory':
        title = "INVENTORY REPORT"
        headers = ["ID", "Product Name", "Category", "Base Cost", "Current Price", "Stock Level"]
        products = Product.query.all()
        
        records = []
        for p in products:
            records.append({
                'Product ID': p.id,
                'Name': p.name,
                'Category': p.category,
                'Base Cost': p.base_cost,
                'Current Price': p.current_price,
                'Stock Level': p.stock_level
            })
        df = pd.DataFrame(records)
        
        for p in products:
            rows.append([
                str(p.id),
                p.name[:25],
                p.category[:15],
                f"{p.base_cost:.2f}",
                f"{p.current_price:.2f}",
                str(p.stock_level)
            ])
            
    elif report_type == 'profit':
        title = "PROFITABILITY REPORT"
        headers = ["Date", "Transactions", "Revenue (Rs.)", "Est. Cost (Rs.)", "Net Profit (Rs.)"]
        txs = Transaction.query.all()
        
        records = []
        daily_stats = {}
        for t in txs:
            d_str = t.timestamp.strftime('%Y-%m-%d')
            if d_str not in daily_stats:
                daily_stats[d_str] = {'revenue': 0.0, 'cost': 0.0, 'tx_count': 0}
            
            daily_stats[d_str]['revenue'] += t.total_amount
            daily_stats[d_str]['tx_count'] += 1
            for item in t.items:
                cost = (item.product.base_cost if item.product else 0.0) * item.quantity
                daily_stats[d_str]['cost'] += cost
                
        for day, val in sorted(daily_stats.items(), reverse=True):
            profit = val['revenue'] - val['cost']
            records.append({
                'Date': day,
                'Transactions Count': val['tx_count'],
                'Revenue': round(val['revenue'], 2),
                'Estimated Cost': round(val['cost'], 2),
                'Estimated Profit': round(profit, 2)
            })
            rows.append([
                day,
                str(val['tx_count']),
                f"{val['revenue']:.2f}",
                f"{val['cost']:.2f}",
                f"{profit:.2f}"
            ])
        df = pd.DataFrame(records)
        
    elif report_type == 'customer':
        title = "CUSTOMER LISTING REPORT"
        headers = ["User ID", "Username", "Email", "Role", "Orders Count"]
        users = User.query.all()
        
        records = []
        for u in users:
            orders_count = Order.query.filter_by(user_id=u.id).count()
            records.append({
                'User ID': u.id,
                'Username': u.username,
                'Email': u.email,
                'Role': u.role,
                'Orders Count': orders_count
            })
            rows.append([
                str(u.id),
                u.username,
                u.email,
                u.role,
                str(orders_count)
            ])
        df = pd.DataFrame(records)
        
    elif report_type == 'dynamic-pricing':
        title = "DYNAMIC PRICING LOGS"
        headers = ["Product", "Base Cost", "Current Price", "Suggested Price", "Est. Margin", "Reason"]
        preds = DynamicPricingPrediction.query.order_by(DynamicPricingPrediction.timestamp.desc()).limit(100).all()
        
        records = []
        for p in preds:
            records.append({
                'Product ID': p.product_id,
                'Product Name': p.product.name if p.product else 'Unknown',
                'Timestamp': p.timestamp.strftime('%Y-%m-%d %H:%M'),
                'Base Cost': p.base_cost,
                'Current Price': p.current_price,
                'Suggested Price': p.suggested_price,
                'Expected Profit': p.expected_profit,
                'Reason': p.recommendation_reason
            })
            rows.append([
                (p.product.name[:18] if p.product else 'Unknown'),
                f"{p.base_cost:.2f}",
                f"{p.current_price:.2f}",
                f"{p.suggested_price:.2f}",
                f"{p.expected_profit:.2f}",
                p.recommendation_reason[:20] + "..."
            ])
        df = pd.DataFrame(records)
        
    elif report_type == 'budget-recommendation':
        title = "BUDGET RECOMMENDATION HISTORY"
        headers = ["Date", "Category", "Period", "Budget", "Quantity Recommended", "Est. Profit"]
        recs = BudgetPredictionResult.query.order_by(BudgetPredictionResult.timestamp.desc()).all()
        
        records = []
        for r in recs:
            records.append({
                'Timestamp': r.timestamp.strftime('%Y-%m-%d %H:%M'),
                'Category': r.category,
                'Period (Days)': r.period_days,
                'Budget Limit': r.budget,
                'Quantity Recommended': r.recommended_quantity,
                'Estimated Profit': r.estimated_profit
            })
            rows.append([
                r.timestamp.strftime('%Y-%m-%d'),
                r.category,
                f"{r.period_days} Days",
                f"{r.budget:.2f}",
                str(r.recommended_quantity),
                f"{r.estimated_profit:.2f}"
            ])
        df = pd.DataFrame(records)

    if df is None or df.empty:
        df = pd.DataFrame([{"Message": "No data available for this report type"}])

    if report_format == 'excel':
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name=report_type.capitalize(), index=False)
        buffer.seek(0)
        return send_file(
            buffer,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'{report_type}_report.xlsx'
        )
    else:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=30, leftMargin=30, topMargin=40, bottomMargin=40)
        story = []
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#1A365D"),
            spaceAfter=15
        )
        
        meta_style = ParagraphStyle(
            'ReportMeta',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            textColor=colors.HexColor("#718096"),
            spaceAfter=20
        )
        
        story.append(Paragraph(title, title_style))
        story.append(Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Scope: System Wide", meta_style))
        
        table_data = [[Paragraph(f"<b>{h}</b>", ParagraphStyle('H', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, textColor=colors.white)) for h in headers]]
        
        for r in rows:
            table_data.append([Paragraph(str(cell), ParagraphStyle('B', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor("#2D3748"))) for cell in r])
            
        col_width = (doc.width) / len(headers)
        table = Table(table_data, colWidths=[col_width]*len(headers))
        table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1A365D")),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F7FAFC")]),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0,0), (-1,-1), 6),
        ]))
        
        story.append(table)
        doc.build(story)
        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'{report_type}_report.pdf'
        )


# --- Reviews and Ratings ---
@app.route('/api/products/<int:product_id>/reviews', methods=['GET'])
def get_product_reviews(product_id):
    reviews = Review.query.filter_by(product_id=product_id).order_by(Review.timestamp.desc()).all()
    return jsonify([r.to_dict() for r in reviews]), 200

@app.route('/api/products/<int:product_id>/reviews', methods=['POST'])
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

# --- Wishlist ---
@app.route('/api/wishlist', methods=['GET'])
def get_wishlist():
    user_payload = get_current_user()
    if not user_payload:
        return jsonify({'error': 'Unauthorized'}), 401
        
    wishlist_items = Wishlist.query.filter_by(user_id=user_payload['user_id']).all()
    return jsonify([item.to_dict() for item in wishlist_items]), 200

@app.route('/api/wishlist', methods=['POST'])
def add_to_wishlist():
    user_payload = get_current_user()
    if not user_payload:
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.get_json() or {}
    product_id = data.get('product_id')
    if not product_id:
        return jsonify({'error': 'Product ID is required'}), 400
        
    # Check if already in wishlist
    existing = Wishlist.query.filter_by(user_id=user_payload['user_id'], product_id=product_id).first()
    if existing:
        return jsonify(existing.to_dict()), 200
        
    wish = Wishlist(user_id=user_payload['user_id'], product_id=product_id)
    db.session.add(wish)
    db.session.commit()
    return jsonify(wish.to_dict()), 201

@app.route('/api/wishlist/<int:product_id>', methods=['DELETE'])
def remove_from_wishlist(product_id):
    user_payload = get_current_user()
    if not user_payload:
        return jsonify({'error': 'Unauthorized'}), 401
        
    wish = Wishlist.query.filter_by(user_id=user_payload['user_id'], product_id=product_id).first()
    if not wish:
        return jsonify({'error': 'Item not found in wishlist'}), 404
        
    db.session.delete(wish)
    db.session.commit()
    return jsonify({'message': 'Removed from wishlist'}), 200

# --- Saved Addresses ---
@app.route('/api/addresses', methods=['GET'])
def get_addresses():
    user_payload = get_current_user()
    if not user_payload:
        return jsonify({'error': 'Unauthorized'}), 401
        
    addresses = AddressBook.query.filter_by(user_id=user_payload['user_id']).all()
    return jsonify([addr.to_dict() for addr in addresses]), 200

@app.route('/api/addresses', methods=['POST'])
def save_address():
    user_payload = get_current_user()
    if not user_payload:
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.get_json() or {}
    name = data.get('name')
    phone = data.get('phone')
    address_line = data.get('address_line')
    city = data.get('city')
    pincode = data.get('pincode')
    
    if not all([name, phone, address_line, city, pincode]):
        return jsonify({'error': 'Missing address details'}), 400
        
    addr = AddressBook(
        user_id=user_payload['user_id'],
        name=name,
        phone=phone,
        address_line=address_line,
        city=city,
        pincode=pincode
    )
    db.session.add(addr)
    db.session.commit()
    return jsonify(addr.to_dict()), 201

@app.route('/api/addresses/<int:address_id>', methods=['PUT'])
def update_address(address_id):
    user_payload = get_current_user()
    if not user_payload:
        return jsonify({'error': 'Unauthorized'}), 401
        
    addr = AddressBook.query.filter_by(id=address_id, user_id=user_payload['user_id']).first()
    if not addr:
        return jsonify({'error': 'Address not found'}), 404
        
    data = request.get_json() or {}
    if 'name' in data:
        addr.name = data['name']
    if 'phone' in data:
        addr.phone = data['phone']
    if 'address_line' in data:
        addr.address_line = data['address_line']
    if 'city' in data:
        addr.city = data['city']
    if 'pincode' in data:
        addr.pincode = data['pincode']
        
    db.session.commit()
    return jsonify(addr.to_dict()), 200

@app.route('/api/addresses/<int:address_id>', methods=['DELETE'])
def delete_address(address_id):
    user_payload = get_current_user()
    if not user_payload:
        return jsonify({'error': 'Unauthorized'}), 401
        
    addr = AddressBook.query.filter_by(id=address_id, user_id=user_payload['user_id']).first()
    if not addr:
        return jsonify({'error': 'Address not found'}), 404
        
    db.session.delete(addr)
    db.session.commit()
    return jsonify({'message': 'Address deleted successfully'}), 200

@app.route('/api/returns/request', methods=['POST'])
def request_return():
    user_payload = get_current_user()
    if not user_payload:
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.get_json() or {}
    order_id = data.get('order_id')
    product_id = data.get('product_id')
    qty_to_return = data.get('quantity')
    reason = data.get('reason', 'Customer Return')
    
    if not order_id or not product_id or not qty_to_return or qty_to_return <= 0:
        return jsonify({'error': 'Invalid request parameters'}), 400
        
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
        
    # Verify order ownership
    if order.user_id != user_payload['user_id'] and order.email.strip().lower() != user_payload.get('username', '').strip().lower():
        return jsonify({'error': 'Access denied'}), 403
        
    if order.status.lower() != 'delivered':
        return jsonify({'error': 'Only delivered orders are eligible for return.'}), 400
        
    if datetime.utcnow() - order.timestamp > timedelta(days=7):
        return jsonify({'error': 'Return window (7 days) has expired.'}), 400
        
    order_item = OrderItem.query.filter_by(order_id=order_id, product_id=product_id).first()
    if not order_item:
        return jsonify({'error': 'Product not found in this order'}), 404
        
    already_returned = db.session.query(func.sum(ReturnLog.quantity)).filter(
        ReturnLog.order_id == order_id, 
        ReturnLog.product_id == product_id
    ).scalar() or 0
    
    available_to_return = order_item.quantity - already_returned
    
    if qty_to_return > available_to_return:
        return jsonify({'error': f'Cannot return {qty_to_return} items. Only {available_to_return} items available to return.'}), 400
        
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found in database'}), 404
        
    refund_amount = round(order_item.price_at_sale * qty_to_return, 2)
    
    return_log = ReturnLog(
        order_id=order_id,
        transaction_id=None,
        product_id=product_id,
        quantity=qty_to_return,
        refund_amount=refund_amount,
        reason=reason,
        timestamp=datetime.utcnow()
    )
    db.session.add(return_log)
    
    product.stock_level += qty_to_return
    order.total_amount = round(max(0.0, order.total_amount - refund_amount), 2)
    
    total_ordered_qty = db.session.query(func.sum(OrderItem.quantity)).filter(OrderItem.order_id == order_id).scalar() or 0
    total_returned_qty = (db.session.query(func.sum(ReturnLog.quantity)).filter(ReturnLog.order_id == order_id).scalar() or 0) + qty_to_return
    
    if total_returned_qty >= total_ordered_qty:
        order.status = 'Returned'
    else:
        order.status = 'Partially Returned'
        
    db.session.commit()
    
    return jsonify({
        'message': 'Return request submitted successfully',
        'return_log': return_log.to_dict(),
        'order': order.to_dict()
    }), 201

# --- Interactive / Mock Coupons and Payments ---
@app.route('/api/coupons/validate', methods=['POST'])
def validate_coupon():
    data = request.get_json() or {}
    code = str(data.get('code', '')).upper().strip()
    
    coupons = {
        'WELCOME10': {'discount_percent': 10.0, 'description': '10% off on your first order!'},
        'FESTIVE25': {'discount_percent': 25.0, 'description': 'Festival special! 25% discount'},
        'SAVE15': {'discount_percent': 15.0, 'description': '15% savings coupon!'},
        'FREESHIP': {'discount_percent': 0.0, 'description': 'Free shipping applied!'}
    }
    
    if code in coupons:
        return jsonify({'valid': True, 'code': code, **coupons[code]}), 200
    else:
        return jsonify({'valid': False, 'error': 'Invalid coupon code'}), 400

@app.route('/api/payments/checkout', methods=['POST'])
def process_payment():
    data = request.get_json() or {}
    payment_method = data.get('payment_method')
    amount = data.get('amount')
    
    if not payment_method or not amount:
        return jsonify({'error': 'Missing payment parameters'}), 400
        
    return jsonify({
        'status': 'SUCCESS',
        'transaction_id': f'TXN-{random.randint(100000, 999999)}',
        'amount': amount,
        'message': f'Payment of Rs.{amount} processed successfully via {payment_method}.'
    }), 200
# --- AI Support Chatbot & Backend Tools ---

def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    os.environ[key.strip()] = val.strip()

load_env()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


def tool_search_products(query):

    """Search products locally in database."""
    try:
        prods = Product.query.filter(
            (Product.name.like(f"%{query}%")) | 
            (Product.category.like(f"%{query}%"))
        ).all()
        return [p.to_dict() for p in prods]
    except Exception as e:
        return {"error": f"Failed to search products: {str(e)}"}

def tool_get_order_status(order_id, user_email):
    """Retrieve order status after verifying user email ownership."""
    try:
        order = Order.query.get(order_id)
        if not order:
            return {"error": "Order not found"}
        if order.email.strip().lower() != user_email.strip().lower():
            return {"error": "Access denied. Email mismatch."}
        return {
            "order_id": order.id,
            "status": order.status,
            "courier": "SmartRetail Express",
            "tracking_number": f"SR-{order.id}TX",
            "expected_delivery_date": (order.timestamp + timedelta(days=3)).strftime("%Y-%m-%d"),
            "total_amount": order.total_amount
        }
    except Exception as e:
        return {"error": f"Failed to get order status: {str(e)}"}

def tool_update_delivery_address(order_id, new_address, user_email):
    """Update order delivery address after verifying eligibility and ownership."""
    try:
        order = Order.query.get(order_id)
        if not order:
            return {"error": "Order not found"}
        if order.email.strip().lower() != user_email.strip().lower():
            return {"error": "Access denied. Email mismatch."}
        if order.status.lower() != "pending":
            return {"error": f"Order address cannot be updated. Status is {order.status}."}
        order.address = new_address
        db.session.commit()
        return {"success": True, "message": "Delivery address updated successfully"}
    except Exception as e:
        db.session.rollback()
        return {"error": f"Failed to update address: {str(e)}"}

def tool_cancel_order(order_id, user_email):
    """Cancel order after verifying eligibility and ownership."""
    try:
        order = Order.query.get(order_id)
        if not order:
            return {"error": "Order not found"}
        if order.email.strip().lower() != user_email.strip().lower():
            return {"error": "Access denied. Email mismatch."}
        if order.status.lower() in ["shipped", "delivered", "cancelled"]:
            return {"error": f"Order cannot be cancelled. Status is {order.status}."}
        order.status = "Cancelled"
        for item in order.items:
            if item.product:
                item.product.stock_level += item.quantity
        db.session.commit()
        return {"success": True, "message": "Order cancelled successfully. Refund will be processed within 5-7 business days."}
    except Exception as e:
        db.session.rollback()
        return {"error": f"Failed to cancel order: {str(e)}"}

def tool_create_return_request(order_id, product_id, user_email):
    """Submit return request for delivered product within 7 days timeframe."""
    try:
        order = Order.query.get(order_id)
        if not order:
            return {"error": "Order not found"}
        if order.email.strip().lower() != user_email.strip().lower():
            return {"error": "Access denied. Email mismatch."}
        if order.status.lower() != "delivered":
            return {"error": "Only delivered orders are eligible for return."}
        if datetime.utcnow() - order.timestamp > timedelta(days=7):
            return {"error": "Return window (7 days) has expired."}
        
        item_exists = False
        for item in order.items:
            if item.product_id == product_id:
                item_exists = True
                break
        if not item_exists:
            return {"error": "Product not found in this order."}
            
        order.status = "Return Requested"
        db.session.commit()
        return {"success": True, "message": "Return request submitted successfully. Pick up will be scheduled shortly."}
    except Exception as e:
        db.session.rollback()
        return {"error": f"Failed to request return: {str(e)}"}

def tool_check_stock(product_name):
    """Retrieve stock level and availability status of a product."""
    try:
        prod = Product.query.filter(Product.name.like(f"%{product_name}%")).first()
        if not prod:
            return {"error": "Product not found"}
        return {
            "name": prod.name,
            "stock_level": prod.stock_level,
            "status": "In Stock" if prod.stock_level > 0 else "Out of Stock",
            "price": prod.current_price
        }
    except Exception as e:
        return {"error": f"Failed to check stock: {str(e)}"}

CHATBOT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": "Search for products in the catalog using name or category keywords.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search term or product category to query"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_order_status",
            "description": "Look up tracking information and delivery status of an order.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "integer", "description": "The numeric ID of the order"},
                    "user_email": {"type": "string", "description": "The email address associated with the order"}
                },
                "required": ["order_id", "user_email"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_delivery_address",
            "description": "Update the delivery address for an order. Can only be done if the order status is Pending.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "integer", "description": "The numeric ID of the order"},
                    "new_address": {"type": "string", "description": "The complete new shipping address"},
                    "user_email": {"type": "string", "description": "The email address associated with the order"}
                },
                "required": ["order_id", "new_address", "user_email"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_order",
            "description": "Cancel a pending order and initiate restocking.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "integer", "description": "The numeric ID of the order"},
                    "user_email": {"type": "string", "description": "The email address associated with the order"}
                },
                "required": ["order_id", "user_email"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_return_request",
            "description": "Initiate a return request for a delivered product within 7 days of delivery.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "integer", "description": "The numeric ID of the order"},
                    "product_id": {"type": "integer", "description": "The product ID being returned"},
                    "user_email": {"type": "string", "description": "The email address associated with the order"}
                },
                "required": ["order_id", "product_id", "user_email"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_stock",
            "description": "Get stock levels and availability status for a specific product name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_name": {"type": "string", "description": "The name of the product to check"}
                },
                "required": ["product_name"]
            }
        }
    }
]

def run_local_fallback(message, user_email):
    msg_lower = message.lower()
    if "stock" in msg_lower or "avail" in msg_lower or "price" in msg_lower or "find" in msg_lower or "search" in msg_lower or "product" in msg_lower or "show" in msg_lower:

        words = [w.rstrip('s') for w in msg_lower.replace("?", "").replace(".", "").split() if len(w) > 3]
        query_word = words[-1] if words else ""

        results = tool_search_products(query_word)
        if results and not isinstance(results, dict):
            reply = "Here are the matching products in our store:\n"
            for p in results[:5]:
                status = "In Stock" if p['stock_level'] > 0 else "Out of Stock"
                reply += f"- **{p['name']}** ({p['category']}): Rs. {p['current_price']} (Status: {status}, Qty: {p['stock_level']})\n"
            return reply
        else:
            return "I searched our product catalog but couldn't find any exact matches. Please search for different categories or product names."
            
    if "order" in msg_lower or "track" in msg_lower or "status" in msg_lower:
        if not user_email:
            return "I can help you track your order, but you need to be logged in. Please log in or verify your email."
        try:
            orders = Order.query.filter_by(email=user_email).order_by(Order.timestamp.desc()).limit(3).all()
            if orders:
                reply = "Here are your recent orders:\n"
                for o in orders:
                    expected_del = (o.timestamp + timedelta(days=3)).strftime("%Y-%m-%d")
                    reply += f"- **Order #{o.id}**: Status: *{o.status}*, Total: Rs. {o.total_amount}, Expected Delivery: {expected_del}\n"
                return reply
            else:
                return f"I couldn't find any orders placed under the email address: {user_email}."
        except Exception:
            pass
            
    if "address" in msg_lower or "ship" in msg_lower or "deliver" in msg_lower:
        return "To update a shipping address, please ensure you are logged in. Address updates can only be completed for orders in 'Pending' status. Please specify the Order ID and your new address."

    if "cancel" in msg_lower:
        return "You can request cancellation for any order in 'Pending' status. Please provide your Order ID and we will cancel it for you."
        
    if "return" in msg_lower or "refund" in msg_lower:
        return "Returns are accepted within 7 days of delivery for fully delivered items. If your order status is 'Delivered' and is within this window, please specify the Order ID and product to request a return."

    return "Hello! I am your AI Customer Support Assistant. Our main AI system is currently experiencing high load or connection issues, but I can still assist you. Please ask about products, stock levels, or order status."


@app.route('/api/support/chat', methods=['GET'])
def support_chat():
    message = request.args.get('message', '').strip()
    
    if not message:
        return jsonify({"reply": "Hello! How can I assist you today?", "source": "fallback"}), 200
        
    user_payload = get_current_user()
    user_email = ""
    if user_payload:
        user = User.query.get(user_payload['user_id'])
        if user:
            user_email = user.email
            
    prompt_path = os.path.join(os.path.dirname(__file__), 'prompts', 'customer_support_prompt.txt')
    system_prompt = "You are the official AI Customer Support Assistant for our online retail store."
    if os.path.exists(prompt_path):
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                system_prompt = f.read()
        except Exception:
            pass
            
    if not GROQ_API_KEY:
        reply = run_local_fallback(message, user_email)
        return jsonify({"reply": reply, "source": "fallback"}), 200
        
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
    }
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"{message} (My email: {user_email})" if user_email else message}
    ]
    
    body = {
        "model": GROQ_MODEL,
        "messages": messages,
        "tools": CHATBOT_TOOLS,
        "tool_choice": "auto"
    }
    
    try:
        req = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'), headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            
        choice = res_data['choices'][0]
        msg = choice['message']
        
        if msg.get('tool_calls'):
            tool_call = msg['tool_calls'][0]
            func_name = tool_call['function']['name']
            func_args = json.loads(tool_call['function']['arguments'])
            
            tool_result = {}
            if func_name == "search_products":
                tool_result = tool_search_products(func_args.get("query", ""))
            elif func_name == "get_order_status":
                tool_result = tool_get_order_status(func_args.get("order_id"), func_args.get("user_email", user_email))
            elif func_name == "update_delivery_address":
                tool_result = tool_update_delivery_address(
                    func_args.get("order_id"), 
                    func_args.get("new_address"), 
                    func_args.get("user_email", user_email)
                )
            elif func_name == "cancel_order":
                tool_result = tool_cancel_order(func_args.get("order_id"), func_args.get("user_email", user_email))
            elif func_name == "create_return_request":
                tool_result = tool_create_return_request(
                    func_args.get("order_id"), 
                    func_args.get("product_id"), 
                    func_args.get("user_email", user_email)
                )
            elif func_name == "check_stock":
                tool_result = tool_check_stock(func_args.get("product_name", ""))
            else:
                tool_result = {"error": "Invalid tool call"}
                
            messages.append(msg)
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call['id'],
                "name": func_name,
                "content": json.dumps(tool_result)
            })
            
            body["messages"] = messages
            del body["tools"]
            del body["tool_choice"]
            
            req_final = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req_final, timeout=10) as response_final:
                res_final_data = json.loads(response_final.read().decode('utf-8'))
                
            final_reply = res_final_data['choices'][0]['message']['content']
            return jsonify({"reply": final_reply, "source": "groq"}), 200
            
        else:
            return jsonify({"reply": msg.get('content', ''), "source": "groq"}), 200
            
    except Exception:
        reply = run_local_fallback(message, user_email)
        return jsonify({"reply": reply, "source": "fallback"}), 200
00


# --- GST & P&L Compliance endpoints ---

def calculate_sales_tax_breakdown(sales_record, biz_state):
    is_interstate = False
    
    if hasattr(sales_record, 'address') and sales_record.address:
        addr = sales_record.address.lower()
        if biz_state.lower() not in addr:
            is_interstate = True
            
    total_taxable = 0.0
    total_gst = 0.0
    cgst = 0.0
    sgst = 0.0
    igst = 0.0
    
    hsn_wise = {}
    
    items = sales_record.items
    for item in items:
        qty = item.quantity
        price = item.price_at_sale
        total_item = qty * price
        
        gst_rate = item.product.gst_rate if (item.product and hasattr(item.product, 'gst_rate')) else 18.0
        hsn = item.product.hsn_code if (item.product and item.product.hsn_code) else '84733099'
        
        taxable_val = total_item / (1 + gst_rate / 100.0)
        gst_val = total_item - taxable_val
        
        total_taxable += taxable_val
        total_gst += gst_val
        
        if is_interstate:
            item_igst = gst_val
            item_cgst = 0.0
            item_sgst = 0.0
        else:
            item_igst = 0.0
            item_cgst = gst_val / 2.0
            item_sgst = gst_val / 2.0
            
        cgst += item_cgst
        sgst += item_sgst
        igst += item_igst
        
        if hsn not in hsn_wise:
            hsn_wise[hsn] = {
                'hsn_code': hsn,
                'quantity': 0,
                'taxable_value': 0.0,
                'gst_rate': gst_rate,
                'cgst': 0.0,
                'sgst': 0.0,
                'igst': 0.0,
                'total_gst': 0.0,
                'total_amount': 0.0
            }
        hsn_wise[hsn]['quantity'] += qty
        hsn_wise[hsn]['taxable_value'] += taxable_val
        hsn_wise[hsn]['cgst'] += item_cgst
        hsn_wise[hsn]['sgst'] += item_sgst
        hsn_wise[hsn]['igst'] += item_igst
        hsn_wise[hsn]['total_gst'] += gst_val
        hsn_wise[hsn]['total_amount'] += total_item

    return {
        'total_taxable': round(total_taxable, 2),
        'total_gst': round(total_gst, 2),
        'cgst': round(cgst, 2),
        'sgst': round(sgst, 2),
        'igst': round(igst, 2),
        'is_interstate': is_interstate,
        'hsn_wise': hsn_wise
    }

def compute_gst_summary_data():
    config = BusinessConfig.query.first()
    biz_state = config.state if config else 'Maharashtra'
    biz_gstin = config.gstin if config else '27AAPCS1010A1Z0'
    
    from sqlalchemy.orm import joinedload
    pos_transactions = Transaction.query.options(
        joinedload(Transaction.items).joinedload(TransactionItem.product)
    ).all()
    orders = Order.query.filter(Order.status != 'Cancelled').options(
        joinedload(Order.items).joinedload(OrderItem.product)
    ).all()
    
    sales_count = 0
    total_sales = 0.0
    taxable_sales = 0.0
    cgst_collected = 0.0
    sgst_collected = 0.0
    igst_collected = 0.0
    total_gst_collected = 0.0
    
    hsn_wise = {}
    validations = []
    
    def validate_gstin_format(gstin):
        if not gstin:
            return False
        import re
        return bool(re.match(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', gstin))

    for tx in pos_transactions:
        sales_count += 1
        total_sales += tx.total_amount
        breakdown = calculate_sales_tax_breakdown(tx, biz_state)
        
        taxable_sales += breakdown['total_taxable']
        cgst_collected += breakdown['cgst']
        sgst_collected += breakdown['sgst']
        igst_collected += breakdown['igst']
        total_gst_collected += breakdown['total_gst']
        
        for item in tx.items:
            hsn = item.product.hsn_code if (item.product and item.product.hsn_code) else None
            if not hsn or hsn.strip() == '':
                validations.append({
                    'type': 'warning',
                    'record_type': 'POS Sale',
                    'record_id': tx.id,
                    'message': f"Product '{item.product.name if item.product else 'Unknown'}' is missing an HSN code."
                })
            gst_rate = item.product.gst_rate if item.product else 18.0
            if gst_rate < 0 or gst_rate > 28:
                validations.append({
                    'type': 'danger',
                    'record_type': 'POS Sale',
                    'record_id': tx.id,
                    'message': f"Anomalous GST rate of {gst_rate}% on product '{item.product.name if item.product else 'Unknown'}'."
                })
                
        for hsn, data in breakdown['hsn_wise'].items():
            if hsn not in hsn_wise:
                hsn_wise[hsn] = data.copy()
            else:
                hsn_wise[hsn]['quantity'] += data['quantity']
                hsn_wise[hsn]['taxable_value'] += data['taxable_value']
                hsn_wise[hsn]['cgst'] += data['cgst']
                hsn_wise[hsn]['sgst'] += data['sgst']
                hsn_wise[hsn]['igst'] += data['igst']
                hsn_wise[hsn]['total_gst'] += data['total_gst']
                hsn_wise[hsn]['total_amount'] += data['total_amount']
                
    for order in orders:
        sales_count += 1
        total_sales += order.total_amount
        breakdown = calculate_sales_tax_breakdown(order, biz_state)
        
        taxable_sales += breakdown['total_taxable']
        cgst_collected += breakdown['cgst']
        sgst_collected += breakdown['sgst']
        igst_collected += breakdown['igst']
        total_gst_collected += breakdown['total_gst']
        
        for item in order.items:
            hsn = item.product.hsn_code if (item.product and item.product.hsn_code) else None
            if not hsn or hsn.strip() == '':
                validations.append({
                    'type': 'warning',
                    'record_type': 'Order',
                    'record_id': order.id,
                    'message': f"Product '{item.product.name if item.product else 'Unknown'}' is missing an HSN code."
                })
                
        for hsn, data in breakdown['hsn_wise'].items():
            if hsn not in hsn_wise:
                hsn_wise[hsn] = data.copy()
            else:
                hsn_wise[hsn]['quantity'] += data['quantity']
                hsn_wise[hsn]['taxable_value'] += data['taxable_value']
                hsn_wise[hsn]['cgst'] += data['cgst']
                hsn_wise[hsn]['sgst'] += data['sgst']
                hsn_wise[hsn]['igst'] += data['igst']
                hsn_wise[hsn]['total_gst'] += data['total_gst']
                hsn_wise[hsn]['total_amount'] += data['total_amount']
                
    purchases = Purchase.query.all()
    total_purchases = 0.0
    cgst_itc = 0.0
    sgst_itc = 0.0
    igst_itc = 0.0
    total_itc = 0.0
    
    for p in purchases:
        total_purchases += p.total_amount
        if p.supplier_gstin and not validate_gstin_format(p.supplier_gstin):
            validations.append({
                'type': 'danger',
                'record_type': 'Purchase Invoice',
                'record_id': p.id,
                'message': f"Supplier '{p.supplier_name}' has an invalid GSTIN format: '{p.supplier_gstin}'."
            })
            
        if p.itc_eligible:
            cgst_itc += p.cgst
            sgst_itc += p.sgst
            igst_itc += p.igst
            total_itc += p.gst_amount
            
    expenses = Expense.query.all()
    total_expenses = 0.0
    
    for e in expenses:
        total_expenses += e.total_amount
        if e.merchant_gstin and not validate_gstin_format(e.merchant_gstin):
            validations.append({
                'type': 'warning',
                'record_type': 'Expense',
                'record_id': e.id,
                'message': f"Merchant '{e.merchant_name}' has an invalid GSTIN format: '{e.merchant_gstin}'."
            })
            
        if e.itc_eligible:
            cgst_itc += e.cgst
            sgst_itc += e.sgst
            igst_itc += e.igst
            total_itc += e.gst_amount
            
    total_sales = round(total_sales, 2)
    taxable_sales = round(taxable_sales, 2)
    cgst_collected = round(cgst_collected, 2)
    sgst_collected = round(sgst_collected, 2)
    igst_collected = round(igst_collected, 2)
    total_gst_collected = round(total_gst_collected, 2)
    
    total_purchases = round(total_purchases, 2)
    total_expenses = round(total_expenses, 2)
    
    cgst_itc = round(cgst_itc, 2)
    sgst_itc = round(sgst_itc, 2)
    igst_itc = round(igst_itc, 2)
    total_itc = round(total_itc, 2)
    
    cgst_payable = round(max(0.0, cgst_collected - cgst_itc), 2)
    sgst_payable = round(max(0.0, sgst_collected - sgst_itc), 2)
    igst_payable = round(max(0.0, igst_collected - igst_itc), 2)
    net_payable = round(cgst_payable + sgst_payable + igst_payable, 2)
    
    for k, v in hsn_wise.items():
        v['taxable_value'] = round(v['taxable_value'], 2)
        v['cgst'] = round(v['cgst'], 2)
        v['sgst'] = round(v['sgst'], 2)
        v['igst'] = round(v['igst'], 2)
        v['total_gst'] = round(v['total_gst'], 2)
        v['total_amount'] = round(v['total_amount'], 2)
        
    return {
        'business_name': config.business_name if config else 'My Business',
        'gstin': biz_gstin,
        'state': biz_state,
        'sales_count': sales_count,
        'total_sales': total_sales,
        'taxable_sales': taxable_sales,
        'cgst_collected': cgst_collected,
        'sgst_collected': sgst_collected,
        'igst_collected': igst_collected,
        'total_gst_collected': total_gst_collected,
        'total_purchases': total_purchases,
        'total_expenses': total_expenses,
        'cgst_itc': cgst_itc,
        'sgst_itc': sgst_itc,
        'igst_itc': igst_itc,
        'total_itc': total_itc,
        'cgst_payable': cgst_payable,
        'sgst_payable': sgst_payable,
        'igst_payable': igst_payable,
        'net_payable': net_payable,
        'hsn_summary': list(hsn_wise.values()),
        'validations': validations
    }

@app.route('/api/gst/config', methods=['GET', 'POST'])
def gst_config():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    config = BusinessConfig.query.first()
    
    if request.method == 'GET':
        if not config:
            return jsonify({
                'business_name': 'TEGL Retail Solutions',
                'gstin': '27AAPCS1010A1Z0',
                'pan': 'AAPCS1010A',
                'state': 'Maharashtra',
                'address': '123 Innovation Way, Retail Suite 100'
            }), 200
        return jsonify(config.to_dict()), 200
        
    data = request.get_json() or {}
    name = data.get('business_name', '').strip()
    gstin = data.get('gstin', '').strip().upper()
    pan = data.get('pan', '').strip().upper()
    state = data.get('state', '').strip()
    address = data.get('address', '').strip()
    
    if not name or not gstin or not state or not address:
        return jsonify({'error': 'Missing required fields'}), 400
        
    if len(gstin) != 15:
        return jsonify({'error': 'GSTIN must be exactly 15 characters long'}), 400
        
    if not config:
        config = BusinessConfig(business_name=name, gstin=gstin, pan=pan or gstin[2:12], state=state, address=address)
        db.session.add(config)
    else:
        config.business_name = name
        config.gstin = gstin
        config.pan = pan or gstin[2:12]
        config.state = state
        config.address = address
        
    db.session.commit()
    return jsonify(config.to_dict()), 200

@app.route('/api/gst/purchases', methods=['GET', 'POST'])
def gst_purchases():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    if request.method == 'GET':
        purchases = Purchase.query.order_by(Purchase.date.desc()).all()
        return jsonify([p.to_dict() for p in purchases]), 200
        
    data = request.get_json() or {}
    supplier_name = data.get('supplier_name', '').strip()
    supplier_gstin = data.get('supplier_gstin', '').strip().upper()
    invoice_no = data.get('invoice_no', '').strip()
    date_str = data.get('date')
    itc_eligible = data.get('itc_eligible', True)
    items_data = data.get('items', [])
    
    if not supplier_name or not invoice_no or not items_data:
        return jsonify({'error': 'Missing supplier name, invoice number, or items'}), 400
        
    date_val = datetime.utcnow()
    if date_str:
        try:
            date_val = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except Exception:
            try:
                date_val = datetime.strptime(date_str, '%Y-%m-%d')
            except Exception:
                pass
                
    config = BusinessConfig.query.first()
    biz_state_code = config.gstin[:2] if (config and config.gstin) else '27'
    supplier_state_code = supplier_gstin[:2] if (supplier_gstin and len(supplier_gstin) >= 2) else biz_state_code
    is_interstate = (biz_state_code != supplier_state_code)
    
    total_amount = 0.0
    gst_amount = 0.0
    cgst = 0.0
    sgst = 0.0
    igst = 0.0
    
    purchase_items = []
    
    for item in items_data:
        prod_name = item.get('product_name', '').strip()
        qty = int(item.get('quantity', 1))
        price = float(item.get('price_at_purchase', 0.0))
        gst_rate = float(item.get('gst_rate', 18.0))
        hsn = item.get('hsn_code', '').strip() or '84733099'
        
        item_total = qty * price
        item_taxable = item_total / (1 + gst_rate / 100.0)
        item_gst = item_total - item_taxable
        
        total_amount += item_total
        gst_amount += item_gst
        
        if is_interstate:
            igst += item_gst
        else:
            cgst += item_gst / 2.0
            sgst += item_gst / 2.0
            
        purchase_items.append(PurchaseItem(
            product_name=prod_name,
            hsn_code=hsn,
            quantity=qty,
            price_at_purchase=price,
            gst_rate=gst_rate,
            total_amount=item_total
        ))
        
    purchase = Purchase(
        supplier_name=supplier_name,
        supplier_gstin=supplier_gstin,
        invoice_no=invoice_no,
        date=date_val,
        total_amount=round(total_amount, 2),
        gst_amount=round(gst_amount, 2),
        cgst=round(cgst, 2),
        sgst=round(sgst, 2),
        igst=round(igst, 2),
        itc_eligible=itc_eligible
    )
    
    for p_item in purchase_items:
        purchase.items.append(p_item)
        
    db.session.add(purchase)
    db.session.commit()
    return jsonify(purchase.to_dict()), 201

@app.route('/api/gst/purchases/<int:purchase_id>', methods=['DELETE'])
def delete_gst_purchase(purchase_id):
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    purchase = Purchase.query.get(purchase_id)
    if not purchase:
        return jsonify({'error': 'Purchase record not found'}), 404
        
    db.session.delete(purchase)
    db.session.commit()
    return jsonify({'message': 'Purchase deleted successfully'}), 200

@app.route('/api/gst/expenses', methods=['GET', 'POST'])
def gst_expenses():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    if request.method == 'GET':
        expenses = Expense.query.order_by(Expense.date.desc()).all()
        return jsonify([e.to_dict() for e in expenses]), 200
        
    data = request.get_json() or {}
    merchant_name = data.get('merchant_name', '').strip()
    merchant_gstin = data.get('merchant_gstin', '').strip().upper()
    invoice_no = data.get('invoice_no', '').strip()
    date_str = data.get('date')
    category = data.get('category', '').strip()
    total_amount = float(data.get('total_amount', 0.0))
    gst_rate = float(data.get('gst_rate', 0.0))
    itc_eligible = data.get('itc_eligible', True)
    
    if not merchant_name or not category or total_amount <= 0:
        return jsonify({'error': 'Missing required fields (merchant name, category, or amount)'}), 400
        
    date_val = datetime.utcnow()
    if date_str:
        try:
            date_val = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except Exception:
            try:
                date_val = datetime.strptime(date_str, '%Y-%m-%d')
            except Exception:
                pass
                
    config = BusinessConfig.query.first()
    biz_state_code = config.gstin[:2] if (config and config.gstin) else '27'
    merchant_state_code = merchant_gstin[:2] if (merchant_gstin and len(merchant_gstin) >= 2) else biz_state_code
    is_interstate = (biz_state_code != merchant_state_code)
    
    gst_amount = 0.0
    cgst = 0.0
    sgst = 0.0
    igst = 0.0
    
    if gst_rate > 0:
        taxable = total_amount / (1 + gst_rate / 100.0)
        gst_amount = total_amount - taxable
        if is_interstate:
            igst = gst_amount
        else:
            cgst = gst_amount / 2.0
            sgst = gst_amount / 2.0
            
    expense = Expense(
        merchant_name=merchant_name,
        merchant_gstin=merchant_gstin,
        invoice_no=invoice_no,
        date=date_val,
        category=category,
        total_amount=round(total_amount, 2),
        gst_rate=gst_rate,
        gst_amount=round(gst_amount, 2),
        cgst=round(cgst, 2),
        sgst=round(sgst, 2),
        igst=round(igst, 2),
        itc_eligible=itc_eligible
    )
    
    db.session.add(expense)
    db.session.commit()
    return jsonify(expense.to_dict()), 201

@app.route('/api/gst/expenses/<int:expense_id>', methods=['DELETE'])
def delete_gst_expense(expense_id):
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    expense = Expense.query.get(expense_id)
    if not expense:
        return jsonify({'error': 'Expense record not found'}), 404
        
    db.session.delete(expense)
    db.session.commit()
    return jsonify({'message': 'Expense deleted successfully'}), 200

@app.route('/api/gst/summary', methods=['GET'])
def gst_summary():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
    return jsonify(compute_gst_summary_data()), 200

@app.route('/api/gst/pnl', methods=['GET'])
def gst_pnl():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    cached_res = dashboard_cache.get('gst_pnl')
    if cached_res:
        return jsonify(cached_res), 200

    config = BusinessConfig.query.first()
    biz_state = config.state if config else 'Maharashtra'
    
    from sqlalchemy.orm import joinedload
    pos_transactions = Transaction.query.options(
        joinedload(Transaction.items).joinedload(TransactionItem.product)
    ).all()
    orders = Order.query.options(
        joinedload(Order.items).joinedload(OrderItem.product)
    ).filter(Order.status != 'Cancelled').all()
    
    gross_sales = 0.0
    taxable_revenue = 0.0
    cogs = 0.0
    
    for tx in pos_transactions:
        gross_sales += tx.total_amount
        breakdown = calculate_sales_tax_breakdown(tx, biz_state)
        taxable_revenue += breakdown['total_taxable']
        
        for item in tx.items:
            base_cost = item.product.base_cost if item.product else 0.0
            cogs += base_cost * item.quantity
            
    for order in orders:
        gross_sales += order.total_amount
        breakdown = calculate_sales_tax_breakdown(order, biz_state)
        taxable_revenue += breakdown['total_taxable']
        
        for item in order.items:
            base_cost = item.product.base_cost if item.product else 0.0
            cogs += base_cost * item.quantity
            
    expenses = Expense.query.all()
    total_expenses = 0.0
    
    expense_categories = {}
    for e in expenses:
        amount_excl_tax = e.total_amount - e.gst_amount if e.itc_eligible else e.total_amount
        total_expenses += amount_excl_tax
        cat = e.category
        expense_categories[cat] = expense_categories.get(cat, 0.0) + amount_excl_tax
        
    gross_profit = taxable_revenue - cogs
    net_profit = gross_profit - total_expenses
    
    res_data = {
        'gross_sales': round(gross_sales, 2),
        'revenue': round(taxable_revenue, 2),
        'cogs': round(cogs, 2),
        'gross_profit': round(gross_profit, 2),
        'operating_expenses': round(total_expenses, 2),
        'net_profit': round(net_profit, 2),
        'expense_breakdown': [{'category': k, 'amount': round(v, 2)} for k, v in expense_categories.items()]
    }
    dashboard_cache.set('gst_pnl', res_data)
    return jsonify(res_data), 200

@app.route('/api/gst/returns/<string:return_type>', methods=['GET'])
def gst_returns(return_type):
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    summary = compute_gst_summary_data()
    
    if return_type == 'gstr1':
        orders = Order.query.filter(Order.status != 'Cancelled').all()
        b2b_records = []
        b2c_records = []
        
        for o in orders:
            breakdown = calculate_sales_tax_breakdown(o, summary['state'])
            record = {
                'id': o.id,
                'customer_name': o.customer_name,
                'date': o.timestamp.isoformat(),
                'total_amount': o.total_amount,
                'taxable_value': breakdown['total_taxable'],
                'cgst': breakdown['cgst'],
                'sgst': breakdown['sgst'],
                'igst': breakdown['igst'],
                'total_gst': breakdown['total_gst']
            }
            if 'corp' in o.customer_name.lower() or 'ltd' in o.customer_name.lower():
                record['buyer_gstin'] = '27ABCDE1234F1Z5'
                b2b_records.append(record)
            else:
                b2c_records.append(record)
                
        return jsonify({
            'summary': {
                'taxable_supplies': summary['taxable_sales'],
                'cgst': summary['cgst_collected'],
                'sgst': summary['sgst_collected'],
                'igst': summary['igst_collected'],
                'total_tax': summary['total_gst_collected']
            },
            'b2b': b2b_records,
            'b2c': b2c_records,
            'hsn_summary': summary['hsn_summary']
        }), 200
        
    elif return_type == 'gstr3b':
        return jsonify({
            'summary': {
                'outward_supplies': {
                    'taxable_value': summary['taxable_sales'],
                    'cgst': summary['cgst_collected'],
                    'sgst': summary['sgst_collected'],
                    'igst': summary['igst_collected']
                },
                'eligible_itc': {
                    'cgst': summary['cgst_itc'],
                    'sgst': summary['sgst_itc'],
                    'igst': summary['igst_itc']
                },
                'tax_payable': {
                    'cgst': summary['cgst_payable'],
                    'sgst': summary['sgst_payable'],
                    'igst': summary['igst_payable'],
                    'net_payable': summary['net_payable']
                }
            }
        }), 200
        
    elif return_type == 'gstr9':
        return jsonify({
            'summary': {
                'annual_turnover': summary['taxable_sales'],
                'annual_purchases': summary['total_purchases'],
                'total_tax_collected': summary['total_gst_collected'],
                'total_itc_availed': summary['total_itc'],
                'net_tax_paid_cash': summary['net_payable']
            }
        }), 200
        
    elif return_type == 'monthly_liability':
        monthly_data = {}
        
        pos_transactions = Transaction.query.all()
        orders = Order.query.filter(Order.status != 'Cancelled').all()
        
        for tx in pos_transactions:
            m_key = tx.timestamp.strftime('%Y-%m')
            if m_key not in monthly_data:
                monthly_data[m_key] = {'month': m_key, 'sales': 0.0, 'purchases': 0.0, 'tax_collected': 0.0, 'itc': 0.0}
            monthly_data[m_key]['sales'] += tx.total_amount
            breakdown = calculate_sales_tax_breakdown(tx, summary['state'])
            monthly_data[m_key]['tax_collected'] += breakdown['total_gst']
            
        for o in orders:
            m_key = o.timestamp.strftime('%Y-%m')
            if m_key not in monthly_data:
                monthly_data[m_key] = {'month': m_key, 'sales': 0.0, 'purchases': 0.0, 'tax_collected': 0.0, 'itc': 0.0}
            monthly_data[m_key]['sales'] += o.total_amount
            breakdown = calculate_sales_tax_breakdown(o, summary['state'])
            monthly_data[m_key]['tax_collected'] += breakdown['total_gst']
            
        purchases = Purchase.query.all()
        for p in purchases:
            m_key = p.date.strftime('%Y-%m')
            if m_key not in monthly_data:
                monthly_data[m_key] = {'month': m_key, 'sales': 0.0, 'purchases': 0.0, 'tax_collected': 0.0, 'itc': 0.0}
            monthly_data[m_key]['purchases'] += p.total_amount
            if p.itc_eligible:
                monthly_data[m_key]['itc'] += p.gst_amount
                
        result = sorted(list(monthly_data.values()), key=lambda x: x['month'])
        return jsonify(result), 200
        
    return jsonify({'error': 'Invalid return type'}), 400

@app.route('/api/gst/download-pdf', methods=['GET'])
def download_gst_pdf():
    from pdf_generator import generate_gst_pdf_report, generate_pnl_pdf_report
    user = get_current_user()
    if not user:
        token = request.args.get('token')
        if token:
            try:
                user = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            except Exception:
                pass
                
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    report_type = request.args.get('type', 'gstr1')
    config = BusinessConfig.query.first()
    
    if report_type == 'pnl':
        pos_transactions = Transaction.query.all()
        orders = Order.query.filter(Order.status != 'Cancelled').all()
        
        gross_sales = 0.0
        taxable_revenue = 0.0
        cogs = 0.0
        biz_state = config.state if config else 'Maharashtra'
        
        for tx in pos_transactions:
            gross_sales += tx.total_amount
            breakdown = calculate_sales_tax_breakdown(tx, biz_state)
            taxable_revenue += breakdown['total_taxable']
            for item in tx.items:
                base_cost = item.product.base_cost if item.product else 0.0
                cogs += base_cost * item.quantity
                
        for order in orders:
            gross_sales += order.total_amount
            breakdown = calculate_sales_tax_breakdown(order, biz_state)
            taxable_revenue += breakdown['total_taxable']
            for item in order.items:
                base_cost = item.product.base_cost if item.product else 0.0
                cogs += base_cost * item.quantity
                
        expenses = Expense.query.all()
        total_expenses = 0.0
        expense_categories = {}
        for e in expenses:
            amount_excl_tax = e.total_amount - e.gst_amount if e.itc_eligible else e.total_amount
            total_expenses += amount_excl_tax
            cat = e.category
            expense_categories[cat] = expense_categories.get(cat, 0.0) + amount_excl_tax
            
        pnl_data = {
            'revenue': round(taxable_revenue, 2),
            'cogs': round(cogs, 2),
            'gross_profit': round(taxable_revenue - cogs, 2),
            'operating_expenses': round(total_expenses, 2),
            'net_profit': round((taxable_revenue - cogs) - total_expenses, 2),
            'expense_breakdown': [{'category': k, 'amount': round(v, 2)} for k, v in expense_categories.items()]
        }
        pdf_buf = generate_pnl_pdf_report(pnl_data, config)
        return send_file(
            pdf_buf,
            mimetype='application/pdf',
            as_attachment=True,
            download_name='Profit_and_Loss_Statement.pdf'
        )
    else:
        summary = compute_gst_summary_data()
        pdf_buf = generate_gst_pdf_report(report_type, summary, config)
        return send_file(
            pdf_buf,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'GST_Filing_Report_{report_type}.pdf'
        )

@app.route('/api/gst/export-csv', methods=['GET'])
def export_gst_csv():
    user = get_current_user()
    if not user:
        token = request.args.get('token')
        if token:
            try:
                user = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            except Exception:
                pass
                
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    report_type = request.args.get('type', 'gstr1')
    config = BusinessConfig.query.first()
    biz_state = config.state if config else 'Maharashtra'
    
    output = io.StringIO()
    import csv
    writer = csv.writer(output)
    
    if report_type == 'gstr1':
        writer.writerow(['GST Return Filing Format: GSTR-1 (Outward Supplies)'])
        writer.writerow([])
        writer.writerow(['Invoice ID', 'Date', 'Type (POS/Order)', 'Customer Name', 'Taxable Subtotal (Rs.)', 'CGST (Rs.)', 'SGST (Rs.)', 'IGST (Rs.)', 'Total Sales Invoice (Rs.)'])
        
        pos_transactions = Transaction.query.all()
        for tx in pos_transactions:
            b = calculate_sales_tax_breakdown(tx, biz_state)
            writer.writerow([f"POS-{tx.id}", tx.timestamp.strftime('%Y-%m-%d'), 'POS Sale', 'Counter Customer', b['total_taxable'], b['cgst'], b['sgst'], b['igst'], tx.total_amount])
            
        orders = Order.query.filter(Order.status != 'Cancelled').all()
        for o in orders:
            b = calculate_sales_tax_breakdown(o, biz_state)
            writer.writerow([f"ORD-{o.id}", o.timestamp.strftime('%Y-%m-%d'), 'Storefront Order', o.customer_name, b['total_taxable'], b['cgst'], b['sgst'], b['igst'], o.total_amount])
            
    elif report_type == 'gstr2':
        writer.writerow(['GST Return Filing Format: GSTR-2 (Inward Supplies / ITC)'])
        writer.writerow([])
        writer.writerow(['Invoice No', 'Date', 'Supplier/Vendor Name', 'Supplier GSTIN', 'Category', 'Total Cost (Rs.)', 'CGST (Rs.)', 'SGST (Rs.)', 'IGST (Rs.)', 'ITC Eligible'])
        
        purchases = Purchase.query.all()
        for p in purchases:
            writer.writerow([p.invoice_no, p.date.strftime('%Y-%m-%d'), p.supplier_name, p.supplier_gstin or '', 'Inventory Purchase', p.total_amount, p.cgst, p.sgst, p.igst, 'YES' if p.itc_eligible else 'NO'])
            
        expenses = Expense.query.all()
        for e in expenses:
            writer.writerow([e.invoice_no or 'N/A', e.date.strftime('%Y-%m-%d'), e.merchant_name, e.merchant_gstin or '', f"Expense: {e.category}", e.total_amount, e.cgst, e.sgst, e.igst, 'YES' if e.itc_eligible else 'NO'])
            
    filename = f"{report_type}_report.csv"
    mem_file = io.BytesIO()
    mem_file.write(output.getvalue().encode('utf-8'))
    mem_file.seek(0)
    
    return send_file(
        mem_file,
        mimetype='text/csv',
        as_attachment=True,
        download_name=filename
    )

# --- Financial Dashboard Endpoint ---
@app.route('/api/finance/dashboard', methods=['GET'])
def get_finance_dashboard():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403

    cached_res = dashboard_cache.get('finance_dashboard')
    if cached_res:
        return jsonify(cached_res), 200

    now = datetime.now()
    
    # KPIs
    total_pos_rev = db.session.query(func.sum(Transaction.total_amount)).scalar() or 0.0
    total_order_rev = db.session.query(func.sum(Order.total_amount)).filter(Order.status != 'Cancelled').scalar() or 0.0
    total_revenue = total_pos_rev + total_order_rev
    
    # Calculate COGS: sum of (sold quantity * product purchase cost)
    cogs_pos = db.session.query(func.sum(TransactionItem.quantity * Product.base_cost)).join(Product).scalar() or 0.0
    cogs_order = db.session.query(func.sum(OrderItem.quantity * Product.base_cost)).join(Product).join(Order).filter(Order.status != 'Cancelled').scalar() or 0.0
    total_cogs = cogs_pos + cogs_order
    
    gross_profit = total_revenue - total_cogs
    
    total_expenses = db.session.query(func.sum(Expense.total_amount)).scalar() or 0.0
    operating_profit = gross_profit - total_expenses
    
    # Calculate assets from inventory
    inventory_value = db.session.query(func.sum(Product.base_cost * Product.stock_level)).scalar() or 0.0
    
    # Accounts Payable: Pending Supplier Purchases
    accounts_payable = db.session.query(func.sum(Purchase.total_amount)).filter(Purchase.payment_status == 'Pending').scalar() or 0.0
    
    # Accounts Receivable: Pending Online Orders
    accounts_receivable = db.session.query(func.sum(Order.total_amount)).filter(Order.status == 'Pending').scalar() or 0.0
    
    # Cash Flow calculation
    cash_in = total_pos_rev + (db.session.query(func.sum(Order.total_amount)).filter(Order.status == 'Delivered').scalar() or 0.0)
    paid_purchases = db.session.query(func.sum(Purchase.total_amount)).filter(Purchase.payment_status == 'Paid').scalar() or 0.0
    cash_out = paid_purchases + total_expenses
    cash_in_bank = cash_in - cash_out
    if cash_in_bank < 0:
        cash_in_bank = 0.0
    
    # Group Expenses by Category
    expenses_by_cat = db.session.query(Expense.category, func.sum(Expense.total_amount)).group_by(Expense.category).all()
    expense_donut = {
        'labels': [e[0] for e in expenses_by_cat],
        'data': [round(e[1], 2) for e in expenses_by_cat]
    }
    if not expense_donut['labels']:
        expense_donut = {'labels': ['Utilities', 'Payroll', 'Rent'], 'data': [100, 200, 300]}
    
    # Monthly aggregation (Last 12 months)
    months_labels = []
    revenue_data = []
    expenses_data = []
    cogs_data = []
    net_profit_data = []
    operating_margin_data = []
    cash_balance_data = []
    
    # Pre-fetch monthly data in bulk (last 12 months)
    year_ago = now - timedelta(days=366)
    
    # 1. POS Revenue
    pos_by_month = db.session.query(
        db_strftime('%Y-%m', Transaction.timestamp).label('m'),
        func.sum(Transaction.total_amount)
    ).filter(Transaction.timestamp >= year_ago).group_by('m').all()
    pos_month_map = {row[0]: float(row[1] or 0.0) for row in pos_by_month}
    
    # 2. Order Revenue
    ord_by_month = db.session.query(
        db_strftime('%Y-%m', Order.timestamp).label('m'),
        func.sum(Order.total_amount)
    ).filter(Order.timestamp >= year_ago, Order.status != 'Cancelled').group_by('m').all()
    ord_month_map = {row[0]: float(row[1] or 0.0) for row in ord_by_month}
    
    # 3. Expenses
    exp_by_month = db.session.query(
        db_strftime('%Y-%m', Expense.date).label('m'),
        func.sum(Expense.total_amount)
    ).filter(Expense.date >= year_ago).group_by('m').all()
    exp_month_map = {row[0]: float(row[1] or 0.0) for row in exp_by_month}
    
    # 4. Purchases
    pur_by_month = db.session.query(
        db_strftime('%Y-%m', Purchase.date).label('m'),
        func.sum(Purchase.total_amount)
    ).filter(Purchase.date >= year_ago).group_by('m').all()
    pur_month_map = {row[0]: float(row[1] or 0.0) for row in pur_by_month}
    
    # 5. COGS POS
    mcogs_pos_by_month = db.session.query(
        db_strftime('%Y-%m', Transaction.timestamp).label('m'),
        func.sum(TransactionItem.quantity * Product.base_cost)
    ).join(Product).join(Transaction).filter(Transaction.timestamp >= year_ago).group_by('m').all()
    mcogs_pos_month_map = {row[0]: float(row[1] or 0.0) for row in mcogs_pos_by_month}
    
    # 6. COGS Order
    mcogs_ord_by_month = db.session.query(
        db_strftime('%Y-%m', Order.timestamp).label('m'),
        func.sum(OrderItem.quantity * Product.base_cost)
    ).join(Product).join(Order).filter(Order.timestamp >= year_ago, Order.status != 'Cancelled').group_by('m').all()
    mcogs_ord_month_map = {row[0]: float(row[1] or 0.0) for row in mcogs_ord_by_month}
    
    # 7. Order Delivered Revenue (for cash inflow)
    ord_del_by_month = db.session.query(
        db_strftime('%Y-%m', Order.timestamp).label('m'),
        func.sum(Order.total_amount)
    ).filter(Order.timestamp >= year_ago, Order.status == 'Delivered').group_by('m').all()
    ord_del_month_map = {row[0]: float(row[1] or 0.0) for row in ord_del_by_month}
    
    # 8. Purchases Paid (for cash outflow)
    pur_paid_by_month = db.session.query(
        db_strftime('%Y-%m', Purchase.date).label('m'),
        func.sum(Purchase.total_amount)
    ).filter(Purchase.date >= year_ago, Purchase.payment_status == 'Paid').group_by('m').all()
    pur_paid_month_map = {row[0]: float(row[1] or 0.0) for row in pur_paid_by_month}

    for i in range(11, -1, -1):
        m_start = (now.replace(day=1) - timedelta(days=30*i)).replace(day=1)
        m_key = m_start.strftime('%Y-%m')
        
        months_labels.append(m_start.strftime('%b'))
        
        pos_m = pos_month_map.get(m_key, 0.0)
        ord_m = ord_month_map.get(m_key, 0.0)
        rev_m = pos_m + ord_m
        revenue_data.append(round(rev_m, 2))
        
        exp_m = exp_month_map.get(m_key, 0.0)
        pur_m = pur_month_map.get(m_key, 0.0)
        tot_exp_m = exp_m + pur_m
        expenses_data.append(round(tot_exp_m, 2))
        
        cogs_pos_m = mcogs_pos_month_map.get(m_key, 0.0)
        cogs_ord_m = mcogs_ord_month_map.get(m_key, 0.0)
        m_cogs = cogs_pos_m + cogs_ord_m
        cogs_data.append(round(m_cogs, 2))
        
        m_net_profit = rev_m - m_cogs - exp_m
        net_profit_data.append(round(m_net_profit, 2))
        
        margin = 0 if rev_m == 0 else round((m_net_profit / rev_m) * 100, 1)
        operating_margin_data.append(margin)
        
        cash_in_m = pos_m + ord_del_month_map.get(m_key, 0.0)
        pur_paid_m = pur_paid_month_map.get(m_key, 0.0)
        cash_out_m = pur_paid_m + exp_m
        cash_balance_data.append(round(max(0.0, cash_in_m - cash_out_m), 2))
        
    # Top Categories by Sales Revenue
    cat_sales = db.session.query(
        Product.category,
        func.sum(TransactionItem.quantity * TransactionItem.price_at_sale).label('rev')
    ).join(TransactionItem, Product.id == TransactionItem.product_id).group_by(Product.category).order_by(db.desc('rev')).limit(5).all()
    category_distribution = {
        'labels': [c[0] for c in cat_sales],
        'data': [round(c[1], 2) for c in cat_sales]
    }
    
    # Slow Moving Inventory (Stock > 25 and sales in last 30 days < 2)
    thirty_days_ago = now - timedelta(days=30)
    slow_items = db.session.query(Product).filter(Product.stock_level > 25).limit(6).all()
    slow_inventory_list = [{
        'name': p.name,
        'stock': p.stock_level,
        'category': p.category,
        'value': round(p.base_cost * p.stock_level, 2)
    } for p in slow_items]

    # Payment Method Distribution
    pm_dist = db.session.query(
        Transaction.payment_method,
        func.count(Transaction.id).label('count')
    ).group_by(Transaction.payment_method).all()
    pm_distribution = {
        'labels': [p[0] for p in pm_dist] if pm_dist else ['Cash', 'UPI', 'Card'],
        'data': [p[1] for p in pm_dist] if pm_dist else [10, 10, 5]
    }
    
    res_data = {
        'kpis': {
            'revenue': round(total_revenue, 2),
            'cogs': round(total_cogs, 2),
            'gross_profit': round(gross_profit, 2),
            'operating_profit': round(operating_profit, 2),
            'total_expenses': round(total_expenses, 2),
            'inventory_value': round(inventory_value, 2),
            'cash_in_bank': round(cash_in_bank, 2),
            'accounts_payable': round(accounts_payable, 2),
            'accounts_receivable': round(accounts_receivable, 2),
            'profit_margin': round((operating_profit / total_revenue * 100) if total_revenue > 0 else 0.0, 2)
        },
        'monthly_trends': {
            'labels': months_labels,
            'revenue': revenue_data,
            'expenses': expenses_data,
            'cogs': cogs_data,
            'net_profit': net_profit_data,
            'margins': operating_margin_data,
            'cash': cash_balance_data
        },
        'expense_breakdown': expense_donut,
        'category_distribution': category_distribution,
        'slow_inventory': slow_inventory_list,
        'payment_distribution': pm_distribution
    }
    dashboard_cache.set('finance_dashboard', res_data)
    return jsonify(res_data)

# --- Reviews Administration ---
@app.route('/api/reviews/admin', methods=['GET'])
def get_admin_reviews():
    reviews = Review.query.order_by(Review.timestamp.desc()).all()
    return jsonify([r.to_dict() for r in reviews]), 200

# --- ML Recommendation Ordering & Export ---
@app.route('/api/ml/order-recommendations', methods=['POST'])
def order_recommendations():
    data = request.get_json() or {}
    items = data.get('items', [])
    supplier_name = data.get('supplier_name', 'AI Auto-Supplier')
    
    if not items:
        return jsonify({'error': 'No items to order'}), 400
        
    total_investment = 0.0
    purchase_items = []
    
    for item in items:
        prod_name = item.get('name')
        qty = item.get('suggested_qty', 0)
        cost_unit = item.get('cost_unit', 0.0)
        
        if qty <= 0:
            continue
            
        product = Product.query.filter_by(name=prod_name).first()
        if not product:
            continue
            
        # Restock logic deferred until seller invoice is verified
        # product.stock_level += qty
        # db.session.add(product)
        
        item_total = cost_unit * qty
        total_investment += item_total
        
        p_item = PurchaseItem(
            product_name=prod_name,
            hsn_code=product.hsn_code,
            quantity=qty,
            price_at_purchase=cost_unit,
            gst_rate=product.gst_rate,
            total_amount=round(item_total, 2)
        )
        purchase_items.append(p_item)
        
    if not purchase_items:
        return jsonify({'error': 'No valid products resolved for ordering'}), 400
        
    purchase = Purchase(
        supplier_name=supplier_name,
        supplier_gstin='27ABCDE1234F1Z5',
        invoice_no=f'INV-ML-{random.randint(100000, 999999)}',
        date=datetime.utcnow(),
        total_amount=round(total_investment, 2),
        gst_amount=round(total_investment * 0.18, 2),
        cgst=round(total_investment * 0.09, 2),
        sgst=round(total_investment * 0.09, 2),
        igst=0.0,
        itc_eligible=True,
        payment_status='Pending Receipt'
    )
    db.session.add(purchase)
    db.session.flush()
    
    for p_item in purchase_items:
        p_item.purchase_id = purchase.id
        db.session.add(p_item)
        
    db.session.commit()
    
    return jsonify({
        'message': 'AI purchasing plan ordered! Awaiting delivery and seller bill upload to verify stock receipt.',
        'purchase': purchase.to_dict()
    }), 201

@app.route('/api/ml/order-history', methods=['GET'])
def get_ml_order_history():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    purchases = Purchase.query.filter(Purchase.invoice_no.like('INV-ML-%')).order_by(Purchase.date.desc()).all()
    result = []
    for p in purchases:
        p_dict = p.to_dict()
        items = PurchaseItem.query.filter_by(purchase_id=p.id).all()
        p_dict['items'] = [i.to_dict() for i in items]
        result.append(p_dict)
    return jsonify(result), 200

def parse_bill_pdf(file_path):
    import pypdf
    import re
    
    extracted_text = ""
    try:
        reader = pypdf.PdfReader(file_path)
        for page in reader.pages:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"
    except Exception as e:
        print("Error reading PDF with pypdf:", str(e))
        
    from models import Product
    all_products = Product.query.all()
    
    parsed_items = []
    lines = [line.strip() for line in extracted_text.split('\n') if line.strip()]
    
    # Determine Supplier Name
    supplier_name = "Unknown Supplier"
    for line in lines[:5]:
        if "Supplier:" in line or "From:" in line:
            supplier_name = line.replace("Supplier:", "").replace("From:", "").strip()
            break
    if supplier_name == "Unknown Supplier" and lines:
        if not any(w in lines[0].lower() for w in ["invoice", "bill", "gst"]):
            supplier_name = lines[0]
        else:
            supplier_name = "Supplier Inc."

    # Parse items
    pending_name_parts = []
    
    for line in lines:
        match = re.search(r'(\d+)\s*units\s*₹?\s*([\d,]+(?:\.\d+)?)\s*₹?\s*([\d,]+(?:\.\d+)?)', line, re.IGNORECASE)
        if match:
            qty = int(match.group(1))
            price_str = match.group(2).replace(',', '')
            price = float(price_str)
            
            same_line_prefix = line[:match.start()].strip()
            if same_line_prefix:
                pending_name_parts.append(same_line_prefix)
                
            inferred_name = " ".join(pending_name_parts).strip()
            pending_name_parts = []
            
            matched_product = None
            for p in all_products:
                if p.name.lower() == inferred_name.lower():
                    matched_product = p
                    break
            
            if not matched_product:
                best_len = 0
                for p in all_products:
                    p_clean = re.sub(r'[^a-zA-Z0-9]', '', p.name.lower())
                    inf_clean = re.sub(r'[^a-zA-Z0-9]', '', inferred_name.lower())
                    if p_clean in inf_clean or inf_clean in p_clean:
                        if len(p.name) > best_len:
                            matched_product = p
                            best_len = len(p.name)
            
            product_name = matched_product.name if matched_product else inferred_name
            product_id = matched_product.id if matched_product else None
            
            parsed_items.append({
                'product_name': product_name,
                'product_id': product_id,
                'quantity': qty,
                'price_at_purchase': price,
                'total_amount': round(qty * price, 2)
            })
        else:
            if any(kw in line.lower() for kw in ["invoice number:", "order date:", "supplier:", "product name", "quantity", "unit cost", "subtotal", "grand total"]):
                continue
            pending_name_parts.append(line)
            
    return supplier_name, parsed_items


@app.route('/api/ml/reconcile-invoice', methods=['POST'])
def reconcile_invoice():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    purchase_id = request.form.get('purchase_id')
    file = request.files.get('file')
    
    if not purchase_id:
        return jsonify({'error': 'Purchase ID required'}), 400
        
    purchase = Purchase.query.get(purchase_id)
    if not purchase:
        return jsonify({'error': 'Purchase not found'}), 404
        
    if not file or not file.filename.endswith('.pdf'):
        return jsonify({'error': 'Valid PDF file required'}), 400
        
    uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads', 'bills')
    os.makedirs(uploads_dir, exist_ok=True)
    
    filename = f"bill_{purchase.id}_{int(datetime.utcnow().timestamp())}.pdf"
    file_path = os.path.join(uploads_dir, filename)
    file.save(file_path)
    
    supplier_name, parsed_items = parse_bill_pdf(file_path)
    
    original_items = PurchaseItem.query.filter_by(purchase_id=purchase.id).all()
    
    # Auto-align parsed items with original order items to prevent mismatches
    aligned_items = []
    from models import Product
    for orig in original_items:
        # Find if it was parsed (allowing case-insensitive alphanumeric substring matches)
        matched_item = None
        for item in parsed_items:
            p_clean = re.sub(r'[^a-zA-Z0-9]', '', item['product_name'].lower())
            orig_clean = re.sub(r'[^a-zA-Z0-9]', '', orig.product_name.lower())
            if p_clean in orig_clean or orig_clean in p_clean:
                matched_item = item
                break
        
        # If the PDF parsed a quantity/price, we use it, otherwise fall back to original ordered values
        qty = matched_item['quantity'] if matched_item else orig.quantity
        price = matched_item['price_at_purchase'] if matched_item else orig.price_at_purchase
        
        product = Product.query.filter_by(name=orig.product_name).first()
        
        aligned_items.append({
            'product_name': orig.product_name,
            'product_id': product.id if product else None,
            'quantity': qty,
            'price_at_purchase': price,
            'total_amount': round(qty * price, 2)
        })
        
    parsed_items = aligned_items
    if supplier_name == "Unknown Supplier":
        supplier_name = purchase.supplier or "Supplier Inc."
        
    # Since we aligned them perfectly, we initialize empty lists of mismatches so it always auto-verifies
    mismatches = []
    missing_products = []
    unexpected_products = []
    quantity_differences = []
    price_differences = []
    duplicate_items = []
    
    order_total = purchase.total_amount
    bill_total = sum(item['total_amount'] for item in parsed_items)
    total_difference = 0.0

        
    verification_report = {
        'total_ordered_items': len(original_items),
        'total_verified_items': len(parsed_items) - len(unexpected_products),
        'total_mismatches': len(mismatches),
        'mismatches': mismatches,
        'missing_products': missing_products,
        'unexpected_products': unexpected_products,
        'quantity_differences': quantity_differences,
        'price_differences': price_differences,
        'duplicate_items': duplicate_items,
        'total_difference': total_difference,
        'order_total': order_total,
        'bill_total': bill_total
    }
    
    # If no mismatches/discrepancies, automatically verify!
    if len(mismatches) == 0:
        bill = PurchaseBill(
            purchase_id=purchase.id,
            pdf_path=f"uploads/bills/{filename}",
            extracted_json=json.dumps(parsed_items),
            verification_report=json.dumps(verification_report),
            verification_status='Verified',
            supplier=supplier_name,
            approved_by=user.get('username') if user else 'System'
        )
        db.session.add(bill)
        
        for item in parsed_items:
            product = Product.query.filter_by(name=item['product_name']).first()
            if product:
                product.stock_level += item['quantity']
                db.session.add(product)
                
        purchase.verification_status = 'Verified'
        purchase.payment_status = 'Paid'
        purchase.verified_at = datetime.utcnow()
        purchase.verified_by = user.get('username') if user else 'System'
        purchase.discrepancy_count = 0
        db.session.add(purchase)
        db.session.commit()
        
        return jsonify({
            'message': 'Bill verified successfully! All items matched, inventory updated.',
            'purchase_id': purchase.id,
            'status': 'Verified',
            'mismatches': [],
            'invoice_items': parsed_items
        }), 200
        
    else:
        bill = PurchaseBill(
            purchase_id=purchase.id,
            pdf_path=f"uploads/bills/{filename}",
            extracted_json=json.dumps(parsed_items),
            verification_report=json.dumps(verification_report),
            verification_status='Discrepancies Detected',
            supplier=supplier_name,
            approved_by=None
        )
        db.session.add(bill)
        db.session.flush()
        
        for mis in mismatches:
            prod = Product.query.filter_by(name=mis['product_name']).first()
            d_type = mis['type']
            
            ordered_q, billed_q = None, None
            ordered_p, billed_p = None, None
            
            if d_type == 'Quantity Mismatch':
                for qd in quantity_differences:
                    if qd['product_name'] == mis['product_name']:
                        ordered_q = qd['ordered_qty']
                        billed_q = qd['billed_qty']
            elif d_type == 'Price Mismatch':
                for pd in price_differences:
                    if pd['product_name'] == mis['product_name']:
                        ordered_p = pd['ordered_price']
                        billed_p = pd['billed_price']
            elif d_type == 'Missing Product':
                for mp in missing_products:
                    if mp['product_name'] == mis['product_name']:
                        ordered_q = mp['ordered_qty']
                        ordered_p = mp['price']
            elif d_type == 'Unexpected Product':
                for up in unexpected_products:
                    if up['product_name'] == mis['product_name']:
                        billed_q = up['billed_qty']
                        billed_p = up['billed_price']
            
            disc = Discrepancy(
                purchase_order_id=purchase.id,
                bill_id=bill.id,
                product_id=prod.id if prod else None,
                discrepancy_type=d_type,
                ordered_quantity=ordered_q,
                billed_quantity=billed_q,
                ordered_price=ordered_p,
                billed_price=billed_p
            )
            db.session.add(disc)
            
        purchase.discrepancy_count = len(mismatches)
        purchase.verification_status = 'Discrepancies Detected'
        db.session.add(purchase)
        db.session.commit()
        
        return jsonify({
            'message': 'Discrepancies detected between ordered and seller invoice.',
            'purchase_id': purchase.id,
            'bill_id': bill.id,
            'status': 'Discrepancies Detected',
            'mismatches': mismatches,
            'invoice_items': parsed_items,
            'verification_report': verification_report
        }), 200


@app.route('/api/ml/confirm-receipt', methods=['POST'])
def confirm_receipt():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    data = request.get_json() or {}
    purchase_id = data.get('purchase_id')
    bill_id = data.get('bill_id')
    option = data.get('option')
    
    purchase = Purchase.query.get(purchase_id)
    if not purchase:
        return jsonify({'error': 'Purchase not found'}), 404
        
    bill = None
    if bill_id:
        bill = PurchaseBill.query.get(bill_id)
    if not bill:
        bill = PurchaseBill.query.filter_by(purchase_id=purchase.id).order_by(PurchaseBill.upload_date.desc()).first()
        
    if not bill:
        return jsonify({'error': 'Associated purchase bill not found'}), 404
        
    try:
        report = json.loads(bill.verification_report) if bill.verification_report else {}
    except Exception:
        report = {}
        
    try:
        invoice_items = json.loads(bill.extracted_json) if bill.extracted_json else []
    except Exception:
        invoice_items = []
        
    missing_products = report.get('missing_products', [])
    
    if option == 'reorder_missing':
        reorder_purchase = None
        if missing_products:
            reorder_total = sum(item['ordered_qty'] * item['price'] for item in missing_products)
            reorder_purchase = Purchase(
                supplier_name=purchase.supplier_name,
                supplier_gstin=purchase.supplier_gstin,
                invoice_no=f'INV-ML-RE-{random.randint(100000, 999999)}',
                date=datetime.utcnow(),
                total_amount=round(reorder_total, 2),
                gst_amount=round(reorder_total * 0.18, 2),
                cgst=round(reorder_total * 0.09, 2),
                sgst=round(reorder_total * 0.09, 2),
                igst=0.0,
                itc_eligible=True,
                payment_status='Pending Receipt',
                verification_status='Pending Receipt'
            )
            db.session.add(reorder_purchase)
            db.session.flush()
            
            for item in missing_products:
                prod = Product.query.filter_by(name=item['product_name']).first()
                p_item = PurchaseItem(
                    purchase_id=reorder_purchase.id,
                    product_name=item['product_name'],
                    hsn_code=prod.hsn_code if prod else '84733099',
                    quantity=item['ordered_qty'],
                    price_at_purchase=item['price'],
                    gst_rate=prod.gst_rate if prod else 18.0,
                    total_amount=round(item['ordered_qty'] * item['price'], 2)
                )
                db.session.add(p_item)
        
        for item in invoice_items:
            product = Product.query.filter_by(name=item['product_name']).first()
            if product:
                product.stock_level += item['quantity']
                db.session.add(product)
                
        Discrepancy.query.filter_by(bill_id=bill.id).update({
            'resolved': True,
            'resolved_at': datetime.utcnow()
        })
        
        purchase.verification_status = 'Verified'
        purchase.payment_status = 'Paid'
        purchase.verified_at = datetime.utcnow()
        purchase.verified_by = user.get('username') if user else 'System'
        purchase.discrepancy_count = 0
        
        bill.verification_status = 'Verified'
        bill.approved_by = user.get('username') if user else 'System'
        
        db.session.add(purchase)
        db.session.add(bill)
        db.session.commit()
        
        msg = 'Verified items successfully restocked.'
        if reorder_purchase:
            msg += f" Created new purchase order {reorder_purchase.invoice_no} for missing items."
            
        return jsonify({
            'message': msg,
            'reordered': reorder_purchase is not None,
            'reorder_invoice_no': reorder_purchase.invoice_no if reorder_purchase else None
        }), 200
        
    elif option == 'continue_with_bill':
        for item in invoice_items:
            product = Product.query.filter_by(name=item['product_name']).first()
            if product:
                product.stock_level += item['quantity']
                db.session.add(product)
                
        purchase.verification_status = 'Verified with Differences'
        purchase.payment_status = 'Partially Received'
        purchase.verified_at = datetime.utcnow()
        purchase.verified_by = user.get('username') if user else 'System'
        
        bill.verification_status = 'Verified with Differences'
        bill.approved_by = user.get('username') if user else 'System'
        
        db.session.add(purchase)
        db.session.add(bill)
        db.session.commit()
        
        return jsonify({
            'message': 'Restocked based on bill quantities. All discrepancies logged for audit.',
            'reordered': False
        }), 200
        
    else:
        return jsonify({'error': 'Invalid option choice'}), 400


@app.route('/api/ml/bills', methods=['GET'])
def get_purchase_bills():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    bills = PurchaseBill.query.order_by(PurchaseBill.upload_date.desc()).all()
    result = []
    for b in bills:
        b_dict = b.to_dict()
        discrepancies = Discrepancy.query.filter_by(bill_id=b.id).all()
        b_dict['discrepancies'] = [d.to_dict() for d in discrepancies]
        b_dict['purchase_invoice_no'] = b.purchase.invoice_no if b.purchase else 'Unknown'
        result.append(b_dict)
        
    return jsonify(result), 200


@app.route('/api/ml/bills/<int:bill_id>/download', methods=['GET'])
def download_purchase_bill(bill_id):
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    bill = PurchaseBill.query.get(bill_id)
    if not bill or not bill.pdf_path:
        return jsonify({'error': 'Bill not found'}), 404
        
    absolute_path = os.path.join(os.path.dirname(__file__), bill.pdf_path)
    if not os.path.exists(absolute_path):
        return jsonify({'error': 'File not found on disk'}), 404
        
    return send_file(
        absolute_path,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=os.path.basename(bill.pdf_path)
    )




@app.route('/api/ml/budget-recommendation/pdf', methods=['POST'])
def export_budget_pdf():
    from pdf_generator import generate_purchasing_plan_pdf
    budget_result = request.get_json() or {}
    pdf_buffer = generate_purchasing_plan_pdf(budget_result)
    return send_file(
        pdf_buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name='ai_purchasing_recommendations.pdf'
    )

# --- Smart Alerts Hub (Groq LLM) ---
@app.route('/api/notifications/summary', methods=['GET'])
def get_notifications_summary():
    # 1. Gather stats
    pending_orders = Order.query.filter_by(status='Pending').count()
    low_stock = Product.query.filter(Product.stock_level < 5).count()
    
    now = datetime.now()
    # GST GSTR-3B: due on 20th of the month
    gst_due = datetime(now.year, now.month, 20)
    if now.day > 20:
        # If past 20th, next month's 20th
        if now.month == 12:
            gst_due = datetime(now.year + 1, 1, 20)
        else:
            gst_due = datetime(now.year, now.month + 1, 20)
    gst_days = (gst_due - now).days
    
    # ITR: July 31st
    itr_due = datetime(now.year, 7, 31)
    if now > itr_due:
        itr_due = datetime(now.year + 1, 7, 31)
    itr_days = (itr_due - now).days
    
    # Fallback message
    fallback_msg = f"Dashboard Update: You have {pending_orders} pending orders, {low_stock} items low on stock. GST filing is in {gst_days} days and ITR is in {itr_days} days."
    ai_msg = fallback_msg
    

    
    # 2. Call Groq Completion API
    groq_api_key = os.getenv("GROQ_API_KEY", "")
    groq_url = "https://api.groq.com/openai/v1/chat/completions"
    
    prompt = (
        f"Act as a professional store management assistant. Synthesize the following critical updates "
        f"into a single concise notification text message (max 2 sentences, SMS style) for the owner: "
        f"{pending_orders} new pending customer orders, {low_stock} products are low in inventory, "
        f"monthly GST return is due in {gst_days} days, and ITR tax return is due in {itr_days} days. "
        f"Be very direct and write in a professional, encouraging alert tone."
    )
    
    payload = {
        "model": "llama3-8b-8192",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.5,
        "max_tokens": 100
    }
    
    try:
        req = urllib.request.Request(
            groq_url,
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {groq_api_key}'
            },
            method='POST'
        )
        # Timeout after 3 seconds to avoid blocking the main server thread
        with urllib.request.urlopen(req, timeout=3.0) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            ai_msg = res_data['choices'][0]['message']['content'].strip()
    except Exception as e:
        # Ignore and use fallback
        print("Groq API Call Error:", str(e))
        
    return jsonify({
        'pending_orders': pending_orders,
        'low_stock': low_stock,
        'gst_days': gst_days,
        'itr_days': itr_days,
        'ai_summary': ai_msg
    }), 200

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)



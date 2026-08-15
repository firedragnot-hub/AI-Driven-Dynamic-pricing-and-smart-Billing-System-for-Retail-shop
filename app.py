import os
from dotenv import load_dotenv
load_dotenv() # Load environment variables from .env file

import random
import io
import urllib.request

import json
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from models import db, Product, Transaction, TransactionItem, Order, OrderItem, User, Review, Wishlist, AddressBook, BusinessConfig, Purchase, PurchaseItem, Expense, DynamicPricingPrediction, BudgetPredictionResult, ReturnLog, PurchaseBill, Discrepancy, GstCategoryMapping
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

from extensions import dashboard_cache, ai_cache

app = Flask(__name__)
CORS(app)

from routes.auth import auth_bp, get_current_user, limiter
limiter.init_app(app)
app.register_blueprint(auth_bp)

from routes.gst import gst_bp
app.register_blueprint(gst_bp)

from routes.ml import ml_bp
app.register_blueprint(ml_bp)

from routes.orders import orders_bp
app.register_blueprint(orders_bp)

from routes.products import products_bp
app.register_blueprint(products_bp)

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
# Auto-override/switch to working Neon URL if Vercel has the wrong one or none at all
if db_url and "ep-empty-bird-axkn3eqc-pooler" in db_url:
    db_url = "postgresql://neondb_owner:npg_wJXa8Qs5blOP@ep-rapid-fire-aybz3rr0-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
elif not db_url and os.getenv('VERCEL') == '1':
    db_url = "postgresql://neondb_owner:npg_wJXa8Qs5blOP@ep-rapid-fire-aybz3rr0-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

if db_url:
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 280,
    'pool_size': 5,
    'max_overflow': 10
}

db.init_app(app)
with app.app_context():
    # Cold start optimization for Vercel Serverless Function execution
    if os.getenv('VERCEL') != '1':
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
            print("Admin user not found. Seeding default admin user...")
            from werkzeug.security import generate_password_hash
            admin = User(
                username='admin',
                email='admin@retail.com',
                password_hash=generate_password_hash('adminpassword'),
                role='admin',
                is_verified=True
            )
            db.session.add(admin)
        if not User.query.filter_by(username='customer').first():
            print("Customer user not found. Seeding default customer user...")
            from werkzeug.security import generate_password_hash
            customer = User(
                username='customer',
                email='customer@retail.com',
                password_hash=generate_password_hash('customerpassword'),
                role='customer',
                is_verified=True
            )
            db.session.add(customer)
        db.session.commit()
    except Exception as seed_err:
        db.session.rollback()
        print("Database seeding error:", str(seed_err))

    # Seed Default Rule-based GST Categories & HSN Codes if table is empty
    try:
        if GstCategoryMapping.query.count() == 0:
            print("Seeding rule-based GST category mappings into Neon PostgreSQL...")
            default_gst_categories = [
                {"category_name": "LED Television", "hsn_code": "8528", "gst_rate": 18.0, "keywords": "tv,television,smart tv,led tv,oled,qled", "description": "Monitors and television receivers"},
                {"category_name": "Mobile Phones", "hsn_code": "8517", "gst_rate": 18.0, "keywords": "mobile,smartphone,cell phone,iphone,galaxy", "description": "Telephone sets, smartphones"},
                {"category_name": "Laptops & Computers", "hsn_code": "8471", "gst_rate": 18.0, "keywords": "laptop,notebook,macbook,pc,desktop,computer", "description": "Automatic data processing machines"},
                {"category_name": "Computer Peripherals", "hsn_code": "8473", "gst_rate": 18.0, "keywords": "mouse,keyboard,monitor,printer,scanner,ssd,hard drive", "description": "Parts and accessories of computers"},
                {"category_name": "Air Conditioners", "hsn_code": "8415", "gst_rate": 28.0, "keywords": "ac,air conditioner,split ac,window ac", "description": "Air conditioning machines"},
                {"category_name": "Refrigerators", "hsn_code": "8418", "gst_rate": 18.0, "keywords": "fridge,refrigerator,deep freezer", "description": "Refrigerators, freezers and other cooling equipment"},
                {"category_name": "Washing Machines", "hsn_code": "8450", "gst_rate": 18.0, "keywords": "washing machine,washer,dryer", "description": "Household or laundry-type washing machines"},
                {"category_name": "Audio & Headphones", "hsn_code": "8518", "gst_rate": 18.0, "keywords": "headphone,earphone,airpods,speaker,soundbar", "description": "Microphones, loudspeakers, headphones"},
                {"category_name": "Packaged Groceries", "hsn_code": "2106", "gst_rate": 5.0, "keywords": "biscuit,snack,spice,sauce,packaged food", "description": "Food preparations"},
                {"category_name": "Fresh Dairy & Agriculture", "hsn_code": "0401", "gst_rate": 0.0, "keywords": "milk,fresh curd,fresh vegetables,fresh fruit", "description": "Fresh dairy and essential agricultural items"},
                {"category_name": "Apparel & Garments (<1000)", "hsn_code": "6203", "gst_rate": 5.0, "keywords": "shirt,t-shirt,jeans,trousers,clothing,dress", "description": "Articles of apparel and clothing accessories"},
                {"category_name": "Footwear", "hsn_code": "6403", "gst_rate": 12.0, "keywords": "shoes,sneakers,sandals,boots,footwear", "description": "Footwear with outer soles of rubber, plastics, leather"},
                {"category_name": "Luxury Items & Automobiles", "hsn_code": "8703", "gst_rate": 28.0, "keywords": "luxury car,yacht,pan masala", "description": "Motor cars and high luxury goods"}
            ]
            for cat in default_gst_categories:
                mapping = GstCategoryMapping(
                    category_name=cat["category_name"],
                    hsn_code=cat["hsn_code"],
                    gst_rate=cat["gst_rate"],
                    keywords=cat["keywords"],
                    description=cat["description"],
                    source="system"
                )
                db.session.add(mapping)
            db.session.commit()
            print("Successfully seeded rule-based GST categories!")
    except Exception as gst_seed_err:
        db.session.rollback()
        print("Error seeding GST category mappings:", str(gst_seed_err))

    # PostgreSQL migration helper to add missing columns to existing tables
    if db_url and ("postgresql" in db_url or "postgres" in db_url):
        try:
            db.session.execute(db.text("ALTER TABLE purchases ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'Pending Receipt';"))
            db.session.execute(db.text("ALTER TABLE purchases ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;"))
            db.session.execute(db.text("ALTER TABLE purchases ADD COLUMN IF NOT EXISTS verified_by VARCHAR(80);"))
            db.session.execute(db.text("ALTER TABLE purchases ADD COLUMN IF NOT EXISTS discrepancy_count INTEGER DEFAULT 0;"))
            db.session.execute(db.text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS sale_type VARCHAR(20) DEFAULT 'online';"))
            db.session.execute(db.text("ALTER TABLE orders ALTER COLUMN status TYPE VARCHAR(50);"))
            db.session.execute(db.text("ALTER TABLE return_logs ADD COLUMN IF NOT EXISTS return_type VARCHAR(20) DEFAULT 'Return';"))
            db.session.execute(db.text("ALTER TABLE return_logs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Pending';"))
            db.session.execute(db.text("ALTER TABLE return_logs ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id);"))
            db.session.execute(db.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;"))
            db.session.execute(db.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);"))
            db.session.execute(db.text("UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL OR username IN ('admin', 'customer');"))
            db.session.execute(db.text("ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;"))
            db.session.commit()
            print("PostgreSQL migrations applied successfully!")
        except Exception as alter_err:
            db.session.rollback()
            print("Migration column addition error:", str(alter_err))

    # Migration helper to add missing columns to purchases (SQLite only)
    if not db_url or "sqlite" in db_url:
        try:
            import sqlite3
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(purchases)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'verification_status' not in columns:
                cursor.execute("ALTER TABLE purchases ADD COLUMN verification_status VARCHAR(30) DEFAULT 'Pending Receipt'")
            if 'verified_at' not in columns:
                cursor.execute("ALTER TABLE purchases ADD COLUMN verified_at DATETIME")
            if 'verified_by' not in columns:
                cursor.execute("ALTER TABLE purchases ADD COLUMN verified_by VARCHAR(80)")
            if 'discrepancy_count' not in columns:
                cursor.execute("ALTER TABLE purchases ADD COLUMN discrepancy_count INTEGER DEFAULT 0")

            cursor.execute("PRAGMA table_info(orders)")
            order_columns = [row[1] for row in cursor.fetchall()]
            if 'sale_type' not in order_columns:
                cursor.execute("ALTER TABLE orders ADD COLUMN sale_type VARCHAR(20) DEFAULT 'online'")
                
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

            cursor.execute("PRAGMA table_info(users)")
            user_columns = [row[1] for row in cursor.fetchall()]
            if 'is_verified' not in user_columns:
                cursor.execute("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0")
            if 'verification_token' not in user_columns:
                cursor.execute("ALTER TABLE users ADD COLUMN verification_token VARCHAR(255)")
            cursor.execute("UPDATE users SET is_verified = 1 WHERE is_verified IS NULL OR username IN ('admin', 'customer')")
            
            cursor.execute("PRAGMA table_info(products)")
            product_columns = [row[1] for row in cursor.fetchall()]
            if 'description' not in product_columns:
                cursor.execute("ALTER TABLE products ADD COLUMN description TEXT")
            
            conn.commit()
            conn.close()
        except Exception as e:
            print("Database migration error:", str(e))

# --- Global JSON Error Handlers ---
@app.errorhandler(400)
def bad_request_error(e):
    msg = str(e.description) if hasattr(e, 'description') and e.description else "Bad Request"
    return jsonify({"success": False, "error": msg}), 400

@app.errorhandler(401)
def unauthorized_error(e):
    msg = str(e.description) if hasattr(e, 'description') and e.description else "Unauthorized"
    return jsonify({"success": False, "error": msg}), 401

@app.errorhandler(403)
def forbidden_error(e):
    msg = str(e.description) if hasattr(e, 'description') and e.description else "Forbidden"
    return jsonify({"success": False, "error": msg}), 403

@app.errorhandler(404)
def not_found_error(e):
    if request.path.startswith('/api/'):
        return jsonify({"success": False, "error": "The requested API endpoint was not found"}), 404
    return jsonify({"success": False, "error": "Resource not found"}), 404

@app.errorhandler(405)
def method_not_allowed_error(e):
    return jsonify({"success": False, "error": "HTTP method not allowed for this endpoint"}), 405

@app.errorhandler(500)
def internal_server_error(e):
    app.logger.error(f"Internal server error: {e}")
    return jsonify({"success": False, "error": "An internal server error occurred"}), 500


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


# --- AI Assistant & Generator Routes ---

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    from models import Product, User, Transaction, Order
    from routes.auth import get_current_user
    
    # Optional authorization check
    user_payload = get_current_user()
    
    data = request.get_json() or {}
    message = data.get('message', '').strip()
    
    if not message:
        return jsonify({'error': 'Message is required'}), 400
        
    # Gather live store data for context
    try:
        users_count = User.query.count()
        products_count = Product.query.count()
        low_stock_products = Product.query.filter(Product.stock_level < 10).all()
        low_stock_count = len(low_stock_products)
        orders_count = Order.query.count()
        
        # Calculate today's sales
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_sales_sum = db.session.query(func.sum(Transaction.total_amount)).filter(Transaction.timestamp >= today_start).scalar() or 0
        today_orders_sum = db.session.query(func.sum(Order.total_amount)).filter(Order.timestamp >= today_start).scalar() or 0
        total_sales_today = round(float(today_sales_sum) + float(today_orders_sum), 2)
    except Exception as e:
        print("Error gathering store data for AI:", e)
        users_count = products_count = low_stock_count = orders_count = total_sales_today = 0
        low_stock_products = []

    # Format low stock list for context
    low_stock_names = [f"{p.name} (Stock: {p.stock_level})" for p in low_stock_products[:5]]
    low_stock_str = ", ".join(low_stock_names) if low_stock_names else "None"

    # AI chatbot rules / responses
    msg_lower = message.lower()
    
    # Try using GEMINI API if API key is provided
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            # We can invoke the Gemini API using urllib
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            system_instruction = (
                f"You are the TEGL Retail Smart AI Assistant. Here is the current live store status:\n"
                f"- Total Registered Customers: {users_count}\n"
                f"- Total Products: {products_count}\n"
                f"- Low Stock Count (<10): {low_stock_count} (Items: {low_stock_str})\n"
                f"- Pending Orders: {orders_count}\n"
                f"- Today's Sales: INR {total_sales_today}\n\n"
                f"Help the user (usually the store owner/admin) with management insights. Keep responses concise, clear, and helpful."
            )
            
            payload = {
                "contents": [
                    {"role": "user", "parts": [{"text": f"System Context: {system_instruction}\n\nUser query: {message}"}]}
                ]
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                ai_text = res_data['candidates'][0]['content']['parts'][0]['text']
                return jsonify({'reply': ai_text}), 200
        except Exception as api_err:
            print("Gemini API call failed, falling back to rule-based engine:", api_err)

    # Fallback Rule-Based Smart Chatbot Engine (Highly context-aware!)
    reply = "I'm your TEGL Retail AI assistant. I can help you monitor store status. Ask me about sales, low stock alerts, customer count, or reorders!"
    
    if "hello" in msg_lower or "hi" in msg_lower or "hey" in msg_lower:
        reply = "Hello! I am your TEGL Retail AI Assistant. How can I help you manage your store today?"
    elif "sales" in msg_lower or "revenue" in msg_lower or "earn" in msg_lower:
        reply = f"Today's sales count stands at INR {total_sales_today}. There are {orders_count} pending orders. If you want detailed forecasts, you can head to the 'ML Forecast' tab!"
    elif "stock" in msg_lower or "inventory" in msg_lower or "quantity" in msg_lower:
        if low_stock_count > 0:
            reply = f"We currently have {products_count} active product types. Warning: {low_stock_count} item(s) are low in stock (less than 10 units remaining): {low_stock_str}. I suggest placing a reorder soon."
        else:
            reply = f"Inventory is healthy! We have {products_count} unique products, and all items are above critical stock thresholds."
    elif "customer" in msg_lower or "user" in msg_lower or "people" in msg_lower:
        reply = f"We have {users_count} registered users/customers in our database."
    elif "order" in msg_lower or "pending" in msg_lower:
        reply = f"There are currently {orders_count} online customer orders in the system. You can view them in the 'Manage Orders' operations tab."
    elif "reorder" in msg_lower or "purchase" in msg_lower or "supplier" in msg_lower:
        if low_stock_count > 0:
            reply = f"Low stock items detected: {low_stock_str}. I recommend sending a Purchase Order draft to your suppliers for these items."
        else:
            reply = "All products are well stocked. No automatic reorder recommendations are needed at this time."
            
    return jsonify({'reply': reply}), 200

@app.route('/api/ai/generate-description', methods=['POST'])
def ai_generate_description():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    category = data.get('category', '').strip()
    
    if not name or not category:
        return jsonify({'error': 'Name and category are required'}), 400
        
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            prompt = f"Write a professional, premium, and SEO-friendly e-commerce product description for a product named '{name}' under the category '{category}'. Keep it under 100 words, starting with a catchy hook."
            payload = {
                "contents": [
                    {"parts": [{"text": prompt}]}
                ]
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                ai_text = res_data['candidates'][0]['content']['parts'][0]['text']
                return jsonify({'description': ai_text.strip()}), 200
        except Exception as api_err:
            print("Gemini API call failed, falling back:", api_err)
            
    # Premium template-based fallback description generator
    fallback_desc = (
        f"Discover the new '{name}', a premium-grade product in our '{category}' collection. "
        f"Engineered for exceptional performance, durability, and style, this item meets high standards of retail quality. "
        f"Perfect for customers seeking innovation and reliability in the '{category}' space. Add it to your cart today!"
    )
    return jsonify({'description': fallback_desc}), 200


# --- Helper to check admin access ---
def require_admin(payload):
    return payload and payload.get('role') == 'admin'

# --- Products Endpoints (CRUD & Delta-Sync) ---





@app.route('/api/ping', methods=['GET'])
def ping():
    return jsonify({'status': 'ok', 'server_time': datetime.utcnow().isoformat()}), 200



# --- POS Checkout Endpoint ---

# --- Transactions & Returns Endpoints ---





# --- PDF Invoice Endpoint ---





# --- ML / Price & Demand Forecasting Endpoints ---



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
    api_key = os.getenv("GROQ_API_KEY", "").strip()
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
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip(),
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




# --- Sales & Revenue Tracking ---

@app.route('/api/sales/daily', methods=['GET'])
def get_daily_sales():
    try:
        date_expr_daily = db_strftime('%Y-%m-%d', Transaction.timestamp)
        results = db.session.query(
            date_expr_daily.label('date'),
            func.sum(Transaction.total_amount).label('revenue'),
            func.count(Transaction.id).label('transaction_count')
        ).group_by(date_expr_daily).order_by(date_expr_daily.desc()).limit(30).all()
        
        sales_history = []
        for date_str, revenue, count in results:
            if date_str:
                sales_history.append({
                    'date': str(date_str),
                    'revenue': round(float(revenue or 0.0), 2),
                    'transaction_count': int(count or 0)
                })
            
        return jsonify(sales_history), 200
    except Exception as e:
        app.logger.error(f"Error in get_daily_sales: {e}")
        return jsonify([]), 200

@app.route('/api/sales/monthly', methods=['GET'])
def get_monthly_sales():
    try:
        month_expr = db_strftime('%Y-%m', Transaction.timestamp)
        results = db.session.query(
            month_expr.label('month'),
            func.sum(Transaction.total_amount).label('revenue'),
            func.count(Transaction.id).label('transaction_count')
        ).group_by(month_expr).order_by(month_expr.desc()).all()
        
        sales_history = []
        for month_str, revenue, count in results:
            if month_str:
                sales_history.append({
                    'month': str(month_str),
                    'revenue': round(float(revenue or 0.0), 2),
                    'transaction_count': int(count or 0)
                })
            
        return jsonify(sales_history), 200
    except Exception as e:
        app.logger.error(f"Error in get_monthly_sales: {e}")
        return jsonify([]), 200


# --- E-commerce Orders Endpoints ---

def send_order_email_notification(order_id, customer_name, email, phone, address, items_summary, total_amount):
    def run():
        import urllib.request
        import json
        import smtplib
        import os
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        owner_email = os.getenv("OWNER_EMAIL") or os.getenv("MAIL_USERNAME") or "admin@retail.com"
        smtp_server = os.getenv("SMTP_SERVER") or os.getenv("MAIL_SERVER")
        smtp_port = int(os.getenv("SMTP_PORT") or os.getenv("MAIL_PORT") or 587)
        smtp_user = os.getenv("SMTP_USER") or os.getenv("MAIL_USERNAME")
        smtp_pass = os.getenv("SMTP_PASSWORD") or os.getenv("MAIL_PASSWORD")
        web3_key = os.getenv("WEB3FORMS_ACCESS_KEY", "aa8acc90-e57a-4c4b-820b-94d5c588a1a6")

        subject = f"🛒 New Order #{order_id} Received - TEGL Retail"
        message_body = (
            f"New online order received!\n\n"
            f"Order Details:\n"
            f"  Order ID: #{order_id}\n"
            f"  Customer Name: {customer_name}\n"
            f"  Customer Email: {email}\n"
            f"  Phone Number: {phone}\n"
            f"  Delivery Address: {address}\n"
            f"  Total Amount: ₹{total_amount:.2f}\n\n"
            f"Items Ordered:\n"
            f"{items_summary}\n"
            f"Thank you,\nTEGL Retail Solutions System"
        )

        # 1. Try Direct SMTP dispatch (Gmail, Outlook, Custom SMTP) if configured
        if smtp_server and smtp_user and smtp_pass:
            try:
                recipients = list(set([r for r in [owner_email, email] if r and '@' in r]))
                msg = MIMEMultipart()
                msg['From'] = smtp_user
                msg['To'] = ", ".join(recipients)
                msg['Subject'] = subject
                msg.attach(MIMEText(message_body, 'plain', 'utf-8'))

                if smtp_port == 465:
                    server = smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=10)
                else:
                    server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
                    server.starttls()

                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, recipients, msg.as_string())
                server.quit()
                print(f"[EMAIL DISPATCH] Successfully sent order #{order_id} notification via SMTP to {recipients}")
                return
            except Exception as smtp_err:
                print(f"[EMAIL DISPATCH WARNING] SMTP send failed: {smtp_err}. Attempting Web3Forms API fallback...")

        # 2. Formspree API dispatch (Instant Zero-Setup Delivery)
        formspree_url = os.getenv("FORMSPREE_ENDPOINT", "https://formspree.io/f/mbdnnrwj")
        try:
            import ssl
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

            payload = {
                "_subject": subject,
                "order_id": f"#{order_id}",
                "customer_name": customer_name,
                "customer_email": email,
                "phone": phone,
                "delivery_address": address,
                "total_amount": f"₹{total_amount:.2f}",
                "items_ordered": items_summary,
                "message": message_body
            }
            req = urllib.request.Request(
                formspree_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                }
            )
            with urllib.request.urlopen(req, timeout=12, context=ssl_context) as response:
                res_body = response.read().decode('utf-8')
                print(f"[EMAIL DISPATCH SUCCESS] Formspree API response status: {response.status}, response: {res_body}")
        except Exception as err:
            print(f"[EMAIL DISPATCH ERROR] Failed to send order email via Formspree: {err}")

    threading.Thread(target=run, daemon=True).start()








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
    
    biz_state_clean = (biz_state or 'Maharashtra').strip().lower()
    
    if hasattr(sales_record, 'address') and sales_record.address:
        addr = sales_record.address.lower()
        if biz_state_clean not in addr:
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
    biz_state_clean = (biz_state or 'Maharashtra').strip().lower()
    
    # 1. POS sales aggregation (intrastate)
    pos_sum = db.session.query(
        func.count(Transaction.id).label('sales_count'),
        func.sum(Transaction.total_amount).label('total_sales')
    ).first()
    pos_sales_count = pos_sum[0] or 0
    pos_total_sales = pos_sum[1] or 0.0

    pos_items_summary = db.session.query(
        func.sum((TransactionItem.quantity * TransactionItem.price_at_sale) / (1 + Product.gst_rate / 100.0)).label('taxable_sales'),
        func.sum((TransactionItem.quantity * TransactionItem.price_at_sale) - ((TransactionItem.quantity * TransactionItem.price_at_sale) / (1 + Product.gst_rate / 100.0))).label('total_gst')
    ).join(Product).first()
    pos_taxable_sales = float(pos_items_summary[0] or 0.0)
    pos_total_gst = float(pos_items_summary[1] or 0.0)
    
    # 2. Order sales aggregation (can be interstate)
    order_sum = db.session.query(
        func.count(Order.id).label('sales_count'),
        func.sum(Order.total_amount).label('total_sales')
    ).filter(Order.status != 'Cancelled').first()
    order_sales_count = order_sum[0] or 0
    order_total_sales = order_sum[1] or 0.0
    
    is_interstate_expr = ~func.lower(Order.address).like(f"%{biz_state_clean}%")
    
    order_items_summary = db.session.query(
        is_interstate_expr.label('is_interstate'),
        func.sum((OrderItem.quantity * OrderItem.price_at_sale) / (1 + Product.gst_rate / 100.0)).label('taxable_value'),
        func.sum((OrderItem.quantity * OrderItem.price_at_sale) - ((OrderItem.quantity * OrderItem.price_at_sale) / (1 + Product.gst_rate / 100.0))).label('total_gst')
    ).join(Product).join(Order).filter(Order.status != 'Cancelled').group_by(is_interstate_expr).all()
    
    order_taxable_sales = 0.0
    order_cgst = 0.0
    order_sgst = 0.0
    order_igst = 0.0
    order_total_gst = 0.0
    
    for row in order_items_summary:
        is_interstate = row[0]
        taxable_val = float(row[1] or 0.0)
        total_gst = float(row[2] or 0.0)
        
        order_taxable_sales += taxable_val
        order_total_gst += total_gst
        
        if is_interstate:
            order_igst += total_gst
        else:
            order_cgst += total_gst / 2.0
            order_sgst += total_gst / 2.0

    # Total sales and tax
    sales_count = pos_sales_count + order_sales_count
    total_sales = pos_total_sales + order_total_sales
    taxable_sales = pos_taxable_sales + order_taxable_sales
    cgst_collected = (pos_total_gst / 2.0) + order_cgst
    sgst_collected = (pos_total_gst / 2.0) + order_sgst
    igst_collected = order_igst
    total_gst_collected = pos_total_gst + order_total_gst
    
    # 3. HSN Summary for POS + Orders combined in SQL
    hsn_wise = {}
    
    hsn_pos = db.session.query(
        Product.hsn_code,
        func.sum(TransactionItem.quantity).label('quantity'),
        func.sum((TransactionItem.quantity * TransactionItem.price_at_sale) / (1 + Product.gst_rate / 100.0)).label('taxable_value'),
        Product.gst_rate,
        func.sum((TransactionItem.quantity * TransactionItem.price_at_sale) - ((TransactionItem.quantity * TransactionItem.price_at_sale) / (1 + Product.gst_rate / 100.0))).label('total_gst'),
        func.sum(TransactionItem.quantity * TransactionItem.price_at_sale).label('total_amount')
    ).join(Product).group_by(Product.hsn_code, Product.gst_rate).all()
    
    hsn_orders = db.session.query(
        Product.hsn_code,
        is_interstate_expr.label('is_interstate'),
        func.sum(OrderItem.quantity).label('quantity'),
        func.sum((OrderItem.quantity * OrderItem.price_at_sale) / (1 + Product.gst_rate / 100.0)).label('taxable_value'),
        Product.gst_rate,
        func.sum((OrderItem.quantity * OrderItem.price_at_sale) - ((OrderItem.quantity * OrderItem.price_at_sale) / (1 + Product.gst_rate / 100.0))).label('total_gst'),
        func.sum(OrderItem.quantity * OrderItem.price_at_sale).label('total_amount')
    ).join(Product).join(Order).filter(Order.status != 'Cancelled').group_by(Product.hsn_code, is_interstate_expr, Product.gst_rate).all()
    
    def add_to_hsn(hsn, qty, taxable_val, gst_rate, total_gst, total_amount, is_interstate):
        hsn = (hsn or '').strip()
        if not hsn:
            hsn = '84733099'
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
        hsn_wise[hsn]['total_gst'] += total_gst
        hsn_wise[hsn]['total_amount'] += total_amount
        if is_interstate:
            hsn_wise[hsn]['igst'] += total_gst
        else:
            hsn_wise[hsn]['cgst'] += total_gst / 2.0
            hsn_wise[hsn]['sgst'] += total_gst / 2.0

    for row in hsn_pos:
        add_to_hsn(row[0], int(row[1] or 0), float(row[2] or 0.0), float(row[3] or 18.0), float(row[4] or 0.0), float(row[5] or 0.0), False)
        
    for row in hsn_orders:
        add_to_hsn(row[0], int(row[2] or 0), float(row[3] or 0.0), float(row[4] or 18.0), float(row[5] or 0.0), float(row[6] or 0.0), row[1])

    # 4. Validations (HSN missing and anomalous rate checks)
    validations = []
    
    def validate_gstin_format(gstin):
        if not gstin:
            return False
        import re
        return bool(re.match(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', gstin))

    missing_hsn_pos = db.session.query(TransactionItem.transaction_id, Product.name).join(Product).filter(
        (Product.hsn_code == None) | (Product.hsn_code == '')
    ).limit(10).all()
    for tx_id, prod_name in missing_hsn_pos:
        validations.append({
            'type': 'warning',
            'record_type': 'POS Sale',
            'record_id': tx_id,
            'message': f"Product '{prod_name}' is missing an HSN code."
        })
        
    missing_hsn_ord = db.session.query(OrderItem.order_id, Product.name).join(Product).join(Order).filter(
        Order.status != 'Cancelled',
        (Product.hsn_code == None) | (Product.hsn_code == '')
    ).limit(10).all()
    for order_id, prod_name in missing_hsn_ord:
        validations.append({
            'type': 'warning',
            'record_type': 'Order',
            'record_id': order_id,
            'message': f"Product '{prod_name}' is missing an HSN code."
        })
        
    anomalous_gst_pos = db.session.query(TransactionItem.transaction_id, Product.name, Product.gst_rate).join(Product).filter(
        (Product.gst_rate < 0) | (Product.gst_rate > 28)
    ).limit(10).all()
    for tx_id, prod_name, gst_rate in anomalous_gst_pos:
        validations.append({
            'type': 'danger',
            'record_type': 'POS Sale',
            'record_id': tx_id,
            'message': f"Anomalous GST rate of {gst_rate}% on product '{prod_name}'."
        })
        
    anomalous_gst_ord = db.session.query(OrderItem.order_id, Product.name, Product.gst_rate).join(Product).join(Order).filter(
        Order.status != 'Cancelled',
        (Product.gst_rate < 0) | (Product.gst_rate > 28)
    ).limit(10).all()
    for order_id, prod_name, gst_rate in anomalous_gst_ord:
        validations.append({
            'type': 'danger',
            'record_type': 'Order',
            'record_id': order_id,
            'message': f"Anomalous GST rate of {gst_rate}% on product '{prod_name}'."
        })

    # Purchases & Expenses summary
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
            cgst_itc += p.cgst or 0.0
            sgst_itc += p.sgst or 0.0
            igst_itc += p.igst or 0.0
            total_itc += p.gst_amount or 0.0
            
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
            cgst_itc += e.cgst or 0.0
            sgst_itc += e.sgst or 0.0
            igst_itc += e.igst or 0.0
            total_itc += e.gst_amount or 0.0
            
    # Rounding
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
    
    m_transaction = db_strftime('%Y-%m', Transaction.timestamp)
    m_order = db_strftime('%Y-%m', Order.timestamp)
    m_expense = db_strftime('%Y-%m', Expense.date)
    m_purchase = db_strftime('%Y-%m', Purchase.date)

    # 1. POS Revenue
    pos_by_month = db.session.query(
        m_transaction.label('m'),
        func.sum(Transaction.total_amount)
    ).filter(Transaction.timestamp >= year_ago).group_by(m_transaction).all()
    pos_month_map = {row[0]: float(row[1] or 0.0) for row in pos_by_month}
    
    # 2. Order Revenue
    ord_by_month = db.session.query(
        m_order.label('m'),
        func.sum(Order.total_amount)
    ).filter(Order.timestamp >= year_ago, Order.status != 'Cancelled').group_by(m_order).all()
    ord_month_map = {row[0]: float(row[1] or 0.0) for row in ord_by_month}
    
    # 3. Expenses
    exp_by_month = db.session.query(
        m_expense.label('m'),
        func.sum(Expense.total_amount)
    ).filter(Expense.date >= year_ago).group_by(m_expense).all()
    exp_month_map = {row[0]: float(row[1] or 0.0) for row in exp_by_month}
    
    # 4. Purchases
    pur_by_month = db.session.query(
        m_purchase.label('m'),
        func.sum(Purchase.total_amount)
    ).filter(Purchase.date >= year_ago).group_by(m_purchase).all()
    pur_month_map = {row[0]: float(row[1] or 0.0) for row in pur_by_month}
    
    # 5. COGS POS
    mcogs_pos_by_month = db.session.query(
        m_transaction.label('m'),
        func.sum(TransactionItem.quantity * Product.base_cost)
    ).join(Product).join(Transaction).filter(Transaction.timestamp >= year_ago).group_by(m_transaction).all()
    mcogs_pos_month_map = {row[0]: float(row[1] or 0.0) for row in mcogs_pos_by_month}
    
    # 6. COGS Order
    mcogs_ord_by_month = db.session.query(
        m_order.label('m'),
        func.sum(OrderItem.quantity * Product.base_cost)
    ).join(Product).join(Order).filter(Order.timestamp >= year_ago, Order.status != 'Cancelled').group_by(m_order).all()
    mcogs_ord_month_map = {row[0]: float(row[1] or 0.0) for row in mcogs_ord_by_month}
    
    # 7. Order Delivered Revenue (for cash inflow)
    ord_del_by_month = db.session.query(
        m_order.label('m'),
        func.sum(Order.total_amount)
    ).filter(Order.timestamp >= year_ago, Order.status == 'Delivered').group_by(m_order).all()
    ord_del_month_map = {row[0]: float(row[1] or 0.0) for row in ord_del_by_month}
    
    # 8. Purchases Paid (for cash outflow)
    pur_paid_by_month = db.session.query(
        m_purchase.label('m'),
        func.sum(Purchase.total_amount)
    ).filter(Purchase.date >= year_ago, Purchase.payment_status == 'Paid').group_by(m_purchase).all()
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
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
    groq_url = "https://api.groq.com/openai/v1/chat/completions"
    
    prompt = (
        f"Act as a professional store management assistant. Synthesize the following critical updates "
        f"into a single concise notification text message (max 2 sentences, SMS style) for the owner: "
        f"{pending_orders} new pending customer orders, {low_stock} products are low in inventory, "
        f"monthly GST return is due in {gst_days} days, and ITR tax return is due in {itr_days} days. "
        f"Be very direct and write in a professional, encouraging alert tone."
    )
    
    payload = {
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip(),
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
                'Authorization': f'Bearer {groq_api_key}',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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

# ----------------------------------------------------
# RULE-BASED GST DATABASE + GROQ AI FALLBACK API
# ----------------------------------------------------




if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)



import ast

with open('app.py', 'r', encoding='utf-8') as f:
    source = f.read()
    lines = source.split('\n')

tree = ast.parse(source)

routes_to_extract = {
    'products': [],
    'orders': [],
    'ml': [],
    'gst': []
}

lines_to_remove = []

for node in tree.body:
    if isinstance(node, ast.FunctionDef):
        for decorator in node.decorator_list:
            if isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Attribute) and decorator.func.attr == 'route':
                if len(decorator.args) > 0 and isinstance(decorator.args[0], ast.Constant):
                    url = decorator.args[0].value
                    
                    category = None
                    if url.startswith('/api/products'): category = 'products'
                    elif url.startswith('/api/checkout') or url.startswith('/api/orders') or url.startswith('/api/transactions') or url.startswith('/api/returns'): category = 'orders'
                    elif url.startswith('/api/ml'): category = 'ml'
                    elif url.startswith('/api/gst'): category = 'gst'
                    
                    if category:
                        # Find start and end line
                        # Start line includes the decorators
                        start_line = node.decorator_list[0].lineno - 1
                        end_line = node.end_lineno
                        
                        # Get raw code
                        func_code = '\n'.join(lines[start_line:end_line]) + '\n\n'
                        
                        # Replace @app.route with @{category}_bp.route
                        func_code = func_code.replace('@app.route', f'@{category}_bp.route')
                        
                        routes_to_extract[category].append(func_code)
                        lines_to_remove.extend(range(start_line, end_line))

# Build Blueprints
headers = {
    'products': 'from flask import Blueprint, request, jsonify\nfrom models import db, Product, TransactionItem, Review\nfrom datetime import datetime\nfrom sqlalchemy import func\nfrom extensions import dashboard_cache\nfrom routes.auth import get_current_user\n\nproducts_bp = Blueprint("products", __name__)\n\ndef require_admin(payload):\n    return payload and payload.get("role") == "admin"\n\n',
    'orders': 'from flask import Blueprint, request, jsonify\nfrom models import db, Order, Transaction, TransactionItem, ReturnLog, OrderItem, Product\nfrom datetime import datetime, timedelta\nfrom extensions import dashboard_cache, socketio\nfrom routes.auth import get_current_user\n\norders_bp = Blueprint("orders", __name__)\n\ndef require_admin(payload):\n    return payload and payload.get("role") == "admin"\n\ndef send_socket_message(event, message, data=None):\n    payload = {"message": message}\n    if data:\n        payload["data"] = data\n    socketio.emit(event, payload)\n\n',
    'ml': 'from flask import Blueprint, request, jsonify, send_file\nfrom models import db, Order, Transaction, TransactionItem, Product, Review\nfrom datetime import datetime\nfrom extensions import dashboard_cache, ai_cache, socketio\nfrom routes.auth import get_current_user\nimport json\nfrom ml_models import predict_dynamic_price, get_budget_recommendation, explain_demand_prediction, train_models\n\nml_bp = Blueprint("ml", __name__)\n\ndef require_admin(payload):\n    return payload and payload.get("role") == "admin"\n\n',
    'gst': 'from flask import Blueprint, request, jsonify, send_file\nfrom models import db, GSTConfig, GSTPurchase, GSTExpense, Transaction, Order\nfrom datetime import datetime\nfrom extensions import dashboard_cache\nfrom routes.auth import get_current_user\nfrom utils import calculate_sales_tax_breakdown\nimport os\n\ngst_bp = Blueprint("gst", __name__)\n\ndef require_admin(payload):\n    return payload and payload.get("role") == "admin"\n\n'
}

for cat, code_list in routes_to_extract.items():
    if code_list:
        with open(f'routes/{cat}.py', 'w', encoding='utf-8') as f:
            f.write(headers[cat] + ''.join(code_list))

# Clean up app.py
new_lines = []
for i, line in enumerate(lines):
    if i not in lines_to_remove:
        new_lines.append(line)

content = '\n'.join(new_lines)

# Inject blueprints
content = content.replace("from routes.auth import auth_bp\napp.register_blueprint(auth_bp, url_prefix='/api')",
"from routes.auth import auth_bp\nfrom routes.products import products_bp\nfrom routes.orders import orders_bp\nfrom routes.ml import ml_bp\nfrom routes.gst import gst_bp\n\napp.register_blueprint(auth_bp, url_prefix='/api')\napp.register_blueprint(products_bp, url_prefix='/api')\napp.register_blueprint(orders_bp, url_prefix='/api')\napp.register_blueprint(ml_bp, url_prefix='/api')\napp.register_blueprint(gst_bp, url_prefix='/api')")

import re
content = re.sub(r'class SimpleCache:.*?ai_cache = SimpleCache\(ttl=300\)\n', 
                 'from extensions import dashboard_cache, ai_cache, socketio\n', 
                 content, flags=re.DOTALL)
content = content.replace('socketio = SocketIO(app, cors_allowed_origins="*")', 'socketio.init_app(app, cors_allowed_origins="*")')

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Split completed perfectly using AST.")

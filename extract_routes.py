import os

with open('app.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# orders.py
orders_header = """from flask import Blueprint, request, jsonify
from models import db, Order, Transaction, TransactionItem, ReturnLog, OrderItem, Product
from datetime import datetime, timedelta
from extensions import dashboard_cache, socketio
from routes.auth import get_current_user

orders_bp = Blueprint("orders", __name__)

def require_admin(payload):
    return payload and payload.get("role") == "admin"

def send_socket_message(event, message, data=None):
    payload = {'message': message}
    if data:
        payload['data'] = data
    socketio.emit(event, payload)

"""

orders_content = ''.join(lines[643:897]) + ''.join(lines[1216:1574]) + ''.join(lines[1984:2062])
orders_content = orders_content.replace('@app.route', '@orders_bp.route')

with open('routes/orders.py', 'w', encoding='utf-8') as f:
    f.write(orders_header + orders_content)

# ml.py
ml_header = """from flask import Blueprint, request, jsonify, send_file
from models import db, Order, Transaction, TransactionItem, Product, Review
from datetime import datetime
from extensions import dashboard_cache, ai_cache, socketio
from routes.auth import get_current_user
import json
import logging
from ml_models import predict_dynamic_price, get_budget_recommendation, explain_demand_prediction, train_models

ml_bp = Blueprint("ml", __name__)

def require_admin(payload):
    return payload and payload.get("role") == "admin"

"""

ml_content = ''.join(lines[898:1152]) + ''.join(lines[3803:3961])
ml_content = ml_content.replace('@app.route', '@ml_bp.route')

with open('routes/ml.py', 'w', encoding='utf-8') as f:
    f.write(ml_header + ml_content)

# gst.py
gst_header = """from flask import Blueprint, request, jsonify, send_file
from models import db, GSTConfig, GSTPurchase, GSTExpense, Transaction, Order
from datetime import datetime
from extensions import dashboard_cache
from routes.auth import get_current_user
import os

gst_bp = Blueprint("gst", __name__)

def require_admin(payload):
    return payload and payload.get("role") == "admin"

"""

gst_content = ''.join(lines[2846:3442])
gst_content = gst_content.replace('@app.route', '@gst_bp.route')

with open('routes/gst.py', 'w', encoding='utf-8') as f:
    f.write(gst_header + gst_content)

print("Extraction script complete.")

import os

with open('app.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False

# The chunks we extracted:
# Products: 490:640, 1828:1860, 3799:3802
# Orders: 643:897, 1216:1574, 1984:2062
# ML: 898:1152, 3803:3961
# GST: 2846:3442

# We will just iterate through the lines and skip the extracted ranges.
for i, line in enumerate(lines):
    # 0-indexed logic: line number is i+1. But we extracted by Python list slice which is 0-indexed.
    # We extracted [490:640] which means indices 490 to 639
    
    if 490 <= i < 640: continue
    if 643 <= i < 897: continue
    if 898 <= i < 1152: continue
    if 1216 <= i < 1574: continue
    if 1828 <= i < 1861: continue
    if 1984 <= i < 2062: continue
    if 2846 <= i < 3442: continue
    if 3799 <= i < 3803: continue
    if 3803 <= i < 3961: continue
    
    new_lines.append(line)

content = ''.join(new_lines)

# Now, we need to inject blueprint registration around line 282 (where auth is registered)
content = content.replace("from routes.auth import auth_bp\napp.register_blueprint(auth_bp, url_prefix='/api')",
"from routes.auth import auth_bp\nfrom routes.products import products_bp\nfrom routes.orders import orders_bp\nfrom routes.ml import ml_bp\nfrom routes.gst import gst_bp\n\napp.register_blueprint(auth_bp, url_prefix='/api')\napp.register_blueprint(products_bp, url_prefix='/api/products')\napp.register_blueprint(orders_bp, url_prefix='/api')\napp.register_blueprint(ml_bp, url_prefix='/api/ml')\napp.register_blueprint(gst_bp, url_prefix='/api/gst')")

# Remove SimpleCache class definition and instantiation (lines 40 to 67)
# And replace with from extensions import dashboard_cache, ai_cache, socketio
import re

content = re.sub(r'class SimpleCache:.*?ai_cache = SimpleCache\(ttl=300\)\n', 
                 'from extensions import dashboard_cache, ai_cache, socketio\n', 
                 content, flags=re.DOTALL)

# Remove socketio = SocketIO(app, cors_allowed_origins="*") since we imported it and need to init_app it instead
content = content.replace('socketio = SocketIO(app, cors_allowed_origins="*")', 'socketio.init_app(app, cors_allowed_origins="*")')

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("App.py cleaned up and blueprints registered.")

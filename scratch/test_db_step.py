import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['VERCEL'] = '1'

print("1. Importing app and db...")
from app import app
from models import db, Transaction

print("2. Starting app context...")
with app.app_context():
    print("3. Getting db engine...")
    engine = db.engine
    print("4. Connecting to engine...")
    conn = engine.connect()
    print("5. Connection successful! Executing a simple text query...")
    from sqlalchemy import text
    res = conn.execute(text("SELECT 1;")).fetchone()
    print("6. Query result:", res)
    conn.close()
    
    print("7. Querying Transaction model...")
    tx = Transaction.query.first()
    print("8. Transaction query finished! Result ID:", tx.id if tx else None)

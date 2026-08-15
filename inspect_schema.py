from app import app, db
from sqlalchemy import text

with app.app_context():
    res = db.session.execute(text("""
        SELECT column_name, column_default, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'transaction_items';
    """)).fetchall()
    
    print("transaction_items schema:")
    for row in res:
        print(row)
        
    res2 = db.session.execute(text("""
        SELECT column_name, column_default, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'transactions';
    """)).fetchall()
    print("\ntransactions schema:")
    for row in res2:
        print(row)

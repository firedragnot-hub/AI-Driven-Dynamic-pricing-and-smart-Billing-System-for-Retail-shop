from app import app, db
from sqlalchemy import text

with app.app_context():
    try:
        db.session.execute(text("SELECT setval(pg_get_serial_sequence('purchases', 'id'), coalesce(max(id),0) + 1, false) FROM purchases;"))
        db.session.execute(text("SELECT setval(pg_get_serial_sequence('purchase_items', 'id'), coalesce(max(id),0) + 1, false) FROM purchase_items;"))
        db.session.execute(text("SELECT setval(pg_get_serial_sequence('transactions', 'id'), coalesce(max(id),0) + 1, false) FROM transactions;"))
        db.session.execute(text("SELECT setval(pg_get_serial_sequence('transaction_items', 'id'), coalesce(max(id),0) + 1, false) FROM transaction_items;"))
        db.session.execute(text("SELECT setval(pg_get_serial_sequence('orders', 'id'), coalesce(max(id),0) + 1, false) FROM orders;"))
        db.session.execute(text("SELECT setval(pg_get_serial_sequence('order_items', 'id'), coalesce(max(id),0) + 1, false) FROM order_items;"))
        db.session.commit()
        print("Sequences reset successfully.")
    except Exception as e:
        print(f"Error resetting sequences: {e}")

from app import app, db
from sqlalchemy import text

with app.app_context():
    # Fix transaction_items
    db.session.execute(text("CREATE SEQUENCE IF NOT EXISTS transaction_items_id_seq;"))
    db.session.execute(text("ALTER TABLE transaction_items ALTER COLUMN id SET DEFAULT nextval('transaction_items_id_seq');"))
    db.session.execute(text("ALTER SEQUENCE transaction_items_id_seq OWNED BY transaction_items.id;"))
    db.session.execute(text("SELECT setval('transaction_items_id_seq', coalesce(max(id),0) + 1, false) FROM transaction_items;"))
    
    # Fix order_items
    db.session.execute(text("CREATE SEQUENCE IF NOT EXISTS order_items_id_seq;"))
    db.session.execute(text("ALTER TABLE order_items ALTER COLUMN id SET DEFAULT nextval('order_items_id_seq');"))
    db.session.execute(text("ALTER SEQUENCE order_items_id_seq OWNED BY order_items.id;"))
    db.session.execute(text("SELECT setval('order_items_id_seq', coalesce(max(id),0) + 1, false) FROM order_items;"))

    db.session.commit()
    print("Fixed sequences for transaction_items and order_items.")

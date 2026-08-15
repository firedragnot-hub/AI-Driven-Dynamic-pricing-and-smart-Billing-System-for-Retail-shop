from app import app, db
from sqlalchemy import text

with app.app_context():
    # Fix reviews
    db.session.execute(text("CREATE SEQUENCE IF NOT EXISTS reviews_id_seq;"))
    db.session.execute(text("ALTER TABLE reviews ALTER COLUMN id SET DEFAULT nextval('reviews_id_seq');"))
    db.session.execute(text("ALTER SEQUENCE reviews_id_seq OWNED BY reviews.id;"))
    db.session.execute(text("SELECT setval('reviews_id_seq', coalesce(max(id),0) + 1, false) FROM reviews;"))
    
    # Fix products (just in case)
    db.session.execute(text("CREATE SEQUENCE IF NOT EXISTS products_id_seq;"))
    db.session.execute(text("ALTER TABLE products ALTER COLUMN id SET DEFAULT nextval('products_id_seq');"))
    db.session.execute(text("ALTER SEQUENCE products_id_seq OWNED BY products.id;"))
    db.session.execute(text("SELECT setval('products_id_seq', coalesce(max(id),0) + 1, false) FROM products;"))
    
    # Fix any other tables missing sequences
    db.session.execute(text("CREATE SEQUENCE IF NOT EXISTS return_logs_id_seq;"))
    db.session.execute(text("ALTER TABLE return_logs ALTER COLUMN id SET DEFAULT nextval('return_logs_id_seq');"))
    db.session.execute(text("ALTER SEQUENCE return_logs_id_seq OWNED BY return_logs.id;"))
    db.session.execute(text("SELECT setval('return_logs_id_seq', coalesce(max(id),0) + 1, false) FROM return_logs;"))

    db.session.commit()
    print("Fixed sequences for reviews, products, and return_logs.")

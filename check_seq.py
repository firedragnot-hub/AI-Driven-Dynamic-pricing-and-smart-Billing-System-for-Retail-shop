from app import app, db
from sqlalchemy import text

with app.app_context():
    result = db.session.execute(text("SELECT pg_get_serial_sequence('transaction_items', 'id');")).scalar()
    print('Sequence:', result)

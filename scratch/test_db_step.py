import os
import sys
from dotenv import load_dotenv
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()
print("Connecting...")
from flask import Flask
from models import db
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)
with app.app_context():
    print("Under context, getting engine...")
    engine = db.engine
    print("Connecting raw connection...")
    conn = engine.raw_connection()
    print("Connected raw connection!")
    cursor = conn.cursor()
    cursor.execute("SELECT 1;")
    print("Result of SELECT 1:", cursor.fetchone())
    cursor.close()
    conn.close()

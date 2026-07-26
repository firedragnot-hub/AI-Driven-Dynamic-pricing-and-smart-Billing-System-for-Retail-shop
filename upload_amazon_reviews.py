import os
import time
import io
import csv
import logging
from datetime import datetime
from decimal import Decimal
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("amazon_reviews_uploader")

# Load environment variables
load_dotenv()

# Neon connection URI
DATABASE_URL = "postgresql://neondb_owner:npg_wJXa8Qs5blOP@ep-rapid-fire-aybz3rr0-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
CSV_PATH = "amazon.csv"

def clean_rating(val):
    """Parses rating string and maps it to a valid integer between 1 and 5."""
    if pd.isna(val) or val == "" or str(val).strip() == "|":
        return 4
    try:
        # Convert to float first, e.g. "4.2"
        rating_val = float(str(val).strip())
        return min(5, max(1, int(round(rating_val))))
    except Exception:
        return 4

def run_upload():
    logger.info("Connecting to Neon PostgreSQL...")
    engine = create_engine(DATABASE_URL)
    
    # Load products from database to map names
    logger.info("Loading products from database for matching...")
    with engine.connect() as conn:
        res = conn.execute(text('SELECT id, name FROM products'))
        db_products = [(row.id, row.name) for row in res]
    logger.info(f"Loaded {len(db_products)} products from DB.")

    if not os.path.exists(CSV_PATH):
        logger.error(f"Source file {CSV_PATH} not found!")
        return

    logger.info(f"Reading {CSV_PATH}...")
    try:
        # Read the CSV file
        df = pd.read_csv(CSV_PATH, keep_default_na=False)
    except Exception as e:
        logger.error(f"Failed to read CSV: {e}")
        return

    reviews_to_insert = []
    matched_count = 0
    total_reviews_parsed = 0

    for idx, row in df.iterrows():
        csv_product_name = str(row['product_name']).strip()
        if not csv_product_name:
            continue

        # Match product by prefix (DB product names are truncated to String(100))
        matched_id = None
        for pid, db_name in db_products:
            # Check prefix matching
            if csv_product_name.startswith(db_name) or db_name.startswith(csv_product_name[:95]):
                matched_id = pid
                break

        if not matched_id:
            continue

        matched_count += 1

        # Extract usernames, titles, and contents
        usernames = [u.strip() for u in str(row['user_name']).split(',') if u.strip()]
        titles = [t.strip() for t in str(row['review_title']).split(',') if t.strip()]
        contents = [c.strip() for c in str(row['review_content']).split(',') if c.strip()]

        rating = clean_rating(row['rating'])

        # Align reviews
        # If lengths match, use content. Otherwise, fallback to titles
        comments = []
        if len(contents) == len(usernames):
            comments = contents
        else:
            comments = titles

        # Ensure we have enough comments
        for i, username in enumerate(usernames):
            comment = comments[i] if i < len(comments) else (titles[0] if titles else "Great product!")
            
            # Truncate username if too long
            username_cleaned = username[:80]
            
            reviews_to_insert.append({
                'product_id': matched_id,
                'user_id': None, # Null/None
                'username': username_cleaned,
                'rating': rating,
                'comment': comment,
                'timestamp': datetime.utcnow()
            })
            total_reviews_parsed += 1

    logger.info(f"Finished parsing. Matched {matched_count} products. Prepared {total_reviews_parsed} reviews to upload.")

    if not reviews_to_insert:
        logger.info("No new reviews to upload.")
        return

    # Use COPY FROM STDIN for ultra-fast upload
    logger.info("Streaming reviews into reviews table using COPY...")
    f = io.StringIO()
    writer = csv.writer(f, delimiter='\t', doublequote=True, lineterminator='\n', quoting=csv.QUOTE_MINIMAL)

    # Column ordering for import
    columns = ['product_id', 'user_id', 'username', 'rating', 'comment', 'timestamp']

    for rec in reviews_to_insert:
        row_vals = []
        for col in columns:
            val = rec[col]
            if val is None:
                row_vals.append('')
            elif isinstance(val, datetime):
                row_vals.append(val.isoformat())
            else:
                row_vals.append(str(val))
        writer.writerow(row_vals)

    f.seek(0)

    start_time = time.time()
    conn = engine.raw_connection()
    try:
        cursor = conn.cursor()
        # Truncate table first to prevent duplicate reviews if rerun
        logger.info("Clearing existing reviews in database...")
        cursor.execute('TRUNCATE TABLE reviews RESTART IDENTITY CASCADE')
        
        col_names_str = ", ".join(f'"{c}"' for c in columns)
        copy_query = f'COPY "reviews" ({col_names_str}) FROM STDIN WITH (FORMAT csv, DELIMITER \'\t\', NULL \'\')'
        cursor.copy_expert(copy_query, f)
        conn.commit()
        
        # Reset ID serial sequence
        cursor.execute("SELECT setval(pg_get_serial_sequence('\"reviews\"', 'id'), coalesce(max(id), 1)) FROM \"reviews\"")
        conn.commit()

        duration = time.time() - start_time
        logger.info(f"Successfully uploaded {total_reviews_parsed} reviews in {duration:.2f} seconds!")
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to copy reviews into database: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    run_upload()

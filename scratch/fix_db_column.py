import psycopg2
import traceback

NEON_URI = "postgresql://neondb_owner:npg_wJXa8Qs5blOP@ep-rapid-fire-aybz3rr0-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require"

try:
    conn = psycopg2.connect(NEON_URI)
    cursor = conn.cursor()
    
    print("Altering transaction_items.price_at_sale column to double precision...")
    cursor.execute("""
        ALTER TABLE transaction_items 
        ALTER COLUMN price_at_sale TYPE double precision 
        USING (price_at_sale #>> '{}')::double precision;
    """)
    conn.commit()
    print("Column altered successfully!")
    
    # Confirm change
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'transaction_items' AND column_name = 'price_at_sale';
    """)
    print("New data type:", cursor.fetchone())
    
    cursor.close()
    conn.close()
except Exception as e:
    traceback.print_exc()

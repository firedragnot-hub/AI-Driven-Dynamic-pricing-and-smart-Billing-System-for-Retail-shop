import psycopg2

NEON_URI = "postgresql://neondb_owner:npg_wJXa8Qs5blOP@ep-rapid-fire-aybz3rr0-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(NEON_URI)
cursor = conn.cursor()

tables = ['products', 'transaction_items', 'order_items', 'expenses', 'purchases']

for table in tables:
    print(f"\nSchema for table: {table}")
    cursor.execute(f"""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '{table}';
    """)
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]}")

cursor.close()
conn.close()

import psycopg2

NEON_URI = "postgresql://neondb_owner:npg_wJXa8Qs5blOP@ep-rapid-fire-aybz3rr0-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(NEON_URI)
cursor = conn.cursor()

cursor.execute("SELECT count(*) FROM orders;")
print("Total orders:", cursor.fetchone()[0])

cursor.execute("SELECT count(*) FROM order_items;")
print("Total order items:", cursor.fetchone()[0])

cursor.close()
conn.close()

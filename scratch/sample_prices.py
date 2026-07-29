import psycopg2

NEON_URI = "postgresql://neondb_owner:npg_wJXa8Qs5blOP@ep-rapid-fire-aybz3rr0-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(NEON_URI)
cursor = conn.cursor()

cursor.execute("SELECT id, price_at_sale, pg_typeof(price_at_sale) FROM transaction_items LIMIT 10;")
print("Samples from transaction_items:")
for row in cursor.fetchall():
    print(row)

cursor.close()
conn.close()

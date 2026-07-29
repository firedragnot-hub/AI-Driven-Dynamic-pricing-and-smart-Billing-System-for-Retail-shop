import psycopg2

NEON_URI = "postgresql://neondb_owner:npg_wJXa8Qs5blOP@ep-rapid-fire-aybz3rr0-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(NEON_URI)
cursor = conn.cursor()

cursor.execute("""
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE data_type = 'json' OR data_type = 'jsonb'
    ORDER BY table_name, column_name;
""")
print("JSON columns in Neon database:")
for row in cursor.fetchall():
    print(f"  {row[0]}.{row[1]}: {row[2]}")

cursor.close()
conn.close()

import psycopg2
import sys

db_urls = [
    "postgresql://neondb_owner:npg_JXzE3RKW1PkF@ep-empty-bird-axkn3eqc-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require",
    "postgresql://neondb_owner:npg_wJXa8Qs5blOP@ep-rapid-fire-aybz3rr0-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    "postgresql://neondb_owner:npg_wJXa8Qs5blOP@ep-rapid-fire-aybz3rr0-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require"
]

for i, url in enumerate(db_urls, 1):
    print(f"\nTesting URL {i}: {url}")
    try:
        conn = psycopg2.connect(url, connect_timeout=5)
        print("-> Connected successfully!")
        cursor = conn.cursor()
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
        tables = [t[0] for t in cursor.fetchall()]
        print("-> Tables in public schema:", tables)
        for t in tables[:5]:
            cursor.execute(f'SELECT count(*) FROM "{t}";')
            count = cursor.fetchone()[0]
            print(f"   Table '{t}' has {count} rows.")
        cursor.close()
        conn.close()
    except Exception as e:
        print("-> Connection failed:", e)

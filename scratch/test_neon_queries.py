import os
import sys
import traceback
import psycopg2

NEON_URI = "postgresql://neondb_owner:npg_wJXa8Qs5blOP@ep-rapid-fire-aybz3rr0-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require"

print("Connecting to Neon PostgreSQL directly via psycopg2...")
try:
    conn = psycopg2.connect(NEON_URI, connect_timeout=5)
    print("Connected successfully!")
    cursor = conn.cursor()
    
    # Let's test the database queries step by step
    queries = {
        "Total POS revenue": "SELECT sum(total_amount) FROM transactions;",
        "Total Order revenue": "SELECT sum(total_amount) FROM orders WHERE status != 'Cancelled';",
        "COGS POS": "SELECT sum(ti.quantity * p.base_cost) FROM transaction_items ti JOIN products p ON ti.product_id = p.id;",
        "COGS Order": "SELECT sum(oi.quantity * p.base_cost) FROM order_items oi JOIN products p ON oi.product_id = p.id JOIN orders o ON oi.order_id = o.id WHERE o.status != 'Cancelled';",
        "Expenses total": "SELECT sum(total_amount) FROM expenses;",
        "Purchases AP": "SELECT sum(total_amount) FROM purchases WHERE payment_status = 'Pending';",
        "Orders AR": "SELECT sum(total_amount) FROM orders WHERE status = 'Pending';",
        "POS by month": "SELECT to_char(timestamp, 'YYYY-MM'), sum(total_amount) FROM transactions WHERE timestamp >= NOW() - INTERVAL '366 days' GROUP BY to_char(timestamp, 'YYYY-MM');",
        "Expense by month": "SELECT to_char(date, 'YYYY-MM'), sum(total_amount) FROM expenses WHERE date >= NOW() - INTERVAL '366 days' GROUP BY to_char(date, 'YYYY-MM');"
    }
    
    for name, sql in queries.items():
        print(f"\nRunning: {name}")
        try:
            cursor.execute(sql)
            res = cursor.fetchall()
            print("Result (first 3):", res[:3])
        except Exception as e:
            print(f"FAILED: {e}")
            conn.rollback()
            
    cursor.close()
    conn.close()
except Exception as e:
    traceback.print_exc()

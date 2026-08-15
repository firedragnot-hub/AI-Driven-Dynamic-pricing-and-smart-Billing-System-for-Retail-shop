import os
import psycopg2
import socket
from dotenv import load_dotenv
from app import app, db
import models

load_dotenv()

# Set default socket timeout to 15 seconds to prevent hanging
socket.setdefaulttimeout(15)

# Fetch Neon URI dynamically from the environment
NEON_URI = os.getenv("DATABASE_URL")

def migrate():
    if not NEON_URI:
        print("Error: DATABASE_URL environment variable is not set.")
        return
        
    with app.app_context():
        # Explicitly create SQLite engine pointing to the local sqlite database
        from sqlalchemy import create_engine
        sqlite_engine = create_engine("sqlite:///retail.db")

        # Bind to Postgres (Neon)
        postgres_engine = create_engine(NEON_URI, connect_args={"connect_timeout": 10})

        # Create tables in Neon if they don't exist
        print("Creating tables in Neon...")
        models.db.metadata.create_all(bind=postgres_engine)

        # Copy data for each table
        connection_sqlite = sqlite_engine.raw_connection()
        connection_postgres = postgres_engine.raw_connection()

        # Set statement timeout to 10 seconds to prevent hanging on table locks
        cursor_setup = connection_postgres.cursor()
        cursor_setup.execute("SET statement_timeout = 10000;")
        cursor_setup.close()

        tables = [
            'business_config', 'users', 'products', 'expenses', 
            'purchases', 'purchase_items', 'transactions', 'transaction_items',
            'orders', 'order_items', 'reviews', 'wishlists', 
            'address_books', 'return_logs', 'purchase_bills', 'discrepancies'
        ]

        for table in tables:
            print(f"Migrating table: {table}...")
            cursor_sqlite = None
            cursor_postgres = None
            try:
                cursor_sqlite = connection_sqlite.cursor()
                cursor_sqlite.execute(f"SELECT * FROM {table}")
                rows = cursor_sqlite.fetchall()
                
                if not rows:
                    print(f"No rows in {table}, skipping.")
                    continue

                # Get columns
                cursor_sqlite.execute(f"PRAGMA table_info({table})")
                columns = [col[1] for col in cursor_sqlite.fetchall()]
                col_names = ", ".join(f'"{col}"' for col in columns)
                placeholders = ", ".join(["%s"] * len(columns))

                # Process rows to convert 1/0 to True/False for boolean columns
                processed_rows = []
                for row in rows:
                    row_list = list(row)
                    for i, col_name in enumerate(columns):
                        if col_name in ('itc_eligible', 'resolved'):
                            if row_list[i] is not None:
                                row_list[i] = bool(row_list[i])
                    processed_rows.append(tuple(row_list))

                cursor_postgres = connection_postgres.cursor()
                # Clear table on Postgres first to prevent duplicates
                cursor_postgres.execute(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE')
                
                # Attempt batch insert
                try:
                    cursor_postgres.executemany(
                        f'INSERT INTO "{table}" ({col_names}) VALUES ({placeholders})',
                        processed_rows
                    )
                    connection_postgres.commit()
                    print(f"Successfully batch-migrated {len(processed_rows)} rows to {table}")
                except Exception as batch_error:
                    connection_postgres.rollback()
                    print(f"Batch migration failed for {table}. Attempting row-by-row fallback...")
                    
                    # Row-by-row fallback
                    success_count = 0
                    fail_count = 0
                    for row in processed_rows:
                        try:
                            cursor_postgres.execute(
                                f'INSERT INTO "{table}" ({col_names}) VALUES ({placeholders})',
                                row
                            )
                            connection_postgres.commit()
                            success_count += 1
                        except Exception as row_error:
                            connection_postgres.rollback()
                            fail_count += 1
                            if fail_count <= 5: # Limit error output
                                print(f"  Row insert failed: {row_error} | Row details: {row}")
                    print(f"Row-by-row completed for {table}: {success_count} success, {fail_count} failed.")
            except Exception as e:
                print(f"Error migrating {table}: {e}")
                if connection_postgres:
                    connection_postgres.rollback()
            finally:
                if cursor_sqlite:
                    cursor_sqlite.close()
                if cursor_postgres:
                    cursor_postgres.close()

        print("Migration process finished!")

if __name__ == "__main__":
    migrate()

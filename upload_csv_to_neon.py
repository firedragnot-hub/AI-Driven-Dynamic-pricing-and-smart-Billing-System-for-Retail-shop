import os
import time
import socket
import logging
import io
import csv
from datetime import datetime
from decimal import Decimal, InvalidOperation
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql.sqltypes import Boolean, DateTime, Integer, Float, Numeric
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("neon_migration")

# Load environment variables
load_dotenv()

# We need the Flask app context to load the DB configuration
try:
    from app import app, db
    import models
except ImportError as e:
    logger.error(f"Failed to import app/models: {e}")
    raise

# Connection configurations
NEW_NEON_URL = "postgresql://neondb_owner:npg_wJXa8Qs5blOP@ep-rapid-fire-aybz3rr0-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
CSV_DIR = "neon_csv_data"
BATCH_SIZE = 5000  # We can use larger batches now because COPY is extremely fast!

# Table order matching the dependency requirements
TABLES_ORDER = [
    'business_config',
    'users',
    'products',
    'expenses',
    'purchases',
    'purchase_items',
    'transactions',
    'transaction_items',
    'orders',
    'order_items'
]

# Map table names to SQLAlchemy model classes
MODEL_MAP = {
    'business_config': models.BusinessConfig,
    'users': models.User,
    'products': models.Product,
    'expenses': models.Expense,
    'purchases': models.Purchase,
    'purchase_items': models.PurchaseItem,
    'transactions': models.Transaction,
    'transaction_items': models.TransactionItem,
    'orders': models.Order,
    'order_items': models.OrderItem
}

def connect_with_retry(uri, retries=5, delay=2):
    """Establishes database connection with retries and SSL verification."""
    engine = None
    for attempt in range(1, retries + 1):
        try:
            logger.info(f"Connecting to database (attempt {attempt}/{retries})...")
            engine = create_engine(
                uri,
                connect_args={"connect_timeout": 10},
                pool_size=10,
                max_overflow=20
            )
            # Test connection
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Successfully connected to Neon PostgreSQL database.")
            return engine
        except Exception as e:
            logger.warning(f"Connection failed: {e}")
            if attempt < retries:
                time.sleep(delay * attempt)
            else:
                logger.error("Max connection retries exceeded.")
                raise e

def clean_and_normalize_value(val, col_type, col_name):
    """Cleans a value from CSV according to its database column type."""
    # Convert pandas/numpy NaN, NaT or None values
    if val is None or (isinstance(val, float) and np.isnan(val)) or val == "" or str(val).strip().lower() in ('nan', 'null', 'nat', '<na>'):
        return None

    val_str = str(val).strip()

    # Normalize string to UTF-8
    try:
        val_str = val_str.encode('utf-8', errors='ignore').decode('utf-8')
    except Exception:
        pass

    # Boolean columns
    if isinstance(col_type, Boolean):
        val_lower = val_str.lower()
        if val_lower in ('true', 't', 'y', 'yes', '1', '1.0'):
            return True
        if val_lower in ('false', 'f', 'n', 'no', '0', '0.0'):
            return False
        raise ValueError(f"Value '{val}' is not a valid boolean for column '{col_name}'")

    # DateTime columns
    if isinstance(col_type, DateTime):
        try:
            # Fast parsing using native fromisoformat if possible
            clean_date = val_str.replace('Z', '').replace(' ', 'T')
            return datetime.fromisoformat(clean_date)
        except Exception:
            try:
                # Fallback to pandas parsing for formats like "2024/08/25"
                return pd.to_datetime(val_str).to_pydatetime()
            except Exception:
                raise ValueError(f"Value '{val}' is not a valid datetime for column '{col_name}'")

    # Integer columns
    if isinstance(col_type, Integer):
        try:
            return int(float(val_str))
        except Exception:
            raise ValueError(f"Value '{val}' is not a valid integer for column '{col_name}'")

    # Numeric/Decimal/Float columns
    if isinstance(col_type, (Float, Numeric)):
        try:
            if isinstance(col_type, Numeric):
                return Decimal(val_str)
            return float(val_str)
        except Exception:
            raise ValueError(f"Value '{val}' is not a valid number for column '{col_name}'")

    return val_str

def migrate_table(engine, table_name, csv_path, inserted_ids_cache):
    """Migrates a single CSV file into the database with validation and batching."""
    model = MODEL_MAP[table_name]
    columns_spec = {col.name: col for col in model.__table__.columns}
    
    # Track metrics
    rows_read = 0
    inserted_count = 0
    skipped_count = 0
    skipped_reasons = []

    # Get primary key column name(s) and unique constraints
    pk_cols = [c.name for c in model.__table__.primary_key.columns]
    
    # Foreign key mapping to parent table
    fk_mappings = {}
    for col in model.__table__.columns:
        for fk in col.foreign_keys:
            fk_mappings[col.name] = fk.column.table.name

    if not os.path.exists(csv_path):
        logger.error(f"CSV file not found: {csv_path}")
        return False, 0, 0, 0, ["CSV file missing"]

    # Local unique sets for deduplication during validation
    seen_pks = set()
    start_time = time.time()

    # Pre-populate unique values currently in DB to avoid collision if running multiple times
    db_session = sessionmaker(bind=engine)()
    try:
        if pk_cols:
            pk_name = pk_cols[0]
            existing_ids = db_session.execute(text(f'SELECT "{pk_name}" FROM "{table_name}"')).scalars().all()
            seen_pks.update(existing_ids)
            inserted_ids_cache[table_name] = set(existing_ids)
    except Exception as db_err:
        logger.warning(f"Could not pre-fetch existing records for {table_name}: {db_err}")
    finally:
        db_session.close()

    try:
        chunks = pd.read_csv(csv_path, chunksize=BATCH_SIZE, keep_default_na=False)
    except Exception as e:
        logger.error(f"Failed to read CSV {csv_path}: {e}")
        return False, 0, 0, 0, [str(e)]

    # Collect batches
    batch_records = []
    
    for chunk in chunks:
        # Check missing required columns
        csv_cols = set(chunk.columns)
        for col_name, col_spec in columns_spec.items():
            if not col_spec.nullable and col_spec.default is None and col_spec.server_default is None and col_name not in pk_cols:
                if col_name not in csv_cols:
                    logger.error(f"Missing required column in CSV '{csv_path}': {col_name}")
                    return False, 0, 0, 0, [f"Missing required column: {col_name}"]

        # Process each row
        for idx, row in chunk.iterrows():
            rows_read += 1
            raw_record = row.to_dict()
            cleaned_record = {}
            is_valid = True
            skip_reason = ""

            for col_name, col_spec in columns_spec.items():
                if col_name not in raw_record:
                    if not col_spec.nullable and col_spec.default is None and col_spec.server_default is None and col_name not in pk_cols:
                        is_valid = False
                        skip_reason = f"Missing required column: {col_name}"
                        break
                    continue

                raw_val = raw_record[col_name]
                try:
                    cleaned_val = clean_and_normalize_value(raw_val, col_spec.type, col_name)
                    if cleaned_val is None and not col_spec.nullable and col_spec.default is None and col_spec.server_default is None:
                        is_valid = False
                        skip_reason = f"Null value in required column: {col_name}"
                        break
                    cleaned_record[col_name] = cleaned_val
                except ValueError as val_err:
                    is_valid = False
                    skip_reason = str(val_err)
                    break

            if not is_valid:
                skipped_count += 1
                skipped_reasons.append(f"Row {rows_read}: {skip_reason}")
                continue

            # Validate Primary Key unique constraint
            if pk_cols:
                pk_val = cleaned_record.get(pk_cols[0])
                if pk_val is not None:
                    if pk_val in seen_pks:
                        skipped_count += 1
                        skipped_reasons.append(f"Row {rows_read}: Duplicate PK value {pk_val} in column '{pk_cols[0]}'")
                        continue
                    seen_pks.add(pk_val)

            # Validate Foreign Keys
            for fk_col, parent_table in fk_mappings.items():
                fk_val = cleaned_record.get(fk_col)
                if fk_val is not None:
                    parent_ids = inserted_ids_cache.get(parent_table, set())
                    if fk_val not in parent_ids:
                        is_valid = False
                        skip_reason = f"Invalid foreign key in '{fk_col}': value '{fk_val}' does not exist in parent table '{parent_table}'"
                        break
            
            if not is_valid:
                skipped_count += 1
                skipped_reasons.append(f"Row {rows_read}: {skip_reason}")
                continue

            batch_records.append(cleaned_record)

            if len(batch_records) >= BATCH_SIZE:
                success = insert_batch(engine, model, batch_records, inserted_ids_cache, table_name, pk_cols)
                if success:
                    inserted_count += len(batch_records)
                else:
                    skipped_count += len(batch_records)
                    skipped_reasons.append(f"Batch insert failed for table {table_name}")
                batch_records = []

    # Insert remaining records
    if batch_records:
        success = insert_batch(engine, model, batch_records, inserted_ids_cache, table_name, pk_cols)
        if success:
            inserted_count += len(batch_records)
        else:
            skipped_count += len(batch_records)
            skipped_reasons.append(f"Final batch insert failed for table {table_name}")

    # Reset postgres serial sequence if table has integer primary key id
    if pk_cols and pk_cols[0] == 'id':
        try:
            with engine.begin() as conn:
                conn.execute(text(f"SELECT setval(pg_get_serial_sequence('\"{table_name}\"', 'id'), coalesce(max(id), 1)) FROM \"{table_name}\""))
        except Exception as seq_err:
            pass

    duration = time.time() - start_time
    
    print(f"\n=========================\nMigrating {table_name.replace('_', ' ').title()}\n=========================")
    print(f"Rows Read: {rows_read}")
    print(f"Inserted: {inserted_count}")
    print(f"Skipped: {skipped_count}")
    print(f"Time: {duration:.2f} sec")
    if skipped_reasons:
        print("Reasons for skipped records (first 10):")
        for reason in skipped_reasons[:10]:
            print(f"  - {reason}")
        if len(skipped_reasons) > 10:
            print(f"  - ... and {len(skipped_reasons) - 10} more errors.")
    
    return True, rows_read, inserted_count, skipped_count, skipped_reasons

def insert_batch(engine, model, records, inserted_ids_cache, table_name, pk_cols):
    """Performs bulk insert on a batch of records inside a single transaction using COPY FROM STDIN."""
    if not records:
        return True
        
    columns = list(records[0].keys())
    f = io.StringIO()
    writer = csv.writer(f, delimiter='\t', doublequote=True, lineterminator='\n', quoting=csv.QUOTE_MINIMAL)
    
    for rec in records:
        row_vals = []
        for col in columns:
            val = rec[col]
            if val is None:
                row_vals.append('')
            elif isinstance(val, bool):
                row_vals.append('1' if val else '0')
            elif isinstance(val, datetime):
                row_vals.append(val.isoformat())
            elif isinstance(val, Decimal):
                row_vals.append(str(val))
            else:
                row_vals.append(str(val))
        writer.writerow(row_vals)
        
    f.seek(0)
    
    conn = engine.raw_connection()
    try:
        cursor = conn.cursor()
        col_names_str = ", ".join(f'"{c}"' for c in columns)
        copy_query = f'COPY "{table_name}" ({col_names_str}) FROM STDIN WITH (FORMAT csv, DELIMITER \'\t\', NULL \'\')'
        cursor.copy_expert(copy_query, f)
        conn.commit()
        
        # Cache newly inserted IDs for downstream foreign key verification
        if pk_cols:
            pk_name = pk_cols[0]
            new_ids = [rec[pk_name] for rec in records if pk_name in rec]
            if table_name not in inserted_ids_cache:
                inserted_ids_cache[table_name] = set()
            inserted_ids_cache[table_name].update(new_ids)
            
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Error executing COPY batch into {table_name}: {e}")
        return False
    finally:
        conn.close()

def run_migration():
    """Main orchestrator for schema initialization and CSV migration."""
    logger.info("Starting migration process...")
    engine = connect_with_retry(NEW_NEON_URL)
    
    logger.info("Initializing database schema...")
    with app.app_context():
        try:
            models.db.metadata.create_all(bind=engine)
            logger.info("Database schema initialized/verified successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize schema: {e}")
            return

    inserted_ids_cache = {}
    migration_summary = {}
    overall_success = True

    for table in TABLES_ORDER:
        csv_path = os.path.join(CSV_DIR, f"{table}.csv")
        try:
            success, read, inserted, skipped, reasons = migrate_table(
                engine, table, csv_path, inserted_ids_cache
            )
            migration_summary[table] = {
                "success": success,
                "read": read,
                "inserted": inserted,
                "skipped": skipped,
                "reasons": reasons
            }
            if not success:
                overall_success = False
        except Exception as table_err:
            logger.error(f"Migration aborted for table {table}: {table_err}")
            migration_summary[table] = {
                "success": False,
                "read": 0,
                "inserted": 0,
                "skipped": 0,
                "reasons": [str(table_err)]
            }
            overall_success = False

    print("\n\n" + "="*40)
    print("      FINAL MIGRATION REPORT")
    print("="*40)
    
    all_inserted = 0
    all_skipped = 0
    
    for table, stats in migration_summary.items():
        status_symbol = "SUCCESS" if stats["success"] else "FAILED"
        print(f"{table.ljust(20)}: [{status_symbol}] | Read: {str(stats['read']).rjust(6)} | Inserted: {str(stats['inserted']).rjust(6)} | Skipped: {str(stats['skipped']).rjust(4)}")
        all_inserted += stats["inserted"]
        all_skipped += stats["skipped"]

    print("-"*40)
    print(f"Total Records Inserted: {all_inserted}")
    print(f"Total Records Skipped : {all_skipped}")
    
    print("\nRunning database integrity checks...")
    integrity_failed = False
    with engine.connect() as conn:
        for table in TABLES_ORDER:
            res = conn.execute(text(f'SELECT COUNT(*) FROM "{table}"'))
            row_count = res.scalar()
            expected = migration_summary[table]["inserted"]
            
            if row_count < expected:
                logger.warning(f"Integrity alert: {table} has {row_count} rows in DB, but we reported {expected} insertions.")
                integrity_failed = True
            else:
                logger.info(f"OK - Table {table}: Row count verified ({row_count} rows in DB)")

    if not integrity_failed and overall_success:
        print("\nSUCCESS: Migration completed successfully. All constraints satisfied.")
    else:
        print("\nWARNING: Migration completed with warnings/errors. Check logs above.")

if __name__ == "__main__":
    run_migration()

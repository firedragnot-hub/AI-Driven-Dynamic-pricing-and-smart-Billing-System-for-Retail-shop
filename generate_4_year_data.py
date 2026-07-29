import os
import sqlite3
import pandas as pd
import numpy as np
import random
import uuid
from datetime import datetime, timedelta

def main():
    print("Connecting to local SQLite database (retail.db) to load current products and users...")
    if not os.path.exists("retail.db"):
        print("Error: retail.db not found. Please run seed_data.py first to initialize database.")
        return

    conn = sqlite3.connect("retail.db")
    
    # 1. Load Products
    df_products = pd.read_sql_query("SELECT * FROM products", conn)
    print(f"Loaded {len(df_products)} products from retail.db.")
    
    # 2. Load Users
    df_users = pd.read_sql_query("SELECT * FROM users", conn)
    print(f"Loaded {len(df_users)} users from retail.db.")
    
    # 3. Load Business Config
    df_config = pd.read_sql_query("SELECT * FROM business_config", conn)
    print(f"Loaded business config from retail.db.")
    
    conn.close()

    # Set up date range for the past 4 years (1460 days)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=1460)
    print(f"Simulating historical sales data from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')} (4 years)...")
    
    # In-memory storage for generated tables
    transactions = []
    transaction_items = []
    orders = []
    order_items = []
    expenses = []
    purchases = []
    purchase_items = []
    
    # Keep track of IDs
    tx_id_counter = 1
    tx_item_id_counter = 1
    order_id_counter = 1
    order_item_id_counter = 1
    expense_id_counter = 1
    purchase_id_counter = 1
    purchase_item_id_counter = 1
    
    # Convert products to a list of dicts for fast simulation access
    products_list = df_products.to_dict('records')
    # Track stock levels in simulation
    stock_levels = {p['id']: p['stock_level'] for p in products_list}
    
    current_date = start_date
    
    while current_date <= end_date:
        day_val = current_date.day
        month_val = current_date.month
        year_val = current_date.year
        day_of_week = current_date.weekday() # 0 = Monday, 6 = Sunday

        # --- A. FIXED EXPENSES (Rent, Salary, Utilities) ---
        if day_val == 1:
            # Rent
            expenses.append({
                'id': expense_id_counter,
                'merchant_name': "Prime Properties Ltd",
                'merchant_gstin': None,
                'invoice_no': f"RENT-{month_val}-{year_val}",
                'date': current_date.replace(hour=10, minute=0, second=0).isoformat(),
                'category': "Rent",
                'total_amount': 30000.0,
                'gst_rate': 0.0,
                'gst_amount': 0.0,
                'cgst': 0.0,
                'sgst': 0.0,
                'igst': 0.0,
                'itc_eligible': False
            })
            expense_id_counter += 1
            
            # Salaries
            expenses.append({
                'id': expense_id_counter,
                'merchant_name': "Store Employees Salaries",
                'merchant_gstin': None,
                'invoice_no': f"SAL-{month_val}-{year_val}",
                'date': current_date.replace(hour=10, minute=0, second=0).isoformat(),
                'category': "Payroll",
                'total_amount': 45000.0,
                'gst_rate': 0.0,
                'gst_amount': 0.0,
                'cgst': 0.0,
                'sgst': 0.0,
                'igst': 0.0,
                'itc_eligible': False
            })
            expense_id_counter += 1
            
            # Software
            expenses.append({
                'id': expense_id_counter,
                'merchant_name': "TEGL SaaS Solutions",
                'merchant_gstin': "27SaaS1234F1ZN",
                'invoice_no': f"SAAS-{month_val}-{year_val}",
                'date': current_date.replace(hour=10, minute=0, second=0).isoformat(),
                'category': "Software Subscription",
                'total_amount': 2000.0,
                'gst_rate': 18.0,
                'gst_amount': 305.08,
                'cgst': 152.54,
                'sgst': 152.54,
                'igst': 0.0,
                'itc_eligible': True
            })
            expense_id_counter += 1
            
            # Internet bill
            expenses.append({
                'id': expense_id_counter,
                'merchant_name': "Jio Fiber Corp",
                'merchant_gstin': "27AAACJ8898F1ZN",
                'invoice_no': f"JIO-{month_val}-{year_val}",
                'date': current_date.replace(hour=11, minute=0, second=0).isoformat(),
                'category': "Internet Bill",
                'total_amount': 1500.0,
                'gst_rate': 18.0,
                'gst_amount': 228.81,
                'cgst': 114.4,
                'sgst': 114.4,
                'igst': 0.0,
                'itc_eligible': True
            })
            expense_id_counter += 1

        if day_val == 10:
            # Electricity Bill
            elec_amt = round(random.uniform(6000.0, 9500.0), 2)
            gst_amt = round(elec_amt - (elec_amt / 1.18), 2)
            expenses.append({
                'id': expense_id_counter,
                'merchant_name': "Adani Electricity Ltd",
                'merchant_gstin': "27MUDEL9990A1Z2",
                'invoice_no': f"ADANI-{month_val}-{year_val}",
                'date': current_date.replace(hour=14, minute=0, second=0).isoformat(),
                'category': "Electricity Bill",
                'total_amount': elec_amt,
                'gst_rate': 18.0,
                'gst_amount': gst_amt,
                'cgst': round(gst_amt/2, 2),
                'sgst': round(gst_amt/2, 2),
                'igst': 0.0,
                'itc_eligible': True
            })
            expense_id_counter += 1

        # --- B. VARIABLE EXPENSES ---
        if random.random() < 0.35: # Occurs roughly every 3 days
            v_cats = [
                ("Printech Solutions", "Printing & Stationery", 200, 800),
                ("City Logistics", "Transportation & Fuel", 500, 1800),
                ("Speedy Delivery Partners", "Delivery Charges", 300, 1200),
                ("Google Ads India", "Marketing", 1000, 4500),
                ("HDFC Bank Corp", "Banking Charges", 100, 500),
                ("Local Carton Wholesalers", "Packaging Material", 400, 1500),
                ("Local Handyman Services", "Repairs & Maintenance", 300, 2500)
            ]
            merchant, cat, min_a, max_a = random.choice(v_cats)
            v_amt = round(random.uniform(min_a, max_a), 2)
            expenses.append({
                'id': expense_id_counter,
                'merchant_name': merchant,
                'merchant_gstin': None,
                'invoice_no': f"EXP-{expense_id_counter}",
                'date': current_date.replace(hour=random.randint(9, 18), minute=random.randint(0, 59)).isoformat(),
                'category': cat,
                'total_amount': v_amt,
                'gst_rate': 0.0,
                'gst_amount': 0.0,
                'cgst': 0.0,
                'sgst': 0.0,
                'igst': 0.0,
                'itc_eligible': False
            })
            expense_id_counter += 1

        # --- C. SUPPLIER INVENTORY PURCHASES (Every 14 days) ---
        if day_val in [5, 20]:
            supplier_name = random.choice(["Apex Tech Distributors", "Saras Essentials Wholesale", "Metro Garment Industries"])
            invoice_no = f"SUP-{current_date.strftime('%y%m')}-{random.randint(100, 999)}"
            
            # Select random products to replenish
            refill_qty = random.randint(10, 25)
            selected_refills = random.sample(products_list, refill_qty)
            total_purch_amt = 0.0
            
            p_items_list = []
            
            for prod in selected_refills:
                qty = random.randint(15, 50)
                item_amt = round(prod['base_cost'] * qty, 2)
                total_purch_amt += item_amt
                
                # Update simulated stock
                stock_levels[prod['id']] += qty
                
                p_items_list.append({
                    'id': purchase_item_id_counter,
                    'purchase_id': purchase_id_counter,
                    'product_name': prod['name'],
                    'hsn_code': prod['hsn_code'],
                    'quantity': qty,
                    'price_at_purchase': prod['base_cost'],
                    'gst_rate': prod['gst_rate'],
                    'total_amount': item_amt
                })
                purchase_item_id_counter += 1
            
            gst_amount = round(total_purch_amt * 0.18, 2)
            purchases.append({
                'id': purchase_id_counter,
                'supplier_name': supplier_name,
                'supplier_gstin': "27SUPPLIER123A1Z",
                'invoice_no': invoice_no,
                'date': current_date.replace(hour=9, minute=0, second=0).isoformat(),
                'total_amount': total_purch_amt,
                'gst_amount': gst_amount,
                'cgst': round(gst_amount / 2, 2),
                'sgst': round(gst_amount / 2, 2),
                'igst': 0.0,
                'itc_eligible': True,
                'payment_status': "Paid" if random.random() < 0.90 else "Pending",
                'verification_status': "Verified" if random.random() < 0.95 else "Discrepancy Detected",
                'verified_at': current_date.replace(hour=11, minute=0, second=0).isoformat(),
                'verified_by': "Manager Admin",
                'discrepancy_count': 0
            })
            
            purchase_items.extend(p_items_list)
            purchase_id_counter += 1

        # --- D. DAILY SALES (POS + Online Orders) ---
        base_demand = 40  # average transactions per day
        if day_of_week in [4, 5, 6]: # Weekend spikes
            base_demand += 20
        # Holiday spikes (Nov Diwali, Dec Christmas)
        if month_val in [11, 12]:
            base_demand += 15
            
        daily_total_items = max(10, int(base_demand + random.normalvariate(0, 8)))
        items_sold_today = 0
        
        while items_sold_today < daily_total_items:
            available_prods = [p for p in products_list if stock_levels[p['id']] > 0]
            if not available_prods:
                break # All items out of stock
                
            tx_items_count = min(random.randint(1, 4), daily_total_items - items_sold_today, len(available_prods))
            if tx_items_count <= 0:
                break
                
            is_online_order = random.random() < 0.20 # 20% Online Store orders, 80% POS
            tx_hour = random.randint(9, 21)
            tx_time = current_date.replace(hour=tx_hour, minute=random.randint(0, 59), second=random.randint(0, 59))
            
            selected_prods = random.sample(available_prods, tx_items_count)
            tx_total = 0.0
            prod_sold_items = []
            
            for prod in selected_prods:
                qty = random.randint(1, 2)
                if stock_levels[prod['id']] < qty:
                    qty = stock_levels[prod['id']]
                
                # Dynamic pricing calculation simulation
                markup = 0.25
                if stock_levels[prod['id']] < 15:
                    markup += 0.15
                if 17 <= tx_hour <= 21:
                    markup += 0.08
                if day_of_week in [4, 5, 6]:
                    markup += 0.05
                    
                price_sold = round(prod['base_cost'] * (1 + markup), 2)
                stock_levels[prod['id']] -= qty
                
                tx_total += qty * price_sold
                prod_sold_items.append((prod, qty, price_sold))
                items_sold_today += qty
                
            if not prod_sold_items:
                break

            pay_method = random.choices(["UPI", "Cash", "Card"], weights=[40, 45, 15])[0]
            
            if is_online_order:
                # E-commerce Order
                order_status = "Delivered" if random.random() < 0.90 else "Pending"
                orders.append({
                    'id': order_id_counter,
                    'user_id': random.choice([2, None]), # Customer user or anonymous guest
                    'customer_name': f"Online Customer {random.randint(100, 999)}",
                    'email': f"online_{random.randint(1, 1000)}@gmail.com",
                    'phone': f"98765{random.randint(10000, 99999)}",
                    'address': "Mumbai Suburban Area, India",
                    'timestamp': tx_time.isoformat(),
                    'status': order_status,
                    'total_amount': round(tx_total, 2),
                    'sale_type': 'online'
                })
                
                for prod, qty, price_sold in prod_sold_items:
                    order_items.append({
                        'id': order_item_id_counter,
                        'order_id': order_id_counter,
                        'product_id': prod['id'],
                        'quantity': qty,
                        'price_at_sale': price_sold
                    })
                    order_item_id_counter += 1
                    
                order_id_counter += 1
            else:
                # POS Transaction
                transactions.append({
                    'id': tx_id_counter,
                    'timestamp': tx_time.isoformat(),
                    'total_amount': round(tx_total, 2),
                    'uuid': str(uuid.uuid4()),
                    'payment_method': pay_method,
                    'customer_name': f"Walk-in Guest {random.randint(10, 99)}" if random.random() < 0.3 else "Counter Customer",
                    'notes': "Standard counter checkout" if random.random() < 0.1 else None,
                    'cashier': "Manager Admin"
                })
                
                for prod, qty, price_sold in prod_sold_items:
                    transaction_items.append({
                        'id': tx_item_id_counter,
                        'transaction_id': tx_id_counter,
                        'product_id': prod['id'],
                        'quantity': qty,
                        'price_at_sale': price_sold
                    })
                    tx_item_id_counter += 1
                    
                tx_id_counter += 1

        current_date += timedelta(days=1)

    # 4. Create Output Folder
    output_dir = "neon_csv_data"
    os.makedirs(output_dir, exist_ok=True)
    
    # 5. Convert lists to DataFrames
    df_tx = pd.DataFrame(transactions)
    df_tx_items = pd.DataFrame(transaction_items)
    df_orders = pd.DataFrame(orders)
    df_order_items = pd.DataFrame(order_items)
    df_expenses = pd.DataFrame(expenses)
    df_purch = pd.DataFrame(purchases)
    df_purch_items = pd.DataFrame(purchase_items)
    
    # Save standard tables as CSVs
    df_products.to_csv(os.path.join(output_dir, "products.csv"), index=False)
    df_users.to_csv(os.path.join(output_dir, "users.csv"), index=False)
    df_config.to_csv(os.path.join(output_dir, "business_config.csv"), index=False)
    df_tx.to_csv(os.path.join(output_dir, "transactions.csv"), index=False)
    df_tx_items.to_csv(os.path.join(output_dir, "transaction_items.csv"), index=False)
    df_orders.to_csv(os.path.join(output_dir, "orders.csv"), index=False)
    df_order_items.to_csv(os.path.join(output_dir, "order_items.csv"), index=False)
    df_expenses.to_csv(os.path.join(output_dir, "expenses.csv"), index=False)
    df_purch.to_csv(os.path.join(output_dir, "purchases.csv"), index=False)
    df_purch_items.to_csv(os.path.join(output_dir, "purchase_items.csv"), index=False)
    
    print("\nSaved all individual Neon DB tables to folder 'neon_csv_data/'.")
    print(f"  - products.csv: {len(df_products)} rows")
    print(f"  - users.csv: {len(df_users)} rows")
    print(f"  - business_config.csv: {len(df_config)} rows")
    print(f"  - transactions.csv: {len(df_tx)} rows")
    print(f"  - transaction_items.csv: {len(df_tx_items)} rows")
    print(f"  - orders.csv: {len(df_orders)} rows")
    print(f"  - order_items.csv: {len(df_order_items)} rows")
    print(f"  - expenses.csv: {len(df_expenses)} rows")
    print(f"  - purchases.csv: {len(df_purch)} rows")
    print(f"  - purchase_items.csv: {len(df_purch_items)} rows")

    # 6. Create a single consolidated "All Sales" CSV (Transactions + Orders joined with Product details)
    # Join POS Sales
    df_pos_full = df_tx_items.merge(df_tx, left_on='transaction_id', right_on='id', suffixes=('_item', '_tx'))
    df_pos_full = df_pos_full.merge(df_products, left_on='product_id', right_on='id', suffixes=('_sold', '_product'))
    df_pos_full['sale_channel'] = 'POS (Offline)'
    df_pos_full['timestamp'] = df_pos_full['timestamp']
    df_pos_full['total_item_revenue'] = df_pos_full['quantity'] * df_pos_full['price_at_sale']
    
    # Rename columns for unified format
    pos_cols = {
        'timestamp': 'sale_date',
        'product_id': 'product_id',
        'name': 'product_name',
        'category': 'category',
        'quantity': 'quantity_sold',
        'price_at_sale': 'price_per_item',
        'base_cost': 'base_cost_per_item',
        'total_item_revenue': 'total_amount',
        'payment_method': 'payment_method',
        'customer_name': 'customer_name',
        'sale_channel': 'sale_channel'
    }
    df_pos_consolidated = df_pos_full[pos_cols.keys()].rename(columns=pos_cols)

    # Join Online Sales
    df_online_full = df_order_items.merge(df_orders, left_on='order_id', right_on='id', suffixes=('_item', '_order'))
    df_online_full = df_online_full.merge(df_products, left_on='product_id', right_on='id', suffixes=('_sold', '_product'))
    df_online_full['sale_channel'] = 'Online E-commerce'
    df_online_full['payment_method'] = 'UPI/Card (Online)'
    df_online_full['total_item_revenue'] = df_online_full['quantity'] * df_online_full['price_at_sale']
    
    online_cols = {
        'timestamp': 'sale_date',
        'product_id': 'product_id',
        'name': 'product_name',
        'category': 'category',
        'quantity': 'quantity_sold',
        'price_at_sale': 'price_per_item',
        'base_cost': 'base_cost_per_item',
        'total_item_revenue': 'total_amount',
        'payment_method': 'payment_method',
        'customer_name': 'customer_name',
        'sale_channel': 'sale_channel'
    }
    df_online_consolidated = df_online_full[online_cols.keys()].rename(columns=online_cols)

    # Combine both
    df_sales_consolidated = pd.concat([df_pos_consolidated, df_online_consolidated], ignore_index=True)
    df_sales_consolidated = df_sales_consolidated.sort_values(by='sale_date')
    
    consolidated_csv_path = "past_4_years_sales_consolidated.csv"
    df_sales_consolidated.to_csv(consolidated_csv_path, index=False)
    
    print(f"\nSaved consolidated sales history to '{consolidated_csv_path}'.")
    print(f"  - Total consolidated records: {len(df_sales_consolidated)} rows")
    print(f"  - Features: {list(df_sales_consolidated.columns)}")

if __name__ == "__main__":
    main()

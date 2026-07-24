import os
import random
import uuid
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

# Import Flask app and db
from app import app, db
from models import (
    Product, Transaction, TransactionItem, User, BusinessConfig,
    Expense, Purchase, PurchaseItem, Order, OrderItem
)
from ml_models import train_dynamic_pricing_model, train_demand_prediction_model

def seed_database_and_train(drop_tables=True, train_models=True):
    print("Initializing Database...")
    if drop_tables:
        db.drop_all()
    db.create_all()
    
    print("Seeding default business config...")
    if not BusinessConfig.query.first():
        config = BusinessConfig(
            business_name="TEGL Supermart",
            gstin="27ABCDE1234F1Z5",
            pan="ABCDE1234F",
            state="Maharashtra",
            address="101, Galaxy Business Galleria, Hiranandani Link Road, Andheri East, Mumbai - 400072"
        )
        db.session.add(config)
    
    print("Seeding default users...")
    from werkzeug.security import generate_password_hash
    if not User.query.filter_by(username='admin').first():
        admin = User(
            username='admin',
            email='admin@retail.com',
            password_hash=generate_password_hash('adminpassword'),
            role='admin'
        )
        db.session.add(admin)
    if not User.query.filter_by(username='customer').first():
        customer = User(
            username='customer',
            email='customer@retail.com',
            password_hash=generate_password_hash('customerpassword'),
            role='customer'
        )
        db.session.add(customer)
    db.session.commit()
    
    # 1. Parse products from amazon.csv
    print("Parsing products from amazon.csv...")
    products_db = []
    if Product.query.count() > 0:
        print("Products already seeded, loading existing products.")
        products_db = Product.query.all()
    else:
        if not os.path.exists('amazon.csv'):
            print("amazon.csv not found!")
            return

        df_amazon = pd.read_csv('amazon.csv')
        seen_names = set()

        def clean_price(val):
            if pd.isna(val):
                return 0.0
            val_str = str(val).replace('₹', '').replace(',', '').replace(' ', '').strip()
            try:
                return float(val_str)
            except ValueError:
                return 0.0

        for idx, row in df_amazon.iterrows():
            if len(products_db) >= 100:
                break

            raw_name = str(row.get('product_name', '')).strip()
            if not raw_name:
                continue
            
            name = raw_name[:95]
            if name in seen_names:
                continue

            category = str(row.get('category', 'General')).split('|')[0].replace('&', ' & ').strip()
            actual_price = clean_price(row.get('actual_price', 0))
            discounted_price = clean_price(row.get('discounted_price', 0))

            base_cost = round(actual_price, 2)
            current_price = round(discounted_price, 2)

            if base_cost <= 0 or current_price <= 0:
                continue

            # Adjust margins based on category rules
            cat_lower = category.lower()
            margin = 0.25 # Standard fallback
            if "electronic" in cat_lower or "computer" in cat_lower:
                margin = random.uniform(0.10, 0.18)
            elif "accessories" in cat_lower or "cable" in cat_lower or "headphone" in cat_lower:
                margin = random.uniform(0.25, 0.45)
            elif "grocery" in cat_lower or "food" in cat_lower or "milk" in cat_lower:
                margin = random.uniform(0.15, 0.30)
            elif "apparel" in cat_lower or "shirt" in cat_lower or "shoe" in cat_lower:
                margin = random.uniform(0.35, 0.60)

            # Set purchase cost (base_cost) and selling price (current_price) based on margin
            if base_cost > current_price or base_cost == current_price:
                base_cost = round(current_price / (1 + margin), 2)
            else:
                # Recalculate price using cost and margin
                current_price = round(base_cost * (1 + margin), 2)

            stock_level = random.randint(15, 60) # Initial stock
            barcode = f"8901234{idx:06d}"

            # HSN and GST Rate mapping
            def get_hsn_and_gst(n, c):
                n_l = n.lower()
                c_l = c.lower()
                if "keyboard" in n_l:
                    return "84716040", 18.0
                elif "mouse" in n_l:
                    return "84716060", 18.0
                elif "headphone" in n_l or "earphone" in n_l or "bluetooth" in n_l:
                    return "85183000", 18.0
                elif "cable" in n_l or "wire" in n_l or "charger" in n_l:
                    return "85444220", 18.0
                elif "computer" in c_l or "electronic" in c_l:
                    return "84713010", 18.0
                elif "coffee" in n_l or "tea" in n_l:
                    return "09012100", 5.0
                elif "milk" in n_l or "organic" in n_l:
                    return "04012000", 0.0
                elif "shirt" in n_l or "apparel" in c_l or "jeans" in n_l:
                    return "61091000", 5.0
                elif "shoe" in n_l:
                    return "64039190", 18.0
                return "84733099", 18.0

            hsn, gst = get_hsn_and_gst(name, category)
            img_url = str(row.get('img_link', '')).strip()

            product = Product(
                name=name,
                category=category,
                base_cost=base_cost,
                current_price=current_price,
                stock_level=stock_level,
                hsn_code=hsn,
                gst_rate=gst,
                barcode=barcode,
                image_url=img_url if img_url else None
            )
            db.session.add(product)
            products_db.append(product)
            seen_names.add(name)

        db.session.commit()
        print(f"Seeded {len(products_db)} products.")

    days_to_seed = 30 if os.getenv('VERCEL') == '1' else 180
    print(f"Generating {days_to_seed} days of historical operating logs...")
    if Transaction.query.count() > 0 or Order.query.count() > 0:
        print("Historical operating logs already seeded. Skipping generation.")
        return
        
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days_to_seed)
    
    pricing_data_list = []
    demand_data_list = []
    
    products_list = Product.query.all()
    current_date = start_date

    while current_date <= end_date:
        day_val = current_date.day
        month_val = current_date.month
        day_of_week = current_date.weekday() # 0 = Monday, 6 = Sunday

        # --- A. FIXED EXPENSES (Rent, Salary, Utilities) ---
        if day_val == 1:
            # Rent
            db.session.add(Expense(merchant_name="Prime Properties Ltd", category="Rent", total_amount=30000.0, date=current_date.replace(hour=10)))
            # Salaries
            db.session.add(Expense(merchant_name="Store Employees Salaries", category="Payroll", total_amount=45000.0, date=current_date.replace(hour=10)))
            # POS Software
            db.session.add(Expense(merchant_name="TEGL SaaS Solutions", category="Software Subscription", total_amount=2000.0, date=current_date.replace(hour=10)))
            # Security & Cleaning
            db.session.add(Expense(merchant_name="Shield Security Force", category="Security", total_amount=8000.0, date=current_date.replace(hour=10)))
            db.session.add(Expense(merchant_name="QuickClean Ltd", category="Cleaning", total_amount=1200.0, date=current_date.replace(hour=10)))
            # Internet bill
            db.session.add(Expense(merchant_name="Jio Fiber Corp", merchant_gstin="27AAACJ8898F1ZN", invoice_no=f"JIO-{month_val}-2026", category="Internet Bill", total_amount=1500.0, gst_rate=18.0, gst_amount=228.81, cgst=114.4, sgst=114.4, date=current_date.replace(hour=11)))
        
        if day_val == 10:
            # Electricity Bill
            elec_amt = round(random.uniform(6000.0, 9500.0), 2)
            db.session.add(Expense(merchant_name="Adani Electricity Ltd", merchant_gstin="27MUDEL9990A1Z2", invoice_no=f"ADANI-{month_val}-09", category="Electricity Bill", total_amount=elec_amt, gst_rate=18.0, gst_amount=round(elec_amt - (elec_amt / 1.18), 2), date=current_date.replace(hour=14)))
            # Water Bill
            water_amt = round(random.uniform(800.0, 1600.0), 2)
            db.session.add(Expense(merchant_name="Municipal Water Corp", category="Water Bill", total_amount=water_amt, date=current_date.replace(hour=15)))

        if current_date == start_date:
            # Domain and Hosting (Annual fee)
            db.session.add(Expense(merchant_name="GoDaddy India", merchant_gstin="27GDADDY1234A1Z9", category="Domain & Hosting", total_amount=5000.0, gst_rate=18.0, gst_amount=762.71, cgst=381.35, sgst=381.35, date=current_date.replace(hour=12)))

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
            db.session.add(Expense(
                merchant_name=merchant,
                category=cat,
                total_amount=v_amt,
                date=current_date.replace(hour=random.randint(9, 18), minute=random.randint(0, 59))
            ))

        # --- C. SUPPLIER INVENTORY PURCHASES (Every 14 days) ---
        if day_val in [5, 20]:
            supplier_name = random.choice(["Apex Tech Distributors", "Saras Essentials Wholesale", "Metro Garment Industries"])
            invoice_no = f"SUP-{current_date.strftime('%y%m')}-{random.randint(100, 999)}"
            
            # Select random products to replenish
            purchased_items = []
            total_purch_amt = 0.0
            
            refill_qty = random.randint(10, 20)
            selected_refills = random.sample(products_list, refill_qty)
            
            db_purchase = Purchase(
                supplier_name=supplier_name,
                supplier_gstin="27SUPPLIER123A1Z",
                invoice_no=invoice_no,
                date=current_date.replace(hour=9, minute=0),
                total_amount=0.0,
                payment_status="Paid" if random.random() < 0.90 else "Pending" # 10% is Accounts Payable
            )
            db.session.add(db_purchase)
            db.session.flush() # Get purchase ID
            
            for prod in selected_refills:
                qty = random.randint(15, 40)
                item_amt = round(prod.base_cost * qty, 2)
                total_purch_amt += item_amt
                
                # Update stock
                prod.stock_level += qty
                db.session.add(prod)
                
                p_item = PurchaseItem(
                    purchase_id=db_purchase.id,
                    product_name=prod.name,
                    hsn_code=prod.hsn_code,
                    quantity=qty,
                    price_at_purchase=prod.base_cost,
                    gst_rate=prod.gst_rate,
                    total_amount=item_amt
                )
                db.session.add(p_item)
                
            db_purchase.total_amount = total_purch_amt
            db_purchase.gst_amount = round(total_purch_amt * 0.18, 2) # Est 18% avg input tax
            db_purchase.cgst = round(db_purchase.gst_amount / 2, 2)
            db_purchase.sgst = round(db_purchase.gst_amount / 2, 2)

        # --- D. DAILY SALES (POS + Online Orders) ---
        base_demand = 80
        if day_of_week in [4, 5, 6]: # Weekend spikes
            base_demand += 50
        # Holiday spikes (Nov Diwali, Dec Christmas)
        if month_val in [11, 12]:
            base_demand += 30

        daily_total_items = max(20, int(base_demand + random.normalvariate(0, 10)))
        demand_data_list.append({
            'date': current_date.strftime('%Y-%m-%d'),
            'day_of_week': day_of_week,
            'month': month_val,
            'total_items_sold': daily_total_items
        })
        
        items_sold_today = 0
        while items_sold_today < daily_total_items:
            available_prods = [p for p in products_list if p.stock_level > 0]
            if not available_prods:
                break # All items out of stock, stop selling for today
                
            tx_items_count = min(random.randint(1, 4), daily_total_items - items_sold_today, len(available_prods))
            if tx_items_count <= 0:
                break
                
            is_online_order = random.random() < 0.20 # 20% Online Store orders, 80% POS
            tx_hour = random.randint(9, 21)
            tx_time = current_date.replace(hour=tx_hour, minute=random.randint(0, 59))
            
            selected_prods = random.sample(available_prods, tx_items_count)
            tx_total = 0.0
            prod_sold_items = []
            
            for prod in selected_prods:
                qty = random.randint(1, 2)
                if prod.stock_level < qty:
                    qty = prod.stock_level
                
                # Dynamic pricing calculation
                markup = 0.25
                if prod.stock_level < 15:
                    markup += 0.15
                if 17 <= tx_hour <= 21:
                    markup += 0.08
                if day_of_week in [4, 5, 6]:
                    markup += 0.05
                    
                price_sold = round(prod.base_cost * (1 + markup), 2)
                
                pricing_data_list.append({
                    'base_cost': prod.base_cost,
                    'stock_level': prod.stock_level,
                    'hour_of_day': tx_hour,
                    'day_of_week': day_of_week,
                    'price_sold': price_sold
                })
                
                prod.stock_level -= qty
                db.session.add(prod)
                
                tx_total += qty * price_sold
                prod_sold_items.append((prod, qty, price_sold))
                items_sold_today += qty
            
            if not prod_sold_items:
                break

            pay_method = random.choices(["UPI", "Cash", "Card"], weights=[40, 45, 15])[0]
            
            if is_online_order:
                # E-commerce Order
                order_status = "Delivered" if random.random() < 0.90 else "Pending" # Pending = Accounts Receivable
                db_order = Order(
                    customer_name=f"Online Customer {random.randint(100, 999)}",
                    email=f"online_{random.randint(1,500)}@gmail.com",
                    phone=f"98765{random.randint(10000, 99999)}",
                    address="Mumbai Suburban Area, India",
                    timestamp=tx_time,
                    status=order_status,
                    total_amount=round(tx_total, 2)
                )
                db.session.add(db_order)
                db.session.flush()
                
                for prod, qty, price_sold in prod_sold_items:
                    db.session.add(OrderItem(
                        order_id=db_order.id,
                        product_id=prod.id,
                        quantity=qty,
                        price_at_sale=price_sold
                    ))
            else:
                # POS Transaction
                db_transaction = Transaction(
                    timestamp=tx_time,
                    total_amount=round(tx_total, 2),
                    uuid=str(uuid.uuid4()),
                    payment_method=pay_method,
                    customer_name=f"Walk-in Guest {random.randint(10, 99)}" if random.random() < 0.3 else "Counter Customer",
                    cashier="Manager Admin",
                    notes="Standard counter checkout" if random.random() < 0.1 else None
                )
                db.session.add(db_transaction)
                db.session.flush()
                
                for prod, qty, price_sold in prod_sold_items:
                    db.session.add(TransactionItem(
                        transaction_id=db_transaction.id,
                        product_id=prod.id,
                        quantity=qty,
                        price_at_sale=price_sold
                    ))

        current_date += timedelta(days=1)
        
    db.session.commit()
    print("Database seeding completed.")
    
    # 3. Train models
    if train_models:
        print("Training models...")
        df_pricing = pd.DataFrame(pricing_data_list)
        df_demand = pd.DataFrame(demand_data_list)
        
        train_dynamic_pricing_model(df_pricing)
        print("Pricing model trained and saved.")
        
        train_demand_prediction_model(df_demand)
        print("Demand model trained and saved.")
        print("All ML models trained and operational!")

if __name__ == '__main__':
    with app.app_context():
        seed_database_and_train()

import os
import sys

# Ensure project root is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, compute_gst_summary_data, get_finance_dashboard, calculate_sales_tax_breakdown
from models import db, Transaction, Order

with app.app_context():
    print("Finding the record causing calculate_sales_tax_breakdown to fail...")
    biz_state = 'Maharashtra'
    for tx in Transaction.query.all():
        for item in tx.items:
            try:
                # Check properties
                qty = item.quantity
                price = item.price_at_sale
                gst_rate = item.product.gst_rate if (item.product and hasattr(item.product, 'gst_rate')) else 18.0
                hsn = item.product.hsn_code if (item.product and item.product.hsn_code) else '84733099'
                
                if qty is None or price is None or gst_rate is None:
                    print(f"Transaction ID {tx.id} has None value! qty={qty}, price={price}, gst_rate={gst_rate}")
                
                # Test call
                b = calculate_sales_tax_breakdown(tx, biz_state)
            except Exception as e:
                print(f"Failed on Transaction ID {tx.id}, item ID {item.id}: {e}")
                print(f"  item.quantity = {item.quantity}")
                print(f"  item.price_at_sale = {item.price_at_sale}")
                print(f"  item.product = {item.product}")
                if item.product:
                    print(f"    product.gst_rate = {item.product.gst_rate}")
                    print(f"    product.hsn_code = {item.product.hsn_code}")
                break

    for o in Order.query.all():
        for item in o.items:
            try:
                b = calculate_sales_tax_breakdown(o, biz_state)
            except Exception as e:
                print(f"Failed on Order ID {o.id}, item ID {item.id}: {e}")
                print(f"  item.quantity = {item.quantity}")
                print(f"  item.price_at_sale = {item.price_at_sale}")
                print(f"  item.product = {item.product}")
                if item.product:
                    print(f"    product.gst_rate = {item.product.gst_rate}")
                    print(f"    product.hsn_code = {item.product.hsn_code}")
                break

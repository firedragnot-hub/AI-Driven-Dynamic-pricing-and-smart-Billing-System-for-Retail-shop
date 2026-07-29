import os
import sys
import time
import traceback
from collections import defaultdict

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['VERCEL'] = '1'

from app import app
from models import db, Order, OrderItem, Product, BusinessConfig
from datetime import datetime

def compute_gstr1_records_super_optimized():
    config = BusinessConfig.query.first()
    biz_state = config.state if config else 'Maharashtra'
    biz_state_clean = (biz_state or 'Maharashtra').strip().lower()

    # 1. Load orders using a query of specific fields
    orders_data = db.session.query(
        Order.id,
        Order.customer_name,
        Order.timestamp,
        Order.total_amount,
        Order.address
    ).filter(Order.status != 'Cancelled').all()

    # 2. Load order items and product gst_rates in a single query
    items_data = db.session.query(
        OrderItem.order_id,
        OrderItem.quantity,
        OrderItem.price_at_sale,
        Product.gst_rate
    ).join(Product).all()

    # Group items by order_id
    order_items_map = defaultdict(list)
    for item in items_data:
        order_items_map[item.order_id].append(item)

    b2b_records = []
    b2c_records = []

    for order_id, customer_name, timestamp, total_amount, address in orders_data:
        # Determine if interstate
        is_interstate = False
        if address:
            addr = address.lower()
            if biz_state_clean not in addr:
                is_interstate = True

        total_taxable = 0.0
        total_gst = 0.0
        cgst = 0.0
        sgst = 0.0
        igst = 0.0

        items = order_items_map.get(order_id, [])
        for item in items:
            qty = item.quantity
            price = item.price_at_sale
            total_item = qty * price
            gst_rate = item.gst_rate or 18.0

            taxable_val = total_item / (1 + gst_rate / 100.0)
            gst_val = total_item - taxable_val

            total_taxable += taxable_val
            total_gst += gst_val

            if is_interstate:
                igst += gst_val
            else:
                cgst += gst_val / 2.0
                sgst += gst_val / 2.0

        cust_name = customer_name or 'Counter Customer'
        record = {
            'id': order_id,
            'customer_name': cust_name,
            'date': timestamp.isoformat() if timestamp else datetime.utcnow().isoformat(),
            'total_amount': total_amount or 0.0,
            'taxable_value': round(total_taxable, 2),
            'cgst': round(cgst, 2),
            'sgst': round(sgst, 2),
            'igst': round(igst, 2),
            'total_gst': round(total_gst, 2)
        }

        if 'corp' in cust_name.lower() or 'ltd' in cust_name.lower():
            record['buyer_gstin'] = '27ABCDE1234F1Z5'
            b2b_records.append(record)
        else:
            b2c_records.append(record)

    return b2b_records, b2c_records

with app.app_context():
    print("Running super optimized GSTR1 processing...")
    t0 = time.time()
    try:
        b2b, b2c = compute_gstr1_records_super_optimized()
        print(f"SUCCESS in {time.time()-t0:.2f}s!")
        print("B2B count:", len(b2b))
        print("B2C count:", len(b2c))
    except Exception as e:
        traceback.print_exc()

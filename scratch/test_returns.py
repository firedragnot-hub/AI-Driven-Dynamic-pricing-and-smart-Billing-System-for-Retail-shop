import os
import sys
import time
import traceback

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['VERCEL'] = '1'

from app import app, compute_gst_summary_data, calculate_sales_tax_breakdown
from models import db, Order, OrderItem
from sqlalchemy.orm import joinedload
from datetime import datetime

with app.app_context():
    summary = compute_gst_summary_data() # This will run the unoptimized version unless we run after editing, but here we just want to measure GSTR1 order loop.
    
    print("Running GSTR1 order processing WITH joinedload...")
    t0 = time.time()
    try:
        orders = Order.query.filter(Order.status != 'Cancelled').options(
            joinedload(Order.items).joinedload(OrderItem.product)
        ).all()
        b2b_records = []
        b2c_records = []
        
        for o in orders:
            breakdown = calculate_sales_tax_breakdown(o, summary['state'])
            cust_name = o.customer_name or 'Counter Customer'
            record = {
                'id': o.id,
                'customer_name': cust_name,
                'date': o.timestamp.isoformat() if o.timestamp else datetime.utcnow().isoformat(),
                'total_amount': o.total_amount or 0.0,
                'taxable_value': breakdown['total_taxable'],
                'cgst': breakdown['cgst'],
                'sgst': breakdown['sgst'],
                'igst': breakdown['igst'],
                'total_gst': breakdown['total_gst']
            }
            if 'corp' in cust_name.lower() or 'ltd' in cust_name.lower():
                record['buyer_gstin'] = '27ABCDE1234F1Z5'
                b2b_records.append(record)
            else:
                b2c_records.append(record)
                
        print(f"GSTR1 processing finished in {time.time()-t0:.2f}s!")
        print("B2B records count:", len(b2b_records))
        print("B2C records count:", len(b2c_records))
    except Exception as e:
        traceback.print_exc()

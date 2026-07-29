import os
import sys
import time
import traceback

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['VERCEL'] = '1'

from app import app
from models import db, Transaction, Order, TransactionItem, OrderItem, Product, Expense, Purchase, BusinessConfig
from sqlalchemy import func, case

def validate_gstin_format(gstin):
    if not gstin:
        return False
    import re
    return bool(re.match(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', gstin))

def compute_gst_summary_data_fully_optimized():
    config = BusinessConfig.query.first()
    biz_state = config.state if config else 'Maharashtra'
    biz_gstin = config.gstin if config else '27AAPCS1010A1Z0'
    biz_state_clean = biz_state.strip().lower()
    
    # 1. POS sales aggregation (intrastate)
    pos_sum = db.session.query(
        func.count(Transaction.id).label('sales_count'),
        func.sum(Transaction.total_amount).label('total_sales')
    ).first()
    pos_sales_count = pos_sum[0] or 0
    pos_total_sales = pos_sum[1] or 0.0

    pos_items_summary = db.session.query(
        func.sum((TransactionItem.quantity * TransactionItem.price_at_sale) / (1 + Product.gst_rate / 100.0)).label('taxable_sales'),
        func.sum((TransactionItem.quantity * TransactionItem.price_at_sale) - ((TransactionItem.quantity * TransactionItem.price_at_sale) / (1 + Product.gst_rate / 100.0))).label('total_gst')
    ).join(Product).first()
    pos_taxable_sales = float(pos_items_summary[0] or 0.0)
    pos_total_gst = float(pos_items_summary[1] or 0.0)
    
    # 2. Order sales aggregation (can be interstate)
    order_sum = db.session.query(
        func.count(Order.id).label('sales_count'),
        func.sum(Order.total_amount).label('total_sales')
    ).filter(Order.status != 'Cancelled').first()
    order_sales_count = order_sum[0] or 0
    order_total_sales = order_sum[1] or 0.0
    
    # Check if order is interstate: LOWER(Order.address) NOT LIKE LOWER('%' + biz_state_clean + '%')
    # In SQLAlchemy we can use func.lower(Order.address).like(f"%{biz_state_clean}%")
    is_interstate_expr = ~func.lower(Order.address).like(f"%{biz_state_clean}%")
    
    order_items_summary = db.session.query(
        is_interstate_expr.label('is_interstate'),
        func.sum((OrderItem.quantity * OrderItem.price_at_sale) / (1 + Product.gst_rate / 100.0)).label('taxable_value'),
        func.sum((OrderItem.quantity * OrderItem.price_at_sale) - ((OrderItem.quantity * OrderItem.price_at_sale) / (1 + Product.gst_rate / 100.0))).label('total_gst')
    ).join(Product).join(Order).filter(Order.status != 'Cancelled').group_by(is_interstate_expr).all()
    
    order_taxable_sales = 0.0
    order_cgst = 0.0
    order_sgst = 0.0
    order_igst = 0.0
    order_total_gst = 0.0
    
    for row in order_items_summary:
        is_interstate = row[0]
        taxable_val = float(row[1] or 0.0)
        total_gst = float(row[2] or 0.0)
        
        order_taxable_sales += taxable_val
        order_total_gst += total_gst
        
        if is_interstate:
            order_igst += total_gst
        else:
            order_cgst += total_gst / 2.0
            order_sgst += total_gst / 2.0

    # Total sales and tax
    sales_count = pos_sales_count + order_sales_count
    total_sales = pos_total_sales + order_total_sales
    taxable_sales = pos_taxable_sales + order_taxable_sales
    cgst_collected = (pos_total_gst / 2.0) + order_cgst
    sgst_collected = (pos_total_gst / 2.0) + order_sgst
    igst_collected = order_igst
    total_gst_collected = pos_total_gst + order_total_gst
    
    # 3. HSN Summary for POS + Orders combined in SQL
    hsn_wise = {}
    
    # POS HSN
    hsn_pos = db.session.query(
        Product.hsn_code,
        func.sum(TransactionItem.quantity).label('quantity'),
        func.sum((TransactionItem.quantity * TransactionItem.price_at_sale) / (1 + Product.gst_rate / 100.0)).label('taxable_value'),
        Product.gst_rate,
        func.sum((TransactionItem.quantity * TransactionItem.price_at_sale) - ((TransactionItem.quantity * TransactionItem.price_at_sale) / (1 + Product.gst_rate / 100.0))).label('total_gst'),
        func.sum(TransactionItem.quantity * TransactionItem.price_at_sale).label('total_amount')
    ).join(Product).group_by(Product.hsn_code, Product.gst_rate).all()
    
    # Orders HSN
    hsn_orders = db.session.query(
        Product.hsn_code,
        is_interstate_expr.label('is_interstate'),
        func.sum(OrderItem.quantity).label('quantity'),
        func.sum((OrderItem.quantity * OrderItem.price_at_sale) / (1 + Product.gst_rate / 100.0)).label('taxable_value'),
        Product.gst_rate,
        func.sum((OrderItem.quantity * OrderItem.price_at_sale) - ((OrderItem.quantity * OrderItem.price_at_sale) / (1 + Product.gst_rate / 100.0))).label('total_gst'),
        func.sum(OrderItem.quantity * OrderItem.price_at_sale).label('total_amount')
    ).join(Product).join(Order).filter(Order.status != 'Cancelled').group_by(Product.hsn_code, is_interstate_expr, Product.gst_rate).all()
    
    def add_to_hsn(hsn, qty, taxable_val, gst_rate, total_gst, total_amount, is_interstate):
        hsn = (hsn or '').strip()
        if not hsn:
            hsn = '84733099'
        if hsn not in hsn_wise:
            hsn_wise[hsn] = {
                'hsn_code': hsn,
                'quantity': 0,
                'taxable_value': 0.0,
                'gst_rate': gst_rate,
                'cgst': 0.0,
                'sgst': 0.0,
                'igst': 0.0,
                'total_gst': 0.0,
                'total_amount': 0.0
            }
        hsn_wise[hsn]['quantity'] += qty
        hsn_wise[hsn]['taxable_value'] += taxable_val
        hsn_wise[hsn]['total_gst'] += total_gst
        hsn_wise[hsn]['total_amount'] += total_amount
        if is_interstate:
            hsn_wise[hsn]['igst'] += total_gst
        else:
            hsn_wise[hsn]['cgst'] += total_gst / 2.0
            hsn_wise[hsn]['sgst'] += total_gst / 2.0

    for row in hsn_pos:
        add_to_hsn(row[0], int(row[1] or 0), float(row[2] or 0.0), float(row[3] or 18.0), float(row[4] or 0.0), float(row[5] or 0.0), False)
        
    for row in hsn_orders:
        add_to_hsn(row[0], int(row[2] or 0), float(row[3] or 0.0), float(row[4] or 18.0), float(row[5] or 0.0), float(row[6] or 0.0), row[1])

    # 4. Validations (HSN missing and anomalous rate checks)
    validations = []
    
    # Missing HSN codes:
    missing_hsn_pos = db.session.query(TransactionItem.transaction_id, Product.name).join(Product).filter(
        (Product.hsn_code == None) | (Product.hsn_code == '')
    ).limit(10).all()
    for tx_id, prod_name in missing_hsn_pos:
        validations.append({
            'type': 'warning',
            'record_type': 'POS Sale',
            'record_id': tx_id,
            'message': f"Product '{prod_name}' is missing an HSN code."
        })
        
    missing_hsn_ord = db.session.query(OrderItem.order_id, Product.name).join(Product).join(Order).filter(
        Order.status != 'Cancelled',
        (Product.hsn_code == None) | (Product.hsn_code == '')
    ).limit(10).all()
    for order_id, prod_name in missing_hsn_ord:
        validations.append({
            'type': 'warning',
            'record_type': 'Order',
            'record_id': order_id,
            'message': f"Product '{prod_name}' is missing an HSN code."
        })
        
    # Anomalous GST rate:
    anomalous_gst_pos = db.session.query(TransactionItem.transaction_id, Product.name, Product.gst_rate).join(Product).filter(
        (Product.gst_rate < 0) | (Product.gst_rate > 28)
    ).limit(10).all()
    for tx_id, prod_name, gst_rate in anomalous_gst_pos:
        validations.append({
            'type': 'danger',
            'record_type': 'POS Sale',
            'record_id': tx_id,
            'message': f"Anomalous GST rate of {gst_rate}% on product '{prod_name}'."
        })
        
    anomalous_gst_ord = db.session.query(OrderItem.order_id, Product.name, Product.gst_rate).join(Product).join(Order).filter(
        Order.status != 'Cancelled',
        (Product.gst_rate < 0) | (Product.gst_rate > 28)
    ).limit(10).all()
    for order_id, prod_name, gst_rate in anomalous_gst_ord:
        validations.append({
            'type': 'danger',
            'record_type': 'Order',
            'record_id': order_id,
            'message': f"Anomalous GST rate of {gst_rate}% on product '{prod_name}'."
        })

    # Purchases & Expenses summary (same as before)
    purchases = Purchase.query.all()
    total_purchases = 0.0
    cgst_itc = 0.0
    sgst_itc = 0.0
    igst_itc = 0.0
    total_itc = 0.0
    for p in purchases:
        total_purchases += p.total_amount
        if p.supplier_gstin and not validate_gstin_format(p.supplier_gstin):
            validations.append({
                'type': 'danger',
                'record_type': 'Purchase Invoice',
                'record_id': p.id,
                'message': f"Supplier '{p.supplier_name}' has an invalid GSTIN format: '{p.supplier_gstin}'."
            })
        if p.itc_eligible:
            cgst_itc += p.cgst or 0.0
            sgst_itc += p.sgst or 0.0
            igst_itc += p.igst or 0.0
            total_itc += p.gst_amount or 0.0
            
    expenses = Expense.query.all()
    total_expenses = 0.0
    for e in expenses:
        total_expenses += e.total_amount
        if e.merchant_gstin and not validate_gstin_format(e.merchant_gstin):
            validations.append({
                'type': 'warning',
                'record_type': 'Expense',
                'record_id': e.id,
                'message': f"Merchant '{e.merchant_name}' has an invalid GSTIN format: '{e.merchant_gstin}'."
            })
        if e.itc_eligible:
            cgst_itc += e.cgst or 0.0
            sgst_itc += e.sgst or 0.0
            igst_itc += e.igst or 0.0
            total_itc += e.gst_amount or 0.0
            
    # Rounding
    total_sales = round(total_sales, 2)
    taxable_sales = round(taxable_sales, 2)
    cgst_collected = round(cgst_collected, 2)
    sgst_collected = round(sgst_collected, 2)
    igst_collected = round(igst_collected, 2)
    total_gst_collected = round(total_gst_collected, 2)
    
    total_purchases = round(total_purchases, 2)
    total_expenses = round(total_expenses, 2)
    
    cgst_itc = round(cgst_itc, 2)
    sgst_itc = round(sgst_itc, 2)
    igst_itc = round(igst_itc, 2)
    total_itc = round(total_itc, 2)
    
    cgst_payable = round(max(0.0, cgst_collected - cgst_itc), 2)
    sgst_payable = round(max(0.0, sgst_collected - sgst_itc), 2)
    igst_payable = round(max(0.0, igst_collected - igst_itc), 2)
    net_payable = round(cgst_payable + sgst_payable + igst_payable, 2)
    
    for k, v in hsn_wise.items():
        v['taxable_value'] = round(v['taxable_value'], 2)
        v['cgst'] = round(v['cgst'], 2)
        v['sgst'] = round(v['sgst'], 2)
        v['igst'] = round(v['igst'], 2)
        v['total_gst'] = round(v['total_gst'], 2)
        v['total_amount'] = round(v['total_amount'], 2)
        
    return {
        'business_name': config.business_name if config else 'My Business',
        'gstin': biz_gstin,
        'state': biz_state,
        'sales_count': sales_count,
        'total_sales': total_sales,
        'taxable_sales': taxable_sales,
        'cgst_collected': cgst_collected,
        'sgst_collected': sgst_collected,
        'igst_collected': igst_collected,
        'total_gst_collected': total_gst_collected,
        'total_purchases': total_purchases,
        'total_expenses': total_expenses,
        'cgst_itc': cgst_itc,
        'sgst_itc': sgst_itc,
        'igst_itc': igst_itc,
        'total_itc': total_itc,
        'cgst_payable': cgst_payable,
        'sgst_payable': sgst_payable,
        'igst_payable': igst_payable,
        'net_payable': net_payable,
        'hsn_summary': list(hsn_wise.values()),
        'validations': validations
    }

with app.app_context():
    print("Testing fully optimized GST summary data calculation...")
    t0 = time.time()
    try:
        res = compute_gst_summary_data_fully_optimized()
        print(f"SUCCESS in {time.time()-t0:.2f}s!")
        print("Sales count:", res['sales_count'])
        print("Total sales:", res['total_sales'])
        print("Validations count:", len(res['validations']))
    except Exception as e:
        traceback.print_exc()

import os
import sys
import time
import traceback

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['VERCEL'] = '1'

from app import app, db_strftime, calculate_sales_tax_breakdown
from models import db, Transaction, Order, TransactionItem, OrderItem, Product, Expense, Purchase, BusinessConfig
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from datetime import datetime

def validate_gstin_format(gstin):
    if not gstin:
        return False
    import re
    return bool(re.match(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', gstin))

def compute_gst_summary_data_optimized():
    config = BusinessConfig.query.first()
    biz_state = config.state if config else 'Maharashtra'
    biz_gstin = config.gstin if config else '27AAPCS1010A1Z0'
    
    # 1. Aggregate POS transactions directly in database
    # Since POS sales are intrastate (counter sales, no address), we can aggregate directly
    pos_aggregates = db.session.query(
        func.count(Transaction.id).label('sales_count'),
        func.sum(Transaction.total_amount).label('total_sales')
    ).first()
    
    pos_sales_count = pos_aggregates[0] or 0
    pos_total_sales = pos_aggregates[1] or 0.0
    
    # Aggregate POS item details for taxable sales, cgst, sgst
    # Formulations:
    # item_total = quantity * price_at_sale
    # taxable_value = item_total / (1 + gst_rate / 100.0)
    # total_gst = item_total - taxable_value
    # Since POS is intrastate: cgst = total_gst / 2, sgst = total_gst / 2, igst = 0
    
    # We can do this calculation in SQL
    pos_items_summary = db.session.query(
        func.sum((TransactionItem.quantity * TransactionItem.price_at_sale) / (1 + Product.gst_rate / 100.0)).label('taxable_sales'),
        func.sum((TransactionItem.quantity * TransactionItem.price_at_sale) - ((TransactionItem.quantity * TransactionItem.price_at_sale) / (1 + Product.gst_rate / 100.0))).label('total_gst')
    ).join(Product).first()
    
    pos_taxable_sales = float(pos_items_summary[0] or 0.0)
    pos_total_gst = float(pos_items_summary[1] or 0.0)
    pos_cgst = pos_total_gst / 2.0
    pos_sgst = pos_total_gst / 2.0
    pos_igst = 0.0
    
    # HSN summary for POS:
    hsn_wise_pos = db.session.query(
        Product.hsn_code,
        func.sum(TransactionItem.quantity).label('quantity'),
        func.sum((TransactionItem.quantity * TransactionItem.price_at_sale) / (1 + Product.gst_rate / 100.0)).label('taxable_value'),
        Product.gst_rate,
        func.sum((TransactionItem.quantity * TransactionItem.price_at_sale) - ((TransactionItem.quantity * TransactionItem.price_at_sale) / (1 + Product.gst_rate / 100.0))).label('total_gst'),
        func.sum(TransactionItem.quantity * TransactionItem.price_at_sale).label('total_amount')
    ).join(Product).group_by(Product.hsn_code, Product.gst_rate).all()
    
    hsn_wise = {}
    for row in hsn_wise_pos:
        hsn = (row[0] or '').strip()
        if not hsn:
            hsn = '84733099'
        qty = int(row[1] or 0)
        taxable_val = float(row[2] or 0.0)
        gst_rate = float(row[3] or 18.0)
        total_gst = float(row[4] or 0.0)
        total_amount = float(row[5] or 0.0)
        
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
        hsn_wise[hsn]['cgst'] += total_gst / 2.0
        hsn_wise[hsn]['sgst'] += total_gst / 2.0
        hsn_wise[hsn]['total_gst'] += total_gst
        hsn_wise[hsn]['total_amount'] += total_amount

    # POS Validations
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

    # 2. Orders: We process orders. Since orders are fewer (3.3k) and have address check, we load them with joinedload
    orders = Order.query.filter(Order.status != 'Cancelled').options(
        joinedload(Order.items).joinedload(OrderItem.product)
    ).all()
    
    sales_count = pos_sales_count
    total_sales = pos_total_sales
    taxable_sales = pos_taxable_sales
    cgst_collected = pos_cgst
    sgst_collected = pos_sgst
    igst_collected = pos_igst
    total_gst_collected = pos_total_gst
    
    for order in orders:
        sales_count += 1
        total_sales += order.total_amount
        breakdown = calculate_sales_tax_breakdown(order, biz_state)
        
        taxable_sales += breakdown['total_taxable']
        cgst_collected += breakdown['cgst']
        sgst_collected += breakdown['sgst']
        igst_collected += breakdown['igst']
        total_gst_collected += breakdown['total_gst']
        
        for item in order.items:
            hsn = item.product.hsn_code if (item.product and item.product.hsn_code) else None
            if not hsn or hsn.strip() == '':
                validations.append({
                    'type': 'warning',
                    'record_type': 'Order',
                    'record_id': order.id,
                    'message': f"Product '{item.product.name if item.product else 'Unknown'}' is missing an HSN code."
                })
                
        for hsn, data in breakdown['hsn_wise'].items():
            if hsn not in hsn_wise:
                hsn_wise[hsn] = data.copy()
            else:
                hsn_wise[hsn]['quantity'] += data['quantity']
                hsn_wise[hsn]['taxable_value'] += data['taxable_value']
                hsn_wise[hsn]['cgst'] += data['cgst']
                hsn_wise[hsn]['sgst'] += data['sgst']
                hsn_wise[hsn]['igst'] += data['igst']
                hsn_wise[hsn]['total_gst'] += data['total_gst']
                hsn_wise[hsn]['total_amount'] += data['total_amount']

    # 3. Purchases & Expenses (same as before)
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
            
    # Round results and return
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
    print("Testing optimized GST summary data calculation...")
    t0 = time.time()
    try:
        res = compute_gst_summary_data_optimized()
        print(f"SUCCESS in {time.time()-t0:.2f}s!")
        print("Sales count:", res['sales_count'])
        print("Total sales:", res['total_sales'])
        print("Validations count:", len(res['validations']))
    except Exception as e:
        traceback.print_exc()

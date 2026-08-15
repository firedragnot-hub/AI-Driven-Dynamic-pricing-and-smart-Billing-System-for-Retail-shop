from flask import Blueprint, request, jsonify, send_file
from models import db, BusinessConfig, Purchase, Expense, Transaction, Order, Product, GstCategoryMapping
from datetime import datetime
from extensions import dashboard_cache
from routes.auth import get_current_user
import os

def calculate_sales_tax_breakdown(*args, **kwargs):
    from app import calculate_sales_tax_breakdown as fn
    return fn(*args, **kwargs)

def compute_gst_summary_data(*args, **kwargs):
    from app import compute_gst_summary_data as fn
    return fn(*args, **kwargs)

gst_bp = Blueprint("gst", __name__)

def require_admin(payload):
    return payload and payload.get("role") == "admin"

@gst_bp.route('/api/gst/config', methods=['GET', 'POST'])
def gst_config():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    config = BusinessConfig.query.first()
    
    if request.method == 'GET':
        if not config:
            return jsonify({
                'business_name': 'TEGL Retail Solutions',
                'gstin': '27AAPCS1010A1Z0',
                'pan': 'AAPCS1010A',
                'state': 'Maharashtra',
                'address': '123 Innovation Way, Retail Suite 100'
            }), 200
        return jsonify(config.to_dict()), 200
        
    data = request.get_json() or {}
    name = data.get('business_name', '').strip()
    gstin = data.get('gstin', '').strip().upper()
    pan = data.get('pan', '').strip().upper()
    state = data.get('state', '').strip()
    address = data.get('address', '').strip()
    
    if not name or not gstin or not state or not address:
        return jsonify({'error': 'Missing required fields'}), 400
        
    if len(gstin) != 15:
        return jsonify({'error': 'GSTIN must be exactly 15 characters long'}), 400
        
    if not config:
        config = BusinessConfig(business_name=name, gstin=gstin, pan=pan or gstin[2:12], state=state, address=address)
        db.session.add(config)
    else:
        config.business_name = name
        config.gstin = gstin
        config.pan = pan or gstin[2:12]
        config.state = state
        config.address = address
        
    db.session.commit()
    return jsonify(config.to_dict()), 200

@gst_bp.route('/api/gst/purchases', methods=['GET', 'POST'])
def gst_purchases():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    if request.method == 'GET':
        purchases = Purchase.query.order_by(Purchase.date.desc()).all()
        return jsonify([p.to_dict() for p in purchases]), 200
        
    data = request.get_json() or {}
    supplier_name = data.get('supplier_name', '').strip()
    supplier_gstin = data.get('supplier_gstin', '').strip().upper()
    invoice_no = data.get('invoice_no', '').strip()
    date_str = data.get('date')
    itc_eligible = data.get('itc_eligible', True)
    items_data = data.get('items', [])
    
    if not supplier_name or not invoice_no or not items_data:
        return jsonify({'error': 'Missing supplier name, invoice number, or items'}), 400
        
    date_val = datetime.utcnow()
    if date_str:
        try:
            date_val = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except Exception:
            try:
                date_val = datetime.strptime(date_str, '%Y-%m-%d')
            except Exception:
                pass
                
    config = BusinessConfig.query.first()
    biz_state_code = config.gstin[:2] if (config and config.gstin) else '27'
    supplier_state_code = supplier_gstin[:2] if (supplier_gstin and len(supplier_gstin) >= 2) else biz_state_code
    is_interstate = (biz_state_code != supplier_state_code)
    
    total_amount = 0.0
    gst_amount = 0.0
    cgst = 0.0
    sgst = 0.0
    igst = 0.0
    
    purchase_items = []
    
    for item in items_data:
        prod_name = item.get('product_name', '').strip()
        qty = int(item.get('quantity', 1))
        price = float(item.get('price_at_purchase', 0.0))
        gst_rate = float(item.get('gst_rate', 18.0))
        hsn = item.get('hsn_code', '').strip() or '84733099'
        
        item_total = qty * price
        item_taxable = item_total / (1 + gst_rate / 100.0)
        item_gst = item_total - item_taxable
        
        total_amount += item_total
        gst_amount += item_gst
        
        if is_interstate:
            igst += item_gst
        else:
            cgst += item_gst / 2.0
            sgst += item_gst / 2.0
            
        purchase_items.append(PurchaseItem(
            product_name=prod_name,
            hsn_code=hsn,
            quantity=qty,
            price_at_purchase=price,
            gst_rate=gst_rate,
            total_amount=item_total
        ))
        
    purchase = Purchase(
        supplier_name=supplier_name,
        supplier_gstin=supplier_gstin,
        invoice_no=invoice_no,
        date=date_val,
        total_amount=round(total_amount, 2),
        gst_amount=round(gst_amount, 2),
        cgst=round(cgst, 2),
        sgst=round(sgst, 2),
        igst=round(igst, 2),
        itc_eligible=itc_eligible
    )
    
    for p_item in purchase_items:
        purchase.items.append(p_item)
        
    db.session.add(purchase)
    db.session.commit()
    return jsonify(purchase.to_dict()), 201

@gst_bp.route('/api/gst/purchases/<int:purchase_id>', methods=['DELETE'])
def delete_gst_purchase(purchase_id):
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    purchase = Purchase.query.get(purchase_id)
    if not purchase:
        return jsonify({'error': 'Purchase record not found'}), 404
        
    db.session.delete(purchase)
    db.session.commit()
    return jsonify({'message': 'Purchase deleted successfully'}), 200

@gst_bp.route('/api/gst/expenses', methods=['GET', 'POST'])
def gst_expenses():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    if request.method == 'GET':
        expenses = Expense.query.order_by(Expense.date.desc()).all()
        return jsonify([e.to_dict() for e in expenses]), 200
        
    data = request.get_json() or {}
    merchant_name = data.get('merchant_name', '').strip()
    merchant_gstin = data.get('merchant_gstin', '').strip().upper()
    invoice_no = data.get('invoice_no', '').strip()
    date_str = data.get('date')
    category = data.get('category', '').strip()
    total_amount = float(data.get('total_amount', 0.0))
    gst_rate = float(data.get('gst_rate', 0.0))
    itc_eligible = data.get('itc_eligible', True)
    
    if not merchant_name or not category or total_amount <= 0:
        return jsonify({'error': 'Missing required fields (merchant name, category, or amount)'}), 400
        
    date_val = datetime.utcnow()
    if date_str:
        try:
            date_val = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except Exception:
            try:
                date_val = datetime.strptime(date_str, '%Y-%m-%d')
            except Exception:
                pass
                
    config = BusinessConfig.query.first()
    biz_state_code = config.gstin[:2] if (config and config.gstin) else '27'
    merchant_state_code = merchant_gstin[:2] if (merchant_gstin and len(merchant_gstin) >= 2) else biz_state_code
    is_interstate = (biz_state_code != merchant_state_code)
    
    gst_amount = 0.0
    cgst = 0.0
    sgst = 0.0
    igst = 0.0
    
    if gst_rate > 0:
        taxable = total_amount / (1 + gst_rate / 100.0)
        gst_amount = total_amount - taxable
        if is_interstate:
            igst = gst_amount
        else:
            cgst = gst_amount / 2.0
            sgst = gst_amount / 2.0
            
    expense = Expense(
        merchant_name=merchant_name,
        merchant_gstin=merchant_gstin,
        invoice_no=invoice_no,
        date=date_val,
        category=category,
        total_amount=round(total_amount, 2),
        gst_rate=gst_rate,
        gst_amount=round(gst_amount, 2),
        cgst=round(cgst, 2),
        sgst=round(sgst, 2),
        igst=round(igst, 2),
        itc_eligible=itc_eligible
    )
    
    db.session.add(expense)
    db.session.commit()
    return jsonify(expense.to_dict()), 201

@gst_bp.route('/api/gst/expenses/<int:expense_id>', methods=['DELETE'])
def delete_gst_expense(expense_id):
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    expense = Expense.query.get(expense_id)
    if not expense:
        return jsonify({'error': 'Expense record not found'}), 404
        
    db.session.delete(expense)
    db.session.commit()
    return jsonify({'message': 'Expense deleted successfully'}), 200

@gst_bp.route('/api/gst/summary', methods=['GET'])
def gst_summary():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
    return jsonify(compute_gst_summary_data()), 200

@gst_bp.route('/api/gst/pnl', methods=['GET'])
def gst_pnl():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    start_date_raw = request.args.get('start_date')
    end_date_raw = request.args.get('end_date')
    start_dt = None
    end_dt = None
    
    if start_date_raw:
        try:
            start_dt = datetime.strptime(start_date_raw, '%Y-%m-%d')
        except ValueError:
            return jsonify({'success': False, 'error': 'Invalid start_date format. Use YYYY-MM-DD'}), 400

    if end_date_raw:
        try:
            end_dt = datetime.strptime(end_date_raw, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
        except ValueError:
            return jsonify({'success': False, 'error': 'Invalid end_date format. Use YYYY-MM-DD'}), 400

    if start_dt and end_dt and start_dt > end_dt:
        return jsonify({'success': False, 'error': 'Start date cannot be after end date'}), 400

    if not start_date_raw and not end_date_raw:
        cached_res = dashboard_cache.get('gst_pnl')
        if cached_res:
            return jsonify(cached_res), 200

    config = BusinessConfig.query.first()
    biz_state = config.state if config else 'Maharashtra'
    
    from sqlalchemy.orm import joinedload
    tx_q = Transaction.query.options(
        joinedload(Transaction.items).joinedload(TransactionItem.product)
    )
    if start_dt:
        tx_q = tx_q.filter(Transaction.timestamp >= start_dt)
    if end_dt:
        tx_q = tx_q.filter(Transaction.timestamp <= end_dt)
    pos_transactions = tx_q.all()

    ord_q = Order.query.options(
        joinedload(Order.items).joinedload(OrderItem.product)
    ).filter(Order.status != 'Cancelled')
    if start_dt:
        ord_q = ord_q.filter(Order.created_at >= start_dt)
    if end_dt:
        ord_q = ord_q.filter(Order.created_at <= end_dt)
    orders = ord_q.all()
    
    gross_sales = 0.0
    taxable_revenue = 0.0
    cogs = 0.0
    
    for tx in pos_transactions:
        gross_sales += tx.total_amount
        breakdown = calculate_sales_tax_breakdown(tx, biz_state)
        taxable_revenue += breakdown['total_taxable']
        
        for item in tx.items:
            base_cost = item.product.base_cost if item.product else 0.0
            cogs += base_cost * item.quantity
            
    for order in orders:
        gross_sales += order.total_amount
        breakdown = calculate_sales_tax_breakdown(order, biz_state)
        taxable_revenue += breakdown['total_taxable']
        
        for item in order.items:
            base_cost = item.product.base_cost if item.product else 0.0
            cogs += base_cost * item.quantity
            
    exp_q = Expense.query
    if start_dt:
        exp_q = exp_q.filter(Expense.date >= start_dt.date())
    if end_dt:
        exp_q = exp_q.filter(Expense.date <= end_dt.date())
    expenses = exp_q.all()
    total_expenses = 0.0
    
    expense_categories = {}
    for e in expenses:
        amount_excl_tax = e.total_amount - e.gst_amount if e.itc_eligible else e.total_amount
        total_expenses += amount_excl_tax
        cat = e.category
        expense_categories[cat] = expense_categories.get(cat, 0.0) + amount_excl_tax
        
    gross_profit = taxable_revenue - cogs
    net_profit = gross_profit - total_expenses
    
    res_data = {
        'gross_sales': round(gross_sales, 2),
        'revenue': round(taxable_revenue, 2),
        'cogs': round(cogs, 2),
        'gross_profit': round(gross_profit, 2),
        'operating_expenses': round(total_expenses, 2),
        'net_profit': round(net_profit, 2),
        'expense_breakdown': [{'category': k, 'amount': round(v, 2)} for k, v in expense_categories.items()]
    }
    if not start_date_raw and not end_date_raw:
        dashboard_cache.set('gst_pnl', res_data)
    return jsonify(res_data), 200

@gst_bp.route('/api/gst/returns/<string:return_type>', methods=['GET'])
def gst_returns(return_type):
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    summary = compute_gst_summary_data()
    
    if return_type == 'gstr1':
        from collections import defaultdict
        
        # 1. Load orders using specific field query to bypass ORM instantiation overhead
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
        
        biz_state_clean = (summary['state'] or 'Maharashtra').strip().lower()

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
                
        return jsonify({
            'summary': {
                'taxable_supplies': summary['taxable_sales'],
                'cgst': summary['cgst_collected'],
                'sgst': summary['sgst_collected'],
                'igst': summary['igst_collected'],
                'total_tax': summary['total_gst_collected']
            },
            'b2b': b2b_records,
            'b2c': b2c_records,
            'hsn_summary': summary['hsn_summary']
        }), 200
        
    elif return_type == 'gstr3b':
        return jsonify({
            'summary': {
                'outward_supplies': {
                    'taxable_value': summary['taxable_sales'],
                    'cgst': summary['cgst_collected'],
                    'sgst': summary['sgst_collected'],
                    'igst': summary['igst_collected']
                },
                'eligible_itc': {
                    'cgst': summary['cgst_itc'],
                    'sgst': summary['sgst_itc'],
                    'igst': summary['igst_itc']
                },
                'tax_payable': {
                    'cgst': summary['cgst_payable'],
                    'sgst': summary['sgst_payable'],
                    'igst': summary['igst_payable'],
                    'net_payable': summary['net_payable']
                }
            }
        }), 200
        
    elif return_type == 'gstr9':
        return jsonify({
            'summary': {
                'annual_turnover': summary['taxable_sales'],
                'annual_purchases': summary['total_purchases'],
                'total_tax_collected': summary['total_gst_collected'],
                'total_itc_availed': summary['total_itc'],
                'net_tax_paid_cash': summary['net_payable']
            }
        }), 200
        
    elif return_type == 'monthly_liability':
        monthly_data = {}
        
        pos_transactions = Transaction.query.all()
        orders = Order.query.filter(Order.status != 'Cancelled').all()
        
        for tx in pos_transactions:
            m_key = tx.timestamp.strftime('%Y-%m')
            if m_key not in monthly_data:
                monthly_data[m_key] = {'month': m_key, 'sales': 0.0, 'purchases': 0.0, 'tax_collected': 0.0, 'itc': 0.0}
            monthly_data[m_key]['sales'] += tx.total_amount
            breakdown = calculate_sales_tax_breakdown(tx, summary['state'])
            monthly_data[m_key]['tax_collected'] += breakdown['total_gst']
            
        for o in orders:
            m_key = o.timestamp.strftime('%Y-%m')
            if m_key not in monthly_data:
                monthly_data[m_key] = {'month': m_key, 'sales': 0.0, 'purchases': 0.0, 'tax_collected': 0.0, 'itc': 0.0}
            monthly_data[m_key]['sales'] += o.total_amount
            breakdown = calculate_sales_tax_breakdown(o, summary['state'])
            monthly_data[m_key]['tax_collected'] += breakdown['total_gst']
            
        purchases = Purchase.query.all()
        for p in purchases:
            m_key = p.date.strftime('%Y-%m')
            if m_key not in monthly_data:
                monthly_data[m_key] = {'month': m_key, 'sales': 0.0, 'purchases': 0.0, 'tax_collected': 0.0, 'itc': 0.0}
            monthly_data[m_key]['purchases'] += p.total_amount
            if p.itc_eligible:
                monthly_data[m_key]['itc'] += p.gst_amount
                
        result = sorted(list(monthly_data.values()), key=lambda x: x['month'])
        return jsonify(result), 200
        
    return jsonify({'error': 'Invalid return type'}), 400

@gst_bp.route('/api/gst/download-pdf', methods=['GET'])
def download_gst_pdf():
    from pdf_generator import generate_gst_pdf_report, generate_pnl_pdf_report
    user = get_current_user()
    if not user:
        token = request.args.get('token')
        if token:
            try:
                user = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            except Exception:
                pass
                
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    report_type = request.args.get('type', 'gstr1')
    config = BusinessConfig.query.first()
    
    if report_type == 'pnl':
        start_date_raw = request.args.get('start_date')
        end_date_raw = request.args.get('end_date')
        start_dt = None
        end_dt = None
        
        if start_date_raw:
            try:
                start_dt = datetime.strptime(start_date_raw, '%Y-%m-%d')
            except ValueError:
                return jsonify({'success': False, 'error': 'Invalid start_date format. Use YYYY-MM-DD'}), 400

        if end_date_raw:
            try:
                end_dt = datetime.strptime(end_date_raw, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            except ValueError:
                return jsonify({'success': False, 'error': 'Invalid end_date format. Use YYYY-MM-DD'}), 400

        if start_dt and end_dt and start_dt > end_dt:
            return jsonify({'success': False, 'error': 'Start date cannot be after end date'}), 400

        tx_q = Transaction.query
        if start_dt:
            tx_q = tx_q.filter(Transaction.timestamp >= start_dt)
        if end_dt:
            tx_q = tx_q.filter(Transaction.timestamp <= end_dt)
        pos_transactions = tx_q.all()

        ord_q = Order.query.filter(Order.status != 'Cancelled')
        if start_dt:
            ord_q = ord_q.filter(Order.created_at >= start_dt)
        if end_dt:
            ord_q = ord_q.filter(Order.created_at <= end_dt)
        orders = ord_q.all()
        
        gross_sales = 0.0
        taxable_revenue = 0.0
        cogs = 0.0
        biz_state = config.state if config else 'Maharashtra'
        
        for tx in pos_transactions:
            gross_sales += tx.total_amount
            breakdown = calculate_sales_tax_breakdown(tx, biz_state)
            taxable_revenue += breakdown['total_taxable']
            for item in tx.items:
                base_cost = item.product.base_cost if item.product else 0.0
                cogs += base_cost * item.quantity
                
        for order in orders:
            gross_sales += order.total_amount
            breakdown = calculate_sales_tax_breakdown(order, biz_state)
            taxable_revenue += breakdown['total_taxable']
            for item in order.items:
                base_cost = item.product.base_cost if item.product else 0.0
                cogs += base_cost * item.quantity
                
        exp_q = Expense.query
        if start_dt:
            exp_q = exp_q.filter(Expense.date >= start_dt.date())
        if end_dt:
            exp_q = exp_q.filter(Expense.date <= end_dt.date())
        expenses = exp_q.all()
        
        total_expenses = 0.0
        expense_categories = {}
        for e in expenses:
            amount_excl_tax = e.total_amount - e.gst_amount if e.itc_eligible else e.total_amount
            total_expenses += amount_excl_tax
            cat = e.category
            expense_categories[cat] = expense_categories.get(cat, 0.0) + amount_excl_tax

        period_label = "FY 2026-27"
        if start_date_raw and end_date_raw:
            period_label = f"{start_date_raw} to {end_date_raw}"
        elif start_date_raw:
            period_label = f"From {start_date_raw}"
        elif end_date_raw:
            period_label = f"Up to {end_date_raw}"
            
        pnl_data = {
            'revenue': round(taxable_revenue, 2),
            'cogs': round(cogs, 2),
            'gross_profit': round(taxable_revenue - cogs, 2),
            'operating_expenses': round(total_expenses, 2),
            'net_profit': round((taxable_revenue - cogs) - total_expenses, 2),
            'expense_breakdown': [{'category': k, 'amount': round(v, 2)} for k, v in expense_categories.items()],
            'period_label': period_label
        }
        pdf_buf = generate_pnl_pdf_report(pnl_data, config)
        return send_file(
            pdf_buf,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'Profit_and_Loss_Statement_{start_date_raw or "all"}_to_{end_date_raw or "all"}.pdf'
        )
    else:
        summary = compute_gst_summary_data()
        pdf_buf = generate_gst_pdf_report(report_type, summary, config)
        return send_file(
            pdf_buf,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'GST_Filing_Report_{report_type}.pdf'
        )

@gst_bp.route('/api/gst/export-csv', methods=['GET'])
def export_gst_csv():
    user = get_current_user()
    if not user:
        token = request.args.get('token')
        if token:
            try:
                user = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            except Exception:
                pass
                
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    report_type = request.args.get('type', 'gstr1')
    config = BusinessConfig.query.first()
    biz_state = config.state if config else 'Maharashtra'
    
    output = io.StringIO()
    import csv
    writer = csv.writer(output)
    
    if report_type == 'gstr1':
        writer.writerow(['GST Return Filing Format: GSTR-1 (Outward Supplies)'])
        writer.writerow([])
        writer.writerow(['Invoice ID', 'Date', 'Type (POS/Order)', 'Customer Name', 'Taxable Subtotal (Rs.)', 'CGST (Rs.)', 'SGST (Rs.)', 'IGST (Rs.)', 'Total Sales Invoice (Rs.)'])
        
        pos_transactions = Transaction.query.all()
        for tx in pos_transactions:
            b = calculate_sales_tax_breakdown(tx, biz_state)
            writer.writerow([f"POS-{tx.id}", tx.timestamp.strftime('%Y-%m-%d'), 'POS Sale', 'Counter Customer', b['total_taxable'], b['cgst'], b['sgst'], b['igst'], tx.total_amount])
            
        orders = Order.query.filter(Order.status != 'Cancelled').all()
        for o in orders:
            b = calculate_sales_tax_breakdown(o, biz_state)
            writer.writerow([f"ORD-{o.id}", o.timestamp.strftime('%Y-%m-%d'), 'Storefront Order', o.customer_name, b['total_taxable'], b['cgst'], b['sgst'], b['igst'], o.total_amount])
            
    elif report_type == 'gstr2':
        writer.writerow(['GST Return Filing Format: GSTR-2 (Inward Supplies / ITC)'])
        writer.writerow([])
        writer.writerow(['Invoice No', 'Date', 'Supplier/Vendor Name', 'Supplier GSTIN', 'Category', 'Total Cost (Rs.)', 'CGST (Rs.)', 'SGST (Rs.)', 'IGST (Rs.)', 'ITC Eligible'])
        
        purchases = Purchase.query.all()
        for p in purchases:
            writer.writerow([p.invoice_no, p.date.strftime('%Y-%m-%d'), p.supplier_name, p.supplier_gstin or '', 'Inventory Purchase', p.total_amount, p.cgst, p.sgst, p.igst, 'YES' if p.itc_eligible else 'NO'])
            
        expenses = Expense.query.all()
        for e in expenses:
            writer.writerow([e.invoice_no or 'N/A', e.date.strftime('%Y-%m-%d'), e.merchant_name, e.merchant_gstin or '', f"Expense: {e.category}", e.total_amount, e.cgst, e.sgst, e.igst, 'YES' if e.itc_eligible else 'NO'])
            
    filename = f"{report_type}_report.csv"
    mem_file = io.BytesIO()
    mem_file.write(output.getvalue().encode('utf-8'))
    mem_file.seek(0)
    
    return send_file(
        mem_file,
        mimetype='text/csv',
        as_attachment=True,
        download_name=filename
    )

@gst_bp.route('/api/gst/lookup', methods=['POST'])
def gst_classifier_lookup():
    """
    1. Primary: Database lookup by category or product name/keyword in GstCategoryMapping.
    2. Fallback: Call Groq AI API to classify unknown products into HSN code, GST rate, confidence score.
    """
    data = request.get_json() or {}
    product_name = data.get('product_name', '').strip()
    category = data.get('category', '').strip()
    description = data.get('description', '').strip()

    if not product_name and not category:
        return jsonify({'error': 'Product name or category is required'}), 400

    query_str = (category or product_name).lower()
    
    # --- STAGE 1: Primary Rule-based DB Lookup ---
    # Exact category match
    match = GstCategoryMapping.query.filter(func.lower(GstCategoryMapping.category_name) == query_str).first()
    
    # Keyword/partial match fallback in DB
    if not match and product_name:
        all_mappings = GstCategoryMapping.query.all()
        for item in all_mappings:
            if item.keywords:
                keywords = [k.strip().lower() for k in item.keywords.split(',') if k.strip()]
                if any(kw in product_name.lower() or kw in description.lower() for kw in keywords):
                    match = item
                    break

    if match:
        return jsonify({
            'found': True,
            'source': 'database',
            'category_name': match.category_name,
            'hsn_code': match.hsn_code,
            'gst_rate': match.gst_rate,
            'confidence': 100.0,
            'requires_confirmation': False,
            'explanation': 'Exact or keyword match found in primary rule-based database.'
        }), 200

    # --- STAGE 2: Groq AI Fallback ---
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not groq_api_key:
        return jsonify({
            'found': False,
            'source': 'fallback_default',
            'category_name': category or 'General Goods',
            'hsn_code': '8473',
            'gst_rate': 18.0,
            'confidence': 50.0,
            'requires_confirmation': True,
            'explanation': 'Groq API key not configured. Applied standard default GST rate 18%.'
        }), 200

    groq_url = "https://api.groq.com/openai/v1/chat/completions"
    prompt = (
        f"You are an expert Indian GST & HSN code classification assistant for a retail POS software.\n"
        f"Classify the following product:\n"
        f"Product Name: {product_name}\n"
        f"Category: {category}\n"
        f"Description: {description}\n\n"
        f"Allowed GST rates in India: 0, 5, 12, 18, 28.\n"
        f"Respond STRICTLY with a valid JSON object matching this schema:\n"
        f"{{\n"
        f'  "likely_category": "Standard Indian GST category name",\n'
        f'  "hsn_code": "4 to 8 digit HSN/SAC code",\n'
        f'  "gst_rate": numeric_rate (e.g. 18.0),\n'
        f'  "confidence": confidence_percentage_between_0_and_100,\n'
        f'  "explanation": "Brief 1-sentence legal/regulatory reason for HSN and GST rate"\n'
        f"}}\n"
        f"Do NOT include any markdown formatting outside JSON."
    )

    payload = {
        "model": os.getenv("GROQ_MODEL", "").strip() or "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 200,
        "response_format": {"type": "json_object"}
    }

    try:
        req = urllib.request.Request(
            groq_url,
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {groq_api_key}',
                'User-Agent': 'Mozilla/5.0'
            },
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=5.0) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            raw_content = res_data['choices'][0]['message']['content'].strip()
            ai_res = json.loads(raw_content)

            gst_rate = float(ai_res.get('gst_rate', 18.0))
            valid_rates = [0.0, 5.0, 12.0, 18.0, 28.0]
            if gst_rate not in valid_rates:
                gst_rate = min(valid_rates, key=lambda x: abs(x - gst_rate))

            confidence = float(ai_res.get('confidence', 85.0))
            requires_confirmation = confidence < 80.0

            return jsonify({
                'found': False,
                'source': 'ai',
                'category_name': ai_res.get('likely_category', category or 'General Goods'),
                'hsn_code': str(ai_res.get('hsn_code', '8473')),
                'gst_rate': gst_rate,
                'confidence': confidence,
                'requires_confirmation': requires_confirmation,
                'explanation': ai_res.get('explanation', 'AI classified using standard Indian HSN/GST schedules.')
            }), 200

    except Exception as err:
        print("Groq GST AI Classifier Exception:", str(err))
        return jsonify({
            'found': False,
            'source': 'ai_fallback_error',
            'category_name': category or 'General Goods',
            'hsn_code': '8473',
            'gst_rate': 18.0,
            'confidence': 50.0,
            'requires_confirmation': True,
            'explanation': 'AI lookup encountered a temporary issue. Fallback to 18% default rate.'
        }), 200

@gst_bp.route('/api/gst/confirm-mapping', methods=['POST'])
def confirm_gst_mapping():
    """
    Admin Learning: Confirm and save a GST category mapping to the database.
    Subsequent lookups for the same category or product keywords will be served deterministically from DB without AI calls.
    """
    data = request.get_json() or {}
    category_name = data.get('category_name', '').strip()
    hsn_code = data.get('hsn_code', '').strip()
    gst_rate = data.get('gst_rate')
    keywords = data.get('keywords', '').strip()
    description = data.get('description', '').strip()

    if not category_name or not hsn_code or gst_rate is None:
        return jsonify({'error': 'category_name, hsn_code, and gst_rate are required'}), 400

    try:
        mapping = GstCategoryMapping.query.filter(func.lower(GstCategoryMapping.category_name) == category_name.lower()).first()
        if not mapping:
            mapping = GstCategoryMapping(
                category_name=category_name,
                hsn_code=hsn_code,
                gst_rate=float(gst_rate),
                keywords=keywords,
                description=description,
                source='ai_confirmed'
            )
            db.session.add(mapping)
        else:
            mapping.hsn_code = hsn_code
            mapping.gst_rate = float(gst_rate)
            if keywords:
                mapping.keywords = keywords
            if description:
                mapping.description = description
            mapping.source = 'ai_confirmed'

        db.session.commit()
        return jsonify({
            'message': 'GST category mapping confirmed and saved successfully to database.',
            'mapping': mapping.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@gst_bp.route('/api/gst/categories', methods=['GET'])
def list_gst_categories():
    """
    List all rule-based GST categories stored in database.
    """
    categories = GstCategoryMapping.query.order_by(GstCategoryMapping.category_name.asc()).all()
    return jsonify([cat.to_dict() for cat in categories]), 200


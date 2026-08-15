from flask import Blueprint, request, jsonify, send_file
from models import db, Order, Transaction, TransactionItem, Product, Review, DynamicPricingPrediction, BudgetPredictionResult, PurchaseItem, Purchase, Discrepancy, PurchaseBill
from datetime import datetime
from extensions import dashboard_cache, ai_cache
from routes.auth import get_current_user
import json
import os
import random
import pandas as pd
from sqlalchemy import func
from ml_models import predict_dynamic_price, predict_demand, train_dynamic_pricing_model, train_demand_prediction_model

def explain_demand_prediction(*args, **kwargs):
    from app import explain_demand_prediction as fn
    return fn(*args, **kwargs)

def get_festival_for_month(*args, **kwargs):
    from app import get_festival_for_month as fn
    return fn(*args, **kwargs)

def db_strftime(*args, **kwargs):
    from app import db_strftime as fn
    return fn(*args, **kwargs)

def parse_bill_pdf(*args, **kwargs):
    from app import parse_bill_pdf as fn
    return fn(*args, **kwargs)

ml_bp = Blueprint("ml", __name__)

def require_admin(payload):
    return payload and payload.get("role") == "admin"

@ml_bp.route('/api/ml/pricing-recommendations', methods=['GET'])
def get_pricing_recommendations():
    from ml_models import predict_dynamic_price
    """
    Returns dynamic pricing details for all products, and saves predictions to the database.
    """
    products = Product.query.all()
    now = datetime.now()
    hour_of_day = now.hour
    day_of_week = now.weekday()
    
    recommendations = []
    for p in products:
        suggested = predict_dynamic_price(
            base_cost=p.base_cost,
            stock_level=p.stock_level,
            hour_of_day=hour_of_day,
            day_of_week=day_of_week
        )
        
        # Build reason
        reason = "Competitive baseline: Normal stock and traffic. Standard competitive markup applied."
        if p.stock_level < 10:
            reason = "Scarcity pricing: Stock is very low (< 10 units). Markup adjusted upward."
        elif p.stock_level < 30:
            reason = "Scarcity pricing: Stock is moderately low (< 30 units). Markup applied."
        elif 17 <= hour_of_day <= 21:
            reason = "Peak hours: High shopping hours (5 PM - 9 PM). Demand markup applied."
        elif day_of_week in [4, 5, 6]:
            reason = "Weekend demand: Sales volume is historically higher on weekends. Price adjusted for demand."
            
        profit = round(suggested - p.base_cost, 2)
        
        # Save prediction history
        pred = DynamicPricingPrediction(
            product_id=p.id,
            timestamp=now,
            base_cost=p.base_cost,
            stock_level=p.stock_level,
            suggested_price=suggested,
            current_price=p.current_price,
            expected_profit=profit,
            recommendation_reason=reason
        )
        db.session.add(pred)
        
        recommendations.append({
            'product_id': p.id,
            'name': p.name,
            'category': p.category,
            'base_cost': p.base_cost,
            'current_price': p.current_price,
            'suggested_price': suggested,
            'expected_profit': profit,
            'reason': reason
        })
        
    db.session.commit()
    return jsonify(recommendations), 200

@ml_bp.route('/api/ml/budget-recommendation', methods=['POST'])
def get_budget_recommendation():
    from ml_models import recommend_budget_allocation
    """
    Calculates allocation of a budget across products in a category using Linear Regression predictions.
    """
    data = request.get_json() or {}
    budget = float(data.get('budget', 1000.0))
    category = data.get('category', 'All')
    period_days = int(data.get('period_days', 30))
    
    result = recommend_budget_allocation(budget, category, period_days, db.session)
    
    # Save budget recommendation summary
    if result['recommended_quantity'] > 0:
        rec = BudgetPredictionResult(
            budget=budget,
            category=category,
            period_days=period_days,
            recommended_quantity=result['recommended_quantity'],
            estimated_sales=result['estimated_sales'],
            estimated_profit=result['estimated_profit']
        )
        db.session.add(rec)
        db.session.commit()
        
    return jsonify(result), 200

@ml_bp.route('/api/ml/predict-demand', methods=['GET'])
def get_predicted_demand():
    from ml_models import predict_demand
    date_str = request.args.get('date')
    if date_str:
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD.'}), 400
    else:
        target_date = datetime.now()
        
    day_of_week = target_date.weekday()
    month = target_date.month
    
    predicted = predict_demand(day_of_week, month)
    explanation = explain_demand_prediction(target_date.strftime('%Y-%m-%d'), predicted, day_of_week, month)
    fest_name, fest_date, fest_hike = get_festival_for_month(month)
    next_month_num = (month % 12) + 1
    next_fest_name, next_fest_date, next_fest_hike = get_festival_for_month(next_month_num)
    
    return jsonify({
        'date': target_date.strftime('%Y-%m-%d'),
        'day_of_week': day_of_week,
        'month': month,
        'predicted_demand_volume': predicted,
        'explanation': explanation,
        'current_festival': {
            'name': fest_name,
            'date': fest_date,
            'hike': fest_hike
        },
        'next_festival': {
            'name': next_fest_name,
            'date': next_fest_date,
            'hike': next_fest_hike
        }
    }), 200

@ml_bp.route('/api/ml/train', methods=['POST'])
def train_models():
    items = TransactionItem.query.all()
    if len(items) < 10:
        return jsonify({'error': 'Insufficient sales history to train pricing model. Need at least 10 items.'}), 400
        
    pricing_records = []
    for item in items:
        tx = item.transaction
        if tx:
            hour_of_day = tx.timestamp.hour
            day_of_week = tx.timestamp.weekday()
            pricing_records.append({
                'base_cost': item.product.base_cost if item.product else 10.0,
                'stock_level': random.randint(10, 100),
                'hour_of_day': hour_of_day,
                'day_of_week': day_of_week,
                'price_sold': item.price_at_sale
            })
            
    df_pricing = pd.DataFrame(pricing_records)
    
    date_expr_demand = db_strftime('%Y-%m-%d', Transaction.timestamp)
    db_demand = db.session.query(
        date_expr_demand.label('date'),
        func.sum(TransactionItem.quantity).label('total_items_sold')
    ).join(TransactionItem).group_by(date_expr_demand).all()
    
    if len(db_demand) < 5:
        return jsonify({'error': 'Insufficient daily history to train demand model. Need at least 5 days of data.'}), 400
        
    demand_records = []
    for day_str, total_qty in db_demand:
        dt = datetime.strptime(day_str, '%Y-%m-%d')
        demand_records.append({
            'day_of_week': dt.weekday(),
            'month': dt.month,
            'total_items_sold': total_qty
        })
        
    df_demand = pd.DataFrame(demand_records)
    
    train_dynamic_pricing_model(df_pricing)
    train_demand_prediction_model(df_demand)
    
    return jsonify({
        'message': 'Models retrained successfully.',
        'pricing_records_count': len(df_pricing),
        'demand_days_count': len(df_demand)
    }), 200

@ml_bp.route('/api/ml/order-recommendations', methods=['POST'])
def order_recommendations():
    data = request.get_json() or {}
    items = data.get('items', [])
    supplier_name = data.get('supplier_name', 'AI Auto-Supplier')
    
    if not items:
        return jsonify({'error': 'No items to order'}), 400
        
    total_investment = 0.0
    purchase_items = []
    
    for item in items:
        prod_name = item.get('name')
        qty = item.get('suggested_qty', 0)
        cost_unit = item.get('cost_unit', 0.0)
        
        if qty <= 0:
            continue
            
        product = Product.query.filter_by(name=prod_name).first()
        if not product:
            continue
            
        # Restock logic deferred until seller invoice is verified
        # product.stock_level += qty
        # db.session.add(product)
        
        item_total = cost_unit * qty
        total_investment += item_total
        
        p_item = PurchaseItem(
            product_name=prod_name,
            hsn_code=product.hsn_code,
            quantity=qty,
            price_at_purchase=cost_unit,
            gst_rate=product.gst_rate,
            total_amount=round(item_total, 2)
        )
        purchase_items.append(p_item)
        
    if not purchase_items:
        return jsonify({'error': 'No valid products resolved for ordering'}), 400
        
    purchase = Purchase(
        supplier_name=supplier_name,
        supplier_gstin='27ABCDE1234F1Z5',
        invoice_no=f'INV-ML-{random.randint(100000, 999999)}',
        date=datetime.utcnow(),
        total_amount=round(total_investment, 2),
        gst_amount=round(total_investment * 0.18, 2),
        cgst=round(total_investment * 0.09, 2),
        sgst=round(total_investment * 0.09, 2),
        igst=0.0,
        itc_eligible=True,
        payment_status='Pending Receipt'
    )
    db.session.add(purchase)
    db.session.flush()
    
    for p_item in purchase_items:
        p_item.purchase_id = purchase.id
        db.session.add(p_item)
        
    db.session.commit()
    
    return jsonify({
        'message': 'AI purchasing plan ordered! Awaiting delivery and seller bill upload to verify stock receipt.',
        'purchase': purchase.to_dict()
    }), 201

@ml_bp.route('/api/ml/order-history', methods=['GET'])
def get_ml_order_history():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    purchases = Purchase.query.filter(Purchase.invoice_no.like('INV-ML-%')).order_by(Purchase.date.desc()).all()
    result = []
    for p in purchases:
        p_dict = p.to_dict()
        items = PurchaseItem.query.filter_by(purchase_id=p.id).all()
        p_dict['items'] = [i.to_dict() for i in items]
        result.append(p_dict)
    return jsonify(result), 200

@ml_bp.route('/api/ml/reconcile-invoice', methods=['POST'])
def reconcile_invoice():
    import re
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    purchase_id = request.form.get('purchase_id')
    file = request.files.get('file')
    
    if not purchase_id:
        return jsonify({'error': 'Purchase ID required'}), 400
        
    purchase = Purchase.query.get(purchase_id)
    if not purchase:
        return jsonify({'error': 'Purchase not found'}), 404
        
    if not file or not file.filename.endswith('.pdf'):
        return jsonify({'error': 'Valid PDF file required'}), 400
        
    if os.getenv('VERCEL') == '1':
        uploads_dir = '/tmp'
    else:
        uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads', 'bills')
        os.makedirs(uploads_dir, exist_ok=True)
    
    filename = f"bill_{purchase.id}_{int(datetime.utcnow().timestamp())}.pdf"
    file_path = os.path.join(uploads_dir, filename)
    file.save(file_path)
    
    supplier_name, parsed_items = parse_bill_pdf(file_path)
    
    original_items = PurchaseItem.query.filter_by(purchase_id=purchase.id).all()
    mismatches = []
    missing_products = []
    unexpected_products = []
    quantity_differences = []
    price_differences = []
    duplicate_items = []
    
    matched_parsed_indices = set()
    aligned_items = []
    from models import Product
    
    for orig in original_items:
        matched_item = None
        matched_idx = -1
        orig_clean = re.sub(r'[^a-zA-Z0-9]', '', orig.product_name.lower())
        
        for idx, item in enumerate(parsed_items):
            if idx in matched_parsed_indices:
                continue
            p_clean = re.sub(r'[^a-zA-Z0-9]', '', item['product_name'].lower())
            if p_clean in orig_clean or orig_clean in p_clean:
                matched_item = item
                matched_idx = idx
                break
                
        product = Product.query.filter_by(name=orig.product_name).first()
        product_id = product.id if product else None
        
        if matched_item:
            matched_parsed_indices.add(matched_idx)
            qty = matched_item['quantity']
            price = matched_item['price_at_purchase']
            
            # Check quantity
            if qty != orig.quantity:
                mismatches.append({
                    'product_name': orig.product_name,
                    'type': 'Quantity Mismatch',
                    'ordered_qty': orig.quantity,
                    'billed_qty': qty,
                    'difference': qty - orig.quantity
                })
                quantity_differences.append({
                    'product_name': orig.product_name,
                    'ordered_qty': orig.quantity,
                    'billed_qty': qty
                })
                
            # Check price
            if abs(price - orig.price_at_purchase) > 0.01:
                mismatches.append({
                    'product_name': orig.product_name,
                    'type': 'Price Mismatch',
                    'ordered_price': orig.price_at_purchase,
                    'billed_price': price,
                    'difference': round(price - orig.price_at_purchase, 2)
                })
                price_differences.append({
                    'product_name': orig.product_name,
                    'ordered_price': orig.price_at_purchase,
                    'billed_price': price
                })
                
            aligned_items.append({
                'product_name': orig.product_name,
                'product_id': product_id,
                'quantity': qty,
                'price_at_purchase': price,
                'total_amount': round(qty * price, 2)
            })
        else:
            # Missing product
            mismatches.append({
                'product_name': orig.product_name,
                'type': 'Missing Product',
                'ordered_qty': orig.quantity,
                'billed_qty': 0,
                'difference': -orig.quantity
            })
            missing_products.append({
                'product_name': orig.product_name,
                'ordered_qty': orig.quantity,
                'price': orig.price_at_purchase
            })
            aligned_items.append({
                'product_name': orig.product_name,
                'product_id': product_id,
                'quantity': 0,
                'price_at_purchase': orig.price_at_purchase,
                'total_amount': 0.0
            })
            
    # Check for extra/unexpected products
    for idx, item in enumerate(parsed_items):
        if idx not in matched_parsed_indices:
            mismatches.append({
                'product_name': item['product_name'],
                'type': 'Unexpected Product',
                'ordered_qty': 0,
                'billed_qty': item['quantity'],
                'difference': item['quantity']
            })
            unexpected_products.append({
                'product_name': item['product_name'],
                'billed_qty': item['quantity'],
                'billed_price': item['price_at_purchase']
            })
            aligned_items.append({
                'product_name': item['product_name'],
                'product_id': item.get('product_id'),
                'quantity': item['quantity'],
                'price_at_purchase': item['price_at_purchase'],
                'total_amount': round(item['quantity'] * item['price_at_purchase'], 2)
            })

    parsed_items = aligned_items
    if supplier_name == "Unknown Supplier":
        supplier_name = purchase.supplier or "Supplier Inc."
        
    order_total = purchase.total_amount
    bill_total = sum(item['total_amount'] for item in parsed_items)
    total_difference = round(bill_total - order_total, 2)
    
    verification_report = {
        'total_ordered_items': len(original_items),
        'total_verified_items': len(parsed_items) - len(unexpected_products),
        'total_mismatches': len(mismatches),
        'mismatches': mismatches,
        'missing_products': missing_products,
        'unexpected_products': unexpected_products,
        'quantity_differences': quantity_differences,
        'price_differences': price_differences,
        'duplicate_items': duplicate_items,
        'total_difference': total_difference,
        'order_total': order_total,
        'bill_total': bill_total
    }
    
    # If no mismatches/discrepancies, automatically verify!
    if len(mismatches) == 0:
        bill = PurchaseBill(
            purchase_id=purchase.id,
            pdf_path=file_path,
            extracted_json=json.dumps(parsed_items),
            verification_report=json.dumps(verification_report),
            verification_status='Verified',
            supplier=supplier_name,
            approved_by=user.get('username') if user else 'System'
        )
        db.session.add(bill)
        
        for item in parsed_items:
            product = Product.query.filter_by(name=item['product_name']).first()
            if product:
                product.stock_level += item['quantity']
                db.session.add(product)
                
        purchase.verification_status = 'Verified'
        purchase.payment_status = 'Paid'
        purchase.verified_at = datetime.utcnow()
        purchase.verified_by = user.get('username') if user else 'System'
        purchase.discrepancy_count = 0
        db.session.add(purchase)
        db.session.commit()
        
        return jsonify({
            'message': 'Bill verified successfully! All items matched, inventory updated.',
            'purchase_id': purchase.id,
            'status': 'Verified',
            'mismatches': [],
            'invoice_items': parsed_items
        }), 200
        
    else:
        bill = PurchaseBill(
            purchase_id=purchase.id,
            pdf_path=file_path,
            extracted_json=json.dumps(parsed_items),
            verification_report=json.dumps(verification_report),
            verification_status='Discrepancies Detected',
            supplier=supplier_name,
            approved_by=None
        )
        db.session.add(bill)
        db.session.flush()
        
        for mis in mismatches:
            prod = Product.query.filter_by(name=mis['product_name']).first()
            d_type = mis['type']
            
            ordered_q, billed_q = None, None
            ordered_p, billed_p = None, None
            
            if d_type == 'Quantity Mismatch':
                for qd in quantity_differences:
                    if qd['product_name'] == mis['product_name']:
                        ordered_q = qd['ordered_qty']
                        billed_q = qd['billed_qty']
            elif d_type == 'Price Mismatch':
                for pd in price_differences:
                    if pd['product_name'] == mis['product_name']:
                        ordered_p = pd['ordered_price']
                        billed_p = pd['billed_price']
            elif d_type == 'Missing Product':
                for mp in missing_products:
                    if mp['product_name'] == mis['product_name']:
                        ordered_q = mp['ordered_qty']
                        ordered_p = mp['price']
            elif d_type == 'Unexpected Product':
                for up in unexpected_products:
                    if up['product_name'] == mis['product_name']:
                        billed_q = up['billed_qty']
                        billed_p = up['billed_price']
            
            disc = Discrepancy(
                purchase_order_id=purchase.id,
                bill_id=bill.id,
                product_id=prod.id if prod else None,
                discrepancy_type=d_type,
                ordered_quantity=ordered_q,
                billed_quantity=billed_q,
                ordered_price=ordered_p,
                billed_price=billed_p
            )
            db.session.add(disc)
            
        purchase.discrepancy_count = len(mismatches)
        purchase.verification_status = 'Discrepancies Detected'
        db.session.add(purchase)
        db.session.commit()
        
        return jsonify({
            'message': 'Discrepancies detected between ordered and seller invoice.',
            'purchase_id': purchase.id,
            'bill_id': bill.id,
            'status': 'Discrepancies Detected',
            'mismatches': mismatches,
            'invoice_items': parsed_items,
            'verification_report': verification_report
        }), 200

@ml_bp.route('/api/ml/confirm-receipt', methods=['POST'])
def confirm_receipt():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    data = request.get_json() or {}
    purchase_id = data.get('purchase_id')
    bill_id = data.get('bill_id')
    option = data.get('option')
    
    purchase = Purchase.query.get(purchase_id)
    if not purchase:
        return jsonify({'error': 'Purchase not found'}), 404
        
    bill = None
    if bill_id:
        bill = PurchaseBill.query.get(bill_id)
    if not bill:
        bill = PurchaseBill.query.filter_by(purchase_id=purchase.id).order_by(PurchaseBill.upload_date.desc()).first()
        
    if not bill:
        return jsonify({'error': 'Associated purchase bill not found'}), 404
        
    try:
        report = json.loads(bill.verification_report) if bill.verification_report else {}
    except Exception:
        report = {}
        
    try:
        invoice_items = json.loads(bill.extracted_json) if bill.extracted_json else []
    except Exception:
        invoice_items = []
        
    missing_products = report.get('missing_products', [])
    
    if option == 'reorder_missing':
        reorder_purchase = None
        if missing_products:
            reorder_total = sum(item['ordered_qty'] * item['price'] for item in missing_products)
            reorder_purchase = Purchase(
                supplier_name=purchase.supplier_name,
                supplier_gstin=purchase.supplier_gstin,
                invoice_no=f'INV-ML-RE-{random.randint(100000, 999999)}',
                date=datetime.utcnow(),
                total_amount=round(reorder_total, 2),
                gst_amount=round(reorder_total * 0.18, 2),
                cgst=round(reorder_total * 0.09, 2),
                sgst=round(reorder_total * 0.09, 2),
                igst=0.0,
                itc_eligible=True,
                payment_status='Pending Receipt',
                verification_status='Pending Receipt'
            )
            db.session.add(reorder_purchase)
            db.session.flush()
            
            for item in missing_products:
                prod = Product.query.filter_by(name=item['product_name']).first()
                p_item = PurchaseItem(
                    purchase_id=reorder_purchase.id,
                    product_name=item['product_name'],
                    hsn_code=prod.hsn_code if prod else '84733099',
                    quantity=item['ordered_qty'],
                    price_at_purchase=item['price'],
                    gst_rate=prod.gst_rate if prod else 18.0,
                    total_amount=round(item['ordered_qty'] * item['price'], 2)
                )
                db.session.add(p_item)
        
        for item in invoice_items:
            product = Product.query.filter_by(name=item['product_name']).first()
            if product:
                product.stock_level += item['quantity']
                db.session.add(product)
                
        Discrepancy.query.filter_by(bill_id=bill.id).update({
            'resolved': True,
            'resolved_at': datetime.utcnow()
        })
        
        purchase.verification_status = 'Verified'
        purchase.payment_status = 'Paid'
        purchase.verified_at = datetime.utcnow()
        purchase.verified_by = user.get('username') if user else 'System'
        purchase.discrepancy_count = 0
        
        bill.verification_status = 'Verified'
        bill.approved_by = user.get('username') if user else 'System'
        
        db.session.add(purchase)
        db.session.add(bill)
        db.session.commit()
        
        msg = 'Verified items successfully restocked.'
        if reorder_purchase:
            msg += f" Created new purchase order {reorder_purchase.invoice_no} for missing items."
            
        return jsonify({
            'message': msg,
            'reordered': reorder_purchase is not None,
            'reorder_invoice_no': reorder_purchase.invoice_no if reorder_purchase else None
        }), 200
        
    elif option == 'continue_with_bill':
        for item in invoice_items:
            product = Product.query.filter_by(name=item['product_name']).first()
            if product:
                product.stock_level += item['quantity']
                db.session.add(product)
                
        purchase.verification_status = 'Verified with Differences'
        purchase.payment_status = 'Partially Received'
        purchase.verified_at = datetime.utcnow()
        purchase.verified_by = user.get('username') if user else 'System'
        
        bill.verification_status = 'Verified with Differences'
        bill.approved_by = user.get('username') if user else 'System'
        
        db.session.add(purchase)
        db.session.add(bill)
        db.session.commit()
        
        return jsonify({
            'message': 'Restocked based on bill quantities. All discrepancies logged for audit.',
            'reordered': False
        }), 200
        
    else:
        return jsonify({'error': 'Invalid option choice'}), 400

@ml_bp.route('/api/ml/bills', methods=['GET'])
def get_purchase_bills():
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    bills = PurchaseBill.query.order_by(PurchaseBill.upload_date.desc()).all()
    result = []
    for b in bills:
        b_dict = b.to_dict()
        discrepancies = Discrepancy.query.filter_by(bill_id=b.id).all()
        b_dict['discrepancies'] = [d.to_dict() for d in discrepancies]
        b_dict['purchase_invoice_no'] = b.purchase.invoice_no if b.purchase else 'Unknown'
        result.append(b_dict)
        
    return jsonify(result), 200

@ml_bp.route('/api/ml/bills/<int:bill_id>/download', methods=['GET'])
def download_purchase_bill(bill_id):
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    bill = PurchaseBill.query.get(bill_id)
    if not bill or not bill.pdf_path:
        return jsonify({'error': 'Bill not found'}), 404
        
    if os.path.isabs(bill.pdf_path):
        absolute_path = bill.pdf_path
    else:
        absolute_path = os.path.join(os.path.dirname(__file__), bill.pdf_path)
        
    if not os.path.exists(absolute_path):
        return jsonify({'error': 'File not found on disk'}), 404
        
    return send_file(
        absolute_path,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=os.path.basename(bill.pdf_path)
    )

@ml_bp.route('/api/ml/budget-recommendation/pdf', methods=['POST'])
def export_budget_pdf():
    from pdf_generator import generate_purchasing_plan_pdf
    budget_result = request.get_json() or {}
    pdf_buffer = generate_purchasing_plan_pdf(budget_result)
    return send_file(
        pdf_buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name='ai_purchasing_recommendations.pdf'
    )


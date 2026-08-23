from flask import Blueprint, request, jsonify, current_app as app, send_file
from models import db, Order, Transaction, TransactionItem, ReturnLog, OrderItem, Product, User, OfflineTransaction, OfflineTransactionLog
from sqlalchemy import func
from datetime import datetime, timedelta
from extensions import dashboard_cache
from routes.auth import get_current_user

orders_bp = Blueprint("orders", __name__)

def require_admin(payload):
    return payload and payload.get("role") == "admin"

def send_socket_message(event, message, data=None):
    pass

@orders_bp.route('/api/checkout', methods=['POST'])
def checkout():
    from ml_models import predict_dynamic_price
    data = request.get_json() or {}
    items_to_checkout = data.get('items', [])
    uuid_val = data.get('uuid')
    pay_method = data.get('payment_method', 'Cash')
    cust_name = data.get('customer_name', 'Counter Customer')
    notes_val = data.get('notes', None)
    cashier_val = data.get('cashier', 'Admin')
    force_sync = data.get('force', False)
    
    # 1. Idempotency Check
    if uuid_val:
        existing_tx = Transaction.query.filter_by(uuid=uuid_val).first()
        if existing_tx:
            # Deduplicated: return existing transaction details
            return jsonify(existing_tx.to_dict()), 200

    if not items_to_checkout:
        return jsonify({'error': 'No items in checkout request'}), 400
        
    now = datetime.now()
    hour_of_day = now.hour
    day_of_week = now.weekday()
    
    total_amount = 0.0
    products_updates = []
    
    # Resolve all products first
    resolved_products = []
    for item in items_to_checkout:
        prod_id = item.get('product_id')
        barcode_val = item.get('barcode')
        qty = item.get('quantity')
        
        if not qty or qty <= 0:
            return jsonify({'error': f'Invalid quantity: {item}'}), 400
            
        product = None
        if prod_id:
            product = Product.query.get(prod_id)
        elif barcode_val:
            product = Product.query.filter_by(barcode=barcode_val).first()
            
        if not product:
            return jsonify({'error': f'Product not found (ID: {prod_id}, Barcode: {barcode_val})'}), 404
            
        if product.stock_level < qty and not force_sync:
            return jsonify({
                'error': f'Insufficient stock for {product.name}. Available: {product.stock_level}',
                'conflict': True,
                'product_id': product.id,
                'available_stock': product.stock_level
            }), 409
        resolved_products.append((product, qty))
    
    # Batch fetch all sales counts in a single query instead of N+1
    product_categories = list(set([p.category for p, _ in resolved_products]))
    sales_counts_rows = db.session.query(
        Product.category,
        func.sum(TransactionItem.quantity)
    ).join(TransactionItem, Product.id == TransactionItem.product_id).filter(Product.category.in_(product_categories)).group_by(Product.category).all()
    sales_count_map = {row[0]: int(row[1] or 0) for row in sales_counts_rows}
    
    for product, qty in resolved_products:
        sales_count = sales_count_map.get(product.category, 0)
        price_at_sale = predict_dynamic_price(
            base_cost=product.base_cost,
            stock_level=product.stock_level,
            hour_of_day=hour_of_day,
            day_of_week=day_of_week,
            sales_count=sales_count
        )
        product.current_price = price_at_sale
        
        total_amount += price_at_sale * qty
        products_updates.append((product, qty, price_at_sale))
    db_transaction = Transaction(
        timestamp=datetime.utcnow(),
        total_amount=round(total_amount, 2),
        uuid=uuid_val,
        payment_method=pay_method,
        customer_name=cust_name,
        notes=notes_val,
        cashier=cashier_val
    )
    db.session.add(db_transaction)
    
    # Create corresponding Order for Manage Orders with 'offline' tag
    db_order = Order(
        customer_name=cust_name,
        email='pos@store.com',
        phone='0000000000',
        address='In-Store Counter',
        timestamp=datetime.utcnow(),
        total_amount=round(total_amount, 2),
        status='Delivered', # Immediately Completed
        sale_type='offline'
    )
    db.session.add(db_order)
    db.session.flush()
    
    for product, qty, price_at_sale in products_updates:
        product.stock_level -= qty
        
        tx_item = TransactionItem(
            transaction_id=db_transaction.id,
            product_id=product.id,
            quantity=qty,
            price_at_sale=price_at_sale
        )
        db.session.add(tx_item)
        
        order_item = OrderItem(
            order_id=db_order.id,
            product_id=product.id,
            quantity=qty,
            price_at_sale=price_at_sale
        )
        db.session.add(order_item)
        
    db.session.commit()

    # Emit socket event so Manage Orders updates in real-time
    try:
        pass
    except Exception as e:
        print("Socket emission error:", str(e))

    return jsonify(db_transaction.to_dict()), 201

@orders_bp.route('/api/transactions', methods=['GET'])
def get_transactions():
    page = request.args.get('page', type=int)
    limit = request.args.get('limit', 100, type=int)
    query = Transaction.query.order_by(Transaction.timestamp.desc())
    if page:
        total = query.count()
        txs = query.limit(limit).offset((page - 1) * limit).all()
        return jsonify({'transactions': [tx.to_dict() for tx in txs], 'total': total, 'page': page, 'limit': limit}), 200
    txs = query.limit(limit).all()
    return jsonify([tx.to_dict() for tx in txs]), 200

@orders_bp.route('/api/returns', methods=['POST'])
def process_return():
    data = request.get_json() or {}
    transaction_id = data.get('transaction_id')
    product_id = data.get('product_id')
    qty_to_return = data.get('quantity')
    reason = data.get('reason', 'Customer Return')

    if not transaction_id or not product_id or not qty_to_return or qty_to_return <= 0:
        return jsonify({'error': 'Invalid request parameters'}), 400

    transaction = Transaction.query.get(transaction_id)
    if not transaction:
        return jsonify({'error': 'Transaction not found'}), 404

    tx_item = TransactionItem.query.filter_by(transaction_id=transaction_id, product_id=product_id).first()
    if not tx_item:
        return jsonify({'error': 'Product not found in this transaction'}), 404

    # Calculate already returned quantity from ReturnLogs
    already_returned = db.session.query(func.sum(ReturnLog.quantity)).filter(
        ReturnLog.transaction_id == transaction_id, 
        ReturnLog.product_id == product_id
    ).scalar() or 0

    available_to_return = tx_item.quantity

    if qty_to_return > available_to_return:
        return jsonify({'error': f'Cannot return {qty_to_return} items. Only {available_to_return} items available to return.'}), 400

    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found in database'}), 404

    refund_amount = round(tx_item.price_at_sale * qty_to_return, 2)

    # Create Return Log
    return_log = ReturnLog(
        transaction_id=transaction_id,
        product_id=product_id,
        quantity=qty_to_return,
        refund_amount=refund_amount,
        reason=reason,
        timestamp=datetime.utcnow()
    )
    db.session.add(return_log)

    # Restock product
    product.stock_level += qty_to_return

    # Deduct transaction financials
    tx_item.quantity -= qty_to_return
    transaction.total_amount = round(max(0.0, transaction.total_amount - refund_amount), 2)

    # If quantity is now 0, optionally keep the item or remove it.
    # We keep the item with 0 quantity so that it is clear it was returned.
    # If the total amount is 0, we can also set it to 0.

    db.session.commit()

    return jsonify({
        'message': 'Return processed successfully',
        'return_log': return_log.to_dict(),
        'transaction': transaction.to_dict()
    }), 200

@orders_bp.route('/api/returns', methods=['GET'])
def get_returns():
    user_payload = get_current_user()
    if user_payload:
        if user_payload.get('role') == 'admin':
            returns = ReturnLog.query.order_by(ReturnLog.timestamp.desc()).all()
        else:
            user_order_ids = [o.id for o in Order.query.filter_by(user_id=user_payload['user_id']).all()]
            if user_order_ids:
                returns = ReturnLog.query.filter(ReturnLog.order_id.in_(user_order_ids)).order_by(ReturnLog.timestamp.desc()).all()
            else:
                returns = []
    else:
        returns = ReturnLog.query.order_by(ReturnLog.timestamp.desc()).all()
    return jsonify([ret.to_dict() for ret in returns]), 200

@orders_bp.route('/api/transactions/<int:transaction_id>/invoice', methods=['GET'])
def get_invoice(transaction_id):
    from pdf_generator import generate_invoice_pdf
    transaction = Transaction.query.get(transaction_id)
    if not transaction:
        return jsonify({'error': 'Transaction not found'}), 404
        
    pdf_buffer = generate_invoice_pdf(transaction)
    return send_file(
        pdf_buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'invoice_{transaction_id}.pdf'
    )

@orders_bp.route('/api/orders/<int:order_id>/invoice', methods=['GET'])
def get_order_invoice(order_id):
    from pdf_generator import generate_invoice_pdf
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
        
    pdf_buffer = generate_invoice_pdf(order)
    return send_file(
        pdf_buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'invoice_order_{order_id}.pdf'
    )

@orders_bp.route('/api/orders', methods=['GET'])
def get_orders():
    search = request.args.get('search')
    status = request.args.get('status')
    sort_by = request.args.get('sort_by', 'date_desc')
    sale_type = request.args.get('sale_type')
    
    user_payload = get_current_user()
    query = Order.query
    if user_payload and user_payload.get('role') == 'customer':
        query = query.filter_by(user_id=user_payload['user_id'])
        
    if search:
        query = query.filter(
            (Order.customer_name.like(f'%{search}%')) | 
            (Order.email.like(f'%{search}%')) |
            (Order.id.like(f'%{search}%'))
        )
        
    if status and status != 'All':
        query = query.filter_by(status=status)
        
    if sale_type and sale_type != 'All':
        query = query.filter_by(sale_type=sale_type)

    page = request.args.get('page', type=int)
    limit = request.args.get('limit', type=int)

    if sort_by == 'date_desc':
        query = query.order_by(Order.id.desc())
    elif sort_by == 'date_asc':
        query = query.order_by(Order.id.asc())
    elif sort_by == 'customer':
        query = query.order_by(Order.customer_name.asc())
    elif sort_by == 'status':
        query = query.order_by(Order.status.asc())
    elif sort_by == 'total':
        query = query.order_by(Order.total_amount.desc())
        
    if page is not None or limit is not None:
        p = page or 1
        l = limit or 100
        total_count = query.count()
        query = query.limit(l).offset((p - 1) * l)
        orders = query.all()
        return jsonify({
            'orders': [o.to_dict() for o in orders],
            'total_count': total_count,
            'page': p,
            'limit': l
        }), 200
    else:
        orders = query.all()
        return jsonify([o.to_dict() for o in orders]), 200

@orders_bp.route('/api/orders', methods=['POST'])
def create_order():
    from ml_models import predict_dynamic_price
    user_payload = get_current_user()
    if not user_payload:
        return jsonify({'error': 'Authentication required. Please log in to place an order.'}), 401
        
    user = User.query.get(user_payload['user_id'])
    if not user:
        app.logger.warning(f"[ORDER CREATION] User not found for user_id={user_payload.get('user_id')}")
        return jsonify({'success': False, 'error': 'User profile not found.'}), 404
        
    if not user.is_verified:
        app.logger.warning(f"[ORDER CREATION DENIED] Unverified email for user_id={user.id}, email={user.email}")
        return jsonify({
            'success': False,
            'error': 'Email verification is required to place an order. Please verify your email first.',
            'unverified': True,
            'email': user.email
        }), 403
    
    data = request.get_json() or {}
    customer_name = data.get('customer_name')
    email = data.get('email')
    phone = data.get('phone')
    address = data.get('address')
    items_to_order = data.get('items', [])
    
    if not all([customer_name, email, phone, address, items_to_order]):
        return jsonify({'error': 'Missing required checkout details'}), 400
        
    now = datetime.now()
    hour_of_day = now.hour
    day_of_week = now.weekday()
    
    total_amount = 0.0
    products_updates = []
    
    # Resolve and validate all products first
    resolved_products = []
    for item in items_to_order:
        prod_id = item.get('product_id')
        qty = item.get('quantity')
        
        if not prod_id or not qty or qty <= 0:
            return jsonify({'error': f'Invalid product_id or quantity: {item}'}), 400
            
        product = Product.query.get(prod_id)
        if not product:
            return jsonify({'error': f'Product with ID {prod_id} not found'}), 404
        if product.stock_level < qty:
            return jsonify({'error': f'Insufficient stock for {product.name}. Available: {product.stock_level}'}), 400
        resolved_products.append((product, qty))
    
    # Batch fetch all sales counts in a single query
    product_categories = list(set([p.category for p, _ in resolved_products]))
    sales_counts_rows = db.session.query(
        Product.category,
        func.sum(TransactionItem.quantity)
    ).join(TransactionItem, Product.id == TransactionItem.product_id).filter(Product.category.in_(product_categories)).group_by(Product.category).all()
    sales_count_map = {row[0]: int(row[1] or 0) for row in sales_counts_rows}
    
    for product, qty in resolved_products:
        sales_count = sales_count_map.get(product.category, 0)
        price_at_sale = predict_dynamic_price(
            base_cost=product.base_cost,
            stock_level=product.stock_level,
            hour_of_day=hour_of_day,
            day_of_week=day_of_week,
            sales_count=sales_count
        )
        product.current_price = price_at_sale
        
        total_amount += price_at_sale * qty
        products_updates.append((product, qty, price_at_sale))
        
    db_order = Order(
        user_id=user_payload['user_id'] if user_payload else None,
        customer_name=customer_name,
        email=email,
        phone=phone,
        address=address,
        timestamp=datetime.utcnow(),
        total_amount=round(total_amount, 2),
        status='Pending',
        sale_type='online'
    )
    db.session.add(db_order)
    db.session.flush()
    
    items_summary = ""
    for product, qty, price_at_sale in products_updates:
        product.stock_level -= qty
        
        order_item = OrderItem(
            order_id=db_order.id,
            product_id=product.id,
            quantity=qty,
            price_at_sale=price_at_sale
        )
        db.session.add(order_item)
        items_summary += f"  - {product.name} (Qty: {qty}) @ INR {price_at_sale} each\n"
        
    db.session.commit()
    
    # Send email notification to owner asynchronously
    try:
        from app import send_order_email_notification
        send_order_email_notification(
            order_id=db_order.id,
            customer_name=customer_name,
            email=email,
            phone=phone,
            address=address,
            items_summary=items_summary,
            total_amount=round(total_amount, 2)
        )
    except Exception as e:
        app.logger.error(f"Failed to send email notification: {e}")
    
    # Emit dynamic socket event for real-time dashboard updates
    try:
        pass
    except Exception as e:
        print("WebSocket emit failed:", str(e))
        
    return jsonify(db_order.to_dict()), 201

@orders_bp.route('/api/orders/<int:order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    user = get_current_user()
    if not require_admin(user):
        return jsonify({'error': 'Access denied'}), 403
        
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
        
    data = request.get_json() or {}
    status = data.get('status')
    valid_statuses = ('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Replacement Requested', 'Returned', 'Replaced', 'Partially Returned')
    if status not in valid_statuses:
        return jsonify({'error': f'Invalid status: {status}'}), 400
        
    order.status = status
    db.session.commit()

    # Emit socket update for real-time status sync across portals
    try:
        pass
    except Exception as e:
        print("WebSocket status emit error:", e)

    return jsonify(order.to_dict()), 200

@orders_bp.route('/api/orders/<int:order_id>/return-request', methods=['POST'])
def create_return_request(order_id):
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    if order.status != 'Delivered':
        return jsonify({'error': f'Only delivered orders can be returned or replaced. Current status: {order.status}'}), 400

    data = request.get_json() or {}
    return_type = data.get('return_type', 'Return') # 'Return' or 'Replacement'
    reason = data.get('reason', 'Defective or incorrect item').strip()
    product_id = data.get('product_id') # Optional specific product ID

    if return_type not in ('Return', 'Replacement'):
        return_type = 'Return'

    new_status = 'Return Requested' if return_type == 'Return' else 'Replacement Requested'
    order.status = new_status

    # Create ReturnLog record
    return_entry = ReturnLog(
        order_id=order.id,
        product_id=product_id if product_id else (order.items[0].product_id if order.items else None),
        quantity=1,
        refund_amount=order.total_amount if return_type == 'Return' else 0.0,
        reason=reason,
        return_type=return_type,
        status='Pending'
    )
    db.session.add(return_entry)
    db.session.commit()

    # Real-time WebSocket event dispatch for both customer and owner portals
    try:
        pass
        pass
    except Exception as e:
        print("WebSocket return emit error:", e)

    return jsonify({
        'message': f'{return_type} request submitted successfully.',
        'order': order.to_dict(),
        'return_log': return_entry.to_dict()
    }), 200

@orders_bp.route('/api/orders/<int:order_id>', methods=['GET'])
def get_order_by_id(order_id):
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    return jsonify(order.to_dict()), 200

@orders_bp.route('/api/orders/track', methods=['GET'])
def track_orders():
    phone = request.args.get('phone')
    email = request.args.get('email')
    
    if not phone and not email:
        return jsonify({'error': 'Please provide email or phone number for tracking'}), 400
        
    query = Order.query
    if phone:
        query = query.filter_by(phone=phone)
    if email:
        query = query.filter_by(email=email)
        
    orders = query.order_by(Order.timestamp.desc()).all()
    return jsonify([o.to_dict() for o in orders]), 200

@orders_bp.route('/api/returns/request', methods=['POST'])
def request_return():
    user_payload = get_current_user()
    if not user_payload:
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.get_json() or {}
    order_id = data.get('order_id')
    product_id = data.get('product_id')
    qty_to_return = data.get('quantity')
    reason = data.get('reason', 'Customer Return')
    
    if not order_id or not product_id or not qty_to_return or qty_to_return <= 0:
        return jsonify({'error': 'Invalid request parameters'}), 400
        
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
        
    # Verify order ownership
    if order.user_id != user_payload['user_id'] and order.email.strip().lower() != user_payload.get('username', '').strip().lower():
        return jsonify({'error': 'Access denied'}), 403
        
    if order.status.lower() != 'delivered':
        return jsonify({'error': 'Only delivered orders are eligible for return.'}), 400
        
    if datetime.utcnow() - order.timestamp > timedelta(days=7):
        return jsonify({'error': 'Return window (7 days) has expired.'}), 400
        
    order_item = OrderItem.query.filter_by(order_id=order_id, product_id=product_id).first()
    if not order_item:
        return jsonify({'error': 'Product not found in this order'}), 404
        
    already_returned = db.session.query(func.sum(ReturnLog.quantity)).filter(
        ReturnLog.order_id == order_id, 
        ReturnLog.product_id == product_id
    ).scalar() or 0
    
    available_to_return = order_item.quantity - already_returned
    
    if qty_to_return > available_to_return:
        return jsonify({'error': f'Cannot return {qty_to_return} items. Only {available_to_return} items available to return.'}), 400
        
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found in database'}), 404
        
    refund_amount = round(order_item.price_at_sale * qty_to_return, 2)
    
    return_log = ReturnLog(
        order_id=order_id,
        transaction_id=None,
        product_id=product_id,
        quantity=qty_to_return,
        refund_amount=refund_amount,
        reason=reason,
        timestamp=datetime.utcnow()
    )
    db.session.add(return_log)
    
    product.stock_level += qty_to_return
    order.total_amount = round(max(0.0, order.total_amount - refund_amount), 2)
    
    total_ordered_qty = db.session.query(func.sum(OrderItem.quantity)).filter(OrderItem.order_id == order_id).scalar() or 0
    total_returned_qty = (db.session.query(func.sum(ReturnLog.quantity)).filter(ReturnLog.order_id == order_id).scalar() or 0) + qty_to_return
    
    if total_returned_qty >= total_ordered_qty:
        order.status = 'Returned'
    else:
        order.status = 'Partially Returned'
        
    db.session.commit()
    
    return jsonify({
        'message': 'Return request submitted successfully',
        'return_log': return_log.to_dict(),
        'order': order.to_dict()
    }), 201

@orders_bp.route('/api/checkout/offline', methods=['POST'])
def checkout_offline():
    """
    Endpoint specifically for offline POS sync.
    Writes to Supabase (fast), then processes in Neon (source of truth).
    """
    data = request.get_json()
    cart = data.get('items', []) # 'items' from POS.jsx payload
    pos_device_id = data.get('pos_device_id', 'unknown')
    
    # ── Step 1: Fast write to Supabase (sync buffer) ──
    offline_tx = OfflineTransaction(
        pos_device_id=pos_device_id,
        transaction_data=data,
        sync_status='pending'
    )
    db.session.add(offline_tx)
    # Note: We need to specify the bind for commit. Wait, standard db.session.commit() commits all binds.
    db.session.commit()
    
    # ── Step 2: Process in Neon (source of truth) ──
    try:
        from ml_models import predict_dynamic_price
        now = datetime.now()
        hour_of_day = now.hour
        day_of_week = now.weekday()
        
        # Create transaction in Neon
        transaction = Transaction(
            total_amount=data.get('total_amount', sum(item.get('price_at_sale', 0) * item.get('quantity', 0) for item in cart)),
            uuid=data.get('uuid'),
            payment_method=data.get('payment_method', 'Cash'),
            customer_name=data.get('customer_name', 'Counter Customer'),
            notes=data.get('notes'),
            cashier=data.get('cashier', 'Admin')
        )
        db.session.add(transaction)
        
        # Create corresponding Order for Manage Orders with 'offline' tag
        db_order = Order(
            customer_name=transaction.customer_name,
            email='pos@store.com',
            phone='0000000000',
            address='In-Store Counter',
            timestamp=datetime.utcnow(),
            total_amount=transaction.total_amount,
            status='Delivered', # Immediately Completed
            sale_type='offline'
        )
        db.session.add(db_order)
        db.session.flush()  # Get transaction.id without committing
        
        # Deduct stock and create items
        for item in cart:
            product = Product.query.get(item['product_id'])
            if not product or product.stock_level < item['quantity']:
                raise ValueError(f"Insufficient stock for {item.get('product_id')}")
            
            product.stock_level -= item['quantity']
            tx_item = TransactionItem(
                transaction_id=transaction.id,
                product_id=item['product_id'],
                quantity=item['quantity'],
                price_at_sale=item.get('price_at_sale', 0)
            )
            db.session.add(tx_item)
            order_item = OrderItem(
                order_id=db_order.id,
                product_id=product.id,
                quantity=item['quantity'],
                price_at_sale=item.get('price_at_sale', 0)
            )
            db.session.add(order_item)
        
        db.session.commit()  # This goes to Neon (default bind)
        
        # ── Step 3: Update Supabase with success ──
        offline_tx.sync_status = 'synced'
        offline_tx.neon_transaction_id = transaction.id
        db.session.add(offline_tx)
        db.session.commit()  # Supabase bind
        
        return jsonify({
            'success': True,
            'id': transaction.id,
            'offline_sync_id': offline_tx.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        
        # Log failure in Supabase
        offline_tx.sync_status = 'failed'
        db.session.add(offline_tx)
        db.session.commit()
        
        # Add error log
        error_log = OfflineTransactionLog(
            offline_transaction_id=offline_tx.id,
            event='error',
            message=str(e)
        )
        db.session.add(error_log)
        db.session.commit()
        
        return jsonify({'success': False, 'error': str(e), 'conflict': 'Insufficient' in str(e)}), 409 if 'Insufficient' in str(e) else 500

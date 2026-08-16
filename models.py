from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='customer', nullable=False) # 'customer' or 'admin'
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    verification_token = db.Column(db.String(255), nullable=True)
    
    orders = db.relationship('Order', backref='user', lazy='selectin')

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'is_verified': self.is_verified
        }

class Product(db.Model):
    __tablename__ = 'products'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    base_cost = db.Column(db.Float, nullable=False)
    current_price = db.Column(db.Float, nullable=False)
    stock_level = db.Column(db.Integer, nullable=False)
    hsn_code = db.Column(db.String(20), nullable=True)
    gst_rate = db.Column(db.Float, default=18.0)
    image_url = db.Column(db.String(500), nullable=True)
    barcode = db.Column(db.String(50), unique=True, nullable=True)
    description = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'base_cost': self.base_cost,
            'current_price': self.current_price,
            'stock_level': self.stock_level,
            'hsn_code': self.hsn_code,
            'gst_rate': self.gst_rate,
            'image_url': self.image_url,
            'barcode': self.barcode,
            'description': self.description,
            'updated_at': self.updated_at.isoformat()
        }

class Transaction(db.Model):
    __tablename__ = 'transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    total_amount = db.Column(db.Float, nullable=False)
    uuid = db.Column(db.String(36), unique=True, nullable=True)
    payment_method = db.Column(db.String(50), default='Cash', nullable=False)
    customer_name = db.Column(db.String(100), default='Counter Customer', nullable=True)
    notes = db.Column(db.Text, nullable=True)
    cashier = db.Column(db.String(80), default='Admin', nullable=True)
    
    items = db.relationship('TransactionItem', backref='transaction', lazy='selectin', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat() + 'Z',
            'total_amount': self.total_amount,
            'uuid': self.uuid,
            'payment_method': self.payment_method,
            'customer_name': self.customer_name,
            'notes': self.notes,
            'cashier': self.cashier,
            'items': [item.to_dict() for item in self.items]
        }

class TransactionItem(db.Model):
    __tablename__ = 'transaction_items'
    
    id = db.Column(db.Integer, primary_key=True)
    transaction_id = db.Column(db.Integer, db.ForeignKey('transactions.id'), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False, index=True)
    quantity = db.Column(db.Integer, nullable=False)
    price_at_sale = db.Column(db.Float, nullable=False)

    product = db.relationship('Product', lazy='selectin')

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else 'Unknown Product',
            'quantity': self.quantity,
            'price_at_sale': self.price_at_sale,
            'total_item_price': round(self.quantity * self.price_at_sale, 2),
            'hsn_code': self.product.hsn_code if (self.product and self.product.hsn_code) else '84733099',
            'gst_rate': self.product.gst_rate if self.product else 18.0
        }

class Order(db.Model):
    __tablename__ = 'orders'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    customer_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    address = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    status = db.Column(db.String(50), default='Pending', nullable=False, index=True)
    total_amount = db.Column(db.Float, nullable=False)
    sale_type = db.Column(db.String(20), default='online', nullable=False) # 'online' or 'offline'
    
    items = db.relationship('OrderItem', backref='order', lazy='selectin', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'customer_name': self.customer_name,
            'email': self.email,
            'phone': self.phone,
            'address': self.address,
            'timestamp': self.timestamp.isoformat() + 'Z',
            'status': self.status,
            'total_amount': self.total_amount,
            'sale_type': self.sale_type,
            'items': [item.to_dict() for item in self.items]
        }

class OrderItem(db.Model):
    __tablename__ = 'order_items'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False, index=True)
    quantity = db.Column(db.Integer, nullable=False)
    price_at_sale = db.Column(db.Float, nullable=False)

    product = db.relationship('Product', lazy='selectin')

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else 'Unknown Product',
            'quantity': self.quantity,
            'price_at_sale': self.price_at_sale,
            'total_item_price': round(self.quantity * self.price_at_sale, 2),
            'hsn_code': self.product.hsn_code if (self.product and self.product.hsn_code) else '84733099',
            'gst_rate': self.product.gst_rate if self.product else 18.0
        }

class DynamicPricingPrediction(db.Model):
    __tablename__ = 'dynamic_pricing_predictions'
    
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    base_cost = db.Column(db.Float, nullable=False)
    stock_level = db.Column(db.Integer, nullable=False)
    suggested_price = db.Column(db.Float, nullable=False)
    current_price = db.Column(db.Float, nullable=False)
    expected_profit = db.Column(db.Float, nullable=False)
    recommendation_reason = db.Column(db.String(255), nullable=False)

    product = db.relationship('Product')

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else 'Unknown Product',
            'timestamp': self.timestamp.isoformat(),
            'base_cost': self.base_cost,
            'stock_level': self.stock_level,
            'suggested_price': self.suggested_price,
            'current_price': self.current_price,
            'expected_profit': self.expected_profit,
            'recommendation_reason': self.recommendation_reason
        }

class BudgetPredictionResult(db.Model):
    __tablename__ = 'budget_prediction_results'
    
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    budget = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    period_days = db.Column(db.Integer, nullable=False)
    recommended_quantity = db.Column(db.Integer, nullable=False)
    estimated_sales = db.Column(db.Float, nullable=False)
    estimated_profit = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat(),
            'budget': self.budget,
            'category': self.category,
            'period_days': self.period_days,
            'recommended_quantity': self.recommended_quantity,
            'estimated_sales': self.estimated_sales,
            'estimated_profit': self.estimated_profit
        }

class Review(db.Model):
    __tablename__ = 'reviews'
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    username = db.Column(db.String(80), nullable=False, default='Anonymous')
    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    product = db.relationship('Product', backref=db.backref('reviews', lazy='selectin', cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else 'Unknown Product',
            'user_id': self.user_id,
            'username': self.username,
            'rating': self.rating,
            'comment': self.comment,
            'timestamp': self.timestamp.isoformat() + 'Z'
        }

class Wishlist(db.Model):
    __tablename__ = 'wishlists'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    product = db.relationship('Product')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'product_id': self.product_id,
            'product': self.product.to_dict() if self.product else None,
            'timestamp': self.timestamp.isoformat() + 'Z'
        }

class AddressBook(db.Model):
    __tablename__ = 'address_book'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    address_line = db.Column(db.Text, nullable=False)
    city = db.Column(db.String(50), nullable=False)
    pincode = db.Column(db.String(10), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'phone': self.phone,
            'address_line': self.address_line,
            'city': self.city,
            'pincode': self.pincode
        }

class BusinessConfig(db.Model):
    __tablename__ = 'business_config'
    id = db.Column(db.Integer, primary_key=True)
    business_name = db.Column(db.String(100), nullable=False)
    gstin = db.Column(db.String(50), nullable=False)
    pan = db.Column(db.String(10), nullable=False)
    state = db.Column(db.String(50), nullable=False)
    address = db.Column(db.Text, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'business_name': self.business_name,
            'gstin': self.gstin,
            'pan': self.pan,
            'state': self.state,
            'address': self.address
        }

class Purchase(db.Model):
    __tablename__ = 'purchases'
    id = db.Column(db.Integer, primary_key=True)
    supplier_name = db.Column(db.String(100), nullable=False)
    supplier_gstin = db.Column(db.String(50), nullable=True)
    invoice_no = db.Column(db.String(50), nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    total_amount = db.Column(db.Float, nullable=False)
    gst_amount = db.Column(db.Float, default=0.0)
    cgst = db.Column(db.Float, default=0.0)
    sgst = db.Column(db.Float, default=0.0)
    igst = db.Column(db.Float, default=0.0)
    itc_eligible = db.Column(db.Boolean, default=True)
    payment_status = db.Column(db.String(20), default='Paid', nullable=False) # 'Paid' or 'Pending'
    
    # New verification fields
    verification_status = db.Column(db.String(30), default='Pending Receipt', nullable=False)
    verified_at = db.Column(db.DateTime, nullable=True)
    verified_by = db.Column(db.String(80), nullable=True)
    discrepancy_count = db.Column(db.Integer, default=0, nullable=False)

    items = db.relationship('PurchaseItem', backref='purchase', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'supplier_name': self.supplier_name,
            'supplier_gstin': self.supplier_gstin,
            'invoice_no': self.invoice_no,
            'date': self.date.isoformat(),
            'total_amount': self.total_amount,
            'gst_amount': self.gst_amount,
            'cgst': self.cgst,
            'sgst': self.sgst,
            'igst': self.igst,
            'itc_eligible': self.itc_eligible,
            'payment_status': self.payment_status,
            'verification_status': self.verification_status,
            'verified_at': self.verified_at.isoformat() if self.verified_at else None,
            'verified_by': self.verified_by,
            'discrepancy_count': self.discrepancy_count,
            'items': [item.to_dict() for item in self.items]
        }

class PurchaseItem(db.Model):
    __tablename__ = 'purchase_items'
    id = db.Column(db.Integer, primary_key=True)
    purchase_id = db.Column(db.Integer, db.ForeignKey('purchases.id'), nullable=False)
    product_name = db.Column(db.String(100), nullable=False)
    hsn_code = db.Column(db.String(20), nullable=True)
    quantity = db.Column(db.Integer, nullable=False)
    price_at_purchase = db.Column(db.Float, nullable=False)
    gst_rate = db.Column(db.Float, default=18.0)
    total_amount = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'purchase_id': self.purchase_id,
            'product_name': self.product_name,
            'hsn_code': self.hsn_code,
            'quantity': self.quantity,
            'price_at_purchase': self.price_at_purchase,
            'gst_rate': self.gst_rate,
            'total_amount': self.total_amount
        }

class PurchaseBill(db.Model):
    __tablename__ = 'purchase_bills'
    id = db.Column(db.Integer, primary_key=True)
    purchase_id = db.Column(db.Integer, db.ForeignKey('purchases.id'), nullable=False)
    pdf_path = db.Column(db.String(255), nullable=True)
    extracted_json = db.Column(db.Text, nullable=True)  # Store JSON representation as text
    verification_report = db.Column(db.Text, nullable=True)  # Store report JSON
    verification_status = db.Column(db.String(30), default='Unverified', nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    supplier = db.Column(db.String(100), nullable=False)
    approved_by = db.Column(db.String(80), nullable=True)

    purchase = db.relationship('Purchase', backref=db.backref('bills', lazy=True, cascade="all, delete-orphan"))

    def to_dict(self):
        import json
        extracted_data = {}
        try:
            if self.extracted_json:
                extracted_data = json.loads(self.extracted_json)
        except Exception:
            pass
            
        report_data = {}
        try:
            if self.verification_report:
                report_data = json.loads(self.verification_report)
        except Exception:
            pass

        return {
            'id': self.id,
            'purchase_id': self.purchase_id,
            'pdf_path': self.pdf_path,
            'extracted_json': extracted_data,
            'verification_report': report_data,
            'verification_status': self.verification_status,
            'upload_date': self.upload_date.isoformat(),
            'supplier': self.supplier,
            'approved_by': self.approved_by
        }

class Discrepancy(db.Model):
    __tablename__ = 'discrepancies'
    id = db.Column(db.Integer, primary_key=True)
    purchase_order_id = db.Column(db.Integer, db.ForeignKey('purchases.id'), nullable=False)
    bill_id = db.Column(db.Integer, db.ForeignKey('purchase_bills.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    discrepancy_type = db.Column(db.String(50), nullable=False) # 'Missing Product', 'Unexpected Product', 'Quantity Mismatch', 'Price Mismatch', 'Duplicate Item'
    ordered_quantity = db.Column(db.Integer, nullable=True)
    billed_quantity = db.Column(db.Integer, nullable=True)
    ordered_price = db.Column(db.Float, nullable=True)
    billed_price = db.Column(db.Float, nullable=True)
    resolved = db.Column(db.Boolean, default=False, nullable=False)
    resolved_at = db.Column(db.DateTime, nullable=True)

    product = db.relationship('Product')

    def to_dict(self):
        return {
            'id': self.id,
            'purchase_order_id': self.purchase_order_id,
            'bill_id': self.bill_id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else 'Unknown Product',
            'discrepancy_type': self.discrepancy_type,
            'ordered_quantity': self.ordered_quantity,
            'billed_quantity': self.billed_quantity,
            'ordered_price': self.ordered_price,
            'billed_price': self.billed_price,
            'resolved': self.resolved,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None
        }


class Expense(db.Model):
    __tablename__ = 'expenses'
    id = db.Column(db.Integer, primary_key=True)
    merchant_name = db.Column(db.String(100), nullable=False)
    merchant_gstin = db.Column(db.String(50), nullable=True)
    invoice_no = db.Column(db.String(50), nullable=True)
    date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    category = db.Column(db.String(50), nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    gst_rate = db.Column(db.Float, default=0.0)
    gst_amount = db.Column(db.Float, default=0.0)
    cgst = db.Column(db.Float, default=0.0)
    sgst = db.Column(db.Float, default=0.0)
    igst = db.Column(db.Float, default=0.0)
    itc_eligible = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'merchant_name': self.merchant_name,
            'merchant_gstin': self.merchant_gstin,
            'invoice_no': self.invoice_no,
            'date': self.date.isoformat(),
            'category': self.category,
            'total_amount': self.total_amount,
            'gst_rate': self.gst_rate,
            'gst_amount': self.gst_amount,
            'cgst': self.cgst,
            'sgst': self.sgst,
            'igst': self.igst,
            'itc_eligible': self.itc_eligible
        }

class ReturnLog(db.Model):
    __tablename__ = 'return_logs'
    id = db.Column(db.Integer, primary_key=True)
    transaction_id = db.Column(db.Integer, db.ForeignKey('transactions.id'), nullable=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    refund_amount = db.Column(db.Float, nullable=False, default=0.0)
    reason = db.Column(db.String(255), nullable=True)
    return_type = db.Column(db.String(20), default='Return', nullable=False) # 'Return' or 'Replacement'
    return_method = db.Column(db.String(50), default='Online Pickup', nullable=False) # 'Store Drop-off' or 'Online Pickup'
    status = db.Column(db.String(20), default='Pending', nullable=False) # 'Pending', 'Approved', 'Rejected'
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    product = db.relationship('Product')
    transaction = db.relationship('Transaction')
    order = db.relationship('Order')

    def to_dict(self):
        return {
            'id': self.id,
            'transaction_id': self.transaction_id,
            'order_id': self.order_id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else 'Order Item',
            'quantity': self.quantity,
            'refund_amount': self.refund_amount,
            'reason': self.reason,
            'return_type': self.return_type,
            'return_method': getattr(self, 'return_method', 'Online Pickup'),
            'status': self.status,
            'timestamp': self.timestamp.isoformat() + 'Z'
        }

class GstCategoryMapping(db.Model):
    __tablename__ = 'gst_category_mappings'
    
    id = db.Column(db.Integer, primary_key=True)
    category_name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    hsn_code = db.Column(db.String(20), nullable=False)
    gst_rate = db.Column(db.Float, nullable=False) # 0, 5, 12, 18, 28
    description = db.Column(db.Text, nullable=True)
    keywords = db.Column(db.Text, nullable=True) # Comma-separated search terms
    source = db.Column(db.String(30), default='system', nullable=False) # 'system', 'ai_confirmed', 'manual'
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'category_name': self.category_name,
            'hsn_code': self.hsn_code,
            'gst_rate': self.gst_rate,
            'description': self.description,
            'keywords': self.keywords,
            'source': self.source,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


# ── Supabase (Sync Buffer) ──
class OfflineTransaction(db.Model):
    __bind_key__ = 'supabase'
    __tablename__ = 'offline_transactions'
    id = db.Column(db.Integer, primary_key=True)
    pos_device_id = db.Column(db.String(50), nullable=False)
    sync_timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    sync_status = db.Column(db.String(20), default='pending')  # pending, synced, failed
    transaction_data = db.Column(db.JSON, nullable=False)  # Full transaction payload
    neon_transaction_id = db.Column(db.Integer, nullable=True)  # Link back to Neon

class OfflineTransactionLog(db.Model):
    __bind_key__ = 'supabase'
    __tablename__ = 'offline_transaction_logs'
    id = db.Column(db.Integer, primary_key=True)
    offline_transaction_id = db.Column(db.Integer, db.ForeignKey('offline_transactions.id'))
    event = db.Column(db.String(50))  # 'received', 'processing', 'stock_deducted', 'completed', 'error'
    message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

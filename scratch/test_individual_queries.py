import os
import sys
import time
import traceback

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['VERCEL'] = '1'

from app import app, db_strftime
from models import db, Transaction, Order, TransactionItem, OrderItem, Product, Expense, Purchase
from sqlalchemy import func
from datetime import datetime, timedelta

with app.app_context():
    now = datetime.now()
    year_ago = now - timedelta(days=366)
    
    m_transaction = db_strftime('%Y-%m', Transaction.timestamp)
    m_order = db_strftime('%Y-%m', Order.timestamp)
    m_expense = db_strftime('%Y-%m', Expense.date)
    m_purchase = db_strftime('%Y-%m', Purchase.date)

    queries = {
        "total_pos_rev": lambda: db.session.query(func.sum(Transaction.total_amount)).scalar(),
        "total_order_rev": lambda: db.session.query(func.sum(Order.total_amount)).filter(Order.status != 'Cancelled').scalar(),
        "cogs_pos": lambda: db.session.query(func.sum(TransactionItem.quantity * Product.base_cost)).join(Product).scalar(),
        "cogs_order": lambda: db.session.query(func.sum(OrderItem.quantity * Product.base_cost)).join(Product).join(Order).filter(Order.status != 'Cancelled').scalar(),
        "total_expenses": lambda: db.session.query(func.sum(Expense.total_amount)).scalar(),
        "accounts_payable": lambda: db.session.query(func.sum(Purchase.total_amount)).filter(Purchase.payment_status == 'Pending').scalar(),
        "accounts_receivable": lambda: db.session.query(func.sum(Order.total_amount)).filter(Order.status == 'Pending').scalar(),
        "cash_in": lambda: db.session.query(func.sum(Order.total_amount)).filter(Order.status == 'Delivered').scalar(),
        "paid_purchases": lambda: db.session.query(func.sum(Purchase.total_amount)).filter(Purchase.payment_status == 'Paid').scalar(),
        "expenses_by_cat": lambda: db.session.query(Expense.category, func.sum(Expense.total_amount)).group_by(Expense.category).all(),
        "pos_by_month": lambda: db.session.query(m_transaction.label('m'), func.sum(Transaction.total_amount)).filter(Transaction.timestamp >= year_ago).group_by(m_transaction).all(),
        "ord_by_month": lambda: db.session.query(m_order.label('m'), func.sum(Order.total_amount)).filter(Order.timestamp >= year_ago, Order.status != 'Cancelled').group_by(m_order).all(),
        "exp_by_month": lambda: db.session.query(m_expense.label('m'), func.sum(Expense.total_amount)).filter(Expense.date >= year_ago).group_by(m_expense).all(),
        "pur_by_month": lambda: db.session.query(m_purchase.label('m'), func.sum(Purchase.total_amount)).filter(Purchase.date >= year_ago).group_by(m_purchase).all(),
        "mcogs_pos_by_month": lambda: db.session.query(m_transaction.label('m'), func.sum(TransactionItem.quantity * Product.base_cost)).join(Product).join(Transaction).filter(Transaction.timestamp >= year_ago).group_by(m_transaction).all(),
        "mcogs_ord_by_month": lambda: db.session.query(m_order.label('m'), func.sum(OrderItem.quantity * Product.base_cost)).join(Product).join(Order).filter(Order.timestamp >= year_ago, Order.status != 'Cancelled').group_by(m_order).all(),
        "ord_del_by_month": lambda: db.session.query(m_order.label('m'), func.sum(Order.total_amount)).filter(Order.timestamp >= year_ago, Order.status == 'Delivered').group_by(m_order).all(),
        "pur_paid_by_month": lambda: db.session.query(m_purchase.label('m'), func.sum(Purchase.total_amount)).filter(Purchase.date >= year_ago, Purchase.payment_status == 'Paid').group_by(m_purchase).all(),
    }

    for name, query_fn in queries.items():
        print(f"Running query: {name} ... ", end="", flush=True)
        t0 = time.time()
        try:
            res = query_fn()
            print(f"DONE in {time.time()-t0:.2f}s | Result type: {type(res)}")
        except Exception as e:
            print(f"FAILED in {time.time()-t0:.2f}s | Error: {e}")
            db.session.rollback()

import os
import sys

# Ensure project root is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set VERCEL=1 to force it to use the Neon PostgreSQL database
os.environ['VERCEL'] = '1'

try:
    from app import app, compute_gst_summary_data, get_finance_dashboard
    from models import db
    
    with app.app_context():
        print("Database URI:", app.config['SQLALCHEMY_DATABASE_URI'])
        
        print("\n--- Testing compute_gst_summary_data ---")
        try:
            summary = compute_gst_summary_data()
            print("Summary computed successfully! Keys:", list(summary.keys()))
        except Exception as e:
            import traceback
            traceback.print_exc()

        print("\n--- Testing get_finance_dashboard ---")
        # Mock require_admin and get_current_user to bypass auth
        # Or we can just call the internal logic of get_finance_dashboard directly:
        try:
            # Let's inspect the KPIs query
            from sqlalchemy import func
            from models import Transaction, Order, TransactionItem, OrderItem, Product, Expense, Purchase
            total_pos_rev = db.session.query(func.sum(Transaction.total_amount)).scalar() or 0.0
            print("total_pos_rev:", total_pos_rev)
            
            # Let's call the function itself but mock get_current_user
            import app as app_module
            original_get_user = app_module.get_current_user
            original_require_admin = app_module.require_admin
            
            app_module.get_current_user = lambda: "admin"
            app_module.require_admin = lambda u: True
            
            with app.test_client() as client:
                res = client.get('/api/finance/dashboard')
                print("Dashboard status code:", res.status_code)
                print("Dashboard response:", res.get_data(as_text=True)[:500])
                
            app_module.get_current_user = original_get_user
            app_module.require_admin = original_require_admin
        except Exception as e:
            import traceback
            traceback.print_exc()

except Exception as e:
    import traceback
    traceback.print_exc()

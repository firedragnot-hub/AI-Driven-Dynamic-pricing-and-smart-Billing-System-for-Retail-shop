import os
import sys
import traceback

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['VERCEL'] = '1'

try:
    from app import app, compute_gst_summary_data
    from models import db
    
    print("Database URI:", app.config['SQLALCHEMY_DATABASE_URI'])
    
    with app.app_context():
        print("\n--- Running compute_gst_summary_data ---")
        try:
            res = compute_gst_summary_data()
            print("Successfully ran compute_gst_summary_data! Keys:", list(res.keys()))
        except Exception as e:
            print("Error in compute_gst_summary_data:")
            traceback.print_exc()
            
        print("\n--- Running get_finance_dashboard via Flask client ---")
        # Mock auth to admin
        import app as app_module
        app_module.get_current_user = lambda: "admin"
        app_module.require_admin = lambda u: True
        
        with app.test_client() as client:
            res = client.get('/api/finance/dashboard')
            print("Status code:", res.status_code)
            if res.status_code != 200:
                print("Response data:", res.get_data(as_text=True))
            else:
                print("Response keys:", list(res.get_json().keys()))
except Exception as e:
    traceback.print_exc()

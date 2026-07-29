import os
import sys
import traceback

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['VERCEL'] = '1'

try:
    from app import app
    from models import db
    
    with app.app_context():
        print("\n--- Running get_finance_dashboard via Flask client ---")
        import app as app_module
        app_module.get_current_user = lambda: "admin"
        app_module.require_admin = lambda u: True
        
        with app.test_client() as client:
            res = client.get('/api/finance/dashboard')
            print("Status code:", res.status_code)
            if res.status_code != 200:
                print("Response data:", res.get_data(as_text=True))
            else:
                data = res.get_json()
                print("Success! Keys in response:", list(data.keys()))
                print("Revenue data:", data.get('revenue_data'))
                print("Expenses data:", data.get('expenses_data'))
except Exception as e:
    traceback.print_exc()

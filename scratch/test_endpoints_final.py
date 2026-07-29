import os
import sys
import traceback

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['VERCEL'] = '1'

from app import app

with app.app_context():
    # Mock auth to admin
    import app as app_module
    app_module.get_current_user = lambda: "admin"
    app_module.require_admin = lambda u: True
    
    with app.test_client() as client:
        print("\n--- Testing GET /api/finance/dashboard ---")
        res = client.get('/api/finance/dashboard')
        print("Status code:", res.status_code)
        if res.status_code == 200:
            print("Dashboard keys:", list(res.get_json().keys()))
        else:
            print("Error data:", res.get_data(as_text=True))
            
        print("\n--- Testing GET /api/gst/returns/gstr1 ---")
        res = client.get('/api/gst/returns/gstr1')
        print("Status code:", res.status_code)
        if res.status_code == 200:
            data = res.get_json()
            print("GSTR1 summary:", data.get('summary'))
            print("GSTR1 B2B count:", len(data.get('b2b', [])))
            print("GSTR1 B2C count:", len(data.get('b2c', [])))
        else:
            print("Error data:", res.get_data(as_text=True))
            
        print("\n--- Testing GET /api/gst/summary ---")
        res = client.get('/api/gst/summary')
        print("Status code:", res.status_code)
        if res.status_code == 200:
            print("GST Summary state:", res.get_json().get('state'))
        else:
            print("Error data:", res.get_data(as_text=True))

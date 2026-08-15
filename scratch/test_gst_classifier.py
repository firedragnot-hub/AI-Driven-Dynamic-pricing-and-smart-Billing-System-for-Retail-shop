import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['VERCEL'] = '1'

from app import app, db, GstCategoryMapping

with app.app_context():
    db.create_all()
    print("DB Engine URI:", app.config['SQLALCHEMY_DATABASE_URI'])

    with app.test_client() as client:
        print("\n--- TEST 1: Database Lookup (Known Category: LED Television) ---")
        res1 = client.post('/api/gst/lookup', json={'category': 'LED Television'})
        print("Status:", res1.status_code)
        print("Response:", res1.get_json())

        print("\n--- TEST 2: Groq AI Fallback Classification (Unknown Product: Samsung 32-inch Smart TV) ---")
        res2 = client.post('/api/gst/lookup', json={'product_name': 'Samsung 32-inch Smart TV', 'description': 'Full HD LED Smart TV'})
        print("Status:", res2.status_code)
        data2 = res2.get_json()
        print("Response:", data2)

        print("\n--- TEST 3: Admin Confirmation Learning Loop ---")
        res3 = client.post('/api/gst/confirm-mapping', json={
            'category_name': 'LED Television',
            'hsn_code': '8528',
            'gst_rate': 18.0,
            'keywords': 'samsung,smart tv,32-inch,led television',
            'description': 'Monitors and smart television receivers'
        })
        print("Status:", res3.status_code)
        print("Response:", res3.get_json())

        print("\n--- TEST 4: Re-testing Lookup after Admin Learning (Should be source=database) ---")
        res4 = client.post('/api/gst/lookup', json={'product_name': 'Samsung 32-inch Smart TV'})
        print("Status:", res4.status_code)
        print("Response:", res4.get_json())

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['VERCEL'] = '1'

from app import app, db, Order, User

with app.app_context():
    db.create_all()

    with app.test_client() as client:
        print("\n--- TEST 1: Submit Return Request for Delivered Order ---")
        # Create dummy delivered order
        order = Order.query.first()
        if not order:
            order = Order(
                customer_name="Test Customer",
                email="customer@example.com",
                phone="9876543210",
                address="Delhi, India",
                total_amount=1200.0,
                status="Delivered"
            )
            db.session.add(order)
            db.session.commit()
        else:
            order.status = "Delivered"
            db.session.commit()

        print(f"Testing order #{order.id} status before request:", order.status)

        res = client.post(f'/api/orders/{order.id}/return-request', json={
            'return_type': 'Replacement',
            'reason': 'Item broken during shipping'
        })
        print("Status Code:", res.status_code)
        data = res.get_json()
        print("Response:", data)

        # Verify updated status
        refreshed_order = Order.query.get(order.id)
        print("Refreshed Order Status:", refreshed_order.status)
        assert refreshed_order.status == 'Replacement Requested'

        print("\n--- TEST 2: PDF Invoice Download Endpoint ---")
        res_inv = client.get(f'/api/orders/{order.id}/invoice')
        print("Status Code:", res_inv.status_code)
        print("Content Type:", res_inv.content_type)
        assert res_inv.status_code == 200
        assert res_inv.content_type == 'application/pdf'
        print("Invoice PDF generated successfully! Length bytes:", len(res_inv.data))

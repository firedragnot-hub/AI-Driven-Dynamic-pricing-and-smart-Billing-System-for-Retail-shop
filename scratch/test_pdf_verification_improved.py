import os
import sys
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['VERCEL'] = '1'

from app import app, db
from models import Purchase, PurchaseItem, Product

def run_test():
    with app.app_context():
        # Setup mock admin auth
        import app as app_module
        app_module.get_current_user = lambda: "admin"
        app_module.require_admin = lambda u: True
        
        # 1. Create a dummy product
        p1 = Product.query.filter_by(name="Test Verification Product A").first()
        if not p1:
            p1 = Product(name="Test Verification Product A", category="Electronics", base_cost=100.0, current_price=150.0, stock_level=10, hsn_code="84733099")
            db.session.add(p1)
            
        p2 = Product.query.filter_by(name="Test Verification Product B").first()
        if not p2:
            p2 = Product(name="Test Verification Product B", category="Electronics", base_cost=200.0, current_price=300.0, stock_level=5, hsn_code="84733099")
            db.session.add(p2)
            
        db.session.commit()
        
        # 2. Create a purchase order
        purchase = Purchase(
            supplier_name="Test Supplier",
            supplier_gstin="27ABCDE1234F1Z5",
            invoice_no="INV-TEST-PO",
            total_amount=500.0,
            gst_amount=90.0,
            cgst=45.0,
            sgst=45.0,
            igst=0.0,
            itc_eligible=True,
            payment_status="Pending Receipt",
            verification_status="Pending Receipt"
        )
        db.session.add(purchase)
        db.session.flush()
        
        # Order items
        # Product A: Qty 3, Price 100
        # Product B: Qty 1, Price 200
        pi1 = PurchaseItem(purchase_id=purchase.id, product_name=p1.name, quantity=3, price_at_purchase=100.0, total_amount=300.0, gst_rate=18.0)
        pi2 = PurchaseItem(purchase_id=purchase.id, product_name=p2.name, quantity=1, price_at_purchase=200.0, total_amount=200.0, gst_rate=18.0)
        db.session.add(pi1)
        db.session.add(pi2)
        db.session.commit()
        
        print(f"Created Purchase ID: {purchase.id} with items:")
        print(f"  - {p1.name}: ordered 3 @ 100")
        print(f"  - {p2.name}: ordered 1 @ 200")
        
        # 3. Mock parse_bill_pdf to return mismatched items:
        # Product A: Qty 2 (Missing 1)
        # Unexpected Product C: Qty 1, Price 50
        # Product B is completely missing (Missing 1)
        mock_parsed_items = [
            {
                'product_name': p1.name,
                'product_id': p1.id,
                'quantity': 2,
                'price_at_purchase': 100.0,
                'total_amount': 200.0
            },
            {
                'product_name': "Unexpected Product C",
                'product_id': None,
                'quantity': 1,
                'price_at_purchase': 50.0,
                'total_amount': 50.0
            }
        ]
        
        app_module.parse_bill_pdf = lambda path: ("Test Supplier", mock_parsed_items)
        
        # 4. Request reconciliation via test client
        with app.test_client() as client:
            import io
            dummy_pdf = (io.BytesIO(b"%PDF-1.4 ... dummy content"), "invoice.pdf")
            res = client.post('/api/ml/reconcile-invoice', data={
                'purchase_id': purchase.id,
                'file': dummy_pdf
            })
            
            print("\nResponse Status Code:", res.status_code)
            res_data = res.get_json()
            print("Response Status Value:", res_data.get('status'))
            print("Response Message:", res_data.get('message'))
            print("\nDiscrepancy Mismatches List:")
            print(json.dumps(res_data.get('mismatches'), indent=2))
            
            # Clean up
            from models import Discrepancy, PurchaseBill
            Discrepancy.query.filter_by(purchase_order_id=purchase.id).delete()
            PurchaseBill.query.filter_by(purchase_id=purchase.id).delete()
            db.session.delete(pi1)
            db.session.delete(pi2)
            db.session.delete(purchase)
            db.session.commit()

if __name__ == "__main__":
    run_test()

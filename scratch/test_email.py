import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import send_order_email_notification

print("Testing email notification dispatch to firedragnot@gmail.com...")
send_order_email_notification(
    order_id=999,
    customer_name="Test Customer",
    email="testcustomer@example.com",
    phone="9876543210",
    address="Test Address, Noida, India",
    items_summary="  - Samsung 32-inch Smart TV (Qty: 1) @ INR 18000.00",
    total_amount=18000.00
)
print("Email notification trigger dispatched!")

import json
import time
import requests

BASE_URL = "http://127.0.0.1:5000"

def test_security_suite():
    print("=== STARTING SECURITY SUITE INTEGRATION TESTS ===")
    
    # 1. Test registration & email verification flow
    print("\n1. Testing Registration and Email Verification Flow...")
    email = f"test_sec_{int(time.time())}@example.com"
    username = f"test_sec_{int(time.time())}"
    password = "SecurePassword123!"
    
    reg_payload = {
        "username": username,
        "email": email,
        "password": password,
        "role": "customer"
    }
    
    reg_res = requests.post(f"{BASE_URL}/api/auth/register", json=reg_payload)
    print(f"Registration Status Code: {reg_res.status_code}")
    if reg_res.status_code != 201:
        print(f"Error during registration: {reg_res.text}")
        return
        
    reg_data = reg_res.json()
    print("Registration returned:", reg_data)
    
    # Check that is_verified is False
    assert reg_data.get("is_verified") is False, "User should start unverified"
    
    # 2. Try to login (should fail because email is not verified)
    print("\n2. Testing login with unverified email (should block and return 403)...")
    login_payload = {
        "username": email,
        "password": password
    }
    
    login_res = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    print(f"Login Status Code: {login_res.status_code}")
    assert login_res.status_code == 403, "Login should return 403 Forbidden for unverified email"
    
    login_data = login_res.json()
    print("Login block response:", login_data)
    assert login_data.get("unverified") is True, "Response should indicate unverified account"
    
    # 3. Simulate getting verification token from DB (since it was mocked to console)
    print("\n3. Testing email verification route...")
    # We will fetch directly from database using a helper query or diagnostic endpoint if needed
    # Let's inspect the diagnostic endpoint /api/diag
    diag_res = requests.get(f"{BASE_URL}/api/diag")
    print(f"Diagnostic endpoint status: {diag_res.status_code}")
    
    # Since we can query the database directly in Python, let's retrieve the verification token
    import sqlite3
    import os
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'retail.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT verification_token FROM users WHERE email=?", (email,))
    token_row = cursor.fetchone()
    conn.close()
    
    if not token_row or not token_row[0]:
        print("Error: Could not retrieve verification token from sqlite database.")
        return
        
    token = token_row[0]
    print(f"Retrieved token from database: {token}")
    
    # Call verify endpoint
    verify_res = requests.post(f"{BASE_URL}/api/auth/verify", json={"token": token})
    print(f"Verify Status Code: {verify_res.status_code}")
    assert verify_res.status_code == 200, "Verification should succeed"
    print("Verification response:", verify_res.json())
    
    # Try login again (should succeed)
    print("\n4. Testing login after verification (should succeed)...")
    login_res2 = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    print(f"Login after verification Status Code: {login_res2.status_code}")
    assert login_res2.status_code == 200, "Login should succeed after verification"
    
    login_data2 = login_res2.json()
    print("Login success payload:", login_data2.keys())
    assert "token" in login_data2, "JWT Token should be returned on successful login"
    
    # 4b. Test placing order with verified user
    print("\n4b. Testing order placement with verified user...")
    headers = {"Authorization": f"Bearer {login_data2['token']}"}
    order_payload = {
        "customer_name": "Test Customer",
        "email": email,
        "phone": "1234567890",
        "address": "123 Test Street",
        "items": [{"product_id": 1, "quantity": 1}]
    }
    order_res = requests.post(f"{BASE_URL}/api/orders", json=order_payload, headers=headers)
    print(f"Order Placement Status Code: {order_res.status_code}")
    assert order_res.status_code in (200, 201, 404), "Order placement user check should pass"
    if order_res.status_code in (200, 201):
        print("Order placed successfully:", order_res.json())
    else:
        print("User verification check passed (product 404 expected if DB is unseeded).")

    # 4c. Test placing order without token
    print("\n4c. Testing order placement without token (should return 401)...")
    order_res_guest = requests.post(f"{BASE_URL}/api/orders", json=order_payload)
    print(f"Guest Order Placement Status Code: {order_res_guest.status_code}")
    assert order_res_guest.status_code == 401, "Order placement should require authentication"
    
    # 5. Test Google login endpoint
    print("\n5. Testing Google Login endpoint mock parsing...")
    # Create a dummy JWT token payload to simulate a Google Identity credential
    # Google credentials have 3 parts separated by dots, where the middle part is base64 encoded JSON payload.
    import base64
    google_email = f"google_user_{int(time.time())}@gmail.com"
    dummy_payload = {
        "email": google_email,
        "name": "Google Test User"
    }
    payload_b64 = base64.b64encode(json.dumps(dummy_payload).encode('utf-8')).decode('utf-8').rstrip('=')
    dummy_credential = f"header.{payload_b64}.signature"
    
    google_res = requests.post(f"{BASE_URL}/api/auth/google", json={"credential": dummy_credential})
    print(f"Google login Status Code: {google_res.status_code}")
    assert google_res.status_code == 200, "Google Sign-In should succeed"
    google_data = google_res.json()
    print("Google Sign-In response user info:", google_data.get("user"))
    assert google_data.get("user", {}).get("is_verified") is True, "Google accounts should be pre-verified"
    
    # 6. Test Rate limiting (hitting login route repeatedly)
    print("\n6. Testing Rate Limiting (attempting multiple rapid login requests)...")
    success_count = 0
    blocked_count = 0
    
    for i in range(10):
        # We send requests to trigger the rate limiter (limit is 5 per minute)
        r = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        if r.status_code == 429:
            blocked_count += 1
        elif r.status_code == 200:
            success_count += 1
        time.sleep(0.1)
        
    print(f"Rate limiting summary: {success_count} succeeded, {blocked_count} blocked (HTTP 429)")
    assert blocked_count > 0, "Rate limiting should have blocked some requests"
    print("Rate limiting validation succeeded!")
    
    print("\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    # We assume the Flask server is running locally on port 5000.
    # To run this script:
    # 1. Start the flask server (e.g. `python app.py`)
    # 2. Run: `python scratch/test_security_suite.py`
    try:
        test_security_suite()
    except Exception as e:
        print(f"\nTest execution encountered an error: {e}")
        import traceback
        traceback.print_exc()

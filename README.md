# 🛒 AI-Driven Dynamic Pricing and Smart Billing System for Retail Shops

<div align="center">
  <p><strong>Intelligent pricing algorithms and seamless checkout for modern retail.</strong></p>
  
  ![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
  ![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)
  ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
  ![Scikit-Learn](https://img.shields.io/badge/scikit_learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)
  ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
  ![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)
  ![Status: Active](https://img.shields.io/badge/Status-Active-success.svg?style=for-the-badge)
  
  <p>
    <a href="#-project-overview--features">Features</a> •
    <a href="#-tech-stack--tools">Tech Stack</a> •
    <a href="#-sqa--testing-documentation">Testing (SQA)</a> •
    <a href="#-api-endpoint-testing">API Docs</a> •
    <a href="#-installation--setup-guide">Setup</a>
  </p>
</div>

---

## 📖 Project Overview & Features

This project provides a comprehensive retail management solution designed to optimize profit margins and streamline the customer checkout experience. The core of the system is an AI-driven dynamic pricing engine that automatically adjusts product prices in real-time based on fluctuating demand, time of day, and inventory levels.

**Key Features:**
*   📈 **Dynamic Pricing Engine:** Machine learning algorithm (Scikit-Learn) that intelligently maps pricing rules to static inventory thresholds and demand metrics.
*   🧾 **Smart Billing & Automated Invoicing:** Seamless checkout process with automated PDF invoice generation.
*   📦 **Inventory Management:** Full CRUD operations allowing retail administrators to efficiently add, monitor, and update product details.
*   📊 **Real-time Analytics Dashboard:** Comprehensive frontend interface offering data visualizations of sales, inventory, and dynamic pricing history.
*   🔒 **Secure Authentication:** User authentication and authorization for retail administrators using Clerk.

---

## 🛠 Tech Stack & Tools

| Category | Technologies / Tools |
| :--- | :--- |
| **Backend & API** | Python, Flask, Flask-SQLAlchemy, Flask-CORS, Flask-Limiter |
| **Machine Learning** | Scikit-Learn, Pandas, NumPy, Joblib |
| **Frontend UI** | React.js, Vite, Chart.js, Lucide Icons |
| **Database** | PostgreSQL (Neon), SQLite (Local Dev) |
| **Authentication** | Clerk, JWT (PyJWT) |
| **Testing & SQA** | Postman, PyTest, Manual Testing |
| **Document Generation** | ReportLab, PyPDF |

---

## 🧪 SQA & Testing Documentation

As a Lead QA Engineer on this project, a rigorous Software Quality Assurance (SQA) process was implemented to ensure system reliability, accurate pricing calculations, and secure data handling.

### Test Strategy & Coverage
*   **API Testing:** Comprehensive validation of all REST endpoints using Postman to verify response codes, payloads, and authentication constraints.
*   **Boundary Value Analysis (BVA):** Tested the dynamic pricing algorithm at extreme inventory levels (e.g., 0 stock, max capacity) to ensure safe fallback pricing.
*   **Database Integrity Testing:** Verified SQL operations to ensure transaction atomicity during checkout processes and inventory deductions.
*   **Integration Testing:** Ensured seamless communication between the React frontend, Flask backend, and Scikit-Learn model predictions.

### Sample Test Cases

| Test ID | Scenario | Test Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| `TC-001` | Verify Dynamic Price Calculation | 1. Set product inventory to < 10.<br>2. Trigger price fetch API. | System applies scarcity markup (+15%). | ✅ PASS |
| `TC-002` | Validate Checkout Atomicity | 1. Add item to cart.<br>2. Initiate checkout.<br>3. Simulate DB disconnect. | Transaction rolls back; inventory remains unchanged. | ✅ PASS |
| `TC-003` | Unauthorized API Access | 1. Send GET request to `/api/admin/stats` without JWT. | Returns `401 Unauthorized`. | ✅ PASS |
| `TC-004` | Boundary Check: Negative Inventory | 1. Attempt to deduct 5 items when stock is 2. | Operation rejected; returns `400 Bad Request`. | ✅ PASS |
| `TC-005` | Generate PDF Invoice | 1. Complete a successful checkout. | PDF is generated with correct totals and tax data. | ✅ PASS |

---

## 🔌 API Endpoint Testing

Below are critical REST API routes validated during the SQA lifecycle.

### 1. Fetch Dynamic Price
*   **Endpoint:** `GET /api/price/<product_id>`
*   **Description:** Retrieves the current AI-calculated price for a given product.
*   **Response (200 OK):**
    ```json
    {
      "product_id": 105,
      "base_price": 50.00,
      "current_price": 57.50,
      "reason": "High demand, low inventory"
    }
    ```
*   **Error Handling (404 Not Found):** Returned if `product_id` does not exist in the database.

### 2. Process Checkout
*   **Endpoint:** `POST /api/checkout`
*   **Description:** Processes the sale, deducts inventory, and generates an invoice.
*   **Request Body:**
    ```json
    {
      "items": [
        {"product_id": 105, "quantity": 2},
        {"product_id": 201, "quantity": 1}
      ],
      "payment_method": "credit_card"
    }
    ```
*   **Response (201 Created):**
    ```json
    {
      "status": "success",
      "invoice_id": "INV-84920",
      "download_url": "/invoices/INV-84920.pdf"
    }
    ```
*   **Error Handling (400 Bad Request):** Handled scenarios like "Insufficient stock for product 105".

---

## 💻 Installation & Setup Guide

Follow these steps to run the project locally.

### Prerequisites
*   Python 3.10+
*   Node.js 18+
*   PostgreSQL (Optional for local dev, SQLite is used by default if not configured)

### 1. Clone the Repository
```bash
git clone https://github.com/firedragnot-hub/AI-Driven-Dynamic-pricing-and-smart-Billing-System-for-Retail-shop.git
cd AI-Driven-Dynamic-pricing-and-smart-Billing-System-for-Retail-shop
```

### 2. Backend Setup (Flask)
```bash
# Create and activate a virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Mac/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the Flask Server
python app.py
```

### 3. Frontend Setup (React/Vite)
```bash
cd frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

---

## 🚀 How to Run Tests

### Backend Unit Tests (PyTest)
To execute the automated test suite for the Python backend:
```bash
# Ensure virtual environment is active
pytest
```

### API Testing (Postman)
1. Open Postman.
2. Ensure the local backend server is running.
3. Import the required requests manually or via a collection file.
4. Execute test runs against `http://localhost:5000`.

---

## 🔮 Future Enhancements
*   **CI/CD Pipeline:** Implement GitHub Actions to run automated testing (PyTest) and linting on every Pull Request.
*   **Load Testing:** Utilize tools like JMeter or Locust to simulate high-traffic checkout events (e.g., Black Friday sales).
*   **Advanced AI Models:** Transition from scikit-learn models to deep learning (TensorFlow/PyTorch) for more granular demand forecasting.

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

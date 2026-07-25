import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression


PRICING_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'pricing_model.joblib')
DEMAND_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'demand_model.joblib')

def train_dynamic_pricing_model(df, model_path=PRICING_MODEL_PATH):
    """
    Trains a Random Forest Regressor for dynamic pricing.
    Expected features in df: ['base_cost', 'stock_level', 'hour_of_day', 'day_of_week']
    Target: 'price_sold'
    """
    features = ['base_cost', 'stock_level', 'hour_of_day', 'day_of_week']
    X = df[features]
    y = df['price_sold']
    
    model = RandomForestRegressor(n_estimators=50, random_state=42)
    model.fit(X, y)
    
    joblib.dump(model, model_path)
    # Clear cache to force reloading the newly trained model
    global _pricing_model
    _pricing_model = None
    return model

_pricing_model = None
_demand_model = None

def load_pricing_model(model_path=PRICING_MODEL_PATH):
    global _pricing_model
    if _pricing_model is None:
        if os.path.exists(model_path):
            try:
                _pricing_model = joblib.load(model_path)
            except Exception:
                pass
    return _pricing_model

def load_demand_model(model_path=DEMAND_MODEL_PATH):
    global _demand_model
    if _demand_model is None:
        if os.path.exists(model_path):
            try:
                _demand_model = joblib.load(model_path)
            except Exception:
                pass
    return _demand_model

def predict_dynamic_price(base_cost, stock_level, hour_of_day, day_of_week, sales_count=0, model_path=PRICING_MODEL_PATH):
    """
    Predicts the dynamic price for a product.
    If the model doesn't exist, falls back to a heuristic pricing rule.
    """
    # Demand / Sales Count markup: +2% for every 3 sales, capped at 20%
    demand_markup = min(0.20, (sales_count // 3) * 0.02)

    model = load_pricing_model(model_path)
    if model is not None:
        try:
            features = np.array([[base_cost, stock_level, hour_of_day, day_of_week]])
            predicted_price = model.predict(features)[0]
            # Add demand markup on top of ML model prediction to reflect live sales demand
            predicted_price = predicted_price * (1 + demand_markup)
            # Ensure price is at least the base cost
            return round(max(float(predicted_price), base_cost), 2)
        except Exception:
            pass
            
    # Fallback heuristic pricing
    markup = 0.20  # Default 20% markup
    
    # Stock level modifier
    if stock_level < 10:
        markup += 0.15
    elif stock_level < 30:
        markup += 0.05
        
    # Peak hours modifier: 17:00 - 21:00 (5 PM - 9 PM)
    if 17 <= hour_of_day <= 21:
        markup += 0.10
        
    # Weekend modifier: Friday, Saturday, Sunday
    if day_of_week in [4, 5, 6]:
        markup += 0.05
        
    # Add demand/sales count markup
    markup += demand_markup
        
    final_price = base_cost * (1 + markup)
    return round(final_price, 2)

def train_demand_prediction_model(df, model_path=DEMAND_MODEL_PATH):
    """
    Trains a Linear Regression model for daily demand/sales prediction.
    Expected features in df: ['day_of_week', 'month']
    Target: 'total_items_sold'
    """
    features = ['day_of_week', 'month']
    X = df[features]
    y = df['total_items_sold']
    
    model = LinearRegression()
    model.fit(X, y)
    
    joblib.dump(model, model_path)
    # Clear cache to force reloading the newly trained model
    global _demand_model
    _demand_model = None
    return model

def predict_demand(day_of_week, month, model_path=DEMAND_MODEL_PATH):
    """
    Predicts total store sales volume for a given day.
    """
    model = load_demand_model(model_path)
    if model is not None:
        try:
            features = np.array([[day_of_week, month]])
            predicted = model.predict(features)[0]
            return max(0, int(round(predicted)))
        except Exception:
            pass
            
    base = 150
    if day_of_week in [4, 5, 6]:
        base += 80
    return base

def recommend_budget_allocation(budget, category, period_days, db_session):
    """
    Runs a Linear Regression prediction of sales trend for the selected category.
    Then performs budget allocation across products in that category.
    """
    from models import Product, Transaction, TransactionItem
    from sqlalchemy import func
    
    # 1. Fetch products
    query = Product.query
    if category and category != 'All':
        query = query.filter_by(category=category)
    products = query.all()
    
    if not products:
        return {
            'recommended_quantity': 0,
            'estimated_sales': 0.0,
            'estimated_profit': 0.0,
            'items': [],
            'reason': 'No products found in this category'
        }
        
    # 2. Get daily sales volumes for this category over the last 90 days
    prod_ids = [p.id for p in products]
    dialect = db_session.bind.dialect.name
    if dialect == 'postgresql':
        date_expr = func.to_char(Transaction.timestamp, 'YYYY-MM-DD').label('date')
    else:
        date_expr = func.strftime('%Y-%m-%d', Transaction.timestamp).label('date')
        
    sales_query = db_session.query(
        date_expr,
        func.sum(TransactionItem.quantity).label('qty')
    ).join(TransactionItem).filter(TransactionItem.product_id.in_(prod_ids)).group_by('date').all()
    
    # Organize into a DataFrame
    if len(sales_query) >= 5:
        df_sales = pd.DataFrame(sales_query, columns=['date', 'qty'])
        df_sales['date'] = pd.to_datetime(df_sales['date'])
        df_sales = df_sales.sort_values('date')
        min_date = df_sales['date'].min()
        df_sales['day_idx'] = (df_sales['date'] - min_date).dt.days
        
        # Fit Linear Regression on time/day index to predict future trend
        lr = LinearRegression()
        X = df_sales[['day_idx']]
        y = df_sales['qty']
        lr.fit(X, y)
        
        # Predict for the next period_days starting from N
        last_day_idx = int(df_sales['day_idx'].max())
        future_days = np.array([[last_day_idx + i] for i in range(1, period_days + 1)])
        predicted_daily_qty = lr.predict(future_days)
        predicted_total_sales = float(max(10.0, sum(predicted_daily_qty)))
    else:
        total_qty_sold = db_session.query(func.sum(TransactionItem.quantity)).filter(TransactionItem.product_id.in_(prod_ids)).scalar() or 0
        daily_avg = total_qty_sold / 90.0 if total_qty_sold > 0 else 2.0
        predicted_total_sales = float(daily_avg * period_days)

    # 3. Fetch product-level historical shares
    prod_sales = db_session.query(
        TransactionItem.product_id,
        func.sum(TransactionItem.quantity).label('total_qty')
    ).filter(TransactionItem.product_id.in_(prod_ids)).group_by(TransactionItem.product_id).all()
    
    sales_map = {p_id: qty for p_id, qty in prod_sales}
    total_historical_sold = sum(sales_map.values()) or 1
    
    # 4. Calculate proposed purchase allocations
    allocations = []
    total_cost = 0.0
    total_expected_revenue = 0.0
    total_recommended_qty = 0
    
    for prod in products:
        share = sales_map.get(prod.id, 0) / total_historical_sold if total_historical_sold > 0 else (1.0 / len(products))
        prod_expected_sales = predicted_total_sales * share
        suggested_qty = max(1, int(round(prod_expected_sales)))
        
        allocations.append({
            'product_id': prod.id,
            'name': prod.name,
            'base_cost': prod.base_cost,
            'suggested_price': prod.current_price,
            'expected_sales': prod_expected_sales,
            'suggested_qty': suggested_qty,
            'unit_profit': max(0.0, prod.current_price - prod.base_cost)
        })
        
    allocations.sort(key=lambda x: x['expected_sales'], reverse=True)
    initial_total_cost = sum(item['suggested_qty'] * item['base_cost'] for item in allocations)
    
    if initial_total_cost > budget:
        scaling_factor = budget / initial_total_cost
        for item in allocations:
            item['suggested_qty'] = max(0, int(item['suggested_qty'] * scaling_factor))
    else:
        remaining_budget = budget - initial_total_cost
        for item in allocations:
            if remaining_budget <= 0:
                break
            can_buy_more = int(remaining_budget // item['base_cost'])
            buy_extra = min(can_buy_more, int(item['expected_sales']))
            if buy_extra > 0:
                item['suggested_qty'] += buy_extra
                remaining_budget -= buy_extra * item['base_cost']

    final_allocations = []
    for item in allocations:
        if item['suggested_qty'] > 0:
            cost = item['suggested_qty'] * item['base_cost']
            revenue = item['suggested_qty'] * item['suggested_price']
            profit = revenue - cost
            
            total_cost += cost
            total_expected_revenue += revenue
            total_recommended_qty += item['suggested_qty']
            
            final_allocations.append({
                'product_id': item['product_id'],
                'name': item['name'],
                'suggested_qty': item['suggested_qty'],
                'cost': round(cost, 2),
                'expected_revenue': round(revenue, 2),
                'expected_profit': round(profit, 2)
            })
            
    return {
        'recommended_quantity': total_recommended_qty,
        'estimated_sales': round(total_expected_revenue, 2),
        'estimated_profit': round(total_expected_revenue - total_cost, 2),
        'items': final_allocations,
        'budget_used': round(total_cost, 2),
        'reason': f"Optimized purchasing plan generated for {category} category over {period_days} days."
    }

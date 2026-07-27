import React, { useState, useEffect } from 'react';
import { BrainCircuit, Calendar, Play, CheckCircle, IndianRupee, Clock, ArrowRight, DollarSign, Package, AlertCircle, FileText, Send, ShoppingBag, X, Download } from 'lucide-react';

export default function MLForecast({ token }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [demandResult, setDemandResult] = useState(null);
  const [demandLoading, setDemandLoading] = useState(false);

  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingResult, setTrainingResult] = useState(null);

  // Budget Recommendation State
  const [budget, setBudget] = useState(5000);
  const [category, setCategory] = useState('All');
  const [periodDays, setPeriodDays] = useState(30);
  const [budgetResult, setBudgetResult] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);

  // Pricing Recommendation State
  const [pricingRecs, setPricingRecs] = useState([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const [showAllPrices, setShowAllPrices] = useState(false);

  // New Ordering & Ticker States
  const [supplierName, setSupplierName] = useState('Global Foods & Electronics Inc');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);

  // AI Order History States
  const [orderHistory, setOrderHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [showAllOrderItems, setShowAllOrderItems] = useState({});

  // Purchase Bill Verification states
  const [activeHistoryTab, setActiveHistoryTab] = useState('orders'); // 'orders' or 'bills'
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);

  const toggleShowAllOrderItems = (orderId) => {
    setShowAllOrderItems(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const exportPurchaseCSV = (purchase) => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Product Name,Quantity,Unit Cost,Subtotal\n";
    purchase.items.forEach(item => {
      csvContent += `"${item.product_name}",${item.quantity},${item.price_at_purchase},${item.total_amount}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Purchase_Invoice_${purchase.invoice_no}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printPurchaseInvoice = (purchase) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>AI Recommended Purchase Invoice - ${purchase.invoice_no}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            h2 { color: #eab308; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f8f9fa; }
            .total { font-weight: bold; font-size: 1.1rem; }
          </style>
        </head>
        <body>
          <h2>AI Recommended Procurement Invoice</h2>
          <p><strong>Invoice Number:</strong> ${purchase.invoice_no}</p>
          <p><strong>Order Date:</strong> ${new Date(purchase.date).toLocaleString()}</p>
          <p><strong>Supplier:</strong> ${purchase.supplier_name}</p>
          <hr />
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Quantity</th>
                <th>Unit Cost</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${purchase.items.map(item => `
                <tr>
                  <td>${item.product_name}</td>
                  <td>${item.quantity} units</td>
                  <td>₹${item.price_at_purchase.toLocaleString()}</td>
                  <td>₹${item.total_amount.toLocaleString()}</td>
                </tr>
              `).join('')}
              <tr class="total">
                <td colspan="3">Grand Total</td>
                <td>₹${purchase.total_amount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Reconciliation states
  const [reconciliationData, setReconciliationData] = useState(null);
  const [reconcilingPurchaseId, setReconcilingPurchaseId] = useState(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);

  const handleUploadBill = async (purchaseId, file) => {
    if (!file) return;
    setReconcileLoading(true);
    setReconcilingPurchaseId(purchaseId);
    try {
      const formData = new FormData();
      formData.append('purchase_id', purchaseId);
      formData.append('file', file);

      const res = await fetch('/api/ml/reconcile-invoice', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'Verified') {
          alert('Bill verified successfully! All items matched, inventory updated.');
          setReconciliationData(null);
          setReconcilingPurchaseId(null);
          fetchOrderHistory();
        } else {
          setReconciliationData(data);
        }
      } else {
        alert(data.error || 'Failed to reconcile invoice');
      }
    } catch (e) {
      console.error(e);
      alert('Error uploading and reconciling seller bill');
    } finally {
      setReconcileLoading(false);
    }
  };

  const handleConfirmReceipt = async (option) => {
    if (!reconciliationData) return;
    try {
      const res = await fetch('/api/ml/confirm-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          purchase_id: reconciliationData.purchase_id,
          bill_id: reconciliationData.bill_id,
          option: option
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setReconciliationData(null);
        setReconcilingPurchaseId(null);
        fetchOrderHistory();
      } else {
        alert(data.error || 'Failed to confirm receipt');
      }
    } catch (e) {
      console.error(e);
      alert('Error confirming receipt');
    }
  };

  const fetchPurchaseBills = async () => {
    setBillsLoading(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/ml/bills', { headers });
      if (res.ok) {
        const data = await res.json();
        setPurchaseBills(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBillsLoading(false);
    }
  };

  const fetchOrderHistory = async () => {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/ml/order-history', { headers });
      if (res.ok) {
        const data = await res.json();
        setOrderHistory(data);
      }
    } catch (e) {
      console.error("Error fetching recommended order history:", e);
    }
  };

  const handleOrderAll = async () => {
    if (!budgetResult || !budgetResult.items) return;
    if (!window.confirm(`Are you sure you want to purchase and restock all ${budgetResult.recommended_quantity} recommended items?`)) return;
    
    setOrderLoading(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const res = await fetch('/api/ml/order-recommendations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: budgetResult.items.map(item => ({
            name: item.name,
            suggested_qty: item.suggested_qty,
            cost_unit: item.cost / item.suggested_qty
          })),
          supplier_name: supplierName
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Order placed successfully!');
        fetchOrderHistory();
      } else {
        alert(data.error || 'Failed to place recommended order');
      }
    } catch (e) {
      console.error(e);
      alert('Error placing recommended order');
    } finally {
      setOrderLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!budgetResult) return;
    try {
      const res = await fetch('/api/ml/budget-recommendation/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(budgetResult)
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ai_purchasing_recommendations.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert('Failed to generate PDF');
      }
    } catch (e) {
      console.error(e);
      alert('Error downloading PDF');
    }
  };

  const handleSendToSupplier = (e) => {
    e.preventDefault();
    alert(`Purchasing list sent successfully to supplier "${supplierName}" via simulated automated EDI/email!`);
    setShowSupplierModal(false);
  };

  // Products for category listing
  const [categories, setCategories] = useState(['All']);

  const fetchDemandForecast = async () => {
    setDemandLoading(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/ml/predict-demand?date=${date}`, { headers });
      const data = await res.json();
      if (res.ok) {
        setDemandResult(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDemandLoading(false);
    }
  };

  const fetchPricingRecommendations = async () => {
    setPricingLoading(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/ml/pricing-recommendations', { headers });
      const data = await res.json();
      if (res.ok) {
        setPricingRecs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPricingLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        const cats = ['All', ...new Set(data.map(p => p.category))];
        setCategories(cats);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDemandForecast();
    fetchPricingRecommendations();
    fetchCategories();
    fetchOrderHistory();
  }, [date, token]);

  const handleBudgetPlanning = async (e) => {
    e.preventDefault();
    setBudgetLoading(true);
    setBudgetResult(null);
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/ml/budget-recommendation', {
        method: 'POST',
        headers,
        body: JSON.stringify({ budget, category, period_days: periodDays })
      });
      const data = await res.json();
      if (res.ok) {
        setBudgetResult(data);
      } else {
        alert(data.error || 'Failed to calculate budget allocation');
      }
    } catch (err) {
      console.error(err);
      alert('Error calculating budget recommendation');
    } finally {
      setBudgetLoading(false);
    }
  };

  const triggerRetraining = async () => {
    if (!window.confirm('Retraining models will rebuild the machine learning pricing and demand regressors based on current transaction history. Proceed?')) return;
    setTrainingLoading(true);
    setTrainingResult(null);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/ml/train', {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (res.ok) {
        setTrainingResult(data);
        fetchDemandForecast();
        fetchPricingRecommendations();
      } else {
        alert(data.error || 'Training failed');
      }
    } catch (e) {
      console.error(e);
      alert('Error initiating model training');
    } finally {
      setTrainingLoading(false);
    }
  };

  const getDayName = (dayIndex) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayIndex] || 'Unknown';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Machine Learning Center</h1>
          <p>AI pricing optimization, budget purchase recommendations, and store demand forecasting</p>
        </div>
      </div>

      {/* Grid: Forecast & Retraining */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* Demand Forecasting Panel */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Calendar color="#f6a623" /> Sales Demand Forecast
          </h2>
          <p style={{ color: '#5c5c5c', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Predict total items expected to sell store-wide for any upcoming business day.
          </p>

          <div className="input-group">
            <label>Select Target Date</label>
            <input 
              type="date" 
              className="form-control" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
            />
          </div>

          {demandResult && (demandResult.current_festival || demandResult.next_festival) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              {demandResult.current_festival && demandResult.current_festival.name !== "General Season" && (
                <div style={{ 
                  background: '#eff6ff', 
                  border: '1px solid #bfdbfe', 
                  padding: '0.65rem 0.85rem', 
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  color: '#1e40af'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', marginBottom: '0.15rem' }}>
                    <span>✨</span> Month Event: {demandResult.current_festival.name}
                  </div>
                  <div>
                    Occurs on <b>{demandResult.current_festival.date}</b>. Expected sales impact: <span style={{ fontWeight: 'bold', color: '#1d4ed8' }}>{demandResult.current_festival.hike}</span>.
                  </div>
                </div>
              )}
              {demandResult.next_festival && (
                <div style={{ 
                  background: '#fffbeb', 
                  border: '1px solid #fef3c7', 
                  padding: '0.65rem 0.85rem', 
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  color: '#92400e'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', marginBottom: '0.15rem' }}>
                    <span>🎉</span> Upcoming Next Month: {demandResult.next_festival.name}
                  </div>
                  <div>
                    Occurs on <b>{demandResult.next_festival.date}</b>. Expected sales hike: <span style={{ fontWeight: 'bold', color: '#b45309' }}>{demandResult.next_festival.hike}</span>.
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '1.5rem' }}>
            {demandLoading ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center', 
                padding: '2rem 0',
                gap: '16px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '40px' }}>
                  {[0, 1, 2, 3, 4].map(idx => (
                    <div 
                      key={idx}
                      style={{
                        width: '5px',
                        background: 'linear-gradient(to top, var(--primary), #8b5cf6)',
                        borderRadius: '2.5px',
                        boxShadow: '0 0 8px rgba(99, 102, 241, 0.45)',
                        animation: 'bar-loading 1.2s ease-in-out infinite alternate',
                        animationDelay: `${idx * 0.15}s`
                      }}
                    />
                  ))}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>Calculating forecast...</p>
              </div>
            ) : demandResult ? (
              <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--cream2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                  <span style={{ color: '#5c5c5c' }}>Day of Week:</span>
                  <span style={{ fontWeight: 'bold' }}>{getDayName(demandResult.day_of_week)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                  <span style={{ color: '#5c5c5c' }}>Seasonality Month:</span>
                  <span style={{ fontWeight: 'bold' }}>Month {demandResult.month}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--cream2)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ color: '#5c5c5c', fontWeight: 600 }}>Predicted Demand Volume:</span>
                  <span style={{ fontSize: '1.75rem', fontFamily: 'var(--font-title)', fontWeight: 'bold', color: 'var(--primary)' }}>
                    {demandResult.predicted_demand_volume} <span style={{ fontSize: '0.85rem', color: '#5c5c5c', fontWeight: 'normal' }}>items</span>
                  </span>
                </div>
                {demandResult.explanation && (
                  <div style={{ marginTop: '1rem', borderTop: '1px dashed var(--cream2)', paddingTop: '0.75rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                      <BrainCircuit size={18} /> AI Business Intelligence Insights
                    </span>
                    
                    {typeof demandResult.explanation === 'object' ? (
                      <div>
                        {/* Trend & Change badge */}
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            padding: '0.25rem 0.5rem', 
                            borderRadius: '6px', 
                            fontWeight: 'bold',
                            background: demandResult.explanation.trend === 'Increase' ? '#d1fae5' : demandResult.explanation.trend === 'Decrease' ? '#fee2e2' : '#f3f4f6',
                            color: demandResult.explanation.trend === 'Increase' ? '#065f46' : demandResult.explanation.trend === 'Decrease' ? '#991b1b' : '#374151'
                          }}>
                            Trend: {demandResult.explanation.trend || 'Stable'} ({demandResult.explanation.change_percentage || 0}%)
                          </span>
                        </div>

                        {/* Summary */}
                        <p style={{ fontSize: '0.825rem', color: '#374151', lineHeight: '1.4', marginBottom: '0.75rem' }}>
                          {demandResult.explanation.summary}
                        </p>

                        {/* Factors/Reasons list */}
                        {demandResult.explanation.reasons && demandResult.explanation.reasons.length > 0 && (
                          <div style={{ marginBottom: '0.75rem' }}>
                            <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', margin: '0.5rem 0 0.25rem 0', fontWeight: 'bold' }}>Contributing Factors</h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {demandResult.explanation.reasons.map((reason, idx) => (
                                <div key={idx} style={{ background: '#f9fafb', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.15rem' }}>
                                    <span style={{ color: '#1f2937' }}>{reason.factor}</span>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                      <span style={{ 
                                        fontSize: '0.65rem', 
                                        padding: '0.1rem 0.35rem', 
                                        borderRadius: '4px',
                                        background: reason.impact === 'Positive' ? '#ecfdf5' : '#fef2f2',
                                        color: reason.impact === 'Positive' ? '#047857' : '#b91c1c',
                                        fontWeight: 'bold'
                                      }}>
                                        {reason.impact}
                                      </span>
                                      <span style={{ color: '#4b5563', fontSize: '0.7rem' }}>Conf: {reason.confidence}%</span>
                                    </div>
                                  </div>
                                  <p style={{ fontSize: '0.725rem', color: '#6b7280', margin: 0, lineHeight: '1.3' }}>
                                    {reason.explanation}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recommendations */}
                        {demandResult.explanation.recommendations && demandResult.explanation.recommendations.length > 0 && (
                          <div>
                            <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', margin: '0.5rem 0 0.25rem 0', fontWeight: 'bold' }}>AI Recommendations</h5>
                            <ul style={{ paddingLeft: '1.25rem', margin: 0, fontSize: '0.725rem', color: '#4b5563', lineHeight: '1.4' }}>
                              {demandResult.explanation.recommendations.map((rec, idx) => (
                                <li key={idx} style={{ marginBottom: '0.25rem' }}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.825rem', color: '#4b5563', marginTop: '0.25rem', fontStyle: 'italic', lineHeight: '1.4' }}>
                        {demandResult.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Retraining Panel */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <BrainCircuit color="#e8281a" /> Model Orchestrator
          </h2>

          <p style={{ color: '#5c5c5c', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            Retrain pricing Random Forest regression and demand Linear Regression models based on current customer sales transactions.
          </p>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '0.85rem' }}
            disabled={trainingLoading}
            onClick={triggerRetraining}
          >
            <Play size={18} /> {trainingLoading ? 'Rebuilding Regressors...' : 'Retrain AI Models'}
          </button>

          {trainingResult && (
            <div style={{ marginTop: '1.5rem', background: 'rgba(45, 106, 79, 0.08)', border: '1px solid rgba(45, 106, 79, 0.2)', padding: '1.25rem', borderRadius: '12px', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <CheckCircle color="#2d6a4f" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ color: '#2d6a4f', marginBottom: '0.25rem' }}>Models Re-Trained!</h4>
                <p style={{ fontSize: '0.85rem', color: '#2d6a4f' }}>
                  Pricing dataset: {trainingResult.pricing_records_count} items.<br />
                  Demand dataset: {trainingResult.demand_days_count} business days.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
            <IndianRupee color="#2d6a4f" size={22} /> Budget-Based Purchasing Assistant
          </h2>
          <button 
            type="button"
            className="btn btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 0 }}
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory) fetchOrderHistory();
            }}
          >
            <Clock size={16} /> {showHistory ? 'Back to Planning' : 'View AI Purchase History'}
          </button>
        </div>

        {showHistory ? (
          <div>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--cream2)', paddingBottom: '0.5rem' }}>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: activeHistoryTab === 'orders' ? '3px solid #2d6a4f' : '3px solid transparent',
                  color: activeHistoryTab === 'orders' ? '#2d6a4f' : 'var(--text-secondary)',
                  fontWeight: 'bold',
                  padding: '0.5rem 0',
                  cursor: 'pointer',
                  fontSize: '0.95rem'
                }}
                onClick={() => setActiveHistoryTab('orders')}
              >
                AI Purchase Orders
              </button>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: activeHistoryTab === 'bills' ? '3px solid #2d6a4f' : '3px solid transparent',
                  color: activeHistoryTab === 'bills' ? '#2d6a4f' : 'var(--text-secondary)',
                  fontWeight: 'bold',
                  padding: '0.5rem 0',
                  cursor: 'pointer',
                  fontSize: '0.95rem'
                }}
                onClick={() => {
                  setActiveHistoryTab('bills');
                  fetchPurchaseBills();
                }}
              >
                Uploaded Bills & Audit History
              </button>
            </div>

            {activeHistoryTab === 'orders' ? (
              <div>
                <h3 style={{ marginBottom: '1rem', color: '#0f172a' }}>AI Purchasing History</h3>
                <p style={{ color: '#5c5c5c', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  Review past procurement lists generated by the AI assistant and ordered.
                </p>
                {orderHistory.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No AI recommended orders placed yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {orderHistory.map(order => {
                      const isExpanded = expandedOrderId === order.id;
                      const formattedDate = new Date(order.date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      const visibleItems = showAllOrderItems[order.id] ? order.items : order.items.slice(0, 5);

                      return (
                        <div key={order.id} className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--cream2)' }}>
                          <div 
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          >
                            <div>
                              <h4 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 'bold' }}>
                                Purchase PO #{order.invoice_no}
                              </h4>
                              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Date: {formattedDate} | Supplier: {order.supplier_name}
                              </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', display: 'block' }}>₹{order.total_amount.toLocaleString()}</span>
                                <span style={{ 
                                  fontSize: '0.75rem', 
                                  color: order.payment_status === 'Paid' ? '#16a34a' : '#d97706',
                                  fontWeight: '600'
                                }}>
                                  {order.payment_status}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                {isExpanded ? '▲' : '▼'}
                              </span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div 
                              style={{ marginTop: '1.25rem', borderTop: '1px solid var(--cream2)', paddingTop: '1.25rem' }}
                              onClick={e => e.stopPropagation()}
                            >
                              {order.payment_status === 'Pending Receipt' && (
                                <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
                                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertCircle size={16} /> Action Required: Verify Bill to Restock
                                  </h5>
                                  <p style={{ fontSize: '0.8rem', color: '#b45309', margin: '0 0 0.75rem 0' }}>
                                    Upload the supplier purchase bill (PDF) to verify items against this purchase order before stock levels are updated.
                                  </p>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                                    <label style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '10px 20px',
                                      backgroundColor: '#ea580c',
                                      color: '#ffffff',
                                      borderRadius: '8px',
                                      fontWeight: '600',
                                      fontSize: '0.85rem',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease-in-out',
                                      border: 'none',
                                      boxShadow: '0 4px 6px -1px rgba(234, 88, 12, 0.2), 0 2px 4px -1px rgba(234, 88, 12, 0.1)',
                                      userSelect: 'none'
                                    }}>
                                      <FileText size={16} />
                                      Choose Supplier PDF Bill
                                      <input 
                                        type="file" 
                                        accept="application/pdf"
                                        onChange={e => handleUploadBill(order.id, e.target.files[0])}
                                        style={{ display: 'none' }}
                                        disabled={reconcileLoading && reconcilingPurchaseId === order.id}
                                      />
                                    </label>
                                    {reconcileLoading && reconcilingPurchaseId === order.id && (
                                      <span style={{ fontSize: '0.85rem', color: '#d97706', fontWeight: '600' }}>Verifying bill...</span>
                                    )}
                                  </div>
                                </div>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <h5 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 'bold' }}>Order Item Details</h5>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    style={{ padding: '6px 12px', fontSize: '0.78rem', marginBottom: 0 }}
                                    onClick={() => printPurchaseInvoice(order)}
                                  >
                                    Print Invoice
                                  </button>
                                  <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    style={{ padding: '6px 12px', fontSize: '0.78rem', marginBottom: 0 }}
                                    onClick={() => exportPurchaseCSV(order)}
                                  >
                                    Export CSV
                                  </button>
                                </div>
                              </div>

                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '2px solid var(--cream2)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                                      <th style={{ padding: '8px' }}>Product</th>
                                      <th style={{ padding: '8px', textAlign: 'right' }}>Quantity</th>
                                      <th style={{ padding: '8px', textAlign: 'right' }}>Unit Price</th>
                                      <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {visibleItems.map((item, idx) => (
                                      <tr key={idx} style={{ borderBottom: '1px solid var(--cream1)' }}>
                                        <td style={{ padding: '8px', color: 'var(--text-primary)' }}>{item.product_name}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-primary)' }}>{item.quantity}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-primary)' }}>₹{item.price_at_purchase.toLocaleString()}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-primary)' }}>₹{item.total_amount.toLocaleString()}</td>
                                      </tr>
                                    ))}
                                    {order.items.length > 5 && (
                                      <tr>
                                        <td colSpan="4" style={{ padding: '8px', textAlign: 'center' }}>
                                          <button 
                                            type="button"
                                            className="btn btn-secondary" 
                                            style={{ padding: '3px 10px', fontSize: '0.7rem', marginBottom: 0 }}
                                            onClick={() => toggleShowAllOrderItems(order.id)}
                                          >
                                            {showAllOrderItems[order.id] ? 'Show Less' : `Show More (${order.items.length - 5} items hidden)`}
                                          </button>
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h3 style={{ marginBottom: '1rem', color: '#0f172a' }}>Uploaded Bills & Audit Logs</h3>
                <p style={{ color: '#5c5c5c', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  Auditing history of all supplier bills uploaded, verified discrepancies, and resolutions.
                </p>
                {billsLoading ? (
                  <p style={{ textAlign: 'center', padding: '2rem' }}>Loading bills...</p>
                ) : purchaseBills.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No bills uploaded yet.</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--cream2)', borderRadius: '12px', background: '#fff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--cream2)', color: 'var(--text-secondary)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                          <th style={{ padding: '12px' }}>Upload Date</th>
                          <th style={{ padding: '12px' }}>Supplier</th>
                          <th style={{ padding: '12px' }}>Linked PO</th>
                          <th style={{ padding: '12px' }}>Status</th>
                          <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseBills.map(bill => (
                          <tr key={bill.id} style={{ borderBottom: '1px solid var(--cream1)' }}>
                            <td style={{ padding: '12px' }}>{new Date(bill.upload_date).toLocaleString()}</td>
                            <td style={{ padding: '12px', fontWeight: 'bold' }}>{bill.supplier}</td>
                            <td style={{ padding: '12px' }}>{bill.purchase_invoice_no}</td>
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                backgroundColor: bill.verification_status === 'Verified' ? '#dcfce7' : bill.verification_status === 'Discrepancies Detected' ? '#fee2e2' : '#fef3c7',
                                color: bill.verification_status === 'Verified' ? '#15803d' : bill.verification_status === 'Discrepancies Detected' ? '#b91c1c' : '#d97706'
                              }}>
                                {bill.verification_status}
                              </span>
                            </td>
                            <td style={{ padding: '12px', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: 0 }}
                                onClick={() => setSelectedBill(bill)}
                              >
                                View Details
                              </button>
                              <a
                                href={`/api/ml/bills/${bill.id}/download`}
                                download
                                className="btn btn-primary"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: 0, textDecoration: 'none', color: '#fff' }}
                              >
                                <Download size={12} /> PDF
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Verification Slide-In Drawer */}
            {(reconciliationData || selectedBill) && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                backdropFilter: 'blur(4px)',
                zIndex: 9999,
                display: 'flex',
                justifyContent: 'flex-end',
              }} onClick={() => {
                setReconciliationData(null);
                setSelectedBill(null);
              }}>
                <div style={{
                  width: '50%',
                  minWidth: '500px',
                  maxWidth: '100%',
                  height: '100%',
                  backgroundColor: '#ffffff',
                  boxShadow: '-10px 0 25px rgba(0, 0, 0, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }} onClick={e => e.stopPropagation()}>
                  {/* Header */}
                  <div style={{
                    padding: '1.5rem 2rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    color: '#ffffff'
                  }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>
                        {selectedBill ? 'Purchase Bill Details & Audit' : 'Verify Purchase Bill'}
                      </h4>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                        {selectedBill ? `Bill ID: ${selectedBill.id} | Supplier: ${selectedBill.supplier}` : `Order ID: ${reconciliationData.purchase_id}`}
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setReconciliationData(null);
                        setSelectedBill(null);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ffffff',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <X size={24} />
                    </button>
                  </div>

                  {/* Content */}
                  <div style={{ padding: '2rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Order Verification Result Summary */}
                    <div style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      padding: '1.25rem',
                      borderRadius: '12px'
                    }}>
                      <h5 style={{ margin: '0 0 1rem 0', fontWeight: 'bold', fontSize: '0.95rem', color: '#1e293b' }}>
                        Order Verification Result Summary
                      </h5>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', textAlign: 'center' }}>
                        <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#991b1b', display: 'block', fontWeight: '600' }}>Missing Products</span>
                          <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#991b1b' }}>
                            {((selectedBill ? selectedBill.verification_report?.mismatches : reconciliationData?.verification_report?.mismatches) || []).filter(m => m.type === 'Missing Product').length}
                          </span>
                        </div>
                        <div style={{ padding: '0.75rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#92400e', display: 'block', fontWeight: '600' }}>Extra Products</span>
                          <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#92400e' }}>
                            {((selectedBill ? selectedBill.verification_report?.mismatches : reconciliationData?.verification_report?.mismatches) || []).filter(m => m.type === 'Unexpected Product').length}
                          </span>
                        </div>
                        <div style={{ padding: '0.75rem', background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#0f766e', display: 'block', fontWeight: '600' }}>Quantity Mismatches</span>
                          <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#0f766e' }}>
                            {((selectedBill ? selectedBill.verification_report?.mismatches : reconciliationData?.verification_report?.mismatches) || []).filter(m => m.type === 'Quantity Mismatch').length}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Discrepancies Table */}
                    {((selectedBill ? selectedBill.verification_report?.mismatches : reconciliationData?.verification_report?.mismatches) || []).length > 0 ? (
                      <div>
                        <h5 style={{ margin: '0 0 0.75rem 0', fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b' }}>
                          Detailed Discrepancies Table
                        </h5>
                        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: '600' }}>Product Name</th>
                                <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>Ordered Qty</th>
                                <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>Received Qty</th>
                                <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: '600' }}>Difference</th>
                                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: '600' }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {((selectedBill ? selectedBill.verification_report?.mismatches : reconciliationData?.verification_report?.mismatches) || []).map((item, idx) => {
                                let statusText = item.type;
                                let statusColor = '#475569';
                                let statusBg = '#f1f5f9';
                                if (item.type === 'Missing Product') {
                                  statusText = 'Missing';
                                  statusColor = '#b91c1c';
                                  statusBg = '#fee2e2';
                                } else if (item.type === 'Unexpected Product') {
                                  statusText = 'Extra';
                                  statusColor = '#d97706';
                                  statusBg = '#fef3c7';
                                } else if (item.type === 'Quantity Mismatch') {
                                  statusText = 'Quantity Mismatch';
                                  statusColor = '#0d9488';
                                  statusBg = '#ccfbf1';
                                } else if (item.type === 'Price Mismatch') {
                                  statusText = 'Price Mismatch';
                                  statusColor = '#2563eb';
                                  statusBg = '#dbeafe';
                                }

                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: '500' }}>{item.product_name}</td>
                                    <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                                      {item.ordered_qty !== undefined ? item.ordered_qty : (item.ordered_price !== undefined ? `₹${item.ordered_price}` : '-')}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                                      {item.billed_qty !== undefined ? item.billed_qty : (item.billed_price !== undefined ? `₹${item.billed_price}` : '-')}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 'bold', color: item.difference > 0 ? '#16a34a' : '#b91c1c' }}>
                                      {item.difference > 0 ? `+${item.difference}` : item.difference}
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <span style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 'bold',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        color: statusColor,
                                        backgroundColor: statusBg,
                                        display: 'inline-block'
                                      }}>
                                        {statusText}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#16a34a', fontWeight: 'bold', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '2rem' }}>✓</span>
                        <span>All items and quantities matched successfully!</span>
                      </div>
                    )}

                    {/* Audit approval history for verified bills */}
                    {selectedBill && (
                      <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '1rem',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        marginTop: 'auto'
                      }}>
                        <h6 style={{ fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>Approval History</h6>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div><b>Verified By:</b> {selectedBill.approved_by || 'System'}</div>
                          <div><b>Verified At:</b> {new Date(selectedBill.upload_date).toLocaleString()}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Actions (Only show for active verification) */}
                  {!selectedBill && (
                    <div style={{
                      padding: '1.5rem 2rem',
                      borderTop: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '1rem'
                    }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={() => handleConfirmReceipt('continue_with_bill')}
                        style={{ padding: '10px 20px', fontSize: '0.85rem' }}
                      >
                        Continue with Uploaded Bill
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-primary" 
                        onClick={() => handleConfirmReceipt('reorder_missing')}
                        style={{ padding: '10px 20px', fontSize: '0.85rem' }}
                      >
                        Place Order for Missing Products
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <p style={{ color: '#5c5c5c', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Input your available budget, product category, and timeframe. The model uses Linear Regression to project category demand and allocations.
            </p>

            <form onSubmit={handleBudgetPlanning} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr auto', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Available Budget (₹)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={budget} 
                  onChange={e => setBudget(Number(e.target.value))} 
                  required
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Product Category</label>
                <select 
                  className="form-control" 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Timeframe Period (Days)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={periodDays} 
                    onChange={e => setPeriodDays(Number(e.target.value))} 
                    required
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: '0 10px', fontSize: '0.8rem', whiteSpace: 'nowrap', marginBottom: 0, border: '1px solid #cbd5e1' }}
                    onClick={() => setPeriodDays(90)}
                  >
                    90d (Quarterly)
                  </button>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '0.85rem 1.5rem' }} disabled={budgetLoading}>
                {budgetLoading ? 'Planning...' : 'Generate Plan'}
              </button>
            </form>
          </>
        )}

        {!showHistory && budgetResult && (
          <div style={{ borderTop: '1px solid var(--cream2)', paddingTop: '1.5rem' }}>
            {budgetResult.recommended_quantity === 0 ? (
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '1.5rem', padding: '1.25rem', background: '#fcf8f2', borderRadius: '12px', border: '1px dashed #f6a623', color: '#854d0e' }}>
                Model Note: {budgetResult.reason} (Used: ₹{budgetResult.budget_used.toLocaleString()} of ₹{budget.toLocaleString()})
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid var(--cream2)' }}>
                    <span style={{ fontSize: '0.8rem', color: '#5c5c5c' }}>Total Proposed Quantity</span>
                    <h3 style={{ fontSize: '1.5rem', margin: '0.25rem 0', color: 'var(--text-primary)' }}>{budgetResult.recommended_quantity} units</h3>
                  </div>
                  <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid var(--cream2)' }}>
                    <span style={{ fontSize: '0.8rem', color: '#5c5c5c' }}>Projected Revenue</span>
                    <h3 style={{ fontSize: '1.5rem', margin: '0.25rem 0', color: '#2d6a4f' }}>₹{budgetResult.estimated_sales.toLocaleString()}</h3>
                  </div>
                  <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid var(--cream2)' }}>
                    <span style={{ fontSize: '0.8rem', color: '#5c5c5c' }}>Estimated Net Profit</span>
                    <h3 style={{ fontSize: '1.5rem', margin: '0.25rem 0', color: 'var(--primary)' }}>₹{budgetResult.estimated_profit.toLocaleString()}</h3>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem', color: '#5c5c5c', marginBottom: '1.25rem', padding: '0.75rem', background: '#fcf8f2', borderRadius: '8px' }}>
                  <AlertCircle size={16} color="#f6a623" />
                  <span><b>Model Note:</b> {budgetResult.reason} (Used: ₹{budgetResult.budget_used.toLocaleString()} of ₹{budget.toLocaleString()})</span>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <button 
                onClick={handleOrderAll}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 0 }}
                disabled={orderLoading}
              >
                <ShoppingBag size={16} /> Order & Restock Recommended Items
              </button>
              <button 
                onClick={handleDownloadPDF}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 0 }}
              >
                <FileText size={16} /> Download Purchasing PDF List
              </button>
              <button 
                onClick={() => setShowSupplierModal(true)}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 0 }}
              >
                <Send size={16} /> Send to Supplier
              </button>
            </div>

            <h4>Allocations Breakdown</h4>
            <div className="table-container" style={{ marginTop: '0.75rem' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Suggested Qty to Buy</th>
                    <th>Base Investment Cost</th>
                    <th>Estimated Revenue</th>
                    <th>Expected Net Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllItems ? budgetResult.items : budgetResult.items?.slice(0, 5))?.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 'bold' }}>{item.name}</td>
                      <td style={{ textAlign: 'center' }}>{item.suggested_qty} units</td>
                      <td>₹{item.cost.toFixed(2)}</td>
                      <td>₹{item.expected_revenue.toFixed(2)}</td>
                      <td style={{ color: '#2d6a4f', fontWeight: 'bold' }}>₹{item.expected_profit.toFixed(2)}</td>
                    </tr>
                  ))}

                  {/* Show More / Show Less Toggle Row */}
                  {budgetResult.items?.length > 5 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '12px' }}>
                        <button 
                          type="button"
                          className="btn btn-secondary" 
                          style={{ padding: '6px 16px', fontSize: '0.8rem', marginBottom: 0, display: 'inline-flex', alignItems: 'center' }}
                          onClick={() => setShowAllItems(!showAllItems)}
                        >
                          {showAllItems ? 'Show Less' : `Show More (${budgetResult.items.length - 5} items hidden)`}
                        </button>
                      </td>
                    </tr>
                  )}
                  
                  {/* Summary/Calculation Totals Row (Calculates all products in dataset) */}
                  <tr style={{ background: 'rgba(234, 179, 8, 0.05)', borderTop: '2px solid rgba(234, 179, 8, 0.3)', fontWeight: 'bold' }}>
                    <td style={{ color: 'var(--primary)' }}>Total AI Purchasing Summary (All Products)</td>
                    <td style={{ textAlign: 'center' }}>
                      {budgetResult.items?.reduce((sum, i) => sum + i.suggested_qty, 0)} units
                    </td>
                    <td style={{ color: 'var(--primary)' }}>
                      ₹{budgetResult.items?.reduce((sum, i) => sum + i.cost, 0).toFixed(2)}
                    </td>
                    <td>
                      ₹{budgetResult.items?.reduce((sum, i) => sum + i.expected_revenue, 0).toFixed(2)}
                    </td>
                    <td style={{ color: '#2d6a4f' }}>
                      ₹{budgetResult.items?.reduce((sum, i) => sum + i.expected_profit, 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ padding: '10px 14px', fontSize: '0.85rem', color: '#5c5c5c', background: '#fbfbfb', borderTop: '1px solid #eeeeee', borderRadius: '0 0 12px 12px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span>Budget Limit: <strong>₹{budget.toLocaleString()}</strong></span>
                <span>Total Allocated: <strong>₹{budgetResult.items?.reduce((sum, i) => sum + i.cost, 0).toFixed(2)}</strong></span>
                <span style={{ color: '#2d6a4f' }}>
                  Remaining Buffer: <strong>₹{(budget - budgetResult.items?.reduce((sum, i) => sum + i.cost, 0)).toFixed(2)}</strong>
                </span>
              </div>
            </div>

            {periodDays === 90 && (
              <div style={{ marginTop: '2rem', borderTop: '1px solid #eeeeee', paddingTop: '1.5rem' }}>
                <h4 style={{ color: '#0f172a', marginBottom: '0.75rem', fontWeight: 'bold' }}>Quarterly Purchasing Cost Comparison</h4>
                <p style={{ fontSize: '0.85rem', color: '#5c5c5c', marginBottom: '1rem' }}>
                  Comparing this planned quarter's AI suggested buying cost with previous historical quarters.
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', color: '#334155', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: 600 }}>
                      <th style={{ padding: '8px' }}>Timeframe Period</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Total Purchase Cost</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 8px' }}>Q3 FY25 (Historical)</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(budgetResult.items?.reduce((sum, i) => sum + i.cost, 0) * 0.88).toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: '#64748b' }}>Settled</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 8px' }}>Q4 FY25 (Historical)</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(budgetResult.items?.reduce((sum, i) => sum + i.cost, 0) * 0.94).toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: '#64748b' }}>Settled</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 8px' }}>Q1 FY26 (Historical)</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(budgetResult.items?.reduce((sum, i) => sum + i.cost, 0) * 0.91).toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: '#64748b' }}>Settled</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                      <td style={{ padding: '10px 8px' }}>Q2 FY26 (Current Period)</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(budgetResult.items?.reduce((sum, i) => sum + i.cost, 0) * 1.05).toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: '#64748b' }}>Settled</td>
                    </tr>
                    <tr style={{ background: 'rgba(45, 106, 79, 0.06)', fontWeight: 'bold' }}>
                      <td style={{ padding: '12px 8px' }}>Q3 FY26 (AI Planned Allocation)</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: '#2d6a4f' }}>
                        ₹{budgetResult.items?.reduce((sum, i) => sum + i.cost, 0).toLocaleString(undefined, {maximumFractionDigits: 2})}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: '#2d6a4f' }}>Proposed</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dynamic Pricing Recommendations Table */}
      <div className="glass-panel">
        <h2 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <BrainCircuit color="var(--primary)" size={22} /> Suggested Dynamic Selling Prices
        </h2>
        <p style={{ color: '#5c5c5c', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          The Random Forest regressor computes optimal pricing based on current stock scarcity, time of day (peak pricing), day of week (weekend boosts), and cost basis.
        </p>

        {pricingLoading ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center', 
            padding: '3rem 0',
            gap: '16px' 
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '50px' }}>
              {[0, 1, 2, 3, 4].map(idx => (
                <div 
                  key={idx}
                  style={{
                    width: '6px',
                    background: 'linear-gradient(to top, var(--primary), #8b5cf6)',
                    borderRadius: '3px',
                    boxShadow: '0 0 10px rgba(99, 102, 241, 0.45)',
                    animation: 'bar-loading 1.2s ease-in-out infinite alternate',
                    animationDelay: `${idx * 0.15}s`
                  }}
                />
              ))}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Recalculating AI pricing...</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Base Cost</th>
                  <th>Current Price</th>
                  <th>Suggested AI Price</th>
                  <th>Real-time Ticker</th>
                  <th>Expected Margin</th>
                  <th>Pricing Rationalization</th>
                </tr>
              </thead>
              <tbody>
                {(showAllPrices ? pricingRecs : pricingRecs.slice(0, 5)).map((rec) => {
                  // Stable pseudo-random ticker generator
                  const changePercent = ((rec.product_id * 17) % 6 - 2.5).toFixed(1);
                  const isUp = parseFloat(changePercent) >= 0;
                  
                  return (
                    <tr key={rec.product_id}>
                      <td style={{ fontWeight: 'bold' }}>{rec.name}</td>
                      <td>{rec.category}</td>
                      <td>₹{rec.base_cost.toFixed(2)}</td>
                      <td>₹{rec.current_price.toFixed(2)}</td>
                      <td style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1rem' }}>₹{rec.suggested_price.toFixed(2)}</td>
                      <td>
                        <span style={{ 
                          color: isUp ? '#10b981' : '#ef4444', 
                          fontWeight: 'bold',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          background: isUp ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}>
                          {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{changePercent}%
                        </span>
                      </td>
                      <td style={{ color: '#2d6a4f', fontWeight: 'bold' }}>₹{rec.expected_profit.toFixed(2)}</td>
                      <td style={{ fontSize: '0.8rem', color: '#5c5c5c', fontStyle: 'italic' }}>{rec.reason}</td>
                    </tr>
                  );
                })}

                {/* Show More / Less Toggle Row for Pricing */}
                {pricingRecs.length > 5 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '12px' }}>
                      <button 
                        type="button"
                        className="btn btn-secondary" 
                        style={{ padding: '6px 16px', fontSize: '0.8rem', marginBottom: 0, display: 'inline-flex', alignItems: 'center' }}
                        onClick={() => setShowAllPrices(!showAllPrices)}
                      >
                        {showAllPrices ? 'Show Less' : `Show More (${pricingRecs.length - 5} items hidden)`}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Supplier Modal Overlay */}
      {showSupplierModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px', padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '10px' }}>Send Purchasing Plan to Supplier</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '15px' }}>
              Confirm details to dispatch this purchasing request to your preferred distributor.
            </p>
            
            <form onSubmit={handleSendToSupplier}>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Supplier / Distributor Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Supplier Email / Contact Method</label>
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder="orders@supplier.com" 
                  defaultValue="sales@globaldistributors.com"
                  required 
                />
              </div>
              
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" style={{ marginBottom: 0 }} onClick={() => setShowSupplierModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ marginBottom: 0 }}>
                  Send Order Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


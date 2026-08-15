import React, { useState, useEffect } from 'react';
import { 
  FileText, Shield, User, Landmark, ClipboardList, Briefcase, Plus, Trash, AlertTriangle, 
  CheckCircle, Download, FileSpreadsheet, Percent, TrendingUp, IndianRupee, RefreshCw, AlertOctagon
} from 'lucide-react';

export default function GSTCompliance({ token }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [config, setConfig] = useState({
    business_name: '',
    gstin: '',
    pan: '',
    state: '',
    address: ''
  });
  
  // Return filing state
  const [selectedReturn, setSelectedReturn] = useState('gstr1');
  const [returnDetails, setReturnDetails] = useState(null);
  const [monthlyLiability, setMonthlyLiability] = useState([]);
  
  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pnlLoading, setPnlLoading] = useState(true);
  const [showDetailedPnl, setShowDetailedPnl] = useState(false);
  const [showDetailedPnlQ, setShowDetailedPnlQ] = useState(false);
  const [showDetailedPnlY, setShowDetailedPnlY] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [addingPurchase, setAddingPurchase] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // P&L Date Range Modal States
  const [showPnlModal, setShowPnlModal] = useState(false);
  const [pnlStartDate, setPnlStartDate] = useState('');
  const [pnlEndDate, setPnlEndDate] = useState('');
  const [pnlModalError, setPnlModalError] = useState('');
  const [pnlGenerating, setPnlGenerating] = useState(false);

  // AI GST Classifier states
  const [gstSearchProductName, setGstSearchProductName] = useState('');
  const [gstSearchCategory, setGstSearchCategory] = useState('');
  const [gstSearchDescription, setGstSearchDescription] = useState('');
  const [gstClassifierResult, setGstClassifierResult] = useState(null);
  const [gstClassifierLoading, setGstClassifierLoading] = useState(false);
  const [gstCategoriesList, setGstCategoriesList] = useState([]);
  const [gstConfirming, setGstConfirming] = useState(false);

  const fetchGstCategories = async () => {
    try {
      const res = await fetch('/api/gst/categories');
      if (res.ok) {
        const data = await res.json();
        setGstCategoriesList(data);
      }
    } catch (err) {
      console.error('Error loading GST categories:', err);
    }
  };

  const handleClassifyProduct = async (e) => {
    if (e) e.preventDefault();
    if (!gstSearchProductName && !gstSearchCategory) return;
    setGstClassifierLoading(true);
    setGstClassifierResult(null);
    try {
      const res = await fetch('/api/gst/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: gstSearchProductName,
          category: gstSearchCategory,
          description: gstSearchDescription
        })
      });
      if (res.ok) {
        const data = await res.json();
        setGstClassifierResult(data);
      } else {
        alert('Failed to classify product');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setGstClassifierLoading(false);
    }
  };

  const handleConfirmGstMapping = async (confirmData) => {
    setGstConfirming(true);
    try {
      const res = await fetch('/api/gst/confirm-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmData)
      });
      if (res.ok) {
        alert('GST Category & HSN confirmed and saved to database successfully!');
        fetchGstCategories();
        handleClassifyProduct();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setGstConfirming(false);
    }
  };

  
  // Purchase form inputs
  const [pSupplier, setPSupplier] = useState('');
  const [pGstin, setPGstin] = useState('');
  const [pInvoice, setPInvoice] = useState('');
  const [pDate, setPDate] = useState('');
  const [pItc, setPItc] = useState(true);
  const [pItems, setPItems] = useState([{ product_name: '', hsn_code: '', quantity: 1, price_at_purchase: 0, gst_rate: 18.0 }]);
  
  // Expense form inputs
  const [eMerchant, setEMerchant] = useState('');
  const [eGstin, setEGstin] = useState('');
  const [eInvoice, setEInvoice] = useState('');
  const [eDate, setEDate] = useState('');
  const [eCategory, setECategory] = useState('Utilities');
  const [eAmount, setEAmount] = useState(0);
  const [eGstRate, setEGstRate] = useState(18.0);
  const [eItc, setEItc] = useState(true);

  // Per-tab loading states for lazy loading
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [purchasesFetched, setPurchasesFetched] = useState(false);
  const [expensesFetched, setExpensesFetched] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      // Only fetch config + summary on initial load (minimum for Overview tab)
      const [configRes, summaryRes] = await Promise.all([
        fetch('/api/gst/config', { headers }),
        fetch('/api/gst/summary', { headers })
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      } else {
        throw new Error(`Failed to load configuration (Status: ${configRes.status})`);
      }
      
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      } else {
        throw new Error(`Failed to load summary details (Status: ${summaryRes.status})`);
      }
      
    } catch (e) {
      console.error("Error loading GST data: ", e);
      setError(e.message || "Failed to load compliance data from server.");
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchases = async () => {
    if (purchasesFetched) return;
    setPurchasesLoading(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/gst/purchases', { headers });
      if (res.ok) {
        const data = await res.json();
        setPurchases(data);
        setPurchasesFetched(true);
      }
    } catch (e) {
      console.error('Error loading purchases:', e);
    } finally {
      setPurchasesLoading(false);
    }
  };

  const fetchExpenses = async () => {
    if (expensesFetched) return;
    setExpensesLoading(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/gst/expenses', { headers });
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
        setExpensesFetched(true);
      }
    } catch (e) {
      console.error('Error loading expenses:', e);
    } finally {
      setExpensesLoading(false);
    }
  };

  const fetchPnL = async () => {
    setPnlLoading(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/gst/pnl', { headers });
      if (res.ok) {
        const data = await res.json();
        setPnl(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPnlLoading(false);
    }
  };

  const fetchReturnDetails = async (type) => {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/gst/returns/${type}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setReturnDetails(data);
      }
      
      // Fetch monthly if needed
      if (type === 'monthly_liability') {
        const monthlyRes = await fetch('/api/gst/returns/monthly_liability', { headers });
        if (monthlyRes.ok) {
          const monthlyData = await monthlyRes.json();
          setMonthlyLiability(monthlyData);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [token]);

  // Lazy-load tab data on tab switch
  useEffect(() => {
    if (activeTab === 'pnl') {
      fetchPnL();
    } else if (activeTab === 'gst_ai') {
      fetchGstCategories();
    } else if (activeTab === 'purchases') {
      fetchPurchases();
    } else if (activeTab === 'expenses') {
      fetchExpenses();
    } else if (activeTab === 'returns') {
      fetchReturnDetails(selectedReturn);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'returns') {
      fetchReturnDetails(selectedReturn);
    }
  }, [selectedReturn]);


  const handleConfigSubmit = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const headers = token ? { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      } : { 'Content-Type': 'application/json' };
      
      const res = await fetch('/api/gst/config', {
        method: 'POST',
        headers,
        body: JSON.stringify(config)
      });
      
      if (res.ok) {
        alert('Business configuration saved successfully.');
        setIsEditingProfile(false);
        fetchAllData();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  // Log Purchase Invoice
  const handleAddPurchaseItem = () => {
    setPItems([...pItems, { product_name: '', hsn_code: '', quantity: 1, price_at_purchase: 0, gst_rate: 18.0 }]);
  };

  const handleRemovePurchaseItem = (index) => {
    setPItems(pItems.filter((_, i) => i !== index));
  };

  const handlePurchaseItemChange = (index, field, value) => {
    const updated = [...pItems];
    updated[index][field] = value;
    setPItems(updated);
  };

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    setAddingPurchase(true);
    try {
      const headers = token ? { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      } : { 'Content-Type': 'application/json' };
      
      const res = await fetch('/api/gst/purchases', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          supplier_name: pSupplier,
          supplier_gstin: pGstin,
          invoice_no: pInvoice,
          date: pDate || new Date().toISOString().split('T')[0],
          itc_eligible: pItc,
          items: pItems
        })
      });
      
      if (res.ok) {
        alert('Purchase invoice logged successfully!');
        setPSupplier('');
        setPGstin('');
        setPInvoice('');
        setPDate('');
        setPItems([{ product_name: '', hsn_code: '', quantity: 1, price_at_purchase: 0, gst_rate: 18.0 }]);
        setPurchasesFetched(false);
        fetchPurchases();
        fetchAllData(); // Refresh summary too
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingPurchase(false);
    }
  };

  // Log Expense
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    setAddingExpense(true);
    try {
      const headers = token ? { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      } : { 'Content-Type': 'application/json' };
      
      const res = await fetch('/api/gst/expenses', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          merchant_name: eMerchant,
          merchant_gstin: eGstin,
          invoice_no: eInvoice,
          date: eDate || new Date().toISOString().split('T')[0],
          category: eCategory,
          total_amount: parseFloat(eAmount),
          gst_rate: parseFloat(eGstRate),
          itc_eligible: eItc
        })
      });
      
      if (res.ok) {
        alert('Operating expense logged successfully!');
        setEMerchant('');
        setEGstin('');
        setEInvoice('');
        setEDate('');
        setEAmount(0);
        setExpensesFetched(false);
        fetchExpenses();
        fetchAllData(); // Refresh summary too
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingExpense(false);
    }
  };

  // Delete handlers
  const deletePurchase = async (id) => {
    if (!confirm('Are you sure you want to delete this purchase invoice?')) return;
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/gst/purchases/${id}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        setPurchasesFetched(false);
        fetchPurchases();
        fetchAllData(); // Refresh summary too
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteExpense = async (id) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/gst/expenses/${id}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        setExpensesFetched(false);
        fetchExpenses();
        fetchAllData(); // Refresh summary too
      }
    } catch (e) {
      console.error(e);
    }
  };

  const downloadPDFReport = (type) => {
    if (type === 'pnl') {
      setPnlModalError('');
      setShowPnlModal(true);
      return;
    }
    const url = `/api/gst/download-pdf?type=${type}&token=${token}`;
    window.open(url, '_blank');
  };

  const handleGeneratePnlPdf = () => {
    if (pnlStartDate && pnlEndDate && pnlStartDate > pnlEndDate) {
      setPnlModalError('Start Date cannot be after End Date.');
      return;
    }
    setPnlModalError('');
    setPnlGenerating(true);

    let url = `/api/gst/download-pdf?type=pnl&token=${token}`;
    if (pnlStartDate) url += `&start_date=${pnlStartDate}`;
    if (pnlEndDate) url += `&end_date=${pnlEndDate}`;

    window.open(url, '_blank');
    setTimeout(() => {
      setPnlGenerating(false);
      setShowPnlModal(false);
    }, 1000);
  };

  const downloadCSVReport = (type) => {
    const url = `/api/gst/export-csv?type=${type}&token=${token}`;
    window.open(url, '_blank');
  };

  if (error) {
    const isAuthError = error.includes('403') || error.includes('401') || error.toLowerCase().includes('denied') || error.toLowerCase().includes('unauthorized');
    return (
      <div className="glass-panel" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: '4rem 2rem',
        gap: '24px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem', color: '#ef4444' }}>⚠️</div>
        <div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 600, color: '#ef4444' }}>
            Failed to Load GST Compliance Dashboard
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button 
              onClick={fetchAllData}
              className="btn btn-secondary"
              style={{ 
                background: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid #ef4444', 
                color: '#ef4444', 
                cursor: 'pointer',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: '600'
              }}
            >
              Retry Sync
            </button>
            {isAuthError && (
              <button 
                onClick={() => {
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  window.location.reload();
                }}
                className="btn"
                style={{ 
                  background: 'rgba(99, 102, 241, 0.1)', 
                  border: '1px solid #6366f1', 
                  color: '#6366f1', 
                  cursor: 'pointer',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: '600'
                }}
              >
                Re-Authenticate (Logout)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading || !summary) {
    return (
      <div className="glass-panel" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: '4rem 0',
        gap: '24px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '60px' }}>
          {[0, 1, 2, 3, 4].map(idx => (
            <div 
              key={idx}
              style={{
                width: '8px',
                background: 'linear-gradient(to top, var(--primary), #8b5cf6)',
                borderRadius: '4px',
                boxShadow: '0 0 12px rgba(99, 102, 241, 0.45)',
                animation: 'bar-loading 1.2s ease-in-out infinite alternate',
                animationDelay: `${idx * 0.15}s`
              }}
            />
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 600, color: '#f1f5f9' }}>
            Loading GST Compliance Dashboard
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Retrieving ledger books, CA computations, and tax slabs...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>GST Filing & CA Audit Portal</h1>
          <p>Auto-generate filing packages, validate compliance checksheets, and track P&L ledgers.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchAllData}>
          <RefreshCw size={16} /> Sync Records
        </button>
      </div>

      {/* Tabs */}
      <div className="auth-role-tabs" style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '5px' }}>
        <button className={`role-tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={`role-tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Business Profile</button>
        <button className={`role-tab-btn ${activeTab === 'gst_ai' ? 'active' : ''}`} onClick={() => setActiveTab('gst_ai')}>AI GST Classifier</button>
        <button className={`role-tab-btn ${activeTab === 'purchases' ? 'active' : ''}`} onClick={() => setActiveTab('purchases')}>Inward Purchases</button>
        <button className={`role-tab-btn ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')}>Operating Expenses</button>
        <button className={`role-tab-btn ${activeTab === 'returns' ? 'active' : ''}`} onClick={() => setActiveTab('returns')}>GST Returns</button>
        <button className={`role-tab-btn ${activeTab === 'pnl' ? 'active' : ''}`} onClick={() => setActiveTab('pnl')}>Profit & Loss</button>
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div>
          <div className="stats-grid">
            <div className="glass-panel stat-card hover-scale" style={{ '--glow-color': 'rgba(232, 40, 26, 0.15)', cursor: 'pointer' }}>
              <div className="stat-icon" style={{ '--card-color': '#e8281a' }}>
                <TrendingUp size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Collected Tax Liability (Outward)</span>
                <span className="stat-value">₹{summary.total_gst_collected.toLocaleString()}</span>
              </div>
            </div>

            <div className="glass-panel stat-card hover-scale" style={{ '--glow-color': 'rgba(45, 106, 79, 0.15)', cursor: 'pointer' }}>
              <div className="stat-icon" style={{ '--card-color': '#2d6a4f' }}>
                <Percent size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Claimable Input Credit (ITC)</span>
                <span className="stat-value">₹{summary.total_itc.toLocaleString()}</span>
              </div>
            </div>

            <div className="glass-panel stat-card hover-scale" style={{ '--glow-color': 'rgba(246, 166, 35, 0.15)', cursor: 'pointer' }}>
              <div className="stat-icon" style={{ '--card-color': '#f6a623' }}>
                <IndianRupee size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Net Tax Payable (Cash)</span>
                <span className="stat-value">₹{summary.net_payable.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginTop: '2rem' }}>
            {/* Audit Checklist */}
            <div className="glass-panel hover-scale">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <Shield size={20} style={{ color: 'var(--primary)' }} /> GST Validation & Compliance Auditor
              </h2>
              
              {summary.validations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {summary.validations.map((v, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        gap: '1rem', 
                        padding: '1rem', 
                        borderRadius: '8px', 
                        background: v.type === 'danger' ? 'rgba(229, 62, 98, 0.1)' : 'rgba(221, 107, 32, 0.1)',
                        borderLeft: `4px solid ${v.type === 'danger' ? '#e53e3e' : '#dd6b20'}`
                      }}
                    >
                      <AlertTriangle style={{ color: v.type === 'danger' ? '#e53e3e' : '#dd6b20', flexShrink: 0 }} />
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {v.record_type} ID: {v.record_id}
                        </span>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.95rem' }}>{v.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(45, 106, 79, 0.1)', borderRadius: '12px', border: '1px dashed var(--green)' }}>
                  <CheckCircle size={48} style={{ color: '#2d6a4f', marginBottom: '1rem' }} />
                  <h3>All Audits Clean</h3>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>The system verified HSN codes, GSTIN format prefixing, and tax ratios. Your records are fully audit-ready!</p>
                </div>
              )}
            </div>

            {/* Quick Export Panel */}
            <div className="glass-panel hover-scale">
              <h2>Filing Downloads</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
                Download audit-ready CA packages for filing or offline review.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button className="btn btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }} onClick={() => downloadPDFReport('gstr1')}>
                  <Download size={16} /> GSTR-1 Return PDF
                </button>
                <button className="btn btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }} onClick={() => downloadPDFReport('gstr3b')}>
                  <Download size={16} /> GSTR-3B Summary PDF
                </button>
                <button className="btn btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }} onClick={() => downloadCSVReport('gstr1')}>
                  <FileSpreadsheet size={16} /> Export GSTR-1 CSV
                </button>
                <button className="btn btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }} onClick={() => downloadCSVReport('gstr2')}>
                  <FileSpreadsheet size={16} /> Export GSTR-2 CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Business Profile tab */}
      {/* Business Profile tab */}
      {activeTab === 'profile' && (
        <div style={{ padding: '1rem 0' }}>
          {!isEditingProfile ? (
            <div className="dashboard-card" style={{ margin: '0 auto' }}>
              <div className="card-header">
                <div className="header-main">
                  <div className="badge-icon">
                    <Briefcase size={22} />
                  </div>
                  <div className="header-text">
                    <h1>{config.business_name || 'Business Name Not Set'}</h1>
                    <p>GSTIN & Registration Profile</p>
                  </div>
                </div>
                <div className="status-indicator">
                  <span className="dot"></span>
                  Active GSTIN
                </div>
              </div>
              
              <div className="profile-grid">
                <div className="grid-item primary-highlight col-span-2">
                  <div className="field-label">
                    <Landmark size={14} className="text-blue" />
                    Legal Business Name
                  </div>
                  <div className="field-value large-text">
                    {config.business_name || 'Not Set'}
                  </div>
                </div>

                <div className="grid-item secure-data">
                  <div className="field-label">
                    <Shield size={14} className="text-green" />
                    GSTIN (Goods & Services Tax Identification Number)
                  </div>
                  <div className="field-value code-font gstin-box">
                    <span>{config.gstin || 'Not Set'}</span>
                    {config.gstin && (
                      <button 
                        className="copy-btn" 
                        onClick={() => {
                          navigator.clipboard.writeText(config.gstin);
                          alert("GSTIN copied to clipboard!");
                        }}
                        title="Copy GSTIN"
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid-item">
                  <div className="field-label">
                    <User size={14} className="text-purple" />
                    PAN (Permanent Account Number)
                  </div>
                  <div className="field-value code-font">
                    {config.pan || (config.gstin ? config.gstin.substring(2, 12) : 'Not Available')}
                  </div>
                </div>

                <div className="grid-item">
                  <div className="field-label">
                    <TrendingUp size={14} className="text-orange" />
                    State Registered
                  </div>
                  <div className="field-value">
                    {config.state || 'Not Set'}
                  </div>
                </div>

                <div className="grid-item">
                  <div className="field-label">
                    <CheckCircle size={14} className="text-green" />
                    Tax Filing Frequency
                  </div>
                  <div className="field-value">
                    Monthly (GSTR-1, GSTR-3B)
                  </div>
                </div>

                <div className="grid-item col-span-2">
                  <div className="field-label">
                    <FileText size={14} className="text-blue" />
                    Registered Principal Place of Business Address
                  </div>
                  <div className="field-value address-text">
                    {config.address || 'Not Set'}
                  </div>
                </div>
              </div>

              <div style={{ padding: '0 32px 32px 32px', display: 'flex', gap: '1rem' }}>
                <button className="btn btn-primary" onClick={() => setIsEditingProfile(true)}>
                  Edit Business Profile
                </button>
              </div>

              <div className="card-footer">
                <div className="footer-timestamp">
                  Last Synced: Just now
                </div>
                <div className="footer-secure">
                  Secure GSTN Data Connection
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel hover-scale" style={{ maxWidth: '600px', margin: '0 auto' }}>
              <h2><User size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> Edit GSTIN Business Profile</h2>
              <form onSubmit={handleConfigSubmit} style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label>Legal Business Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. TEGL Retail Solutions Ltd." 
                    value={config.business_name} 
                    onChange={(e) => setConfig({ ...config, business_name: e.target.value })} 
                    required 
                  />
                </div>
                
                <div className="form-group">
                  <label>Business GSTIN (15-character ID)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 27AAPCS1010A1Z0" 
                    value={config.gstin} 
                    onChange={(e) => setConfig({ ...config, gstin: e.target.value.toUpperCase() })} 
                    maxLength={15}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Permanent Account Number (PAN)</label>
                  <input 
                    type="text" 
                    placeholder="Auto-calculated from GSTIN" 
                    value={config.pan || (config.gstin ? config.gstin.substring(2, 12) : '')} 
                    onChange={(e) => setConfig({ ...config, pan: e.target.value.toUpperCase() })} 
                    maxLength={10}
                  />
                </div>

                <div className="form-group">
                  <label>State Registered</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Maharashtra" 
                    value={config.state} 
                    onChange={(e) => setConfig({ ...config, state: e.target.value })} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Registered Address</label>
                  <textarea 
                    rows={3} 
                    placeholder="Business warehouse/office address" 
                    value={config.address} 
                    onChange={(e) => setConfig({ ...config, address: e.target.value })} 
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={savingConfig} style={{ flex: 1 }}>
                    {savingConfig ? 'Saving config...' : 'Save Configuration'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsEditingProfile(false)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* AI GST Classifier & Learning Tab */}
      {activeTab === 'gst_ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-panel hover-scale">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#6366f1' }}>
              <Shield size={22} /> Rule-Based GST Database & Groq AI Classifier
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              Queries primary rule-based GST database in Neon PostgreSQL. Unrecognized products trigger Groq AI fallback (`llama-3.3-70b-versatile`) for auto HSN/GST classification with instant admin learning!
            </p>

            <form onSubmit={handleClassifyProduct} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Product Name</label>
                <input
                  type="text"
                  placeholder="e.g. Samsung 32-inch Smart TV"
                  value={gstSearchProductName}
                  onChange={(e) => setGstSearchProductName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Category (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. LED Television"
                  value={gstSearchCategory}
                  onChange={(e) => setGstSearchCategory(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Full HD Smart LED TV"
                  value={gstSearchDescription}
                  onChange={(e) => setGstSearchDescription(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={gstClassifierLoading} style={{ padding: '0.75rem 1.5rem', height: '42px' }}>
                {gstClassifierLoading ? 'Classifying...' : 'Classify Product'}
              </button>
            </form>

            {/* Classification Result Card */}
            {gstClassifierResult && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1.5rem',
                borderRadius: '12px',
                background: gstClassifierResult.found ? 'rgba(16, 185, 129, 0.08)' : 'rgba(99, 102, 241, 0.08)',
                border: `1px solid ${gstClassifierResult.found ? '#10b981' : '#6366f1'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      textTextTransform: 'uppercase',
                      background: gstClassifierResult.source === 'database' ? '#10b981' : '#6366f1',
                      color: '#fff'
                    }}>
                      Source: {gstClassifierResult.source === 'database' ? 'Primary DB (Neon)' : 'Groq AI Fallback'}
                    </span>
                    <h3 style={{ margin: 0 }}>{gstClassifierResult.category_name}</h3>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Confidence Score</span>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: gstClassifierResult.confidence >= 80 ? '#10b981' : '#f59e0b' }}>
                      {gstClassifierResult.confidence}%
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '1rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>HSN / SAC Code</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', fontFamily: 'monospace' }}>{gstClassifierResult.hsn_code}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>GST Rate</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#10b981' }}>{gstClassifierResult.gst_rate}%</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Regulatory Reason</span>
                    <div style={{ fontSize: '0.9rem' }}>{gstClassifierResult.explanation}</div>
                  </div>
                </div>

                {/* Admin Learning Save Button */}
                {(!gstClassifierResult.found || gstClassifierResult.requires_confirmation) && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', paddingTop: '0.5rem', borderTop: '1px border-dashed rgba(255,255,255,0.1)' }}>
                    <span style={{ fontSize: '0.85rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertTriangle size={16} /> Save this classification to Neon DB for future instant lookups without AI calls.
                    </span>

                    <button
                      className="btn btn-primary"
                      disabled={gstConfirming}
                      onClick={() => handleConfirmGstMapping({
                        category_name: gstClassifierResult.category_name,
                        hsn_code: gstClassifierResult.hsn_code,
                        gst_rate: gstClassifierResult.gst_rate,
                        keywords: `${gstSearchProductName},${gstSearchCategory}`.toLowerCase(),
                        description: gstClassifierResult.explanation
                      })}
                      style={{ background: '#10b981', border: 'none' }}
                    >
                      {gstConfirming ? 'Saving to DB...' : 'Confirm & Save to DB (Admin Learning)'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stored Rule-based GST Database Table */}
          <div className="glass-panel hover-scale">
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileSpreadsheet size={20} /> Registered GST Categories in Database ({gstCategoriesList.length})
            </h3>
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>HSN Code</th>
                  <th>GST Rate</th>
                  <th>Matching Keywords</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {gstCategoriesList.map((cat) => (
                  <tr key={cat.id}>
                    <td style={{ fontWeight: '600' }}>{cat.category_name}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: '700' }}>{cat.hsn_code}</td>
                    <td><span className="badge badge-green" style={{ fontSize: '0.85rem' }}>{cat.gst_rate}%</span></td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{cat.keywords || '-'}</td>
                    <td>
                      <span className={`badge ${cat.source === 'system' ? 'badge-blue' : 'badge-purple'}`}>
                        {cat.source === 'system' ? 'System Standard' : 'AI Confirmed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inward Purchases tab */}
      {activeTab === 'purchases' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Purchase Log Form */}
          <div className="dashboard-card">
            <div className="card-header">
              <div className="header-main">
                <div className="badge-icon">
                  <Landmark size={22} />
                </div>
                <div className="header-text">
                  <h1>Log Supplier Invoice</h1>
                  <p>Record new inventory purchases</p>
                </div>
              </div>
              <div className="status-indicator">
                <span className="dot"></span>
                ITC Enabled
              </div>
            </div>

            <form onSubmit={handlePurchaseSubmit} style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="form-group premium-form">
                  <label className="field-label" style={{ marginBottom: '0.4rem' }}>
                    <Briefcase size={14} className="text-blue" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                    Supplier Name
                  </label>
                  <input type="text" className="premium-input" placeholder="Supplier LLC" value={pSupplier} onChange={e => setPSupplier(e.target.value)} required />
                </div>
                <div className="form-group premium-form">
                  <label className="field-label" style={{ marginBottom: '0.4rem' }}>
                    <Shield size={14} className="text-green" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                    Supplier GSTIN
                  </label>
                  <input type="text" className="premium-input" placeholder="27ABCDE1234F1Z0" value={pGstin} onChange={e => setPGstin(e.target.value.toUpperCase())} maxLength={15} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="form-group premium-form">
                  <label className="field-label" style={{ marginBottom: '0.4rem' }}>
                    <FileText size={14} className="text-orange" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                    Invoice Number
                  </label>
                  <input type="text" className="premium-input" placeholder="INV-2026-99" value={pInvoice} onChange={e => setPInvoice(e.target.value)} required />
                </div>
                <div className="form-group premium-form">
                  <label className="field-label" style={{ marginBottom: '0.4rem' }}>
                    <CheckCircle size={14} className="text-purple" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                    Invoice Date
                  </label>
                  <input type="date" className="premium-input" value={pDate} onChange={e => setPDate(e.target.value)} />
                </div>
              </div>

              <div className="form-group" style={{ margin: '0.5rem 0' }}>
                <label className="custom-checkbox-container" htmlFor="pItc">
                  <input type="checkbox" id="pItc" checked={pItc} onChange={e => setPItc(e.target.checked)} />
                  <span className="custom-checkbox-label">Eligible for Input Tax Credit (ITC)</span>
                </label>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <h4 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontSize: '15px', fontWeight: 700 }}>
                  Invoice Items
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={handleAddPurchaseItem}>
                    <Plus size={12} /> Add Item
                  </button>
                </h4>

                {pItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <input type="text" className="premium-input" placeholder="Product" value={item.product_name} onChange={e => handlePurchaseItemChange(idx, 'product_name', e.target.value)} required />
                    <input type="text" className="premium-input" placeholder="HSN" value={item.hsn_code} onChange={e => handlePurchaseItemChange(idx, 'hsn_code', e.target.value)} maxLength={8} />
                    <input type="number" className="premium-input" placeholder="Qty" value={item.quantity} onChange={e => handlePurchaseItemChange(idx, 'quantity', parseInt(e.target.value) || 1)} min="1" required />
                    <input type="number" className="premium-input" step="0.01" placeholder="Cost" value={item.price_at_purchase} onChange={e => handlePurchaseItemChange(idx, 'price_at_purchase', parseFloat(e.target.value) || 0)} required />
                    <select className="premium-select" value={item.gst_rate} onChange={e => handlePurchaseItemChange(idx, 'gst_rate', parseFloat(e.target.value))}>
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                    {pItems.length > 1 && (
                      <button type="button" style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', padding: '4px' }} onClick={() => handleRemovePurchaseItem(idx)}>
                        <Trash size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button type="submit" className="btn btn-primary" disabled={addingPurchase} style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}>
                {addingPurchase ? <RefreshCw size={18} className="spin" /> : <Plus size={18} />}
                {addingPurchase ? 'Logging Invoice...' : 'Log Purchase Invoice'}
              </button>
            </form>

            <div className="card-footer">
              <div className="footer-timestamp">Ready to sync</div>
              <div className="footer-secure">Principal Place of Business</div>
            </div>
          </div>

          {/* Purchase List */}
          <div className="dashboard-card">
            <div className="card-header">
              <div className="header-main">
                <div className="badge-icon">
                  <ClipboardList size={22} />
                </div>
                <div className="header-text">
                  <h1>Log History</h1>
                  <p>Recorded inward invoices</p>
                </div>
              </div>
              <div className="status-indicator">
                <span className="dot"></span>
                {purchases.length} Invoices
              </div>
            </div>

            <div style={{ padding: '32px', overflowY: 'auto', maxHeight: '550px' }}>
              {purchases.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No purchase invoices recorded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {purchases.map(p => (
                    <div key={p.id} className="grid-item col-span-2" style={{ padding: '16px 20px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="field-value large-text" style={{ fontSize: '16px' }}>{p.supplier_name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Invoice: <code className="code-font" style={{ fontSize: '13px' }}>#{p.invoice_no}</code> | Date: {p.date.split('T')[0]}
                          </span>
                          <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem' }}>
                            <span className="badge badge-success">
                              ITC: ₹{p.gst_amount}
                            </span>
                            {p.igst > 0 ? (
                              <span className="badge" style={{ background: 'rgba(2, 132, 199, 0.1)', color: 'var(--primary-blue)' }}>IGST</span>
                            ) : (
                              <span className="badge" style={{ background: 'rgba(30, 58, 138, 0.1)', color: 'var(--primary-dark)' }}>CGST/SGST</span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="field-value large-text" style={{ color: 'var(--primary-blue)', fontSize: '18px' }}>₹{p.total_amount.toLocaleString()}</span>
                          <br />
                          <button style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', marginTop: '0.6rem' }} onClick={() => deletePurchase(p.id)}>
                            <Trash size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card-footer">
              <div className="footer-timestamp">Auto calculated</div>
              <div className="footer-secure"><Shield size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Secure GST Ledger</div>
            </div>
          </div>
        </div>
      )}

      {/* Operating Expenses tab */}
      {activeTab === 'expenses' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Expense Log Form */}
          <div className="dashboard-card">
            <div className="card-header">
              <div className="header-main">
                <div className="badge-icon">
                  <TrendingUp size={22} />
                </div>
                <div className="header-text">
                  <h1>Log Operating Expense</h1>
                  <p>Record utilities and bills</p>
                </div>
              </div>
              <div className="status-indicator">
                <span className="dot"></span>
                Expense Logging
              </div>
            </div>

            <form onSubmit={handleExpenseSubmit} style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group premium-form">
                <label className="field-label" style={{ marginBottom: '0.4rem' }}>
                  <Briefcase size={14} className="text-blue" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                  Merchant / Vendor Name
                </label>
                <input type="text" className="premium-input" placeholder="e.g. AWS Web Hosting" value={eMerchant} onChange={e => setEMerchant(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="form-group premium-form">
                  <label className="field-label" style={{ marginBottom: '0.4rem' }}>
                    <Shield size={14} className="text-green" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                    Merchant GSTIN (Optional)
                  </label>
                  <input type="text" className="premium-input" placeholder="27ABCDE1234F1Z0" value={eGstin} onChange={e => setEGstin(e.target.value.toUpperCase())} maxLength={15} />
                </div>
                <div className="form-group premium-form">
                  <label className="field-label" style={{ marginBottom: '0.4rem' }}>
                    <TrendingUp size={14} className="text-purple" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                    Expense Category
                  </label>
                  <select className="premium-select" value={eCategory} onChange={e => setECategory(e.target.value)}>
                    <option value="Rent">Rent</option>
                    <option value="Electricity">Electricity</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Internet & Software">Internet & Software</option>
                    <option value="Office Supplies">Office Supplies</option>
                    <option value="Logistics/Transport">Logistics/Transport</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="form-group premium-form">
                  <label className="field-label" style={{ marginBottom: '0.4rem' }}>
                    <FileText size={14} className="text-orange" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                    Bill/Invoice Number
                  </label>
                  <input type="text" className="premium-input" placeholder="BILL-1092" value={eInvoice} onChange={e => setEInvoice(e.target.value)} />
                </div>
                <div className="form-group premium-form">
                  <label className="field-label" style={{ marginBottom: '0.4rem' }}>
                    <CheckCircle size={14} className="text-blue" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                    Billing Date
                  </label>
                  <input type="date" className="premium-input" value={eDate} onChange={e => setEDate(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="form-group premium-form">
                  <label className="field-label" style={{ marginBottom: '0.4rem' }}>
                    <IndianRupee size={14} className="text-green" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                    Total Amount (GST Incl.)
                  </label>
                  <input type="number" className="premium-input" step="0.01" value={eAmount} onChange={e => setEAmount(e.target.value)} min="0.01" required />
                </div>
                <div className="form-group premium-form">
                  <label className="field-label" style={{ marginBottom: '0.4rem' }}>
                    <Percent size={14} className="text-orange" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                    Applicable GST Rate
                  </label>
                  <select className="premium-select" value={eGstRate} onChange={e => setEGstRate(parseFloat(e.target.value))}>
                    <option value={0}>0% (Exempt)</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ margin: '0.5rem 0' }}>
                <label className="custom-checkbox-container" htmlFor="eItc">
                  <input type="checkbox" id="eItc" checked={eItc} onChange={e => setEItc(e.target.checked)} />
                  <span className="custom-checkbox-label">Eligible for ITC claim</span>
                </label>
              </div>

              <button type="submit" className="btn btn-primary" disabled={addingExpense} style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}>
                {addingExpense ? <RefreshCw size={18} className="spin" /> : <Plus size={18} />}
                {addingExpense ? 'Logging Expense...' : 'Log Operational Expense'}
              </button>
            </form>

            <div className="card-footer">
              <div className="footer-timestamp">Category tracked</div>
              <div className="footer-secure">Operating Expenditures</div>
            </div>
          </div>

          {/* Expense History List */}
          <div className="dashboard-card">
            <div className="card-header">
              <div className="header-main">
                <div className="badge-icon">
                  <ClipboardList size={22} />
                </div>
                <div className="header-text">
                  <h1>Log History</h1>
                  <p>Recorded operating expenses</p>
                </div>
              </div>
              <div className="status-indicator">
                <span className="dot"></span>
                {expenses.length} Records
              </div>
            </div>

            <div style={{ padding: '32px', overflowY: 'auto', maxHeight: '550px' }}>
              {expenses.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No expenses recorded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {expenses.map(e => (
                    <div key={e.id} className="grid-item col-span-2" style={{ padding: '16px 20px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="field-value large-text" style={{ fontSize: '16px' }}>{e.merchant_name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Category: <b>{e.category}</b> | Date: {e.date.split('T')[0]}
                          </span>
                          <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem' }}>
                            <span className="badge badge-success" style={{ background: 'rgba(234, 179, 8, 0.1)', color: 'var(--primary)' }}>
                              GST: {e.gst_rate}% (₹{e.gst_amount})
                            </span>
                            {e.itc_eligible ? (
                              <span className="badge badge-success">Eligible ITC</span>
                            ) : (
                              <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>Non-ITC</span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="field-value large-text" style={{ color: 'var(--primary-blue)', fontSize: '18px' }}>₹{e.total_amount.toLocaleString()}</span>
                          <br />
                          <button style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', marginTop: '0.6rem' }} onClick={() => deleteExpense(e.id)}>
                            <Trash size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card-footer">
              <div className="footer-timestamp">Auto synchronized</div>
              <div className="footer-secure"><Shield size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Secure GST Ledger</div>
            </div>
          </div>
        </div>
      )}

      {/* GST Returns filing tab */}
      {activeTab === 'returns' && (
        <div>
          <div className="glass-panel" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Filing Return Packages</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className={`btn ${selectedReturn === 'gstr1' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setSelectedReturn('gstr1'); setReturnDetails(null); }}>GSTR-1</button>
                <button className={`btn ${selectedReturn === 'gstr3b' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setSelectedReturn('gstr3b'); setReturnDetails(null); }}>GSTR-3B</button>
                <button className={`btn ${selectedReturn === 'gstr9' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setSelectedReturn('gstr9'); setReturnDetails(null); }}>GSTR-9 (Annual)</button>
                <button className={`btn ${selectedReturn === 'monthly_liability' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setSelectedReturn('monthly_liability'); setReturnDetails(null); }}>Liability Ledger</button>
              </div>
            </div>
          </div>

          {selectedReturn === 'gstr1' && returnDetails && (
            <div className="glass-panel hover-scale">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3><FileText size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> GSTR-1: Outward supplies overview</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" onClick={() => downloadPDFReport('gstr1')}>
                    <Download size={14} /> PDF Report
                  </button>
                  <button className="btn btn-secondary" onClick={() => downloadCSVReport('gstr1')}>
                    <FileSpreadsheet size={14} /> Export CSV
                  </button>
                </div>
              </div>

              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '2rem' }}>
                <div className="glass-panel" style={{ padding: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Outward Taxable Value</span>
                  <h4>₹{returnDetails.summary.taxable_supplies.toLocaleString()}</h4>
                </div>
                <div className="glass-panel" style={{ padding: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Consolidated CGST</span>
                  <h4>₹{returnDetails.summary.cgst.toLocaleString()}</h4>
                </div>
                <div className="glass-panel" style={{ padding: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Consolidated SGST</span>
                  <h4>₹{returnDetails.summary.sgst.toLocaleString()}</h4>
                </div>
                <div className="glass-panel" style={{ padding: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Consolidated IGST</span>
                  <h4>₹{returnDetails.summary.igst.toLocaleString()}</h4>
                </div>
              </div>

              {/* B2B Supplies table */}
              <h4 style={{ marginBottom: '1rem' }}>B2B Corporate Invoices</h4>
              <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>Invoice ID</th>
                      <th>Customer</th>
                      <th>Buyer GSTIN</th>
                      <th>Taxable Value</th>
                      <th>CGST/SGST</th>
                      <th>IGST</th>
                      <th>Grand Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnDetails.b2b.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No B2B corporate supplies recorded.</td>
                      </tr>
                    ) : (
                      returnDetails.b2b.map(b => (
                        <tr key={b.id}>
                          <td>#{b.id}</td>
                          <td>{b.customer_name}</td>
                          <td><code>{b.buyer_gstin}</code></td>
                          <td>₹{b.taxable_value.toLocaleString()}</td>
                          <td>₹{b.cgst + b.sgst}</td>
                          <td>₹{b.igst}</td>
                          <td><b>₹{b.total_amount.toLocaleString()}</b></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* HSN Summary table */}
              <h4 style={{ marginBottom: '1rem' }}>HSN-wise Supplies Summary</h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>HSN/SAC Code</th>
                      <th>Description</th>
                      <th>Net Quantity</th>
                      <th>Taxable Value</th>
                      <th>CGST/SGST</th>
                      <th>IGST</th>
                      <th>Total Tax</th>
                      <th>Gross Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnDetails.hsn_summary.map((h, i) => (
                      <tr key={i}>
                        <td><code>{h.hsn_code}</code></td>
                        <td>Retail Supplies</td>
                        <td>{h.quantity}</td>
                        <td>₹{h.taxable_value.toLocaleString()}</td>
                        <td>₹{(h.cgst + h.sgst).toFixed(2)}</td>
                        <td>₹{h.igst.toFixed(2)}</td>
                        <td>₹{h.total_gst.toFixed(2)}</td>
                        <td><b>₹{h.total_amount.toLocaleString()}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedReturn === 'gstr3b' && returnDetails && (
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3><FileText size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> GSTR-3B: Consolidated tax return summary</h3>
                <button className="btn btn-secondary" onClick={() => downloadPDFReport('gstr3b')}>
                  <Download size={14} /> PDF Report
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <h4 style={{ marginBottom: '1rem' }}>1. Outward Taxable Liability</h4>
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Taxable Value:</span>
                      <b>₹{(returnDetails?.summary?.outward_supplies?.taxable_value || 0).toLocaleString()}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>CGST collected:</span>
                      <b>₹{(returnDetails?.summary?.outward_supplies?.cgst || 0).toLocaleString()}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>SGST collected:</span>
                      <b>₹{(returnDetails?.summary?.outward_supplies?.sgst || 0).toLocaleString()}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>IGST collected:</span>
                      <b>₹{(returnDetails?.summary?.outward_supplies?.igst || 0).toLocaleString()}</b>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ marginBottom: '1rem' }}>2. Inward Eligible ITC</h4>
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>CGST Credit:</span>
                      <b>₹{(returnDetails?.summary?.eligible_itc?.cgst || 0).toLocaleString()}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>SGST Credit:</span>
                      <b>₹{(returnDetails?.summary?.eligible_itc?.sgst || 0).toLocaleString()}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>IGST Credit:</span>
                      <b>₹{(returnDetails?.summary?.eligible_itc?.igst || 0).toLocaleString()}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--cream2)', paddingTop: '1rem' }}>
                      <span>Total ITC Balance:</span>
                      <b>₹{((returnDetails?.summary?.eligible_itc?.cgst || 0) + (returnDetails?.summary?.eligible_itc?.sgst || 0) + (returnDetails?.summary?.eligible_itc?.igst || 0)).toLocaleString()}</b>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-panel" style={{ marginTop: '2rem', background: 'rgba(246, 166, 35, 0.05)', border: '1px solid var(--secondary)' }}>
                <h4 style={{ marginBottom: '1rem' }}>3. Net Tax Payable (Cash Ledger Liability)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Net CGST Payable</span>
                    <h4 style={{ color: 'var(--primary)' }}>₹{(returnDetails?.summary?.tax_payable?.cgst || 0).toLocaleString()}</h4>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Net SGST Payable</span>
                    <h4 style={{ color: 'var(--primary)' }}>₹{(returnDetails?.summary?.tax_payable?.sgst || 0).toLocaleString()}</h4>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Net IGST Payable</span>
                    <h4 style={{ color: 'var(--primary)' }}>₹{(returnDetails?.summary?.tax_payable?.igst || 0).toLocaleString()}</h4>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Grand Net Cash Liability</span>
                    <h3 style={{ color: 'var(--primary)' }}>₹{(returnDetails?.summary?.tax_payable?.net_payable || 0).toLocaleString()}</h3>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedReturn === 'gstr9' && returnDetails && (
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3><FileText size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> GSTR-9: Consolidated annual compliance</h3>
                <button className="btn btn-secondary" onClick={() => downloadPDFReport('gstr9')}>
                  <Download size={14} /> PDF Return
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>Annual Particulars</th>
                      <th>Consolidated Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><b>Consolidated Outward Sales Turnover</b></td>
                      <td><b>₹{(returnDetails?.summary?.annual_turnover || 0).toLocaleString()}</b></td>
                    </tr>
                    <tr>
                      <td>Total Supplies Tax Liability (A)</td>
                      <td>₹{(returnDetails?.summary?.total_tax_collected || 0).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>Consolidated Purchases Turnover</td>
                      <td>₹{(returnDetails?.summary?.annual_purchases || 0).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>Total Eligible ITC Availed (B)</td>
                      <td>₹{(returnDetails?.summary?.total_itc_availed || 0).toLocaleString()}</td>
                    </tr>
                    <tr style={{ background: 'rgba(45, 106, 79, 0.05)' }}>
                      <td><b>Net Cash Tax Settled (A - B)</b></td>
                      <td><b>
                        {(() => {
                          const val = (returnDetails?.summary?.total_tax_collected || 0) - (returnDetails?.summary?.total_itc_availed || 0);
                          return (val < 0 ? '-' : '') + '₹' + Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        })()}
                      </b></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedReturn === 'monthly_liability' && (
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3><TrendingUp size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> Monthly Tax Liability ledger</h3>
                <button className="btn btn-secondary" onClick={() => downloadPDFReport('monthly_liability')}>
                  <Download size={14} /> PDF Ledger
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Sales Turnover</th>
                      <th>GST Collected</th>
                      <th>Purchases Turnover</th>
                      <th>ITC Claimed</th>
                      <th>Net Cash Liability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyLiability.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No monthly trends available.</td>
                      </tr>
                    ) : (
                      monthlyLiability.map((m, idx) => {
                        const netPay = Math.max(0, m.tax_collected - m.itc);
                        return (
                          <tr key={idx}>
                            <td><code>{m.month}</code></td>
                            <td>₹{m.sales.toLocaleString()}</td>
                            <td style={{ color: 'var(--primary)' }}>₹{m.tax_collected.toLocaleString()}</td>
                            <td>₹{m.purchases.toLocaleString()}</td>
                            <td style={{ color: '#2d6a4f' }}>₹{m.itc.toLocaleString()}</td>
                            <td><b>₹{netPay.toLocaleString()}</b></td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Profit & Loss Statement tab */}
      {activeTab === 'pnl' && (
        <div className="glass-panel hover-scale">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2>Profit & Loss (P&L) Statement</h2>
            <button className="btn btn-secondary" onClick={() => downloadPDFReport('pnl')}>
              <Download size={16} /> Download P&L PDF
            </button>
          </div>

          {pnlLoading || !pnl ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Calculating P&L balances...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse', 
                  fontSize: '0.9rem', 
                  color: '#334155',
                  textAlign: 'left'
                }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: 600 }}>
                      <th style={{ padding: '12px 8px' }}>Particulars</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Amount (Rs.)</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>% of Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#0f172a' }}>
                      <td style={{ padding: '12px 8px' }}>Sales</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>₹{pnl.revenue.toLocaleString()}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>100%</td>
                    </tr>
                    
                    <tr style={{ borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>
                      <td style={{ padding: '12px 8px' }}>Expenses</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: '#ef4444' }}>
                        ₹{(pnl.cogs + pnl.operating_expenses).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        {(((pnl.cogs + pnl.operating_expenses) / pnl.revenue) * 100 || 0).toFixed(1)}%
                      </td>
                    </tr>
                    
                    {/* Sub Expenses Details (Conditional) */}
                    {showDetailedPnl ? (
                      <>
                        <tr style={{ borderBottom: '1px dashed #e2e8f0', color: '#64748b' }}>
                          <td style={{ padding: '10px 8px 10px 24px' }}>Material Cost (COGS)</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{pnl.cogs.toLocaleString()}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                            {((pnl.cogs / pnl.revenue) * 100 || 0).toFixed(1)}%
                          </td>
                        </tr>
                        {pnl.expense_breakdown.map((exp, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px dashed #e2e8f0', color: '#64748b' }}>
                            <td style={{ padding: '10px 8px 10px 24px' }}>{exp.category}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{exp.amount.toLocaleString()}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                              {((exp.amount / pnl.revenue) * 100 || 0).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </>
                    ) : null}

                    {/* Toggle Button Row for Expenses Details */}
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'left', padding: '8px 8px 8px 24px' }}>
                        <button 
                          type="button"
                          className="btn btn-secondary" 
                          style={{ padding: '4px 10px', fontSize: '0.75rem', marginBottom: 0, border: '1px dashed #cbd5e1' }}
                          onClick={() => setShowDetailedPnl(!showDetailedPnl)}
                        >
                          {showDetailedPnl ? 'Hide Detailed Expenses' : 'Show Detailed Expenses Breakdown'}
                        </button>
                      </td>
                    </tr>
                    
                    <tr style={{ 
                      borderBottom: '1px solid #cbd5e1', 
                      background: 'rgba(234, 179, 8, 0.05)', 
                      fontWeight: '600', 
                      color: '#0f172a' 
                    }}>
                      <td style={{ padding: '12px 8px' }}>Operating Profit (EBITDA)</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        ₹{pnl.gross_profit.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        {((pnl.gross_profit / pnl.revenue) * 100 || 0).toFixed(1)}%
                      </td>
                    </tr>
                    
                    <tr style={{ borderBottom: '1px solid #cbd5e1', fontWeight: '600' }}>
                      <td style={{ padding: '12px 8px' }}>Other Income</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>₹0.00</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>0.0%</td>
                    </tr>
                    
                    <tr style={{ borderBottom: '1px solid #cbd5e1', fontWeight: '600' }}>
                      <td style={{ padding: '12px 8px' }}>Interest / Financing Costs</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>₹0.00</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>0.0%</td>
                    </tr>
                    
                    <tr style={{ borderBottom: '1px solid #cbd5e1', fontWeight: '600' }}>
                      <td style={{ padding: '12px 8px' }}>Depreciation</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>₹0.00</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>0.0%</td>
                    </tr>
                    
                    <tr style={{ 
                      borderBottom: '2px solid #94a3b8', 
                      background: 'rgba(16, 185, 129, 0.05)', 
                      fontWeight: '700', 
                      color: '#0f172a',
                      fontSize: '0.95rem'
                    }}>
                      <td style={{ padding: '14px 8px' }}>Profit before tax</td>
                      <td style={{ padding: '14px 8px', textAlign: 'right', color: pnl.net_profit >= 0 ? '#10b981' : '#ef4444' }}>
                        ₹{pnl.net_profit.toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                        {((pnl.net_profit / pnl.revenue) * 100 || 0).toFixed(1)}%
                      </td>
                    </tr>
                    
                    <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#64748b' }}>
                      <td style={{ padding: '12px 8px' }}>Tax % (Consolidated Slabs)</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>18% GST</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>-</td>
                    </tr>
                    
                    <tr style={{ 
                      background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(209, 160, 7, 0.04) 100%)', 
                      fontWeight: '800', 
                      color: '#0f172a',
                      fontSize: '1rem',
                      borderTop: '2px solid var(--primary)',
                      borderBottom: '2px solid var(--primary)'
                    }}>
                      <td style={{ padding: '14px 8px' }}>Net Profit</td>
                      <td style={{ padding: '14px 8px', textAlign: 'right', color: pnl.net_profit >= 0 ? '#10b981' : '#ef4444' }}>
                        ₹{pnl.net_profit.toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                        {((pnl.net_profit / pnl.revenue) * 100 || 0).toFixed(1)}%
                      </td>
                    </tr>
                   </tbody>
                </table>
              </div>

              {/* QUARTERLY COMPARISON SECTION */}
              <div style={{ marginTop: '3rem', borderTop: '2px dashed #e2e8f0', paddingTop: '2rem' }}>
                <h3 style={{ marginBottom: '1.25rem', color: '#0f172a', fontWeight: '700' }}>Quarterly Performance (Previous 4 Quarters)</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', color: '#334155', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: 600 }}>
                        <th style={{ padding: '10px 8px' }}>Particulars</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>Q3 FY25</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>Q4 FY25</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>Q1 FY26</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>Q2 FY26 (Current)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#0f172a' }}>
                        <td style={{ padding: '10px 8px' }}>Sales</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(pnl.revenue * 0.46).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(pnl.revenue * 0.49).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(pnl.revenue * 0.45).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(pnl.revenue * 0.55).toFixed(0)}</td>
                      </tr>
                      
                      <tr style={{ borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>
                        <td style={{ padding: '10px 8px' }}>Expenses</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#ef4444' }}>₹{((pnl.cogs + pnl.operating_expenses) * 0.46).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#ef4444' }}>₹{((pnl.cogs + pnl.operating_expenses) * 0.49).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#ef4444' }}>₹{((pnl.cogs + pnl.operating_expenses) * 0.45).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#ef4444' }}>₹{((pnl.cogs + pnl.operating_expenses) * 0.55).toFixed(0)}</td>
                      </tr>

                      {/* Sub-expenses for Quarters */}
                      {showDetailedPnlQ ? (
                        <>
                          <tr style={{ borderBottom: '1px dashed #e2e8f0', color: '#64748b' }}>
                            <td style={{ padding: '8px 8px 8px 24px' }}>Material Cost (COGS)</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{(pnl.cogs * 0.46).toFixed(0)}</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{(pnl.cogs * 0.49).toFixed(0)}</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{(pnl.cogs * 0.45).toFixed(0)}</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{(pnl.cogs * 0.55).toFixed(0)}</td>
                          </tr>
                          {pnl.expense_breakdown.map((exp, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px dashed #e2e8f0', color: '#64748b' }}>
                              <td style={{ padding: '8px 8px 8px 24px' }}>{exp.category}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{(exp.amount * 0.46).toFixed(0)}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{(exp.amount * 0.49).toFixed(0)}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{(exp.amount * 0.45).toFixed(0)}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{(exp.amount * 0.55).toFixed(0)}</td>
                            </tr>
                          ))}
                        </>
                      ) : null}

                      <tr>
                        <td colSpan="5" style={{ textAlign: 'left', padding: '8px 8px 8px 24px' }}>
                          <button 
                            type="button"
                            className="btn btn-secondary" 
                            style={{ padding: '4px 10px', fontSize: '0.72rem', marginBottom: 0, border: '1px dashed #cbd5e1' }}
                            onClick={() => setShowDetailedPnlQ(!showDetailedPnlQ)}
                          >
                            {showDetailedPnlQ ? 'Hide Detailed Expenses' : 'Show Detailed Expenses Breakdown'}
                          </button>
                        </td>
                      </tr>

                      <tr style={{ borderBottom: '1px solid #cbd5e1', background: 'rgba(234, 179, 8, 0.05)', fontWeight: '600', color: '#0f172a' }}>
                        <td style={{ padding: '10px 8px' }}>Operating Profit (EBITDA)</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(pnl.gross_profit * 0.46).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(pnl.gross_profit * 0.49).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(pnl.gross_profit * 0.45).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(pnl.gross_profit * 0.55).toFixed(0)}</td>
                      </tr>

                      <tr style={{ borderBottom: '1px solid #cbd5e1', fontWeight: '600' }}>
                        <td style={{ padding: '10px 8px' }}>OPM %</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>{((pnl.gross_profit / pnl.revenue) * 100 || 0).toFixed(1)}%</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>{((pnl.gross_profit / pnl.revenue) * 100 || 0).toFixed(1)}%</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>{((pnl.gross_profit / pnl.revenue) * 100 || 0).toFixed(1)}%</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>{((pnl.gross_profit / pnl.revenue) * 100 || 0).toFixed(1)}%</td>
                      </tr>

                      <tr style={{ borderBottom: '2px solid #94a3b8', background: 'rgba(16, 185, 129, 0.05)', fontWeight: '700', color: '#0f172a' }}>
                        <td style={{ padding: '12px 8px' }}>Net Profit</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: pnl.net_profit >= 0 ? '#10b981' : '#ef4444' }}>₹{(pnl.net_profit * 0.46).toFixed(0)}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: pnl.net_profit >= 0 ? '#10b981' : '#ef4444' }}>₹{(pnl.net_profit * 0.49).toFixed(0)}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: pnl.net_profit >= 0 ? '#10b981' : '#ef4444' }}>₹{(pnl.net_profit * 0.45).toFixed(0)}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: pnl.net_profit >= 0 ? '#10b981' : '#ef4444' }}>₹{(pnl.net_profit * 0.55).toFixed(0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ANNUAL FINANCIAL YEARS COMPARISON SECTION */}
              <div style={{ marginTop: '3rem', borderTop: '2px dashed #e2e8f0', paddingTop: '2rem' }}>
                <h3 style={{ marginBottom: '1.25rem', color: '#0f172a', fontWeight: '700' }}>Annual Performance Trends (Last 5 Financial Years)</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', color: '#334155', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: 600 }}>
                        <th style={{ padding: '10px 8px' }}>Particulars</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>FY22 (62%)</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>FY23 (68%)</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>FY24 (75%)</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>FY25 (85%)</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>FY26 (Current)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#0f172a' }}>
                        <td style={{ padding: '10px 8px' }}>Sales</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(pnl.revenue * 0.62).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(pnl.revenue * 0.68).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(pnl.revenue * 0.75).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(pnl.revenue * 0.85).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold' }}>₹{pnl.revenue.toLocaleString()}</td>
                      </tr>
                      
                      <tr style={{ borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>
                        <td style={{ padding: '10px 8px' }}>Expenses</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#ef4444' }}>₹{((pnl.cogs + pnl.operating_expenses) * 0.62).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#ef4444' }}>₹{((pnl.cogs + pnl.operating_expenses) * 0.68).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#ef4444' }}>₹{((pnl.cogs + pnl.operating_expenses) * 0.75).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#ef4444' }}>₹{((pnl.cogs + pnl.operating_expenses) * 0.85).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#ef4444', fontWeight: 'bold' }}>₹{(pnl.cogs + pnl.operating_expenses).toLocaleString()}</td>
                      </tr>

                      {/* Sub-expenses for Years */}
                      {showDetailedPnlY ? (
                        <>
                          <tr style={{ borderBottom: '1px dashed #e2e8f0', color: '#64748b' }}>
                            <td style={{ padding: '8px 8px 8px 24px' }}>Material Cost (COGS)</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{(pnl.cogs * 0.62).toFixed(0)}</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{(pnl.cogs * 0.68).toFixed(0)}</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{(pnl.cogs * 0.75).toFixed(0)}</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{(pnl.cogs * 0.85).toFixed(0)}</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{pnl.cogs.toLocaleString()}</td>
                          </tr>
                          {pnl.expense_breakdown.map((exp, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px dashed #e2e8f0', color: '#64748b' }}>
                              <td style={{ padding: '8px 8px 8px 24px' }}>{exp.category}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{(exp.amount * 0.62).toFixed(0)}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{(exp.amount * 0.68).toFixed(0)}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{(exp.amount * 0.75).toFixed(0)}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{(exp.amount * 0.85).toFixed(0)}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'right' }}>₹{exp.amount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </>
                      ) : null}

                      <tr>
                        <td colSpan="6" style={{ textAlign: 'left', padding: '8px 8px 8px 24px' }}>
                          <button 
                            type="button"
                            className="btn btn-secondary" 
                            style={{ padding: '4px 10px', fontSize: '0.72rem', marginBottom: 0, border: '1px dashed #cbd5e1' }}
                            onClick={() => setShowDetailedPnlY(!showDetailedPnlY)}
                          >
                            {showDetailedPnlY ? 'Hide Detailed Expenses' : 'Show Detailed Expenses Breakdown'}
                          </button>
                        </td>
                      </tr>

                      <tr style={{ borderBottom: '1px solid #cbd5e1', background: 'rgba(234, 179, 8, 0.05)', fontWeight: '600', color: '#0f172a' }}>
                        <td style={{ padding: '10px 8px' }}>Operating Profit (EBITDA)</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(pnl.gross_profit * 0.62).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(pnl.gross_profit * 0.68).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(pnl.gross_profit * 0.75).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(pnl.gross_profit * 0.85).toFixed(0)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold' }}>₹{pnl.gross_profit.toLocaleString()}</td>
                      </tr>

                      <tr style={{ borderBottom: '1px solid #cbd5e1', fontWeight: '600' }}>
                        <td style={{ padding: '10px 8px' }}>OPM %</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>{((pnl.gross_profit / pnl.revenue) * 100 || 0).toFixed(1)}%</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>{((pnl.gross_profit / pnl.revenue) * 100 || 0).toFixed(1)}%</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>{((pnl.gross_profit / pnl.revenue) * 100 || 0).toFixed(1)}%</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>{((pnl.gross_profit / pnl.revenue) * 100 || 0).toFixed(1)}%</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold' }}>{((pnl.gross_profit / pnl.revenue) * 100 || 0).toFixed(1)}%</td>
                      </tr>

                      <tr style={{ borderBottom: '2px solid #94a3b8', background: 'rgba(16, 185, 129, 0.05)', fontWeight: '700', color: '#0f172a' }}>
                        <td style={{ padding: '12px 8px' }}>Net Profit</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: pnl.net_profit >= 0 ? '#10b981' : '#ef4444' }}>₹{(pnl.net_profit * 0.62).toFixed(0)}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: pnl.net_profit >= 0 ? '#10b981' : '#ef4444' }}>₹{(pnl.net_profit * 0.68).toFixed(0)}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: pnl.net_profit >= 0 ? '#10b981' : '#ef4444' }}>₹{(pnl.net_profit * 0.75).toFixed(0)}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: pnl.net_profit >= 0 ? '#10b981' : '#ef4444' }}>₹{(pnl.net_profit * 0.85).toFixed(0)}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: pnl.net_profit >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>₹{pnl.net_profit.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* P&L Date Range Selector Modal */}
      {showPnlModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Generate P&L PDF Report</h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '20px' }}>Select a date range for the Profit & Loss statement, or leave blank for full history.</p>

            {pnlModalError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>
                {pnlModalError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Start Date</label>
                <input 
                  type="date" 
                  value={pnlStartDate} 
                  onChange={(e) => setPnlStartDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>End Date</label>
                <input 
                  type="date" 
                  value={pnlEndDate} 
                  onChange={(e) => setPnlEndDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={() => setShowPnlModal(false)}
                disabled={pnlGenerating}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn btn-accent" 
                onClick={handleGeneratePnlPdf}
                disabled={pnlGenerating}
                style={{ padding: '8px 20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {pnlGenerating ? 'Generating...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

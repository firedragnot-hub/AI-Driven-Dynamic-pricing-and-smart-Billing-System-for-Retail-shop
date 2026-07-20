import React, { useState, useEffect } from 'react';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, ArcElement, Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { Filter, Sparkles, TrendingUp, TrendingDown, Landmark, Receipt, Percent, Wallet, Package2, ShieldAlert } from 'lucide-react';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, ArcElement, Filler
);

// --- Metric Card Component ---
const MetricCard = ({ title, value, subtext, trend, icon: Icon, color = 'var(--text-primary)' }) => (
  <div className="chart-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '120px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 500 }}>{title}</h4>
      {Icon && <Icon size={18} style={{ color: 'var(--text-muted)', opacity: 0.8 }} />}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
      <span style={{ fontSize: '1.5rem', fontWeight: 700, color: color, wordBreak: 'break-word' }}>{value}</span>
      {trend && (
        <span style={{ 
          display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 600,
          color: trend === 'up' ? 'var(--success)' : '#ef4444' 
        }}>
          {trend === 'up' ? <TrendingUp size={14} style={{ marginRight: '2px' }} /> : <TrendingDown size={14} style={{ marginRight: '2px' }} />}
          {trend === 'up' ? 'Positive' : 'Negative'}
        </span>
      )}
    </div>
    {subtext && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{subtext}</p>}
  </div>
);

// Common Chart Options
const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'inherit', size: 12 } } },
    tooltip: { backgroundColor: 'var(--dark)', padding: 12, titleFont: { size: 13 }, bodyFont: { size: 13 } }
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: 'var(--text-muted)', font: { size: 11 } } },
    y: { grid: { color: 'var(--panel-border)' }, ticks: { color: 'var(--text-muted)', font: { size: 11 } } }
  }
};
const donutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '65%',
  plugins: {
    legend: { display: false }
  }
};

const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

const CustomDonutLegend = ({ labels = [], data = [], colors = [], isCurrency = false }) => {
  const total = data.reduce((sum, val) => sum + val, 0) || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '5px', width: '100%' }}>
      {labels.map((label, idx) => {
        const val = data[idx] || 0;
        const pct = ((val / total) * 100).toFixed(1);
        const formattedVal = isCurrency ? formatCurrency(val) : `${val.toLocaleString()} units`;
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: colors[idx % colors.length], flexShrink: 0 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)', textAlign: 'left' }} title={label}>
                {label.length > 20 ? `${label.substring(0, 18)}...` : label}
              </span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>
                {formattedVal} ({pct}%)
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function FinancialDashboard({ token }) {
  const [activeTab, setActiveTab] = useState('pl');
  const [financeData, setFinanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFinanceData = async () => {
    try {
      setError(null);
      setLoading(true);
      const res = await fetch('http://127.0.0.1:5000/api/finance/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFinanceData(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || `HTTP error! Status: ${res.status}`);
      }
    } catch (err) {
      console.error('Failed to fetch finance dashboard data:', err);
      setError(err.message || 'Failed to connect to the server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [token]);

  if (error) {
    const isAuthError = error.includes('403') || error.includes('401') || error.toLowerCase().includes('denied') || error.toLowerCase().includes('unauthorized');
    return (
       <div style={{ 
         display: 'flex', 
         flexDirection: 'column',
         justifyContent: 'center', 
         alignItems: 'center', 
         height: '100%', 
         minHeight: '400px',
         gap: '24px',
         padding: '24px',
         textAlign: 'center'
       }}>
         <div style={{ fontSize: '3rem', color: '#ef4444' }}>⚠️</div>
         <div>
           <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 600, color: '#ef4444' }}>
             Failed to Load Financial Dashboard
           </h3>
           <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
             {error}
           </p>
           <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
             <button 
               onClick={fetchFinanceData}
               style={{ 
                 background: 'rgba(239, 68, 68, 0.1)', 
                 border: '1px solid #ef4444', 
                 color: '#ef4444', 
                 cursor: 'pointer',
                 padding: '10px 20px',
                 borderRadius: '8px',
                 fontWeight: '600',
                 transition: 'all 0.2s'
               }}
             >
               Retry Connection
             </button>
             {isAuthError && (
               <button 
                 onClick={() => {
                   localStorage.removeItem('token');
                   localStorage.removeItem('user');
                   window.location.reload();
                 }}
                 style={{ 
                   background: 'rgba(99, 102, 241, 0.1)', 
                   border: '1px solid #6366f1', 
                   color: '#6366f1', 
                   cursor: 'pointer',
                   padding: '10px 20px',
                   borderRadius: '8px',
                   fontWeight: '600',
                   transition: 'all 0.2s'
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

  if (loading || !financeData) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%', 
        minHeight: '400px',
        gap: '24px'
      }}>
        {/* Animated Bar Chart Equalizer Loader Graphic */}
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
            Compiling Financial Database
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Processing ledgers, tax metrics, and dynamic margins...
          </p>
        </div>
      </div>
    );
  }

  // Dual Axis Chart config
  const mainComboData = {
    labels: financeData.monthly_trends.labels,
    datasets: [
      {
        type: 'bar',
        label: 'Revenue',
        data: financeData.monthly_trends.revenue,
        backgroundColor: 'rgba(59, 130, 246, 0.85)', // Blue
        borderRadius: 4,
        yAxisID: 'y'
      },
      {
        type: 'bar',
        label: 'COGS',
        data: financeData.monthly_trends.cogs,
        backgroundColor: 'rgba(239, 68, 68, 0.75)', // Red
        borderRadius: 4,
        yAxisID: 'y'
      },
      {
        type: 'bar',
        label: 'Expenses',
        data: financeData.monthly_trends.expenses,
        backgroundColor: 'rgba(156, 163, 175, 0.65)', // Grey
        borderRadius: 4,
        yAxisID: 'y'
      },
      {
        type: 'line',
        label: 'Net Profit',
        data: financeData.monthly_trends.net_profit,
        borderColor: '#10b981', // Green
        borderWidth: 2,
        tension: 0.35,
        yAxisID: 'y'
      }
    ]
  };

  // Donuts
  const expenseDonutData = {
    labels: financeData.expense_breakdown.labels,
    datasets: [{
      data: financeData.expense_breakdown.data,
      backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'],
      borderWidth: 0
    }]
  };

  const categoryDonutData = {
    labels: financeData.category_distribution?.labels || ['General'],
    datasets: [{
      data: financeData.category_distribution?.data || [100],
      backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
      borderWidth: 0
    }]
  };

  const paymentDonutData = {
    labels: financeData.payment_distribution?.labels || ['UPI', 'Cash', 'Card'],
    datasets: [{
      data: financeData.payment_distribution?.data || [10, 10, 5],
      backgroundColor: ['#6366f1', '#10b981', '#f59e0b'],
      borderWidth: 0
    }]
  };

  return (
    <div style={{ padding: '24px 0', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Dashboard Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Financial Analytics</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Enterprise financial reporting & cashflow tracking</p>
        </div>
        
        <div className="finance-header-actions">
          <button className="finance-btn-secondary" style={{ color: '#8b5cf6', borderColor: '#8b5cf6', background: 'rgba(139, 92, 246, 0.05)' }}>
            <Sparkles size={16} /> AI Accountant
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="finance-tabs">
        <button className={`finance-tab-btn ${activeTab === 'pl' ? 'active' : ''}`} onClick={() => setActiveTab('pl')}>PROFIT & LOSS</button>
        <button className={`finance-tab-btn ${activeTab === 'cash' ? 'active' : ''}`} onClick={() => setActiveTab('cash')}>CASH FLOW</button>
        <button className={`finance-tab-btn ${activeTab === 'balance' ? 'active' : ''}`} onClick={() => setActiveTab('balance')}>BALANCE SHEET</button>
      </div>

      {/* Tab Content */}
      <div className="finance-dashboard-grid">
        
        {/* === TAB 1: P&L === */}
        {activeTab === 'pl' && (
          <>
            <div className="kpi-stack">
              <MetricCard title="Revenue (Gross Sales)" value={formatCurrency(financeData.kpis.revenue)} icon={Landmark} />
              <MetricCard title="Cost of Goods (COGS)" value={formatCurrency(financeData.kpis.cogs)} icon={Receipt} />
              <MetricCard title="Gross Profit" value={formatCurrency(financeData.kpis.gross_profit)} trend="up" icon={Percent} />
              <MetricCard title="Operating Expenses" value={formatCurrency(financeData.kpis.total_expenses)} icon={Wallet} />
              <MetricCard title="Net Operating Profit" value={formatCurrency(financeData.kpis.operating_profit)} color="#10b981" trend="up" icon={Percent} />
              <MetricCard title="Profit Margin" value={`${financeData.kpis.profit_margin}%`} icon={Percent} />
            </div>

            <div>
              {/* Main Revenue vs Expense vs Margin Chart */}
              <div className="chart-card" style={{ marginBottom: '1.5rem', height: '380px' }}>
                <h3>Sales, COGS, Expenses & Net Profit Trend (Last 12 Mos)</h3>
                <div style={{ height: '300px' }}>
                  <Bar data={mainComboData} options={commonOptions} />
                </div>
              </div>

              {/* Donuts Row */}
              <div className="chart-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="chart-card" style={{ height: '280px' }}>
                  <h3>Operating Expense Breakdown</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', height: '200px' }}>
                    <div style={{ width: '45%', height: '180px' }}>
                      <Doughnut data={expenseDonutData} options={donutOptions} />
                    </div>
                    <div style={{ width: '55%', maxHeight: '180px', overflowY: 'auto' }}>
                      <CustomDonutLegend 
                        labels={financeData.expense_breakdown.labels}
                        data={financeData.expense_breakdown.data}
                        colors={['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e']}
                        isCurrency={true}
                      />
                    </div>
                  </div>
                </div>
                <div className="chart-card" style={{ height: '280px' }}>
                  <h3>Sales by Category</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', height: '200px' }}>
                    <div style={{ width: '45%', height: '180px' }}>
                      <Doughnut data={categoryDonutData} options={donutOptions} />
                    </div>
                    <div style={{ width: '55%', maxHeight: '180px', overflowY: 'auto' }}>
                      <CustomDonutLegend 
                        labels={financeData.category_distribution?.labels || ['General']}
                        data={financeData.category_distribution?.data || [100]}
                        colors={['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6']}
                        isCurrency={true}
                      />
                    </div>
                  </div>
                </div>
                <div className="chart-card" style={{ height: '280px' }}>
                  <h3>POS Payment Methods</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', height: '200px' }}>
                    <div style={{ width: '45%', height: '180px' }}>
                      <Doughnut data={paymentDonutData} options={donutOptions} />
                    </div>
                    <div style={{ width: '55%', maxHeight: '180px', overflowY: 'auto' }}>
                      <CustomDonutLegend 
                        labels={financeData.payment_distribution?.labels || ['UPI', 'Cash', 'Card']}
                        data={financeData.payment_distribution?.data || [10, 10, 5]}
                        colors={['#6366f1', '#10b981', '#f59e0b']}
                        isCurrency={true}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Slow Moving Inventory & P&L Statement Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {/* P&L Statement */}
                <div className="chart-card">
                  <h3>Profit & Loss Statement (All Time)</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="financial-table">
                      <thead>
                        <tr>
                          <th>Account Details</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Gross Revenue (Sales)</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(financeData.kpis.revenue)}</td>
                        </tr>
                        <tr>
                          <td>Less: Cost of Goods Sold (COGS)</td>
                          <td style={{ textAlign: 'right', color: '#ef4444' }}>- {formatCurrency(financeData.kpis.cogs)}</td>
                        </tr>
                        <tr className="total-row">
                          <td>Total Gross Profit</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(financeData.kpis.gross_profit)}</td>
                        </tr>
                        <tr>
                          <td>Less: Operating Expenses (OPEX)</td>
                          <td style={{ textAlign: 'right', color: '#ef4444' }}>- {formatCurrency(financeData.kpis.total_expenses)}</td>
                        </tr>
                        <tr className="total-row" style={{ borderTop: '2px solid var(--text-primary)' }}>
                          <td>Net Operating Profit</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{formatCurrency(financeData.kpis.operating_profit)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Slow Moving Inventory */}
                <div className="chart-card">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Package2 size={18} /> Slow Moving Stock (Overstocked)</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="financial-table">
                      <thead>
                        <tr>
                          <th>Item Name</th>
                          <th>Category</th>
                          <th style={{ textAlign: 'center' }}>In Stock</th>
                          <th style={{ textAlign: 'right' }}>Est Asset Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financeData.slow_inventory?.map((p, idx) => (
                          <tr key={idx}>
                            <td>
                              <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>
                                {p.name}
                              </div>
                            </td>
                            <td>{p.category}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{p.stock}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(p.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* === TAB 2: CASH FLOW === */}
        {activeTab === 'cash' && (
          <>
            <div className="kpi-stack">
              <MetricCard title="Cash In Bank (Net Cash)" value={formatCurrency(financeData.kpis.cash_in_bank)} color="#10b981" trend="up" icon={Landmark} />
              <MetricCard title="Accounts Payable (Outstanding Supplies)" value={formatCurrency(financeData.kpis.accounts_payable)} color="#ef4444" icon={ShieldAlert} />
              <MetricCard title="Accounts Receivable (Pending Invoices)" value={formatCurrency(financeData.kpis.accounts_receivable)} color="#f59e0b" icon={Receipt} />
            </div>

            <div>
              <div className="chart-card" style={{ marginBottom: '1.5rem', height: '350px' }}>
                <h3>Estimated Monthly Net Cash Flow (Inflow vs Outflow)</h3>
                <div style={{ height: '270px' }}>
                  <Bar 
                    data={{
                      labels: financeData.monthly_trends.labels,
                      datasets: [
                        { type: 'bar', label: 'Net Cash Flow', data: financeData.monthly_trends.cash, backgroundColor: '#10b981', borderRadius: 4 },
                      ]
                    }} 
                    options={commonOptions} 
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* === TAB 3: BALANCE SHEET === */}
        {activeTab === 'balance' && (
          <>
            <div className="kpi-stack">
              <MetricCard title="Total Assets (Cash + Stock)" value={formatCurrency(financeData.kpis.cash_in_bank + financeData.kpis.inventory_value)} trend="up" icon={Landmark} />
              <MetricCard title="Cash & Bank Balance" value={formatCurrency(financeData.kpis.cash_in_bank)} icon={Landmark} />
              <MetricCard title="Inventory Valuation" value={formatCurrency(financeData.kpis.inventory_value)} icon={Package2} />
            </div>

            <div>
              <div className="chart-card">
                <h3>Balance Sheet Statement</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="financial-table">
                    <thead>
                      <tr>
                        <th>Asset Class / Accounts</th>
                        <th style={{ textAlign: 'right' }}>Valuation</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Current Assets (Cash & Cash Equivalents)</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(financeData.kpis.cash_in_bank)}</td>
                      </tr>
                      <tr>
                        <td>Inventory Asset Value (Valued at Purchase Cost)</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(financeData.kpis.inventory_value)}</td>
                      </tr>
                      <tr className="total-row" style={{ borderTop: '2px solid var(--text-primary)' }}>
                        <td>Total Business Assets</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(financeData.kpis.cash_in_bank + financeData.kpis.inventory_value)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

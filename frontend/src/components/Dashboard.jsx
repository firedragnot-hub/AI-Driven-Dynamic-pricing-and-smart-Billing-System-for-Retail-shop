import React, { useEffect, useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { DollarSign, Package, ShoppingCart, RefreshCw, Sparkles, Filter } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// --- Reusable Metric Card Component ---
const MetricCard = ({ title, value, icon: Icon, iconColor, glowColor, onClick }) => (
  <div 
    className="chart-card hover-scale" 
    onClick={onClick}
    style={{ 
      padding: '24px', 
      flex: 1, 
      borderTop: `4px solid ${iconColor}`, 
      position: 'relative', 
      overflow: 'hidden',
      cursor: onClick ? 'pointer' : 'default',
    }}
  >
    <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1, color: iconColor }}>
      <Icon size={100} />
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <h4 style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 600 }}>{title}</h4>
      <div style={{ color: iconColor, backgroundColor: glowColor, padding: '8px', borderRadius: '12px' }}>
        <Icon size={20} />
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
      <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{value}</span>
    </div>
  </div>
);

const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

export default function Dashboard({ products, token, setActiveTab }) {
  const [dailySales, setDailySales] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [loading, setLoading] = useState(true);

  // AI Chatbot State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', text: 'Hi! I am your TEGL Retail AI Assistant. How can I help you manage your store today?' }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ message: userText })
      });
      const data = await res.json();
      if (res.ok) {
        setChatMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', text: data.error || 'Failed to generate response.' }]);
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Error connecting to AI server.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const dailyRes = await fetch('/api/sales/daily', { headers });
      const dailyData = await dailyRes.json();
      if (Array.isArray(dailyData)) {
        setDailySales([...dailyData].reverse()); // Show chronologically
      }

      const monthlyRes = await fetch('/api/sales/monthly', { headers });
      const monthlyData = await monthlyRes.json();
      if (Array.isArray(monthlyData)) {
        setMonthlySales([...monthlyData].reverse());
      }
    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData();
  }, [token]);

  // Compute metrics
  const totalRevenue = dailySales.reduce((sum, item) => sum + item.revenue, 0);
  const totalTxCount = dailySales.reduce((sum, item) => sum + item.transaction_count, 0);
  const lowStockProducts = products.filter(p => p.stock_level < 15).length;

  // Chart Options
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { 
        backgroundColor: '#111111', 
        padding: 12, 
        titleFont: { size: 13, weight: 'bold' }, 
        bodyFont: { size: 13 },
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: { 
        grid: { display: false }, 
        ticks: { 
          color: '#888888', 
          font: { size: 10 },
          maxRotation: 45,
          minRotation: 0
        } 
      },
      y: { 
        grid: { color: 'rgba(150, 150, 150, 0.15)' }, 
        ticks: { 
          color: '#888888', 
          font: { size: 10 },
          callback: function(value) {
            if (value >= 100000) {
              return '₹' + (value / 100000).toFixed(1) + 'L';
            }
            return '₹' + value.toLocaleString('en-IN');
          }
        } 
      }
    }
  };

  // Chart Data: Daily Sales
  const dailyChartData = {
    labels: dailySales.map(item => item.date),
    datasets: [
      {
        label: 'Revenue',
        data: dailySales.map(item => item.revenue),
        fill: true,
        borderColor: '#eab308',
        backgroundColor: 'rgba(234, 179, 8, 0.05)',
        tension: 0.35,
        pointBackgroundColor: '#eab308',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2
      },
    ],
  };

  // Chart Data: Monthly Sales
  const monthlyChartData = {
    labels: monthlySales.map(item => item.month),
    datasets: [
      {
        label: 'Revenue',
        data: monthlySales.map(item => item.revenue),
        backgroundColor: 'rgba(59, 130, 246, 0.85)',
        hoverBackgroundColor: '#3b82f6',
        borderRadius: 6,
      },
    ],
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Executive Dashboard</h1>
          <p>Real-time updates, metrics and sales performance</p>
          <div className="page-header-accent"></div>
        </div>
        <div className="finance-header-actions">
          <button className="finance-btn-secondary" onClick={fetchSalesData}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-accent" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            <Sparkles size={16} /> AI Insights
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <MetricCard 
          title="Total Revenue (30 Days)" 
          value={formatCurrency(totalRevenue)} 
          icon={DollarSign}
          iconColor="#10b981"
          glowColor="rgba(16, 185, 129, 0.1)"
          onClick={() => setActiveTab && setActiveTab('finance')}
        />
        <MetricCard 
          title="Transactions (30 Days)" 
          value={totalTxCount.toLocaleString()} 
          icon={ShoppingCart}
          iconColor="#06b6d4"
          glowColor="rgba(6, 182, 212, 0.1)"
          onClick={() => setActiveTab && setActiveTab('orders')}
        />
        <MetricCard 
          title="Low Stock Alerts" 
          value={lowStockProducts.toLocaleString()} 
          icon={Package}
          iconColor="#f59e0b"
          glowColor="rgba(245, 158, 11, 0.1)"
          onClick={() => setActiveTab && setActiveTab('inventory')}
        />
      </div>

      {/* Charts Row */}
      <div className="chart-row">
        <div className="chart-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Daily Sales (Last 30 Days)</h3>
          <div style={{ height: '300px' }}>
            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading Daily Sales Chart...</p>
            ) : (
              <Line data={dailyChartData} options={commonOptions} />
            )}
          </div>
        </div>

        <div className="chart-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Monthly Revenue Overview</h3>
          <div style={{ height: '300px' }}>
            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading Monthly Sales Chart...</p>
            ) : (
              <Bar data={monthlyChartData} options={commonOptions} />
            )}
          </div>
        </div>
      </div>

      {/* Floating AI Chat Assistant */}
      <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 9999 }}>
        {!chatOpen ? (
          <button 
            onClick={() => setChatOpen(true)}
            style={{ 
              width: '60px', 
              height: '60px', 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #eab308, #d1a007)', 
              color: '#fff', 
              border: 'none', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              boxShadow: '0 6px 20px rgba(234,179,8,0.4)',
              transition: 'transform 0.2s ease',
              fontSize: '1.5rem'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            💬
          </button>
        ) : (
          <div 
            style={{ 
              width: '360px', 
              height: '460px', 
              background: '#fff', 
              borderRadius: '20px', 
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)', 
              border: '1px solid #f1f5f9',
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #eab308, #d1a007)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>✨</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Smart Store AI</div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.9 }}>Online Analytics Assistant</div>
                </div>
              </div>
              <button 
                onClick={() => setChatOpen(false)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.1rem', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Messages body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc' }}>
              {chatMessages.map((m, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div 
                    style={{ 
                      maxWidth: '80%', 
                      padding: '10px 14px', 
                      borderRadius: m.role === 'user' ? '14px 14px 0 14px' : '14px 14px 14px 0',
                      background: m.role === 'user' ? 'linear-gradient(135deg, #eab308, #d1a007)' : '#fff',
                      color: m.role === 'user' ? '#fff' : '#1e293b',
                      fontSize: '0.82rem',
                      lineHeight: '1.4',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      border: m.role === 'user' ? 'none' : '1px solid #e2e8f0',
                      textAlign: 'left'
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ background: '#fff', color: '#64748b', padding: '10px 14px', borderRadius: '14px 14px 14px 0', fontSize: '0.82rem', border: '1px solid #e2e8f0' }}>
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} style={{ padding: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px', background: '#fff' }}>
              <input 
                type="text" 
                placeholder="Ask about sales, stock or reorders..." 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                style={{ 
                  flex: 1, 
                  padding: '10px 14px', 
                  borderRadius: '10px', 
                  border: '1.5px solid #e2e8f0',
                  fontSize: '0.82rem',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
              <button 
                type="submit"
                disabled={chatLoading}
                style={{ 
                  padding: '10px 14px', 
                  background: 'linear-gradient(135deg, #eab308, #d1a007)', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.82rem'
                }}
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}

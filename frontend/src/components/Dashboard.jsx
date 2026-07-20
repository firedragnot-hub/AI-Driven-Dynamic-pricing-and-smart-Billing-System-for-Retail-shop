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

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const dailyRes = await fetch('http://127.0.0.1:5000/api/sales/daily', { headers });
      const dailyData = await dailyRes.json();
      setDailySales(dailyData.reverse()); // Show chronologically

      const monthlyRes = await fetch('http://127.0.0.1:5000/api/sales/monthly', { headers });
      const monthlyData = await monthlyRes.json();
      setMonthlySales(monthlyData.reverse());
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
    <div style={{ padding: '24px 0', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Dashboard Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Executive Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Real-time updates, metrics and sales performance</p>
        </div>
        
        <div className="finance-header-actions">
          <button className="finance-btn-secondary" onClick={fetchSalesData}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="finance-btn-secondary" style={{ color: '#8b5cf6', borderColor: '#8b5cf6', background: 'rgba(139, 92, 246, 0.05)' }}>
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

    </div>
  );
}

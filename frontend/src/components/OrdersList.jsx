import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import InvoiceTemplate from './InvoiceTemplate';
import { Eye, Printer, Check, X, FileText, Search, ArrowUpDown, Download } from 'lucide-react';


export default function OrdersList({ token }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePrintOrder, setActivePrintOrder] = useState(null);

  // Filtering & Sorting State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('date_desc');
  const [saleTypeFilter, setSaleTypeFilter] = useState('All');

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  const fetchOrders = async (isAppend = false) => {
    setLoading(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const params = new URLSearchParams({
        search,
        status: statusFilter,
        sort_by: sortBy,
        sale_type: saleTypeFilter,
        page: page.toString(),
        limit: limit.toString()
      });
      const res = await fetch(`/api/orders?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (isAppend) {
          setOrders(prev => [...prev, ...(data.orders || [])]);
        } else {
          setOrders(data.orders || []);
        }
        setTotalCount(data.total_count || 0);
      }
    } catch (e) {
      console.error('Error fetching orders:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(page > 1);
  }, [search, statusFilter, sortBy, saleTypeFilter, page, limit, token]);

  useEffect(() => {
    // Poll for new orders every 10 seconds to replace WebSocket for Vercel deployment
    const pollInterval = setInterval(() => {
      fetchOrders();
    }, 10000);
    
    return () => {
      clearInterval(pollInterval);
    };
  }, [search, statusFilter, sortBy, saleTypeFilter, token]);

  const updateStatus = async (orderId, newStatus) => {
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchOrders(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update status');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrint = (order) => {
    setActivePrintOrder(order);
    setTimeout(() => {
      window.print();
      setActivePrintOrder(null);
    }, 500);
  };

  const handleExport = async (format) => {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/reports/download?type=sales&format=${format}`, { headers });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales_report.${format === 'excel' ? 'xlsx' : 'pdf'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert('Failed to download report');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getBuyerStateAndCode = (address) => {
    const addr = (address || '').toLowerCase();
    if (addr.includes('delhi')) return { state: 'Delhi', code: '07' };
    if (addr.includes('haryana')) return { state: 'Haryana', code: '06' };
    if (addr.includes('karnataka')) return { state: 'Karnataka', code: '29' };
    if (addr.includes('maharashtra')) return { state: 'Maharashtra', code: '27' };
    if (addr.includes('tamil nadu') || addr.includes('tamilnadu')) return { state: 'Tamil Nadu', code: '33' };
    return { state: 'Uttar Pradesh', code: '09' };
  };

  const numberToWords = (num) => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convert = (n) => {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
      if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? 'and ' + convert(n % 100) : '');
      if (n < 100000) return convert(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
      if (n < 10000000) return convert(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
      return convert(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
    };

    const integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100);

    let str = convert(integerPart) + 'Rupees ';
    if (decimalPart > 0) {
      str += 'and ' + convert(decimalPart) + 'Paise ';
    }
    return str + 'Only';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Delivered':
      case 'Completed':
        return <span className="badge badge-success">{status}</span>;
      case 'Cancelled':
        return <span className="badge badge-danger">Cancelled</span>;
      case 'Shipped':
        return <span className="badge" style={{ backgroundColor: '#3b82f6', color: '#fff' }}>Shipped</span>;
      case 'Processing':
        return <span className="badge" style={{ backgroundColor: '#8b5cf6', color: '#fff' }}>Processing</span>;
      case 'Return Requested':
        return <span className="badge" style={{ backgroundColor: '#f59e0b', color: '#fff' }}>Return Requested</span>;
      case 'Replacement Requested':
        return <span className="badge" style={{ backgroundColor: '#ec4899', color: '#fff' }}>Replacement Requested</span>;
      case 'Returned':
        return <span className="badge" style={{ backgroundColor: '#64748b', color: '#fff' }}>Returned</span>;
      case 'Replaced':
        return <span className="badge" style={{ backgroundColor: '#10b981', color: '#fff' }}>Replaced</span>;
      case 'Partially Returned':
        return <span className="badge" style={{ backgroundColor: '#f97316', color: '#fff' }}>Partially Returned</span>;
      default:
        return <span className="badge badge-warning">Pending</span>;
    }
  };

  const renderInvoiceMarkup = () => {
    if (!activePrintOrder) return null;
    return <InvoiceTemplate order={activePrintOrder} />;
  };


  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Order Management System</h1>
          <p>Fulfill, update status, search, and manage customer order receipts</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
          <input
            type="text"
            placeholder="Search by ID, Customer Name, Email..."
            className="form-control"
            style={{ paddingLeft: '40px', marginBottom: 0 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#5c5c5c' }}>Status:</span>
          <select
            className="form-control"
            style={{ width: '150px', marginBottom: 0 }}
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Return Requested">Return Requested</option>
            <option value="Replacement Requested">Replacement Requested</option>
            <option value="Returned">Returned</option>
            <option value="Replaced">Replaced</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Partially Returned">Partially Returned</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#5c5c5c' }}>Channel:</span>
          <select
            className="form-control"
            style={{ width: '130px', marginBottom: 0 }}
            value={saleTypeFilter}
            onChange={e => { setSaleTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="All">All Channels</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <ArrowUpDown size={16} style={{ color: '#5c5c5c' }} />
          <select
            className="form-control"
            style={{ width: '150px', marginBottom: 0 }}
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); setPage(1); }}
          >
            <option value="date_desc">Date Newest</option>
            <option value="date_asc">Date Oldest</option>
            <option value="customer">Customer Name</option>
            <option value="status">Status</option>
            <option value="total">Order Total</option>
          </select>
        </div>
      </div>

      <div className="glass-panel">
        {loading && orders.length === 0 ? (
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
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <p style={{ color: '#5c5c5c', textAlign: 'center', padding: '2rem 0' }}>No matching orders found.</p>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer Details</th>
                  <th>Channel</th>
                  <th>Date & Time</th>
                  <th>Items Count</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Change Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>{o.customer_name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#5c5c5c' }}>📞 {o.phone}</div>
                      <div style={{ fontSize: '0.75rem', color: '#8c8c8c' }}>✉️ {o.email}</div>
                    </td>
                    <td>
                      <span className="badge" style={{
                        backgroundColor: o.sale_type === 'offline' ? '#f97316' : '#2563eb',
                        color: '#ffffff',
                        textTransform: 'uppercase',
                        fontWeight: 'bold',
                        fontSize: '0.7rem',
                        padding: '4px 8px',
                        borderRadius: '6px'
                      }}>
                        {o.sale_type || 'online'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {new Date(o.timestamp).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'center' }}>{o.items?.length || 0} items</td>
                    <td style={{ fontWeight: 'bold' }}>₹{o.total_amount.toFixed(2)}</td>
                    <td>{getStatusBadge(o.status)}</td>
                    <td>
                      <select
                        value={o.status}
                        onChange={(e) => updateStatus(o.id, e.target.value)}
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', width: '150px', marginBottom: 0 }}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Processing">Processing</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Return Requested">Return Requested</option>
                        <option value="Replacement Requested">Replacement Requested</option>
                        <option value="Returned">Returned</option>
                        <option value="Replaced">Replaced</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="Partially Returned">Partially Returned</option>
                      </select>
                    </td>
                    <td>
                      <button
                        className="btn-icon"
                        title="Print Invoice / Packing Sheet"
                        onClick={() => handlePrint(o)}
                      >
                        <Printer size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Infinite Scroll Sentinel */}
      {orders.length < totalCount && (
        <div 
          style={{ textAlign: 'center', padding: '2rem' }}
          ref={(node) => {
            if (!node || loading) return;
            if (node._observer) node._observer.disconnect();
            node._observer = new IntersectionObserver(entries => {
              if (entries[0].isIntersecting) {
                setPage(p => p + 1);
              }
            }, { threshold: 1.0 });
            node._observer.observe(node);
          }}
        >
          {loading ? (
            <div className="spinner"></div>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>Scroll for more</span>
          )}
        </div>
      )}
      
      {/* Footer Info */}
      {!loading && orders.length > 0 && (
        <div style={{
          textAlign: 'center',
          marginTop: '1.5rem',
          color: 'var(--text-muted)',
          fontSize: '0.9rem'
        }}>
          Showing {orders.length} of {totalCount} orders
        </div>
      )}

      {/* Render Print Area to document.body via Portal to fix the display:none print bug */}
      {activePrintOrder && createPortal(renderInvoiceMarkup(), document.body)}
    </div>
  );
}


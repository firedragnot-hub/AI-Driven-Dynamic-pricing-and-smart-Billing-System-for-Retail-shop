import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

    const buyerInfo = getBuyerStateAndCode(activePrintOrder.address);
    const sellerStateCode = '09'; // Uttar Pradesh
    const isLocal = buyerInfo.code === sellerStateCode;

    let subtotal = 0.0;
    let totalTaxableAmount = 0.0;
    let totalCgst = 0.0;
    let totalSgst = 0.0;
    let totalIgst = 0.0;

    const invoiceItems = (activePrintOrder.items || []).map((item, idx) => {
      const total = item.price_at_sale * item.quantity;
      const gst_rate = item.gst_rate || 18.0;
      const taxableVal = total / (1 + (gst_rate / 100));
      const gstAmt = total - taxableVal;
      const rateBeforeTax = item.price_at_sale / (1 + (gst_rate / 100));

      subtotal += total;
      totalTaxableAmount += taxableVal;

      let cgstRate = 0, cgstAmt = 0;
      let sgstRate = 0, sgstAmt = 0;
      let igstRate = 0, igstAmt = 0;

      if (isLocal) {
        cgstRate = gst_rate / 2;
        cgstAmt = gstAmt / 2;
        sgstRate = gst_rate / 2;
        sgstAmt = gstAmt / 2;
        totalCgst += cgstAmt;
        totalSgst += sgstAmt;
      } else {
        igstRate = gst_rate;
        igstAmt = gstAmt;
        totalIgst += igstAmt;
      }

      return {
        sNo: idx + 1,
        name: item.product_name,
        hsn: item.hsn_code || '84733099',
        qty: item.quantity,
        rate: rateBeforeTax,
        taxableVal: taxableVal,
        gstRate: gst_rate,
        cgstRate,
        cgstAmt,
        sgstRate,
        sgstAmt,
        igstRate,
        igstAmt,
        total
      };
    });

    const grandTotal = activePrintOrder.total_amount;
    const calculatedSum = totalTaxableAmount + totalCgst + totalSgst + totalIgst;
    const roundOff = grandTotal - calculatedSum;
    const upiLink = `upi://pay?pa=tegl@sbi&pn=TEGL%20Electronics&am=${grandTotal.toFixed(2)}&cu=INR`;
    const qrSource = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(upiLink)}`;

    return (
      <div className="print-area" style={{ background: '#fff', color: '#1f2937', fontFamily: "'Poppins', sans-serif", padding: '30px', maxWidth: '800px', margin: '0 auto', fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>

        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #1d4ed8', paddingBottom: '15px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1d4ed8', letterSpacing: '1px' }}>TEGL</span>
              <span style={{ fontSize: '10px', color: '#6b7280', borderLeft: '1px solid #d1d5db', paddingLeft: '8px', textTransform: 'uppercase', fontWeight: 600 }}>Electronics Pvt. Ltd.</span>
            </div>
            <div style={{ color: '#4b5563', fontSize: '10px', marginTop: '4px', lineHeight: '1.4', textAlign: 'left' }}>
              Plot No. 42, Tech Park, Sector 62, Noida<br />
              Uttar Pradesh, India - 201301<br />
              GSTIN: 09AAACT1234A1Z5 | PAN: AAACT1234A<br />
              Email: billing@tegl.com | Phone: +91 98765 43210
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <h1 style={{ margin: 0, color: '#1d4ed8', fontSize: '22px', fontWeight: 'bold', letterSpacing: '0.5px' }}>TAX INVOICE</h1>
            <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 12px', justifyItems: 'end', fontSize: '10.5px', color: '#374151' }}>
              <span>Invoice No:</span><strong>TEGL/2026/{activePrintOrder.id}</strong>
              <span>Invoice Date:</span><strong>{new Date(activePrintOrder.timestamp).toLocaleDateString('en-IN')}</strong>
              <span>Due Date:</span><strong>{new Date(activePrintOrder.timestamp).toLocaleDateString('en-IN')}</strong>
              <span>Place of Supply:</span><strong>{buyerInfo.state}</strong>
            </div>
          </div>
        </div>

        {/* Billing Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '20px', background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '10.5px', color: '#1d4ed8', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', fontWeight: 'bold', textTransform: 'uppercase' }}>Details of Seller (Consignor)</h3>
            <div style={{ lineHeight: '1.4', color: '#374151' }}>
              <strong>TEGL Electronics Pvt. Ltd.</strong><br />
              Plot No. 42, Tech Park, Sector 62, Noida<br />
              State: Uttar Pradesh (Code: 09)<br />
              GSTIN: 09AAACT1234A1Z5<br />
              Email: billing@tegl.com
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '10.5px', color: '#1d4ed8', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', fontWeight: 'bold', textTransform: 'uppercase' }}>Details of Buyer (Consignee)</h3>
            <div style={{ lineHeight: '1.4', color: '#374151' }}>
              <strong>{activePrintOrder.customer_name}</strong><br />
              Address: {activePrintOrder.address}<br />
              State: {buyerInfo.state} (Code: {buyerInfo.code})<br />
              GSTIN: Unregistered<br />
              Phone: {activePrintOrder.phone} | Email: {activePrintOrder.email}
            </div>
          </div>
        </div>

        {/* Product Table */}
        <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr style={{ background: '#1d4ed8', color: '#fff', textAlign: 'left' }}>
                <th style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>S.No</th>
                <th style={{ padding: '6px', border: '1px solid #e5e7eb' }}>Product Name</th>
                <th style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>HSN</th>
                <th style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'right' }}>Rate (₹)</th>
                <th style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'right' }}>Taxable Val</th>
                <th style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>GST%</th>
                {isLocal ? (
                  <>
                    <th style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'right' }}>CGST</th>
                    <th style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'right' }}>SGST</th>
                  </>
                ) : (
                  <th style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'right' }}>IGST</th>
                )}
                <th style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'right' }}>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {invoiceItems.map((item) => (
                <tr key={item.sNo} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{item.sNo}</td>
                  <td style={{ padding: '6px', border: '1px solid #e5e7eb', fontWeight: 600, textAlign: 'left' }}>{item.name}</td>
                  <td style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#4b5563' }}>{item.hsn}</td>
                  <td style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{item.qty}</td>
                  <td style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'right' }}>{item.rate.toFixed(2)}</td>
                  <td style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'right' }}>{item.taxableVal.toFixed(2)}</td>
                  <td style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{item.gstRate}%</td>
                  {isLocal ? (
                    <>
                      <td style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'right' }}>{item.cgstAmt.toFixed(2)}</td>
                      <td style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'right' }}>{item.sgstAmt.toFixed(2)}</td>
                    </>
                  ) : (
                    <td style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'right' }}>{item.igstAmt.toFixed(2)}</td>
                  )}
                  <td style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'right', fontWeight: 'bold' }}>{item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary and Payment section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '30px', marginBottom: '20px' }}>
          {/* Left Block: Payment info & QR */}
          <div style={{ textAlign: 'left' }}>
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', background: '#f8fafc', display: 'flex', gap: '15px', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '10px', color: '#1d4ed8', fontWeight: 'bold', textTransform: 'uppercase' }}>Bank Details</h4>
                <div style={{ lineHeight: '1.4', color: '#4b5563' }}>
                  Bank: <strong>State Bank of India</strong><br />
                  A/c Name: <strong>TEGL Electronics Pvt. Ltd.</strong><br />
                  A/c No: <strong>98765432109</strong><br />
                  IFSC: <strong>SBIN0001234</strong>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <img src={qrSource} alt="UPI QR" style={{ width: '85px', height: '85px', border: '1px solid #d1d5db', padding: '3px', background: '#fff', borderRadius: '4px' }} />
                <div style={{ fontSize: '8px', fontWeight: 'bold', marginTop: '4px', color: '#4b5563' }}>Scan to Pay via UPI</div>
              </div>
            </div>

            <div style={{ marginTop: '12px', fontSize: '9.5px', color: '#4b5563', lineHeight: '1.3' }}>
              <strong>Amount in Words:</strong><br />
              <span style={{ fontStyle: 'italic', fontWeight: 600, color: '#1f2937' }}>{numberToWords(grandTotal)}</span>
            </div>
          </div>

          {/* Right Block: Summary Table */}
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', color: '#374151' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 0', color: '#6b7280', textAlign: 'left' }}>Total Taxable Value:</td>
                  <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 500 }}>₹{totalTaxableAmount.toFixed(2)}</td>
                </tr>
                {isLocal ? (
                  <>
                    <tr>
                      <td style={{ padding: '4px 0', color: '#6b7280', textAlign: 'left' }}>CGST Total:</td>
                      <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 500 }}>₹{totalCgst.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 0', color: '#6b7280', textAlign: 'left' }}>SGST Total:</td>
                      <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 500 }}>₹{totalSgst.toFixed(2)}</td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td style={{ padding: '4px 0', color: '#6b7280', textAlign: 'left' }}>IGST Total:</td>
                    <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 500 }}>₹{totalIgst.toFixed(2)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '4px 0', color: '#6b7280', textAlign: 'left' }}>Discount:</td>
                  <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 500 }}>₹0.00</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0', color: '#6b7280', textAlign: 'left' }}>Round Off:</td>
                  <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 500 }}>₹{roundOff.toFixed(2)}</td>
                </tr>
                <tr style={{ borderTop: '2px solid #1d4ed8', fontSize: '12px', fontWeight: 'bold' }}>
                  <td style={{ padding: '8px 0', color: '#1d4ed8', textAlign: 'left' }}>Grand Total:</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: '#1d4ed8' }}>₹{grandTotal.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Terms and Signatures */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '15px', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px', color: '#4b5563' }}>
          <div style={{ textAlign: 'left' }}>
            <h5 style={{ margin: '0 0 4px 0', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1f2937' }}>Terms & Conditions:</h5>
            <ol style={{ margin: 0, paddingLeft: '12px', fontSize: '8.5px', lineHeight: '1.3' }}>
              <li>Goods once sold will not be taken back or exchanged.</li>
              <li>Warranty (if any) is provided by the manufacturer directly.</li>
              <li>All disputes are subject to Noida Jurisdiction.</li>
            </ol>
            <div style={{ marginTop: '8px', fontSize: '9px', fontWeight: 'bold', color: '#1d4ed8' }}>
              Thank you for your business! We look forward to serving you again.
            </div>
          </div>

          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '80px', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#374151' }}>For TEGL Electronics Pvt. Ltd.</span>

            {/* Signature Area */}
            <div style={{ borderBottom: '1px solid #d1d5db', width: '150px', margin: '15px 0 5px 0' }}></div>
            <span style={{ fontSize: '8.5px', color: '#6b7280' }}>Authorized Signatory</span>
          </div>
        </div>

      </div>
    );
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


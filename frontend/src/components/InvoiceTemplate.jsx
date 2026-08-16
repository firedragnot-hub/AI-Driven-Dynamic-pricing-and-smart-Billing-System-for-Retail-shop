import React from 'react';

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

export default function InvoiceTemplate({ order }) {
  if (!order) return null;

  const buyerInfo = getBuyerStateAndCode(order.address || order.customer_name);
  const sellerStateCode = '09'; // Uttar Pradesh
  const isLocal = buyerInfo.code === sellerStateCode;

  let subtotal = 0.0;
  let totalTaxableAmount = 0.0;
  let totalCgst = 0.0;
  let totalSgst = 0.0;
  let totalIgst = 0.0;

  const invoiceItems = (order.items || []).map((item, idx) => {
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

  const grandTotal = order.total_amount;
  const calculatedSum = totalTaxableAmount + totalCgst + totalSgst + totalIgst;
  const roundOff = grandTotal - calculatedSum;
  const upiLink = `upi://pay?pa=tegl@sbi&pn=TEGL%20Electronics&am=${grandTotal.toFixed(2)}&cu=INR`;
  const qrSource = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(upiLink)}`;

  return (
    <div className="print-area" style={{ background: '#fff', color: '#1f2937', fontFamily: "'Poppins', sans-serif", padding: '30px', maxWidth: '800px', margin: '0 auto', fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #1d4ed8', paddingBottom: '15px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.png" alt="TEGL Logo" style={{ height: '40px', width: '40px', objectFit: 'contain' }} />
            <div>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1d4ed8', letterSpacing: '1px' }}>TEGL</span>
              <span style={{ fontSize: '10px', color: '#6b7280', borderLeft: '1px solid #d1d5db', marginLeft: '8px', paddingLeft: '8px', textTransform: 'uppercase', fontWeight: 600 }}>Electronics Pvt. Ltd.</span>
            </div>
          </div>
          <div style={{ fontSize: '9px', color: '#4b5563', marginTop: '6px', lineHeight: '1.4' }}>
            123 Innovation Way, Tech Park<br />
            Noida, Uttar Pradesh 201301<br />
            GSTIN: 09ABCDE1234F1Z5<br />
            Phone: +91 98765 43210 | Email: billing@tegl.in
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '2px' }}>Tax Invoice</h2>
          <div style={{ marginTop: '8px', fontSize: '10px', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
              <span style={{ color: '#9ca3af' }}>Invoice No:</span>
              <span style={{ fontWeight: 600, color: '#1f2937' }}>INV-{order.id}-{new Date(order.timestamp).getFullYear()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
              <span style={{ color: '#9ca3af' }}>Date:</span>
              <span style={{ fontWeight: 600, color: '#1f2937' }}>{new Date(order.timestamp).toLocaleDateString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
              <span style={{ color: '#9ca3af' }}>Time:</span>
              <span style={{ fontWeight: 600, color: '#1f2937' }}>{new Date(order.timestamp).toLocaleTimeString()}</span>
            </div>
            {order.payment_method && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                <span style={{ color: '#9ca3af' }}>Pay Mode:</span>
                <span style={{ fontWeight: 600, color: '#1f2937' }}>{order.payment_method}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bill To & QR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', background: '#f9fafb', padding: '15px', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>Billed To</h4>
          <div style={{ fontSize: '11px', color: '#1f2937', fontWeight: 'bold', marginBottom: '4px' }}>{order.customer_name}</div>
          <div style={{ fontSize: '10px', color: '#4b5563', lineHeight: '1.4' }}>
            {order.address || "Counter Sale"}<br />
            <span style={{ color: '#111827', fontWeight: 600 }}>State: {buyerInfo.state} (Code: {buyerInfo.code})</span><br />
            {order.phone && <span>Phone: {order.phone}<br/></span>}
            {order.email && <span>Email: {order.email}</span>}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '15px' }}>
          <div style={{ textAlign: 'right', fontSize: '9px', color: '#6b7280' }}>
            Scan to Pay via UPI<br/>
            <span style={{ fontWeight: 'bold', color: '#1f2937' }}>tegl@sbi</span>
          </div>
          <img src={qrSource} alt="UPI QR Code" style={{ width: '70px', height: '70px', borderRadius: '4px', border: '1px solid #e5e7eb', padding: '2px', background: '#fff' }} />
        </div>
      </div>

      {/* Item Table */}
      <div style={{ marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#1d4ed8', color: '#ffffff' }}>
              <th style={{ padding: '8px 4px', border: '1px solid #1e40af', borderTopLeftRadius: '6px' }}>S.No</th>
              <th style={{ padding: '8px 4px', border: '1px solid #1e40af', textAlign: 'left', minWidth: '140px' }}>Item Description</th>
              <th style={{ padding: '8px 4px', border: '1px solid #1e40af' }}>HSN/SAC</th>
              <th style={{ padding: '8px 4px', border: '1px solid #1e40af' }}>Qty</th>
              <th style={{ padding: '8px 4px', border: '1px solid #1e40af', textAlign: 'right' }}>Rate<br/>(₹)</th>
              <th style={{ padding: '8px 4px', border: '1px solid #1e40af', textAlign: 'right' }}>Taxable<br/>Val (₹)</th>
              {isLocal ? (
                <>
                  <th style={{ padding: '8px 4px', border: '1px solid #1e40af', textAlign: 'right' }}>CGST<br/>(%)</th>
                  <th style={{ padding: '8px 4px', border: '1px solid #1e40af', textAlign: 'right' }}>Amt (₹)</th>
                  <th style={{ padding: '8px 4px', border: '1px solid #1e40af', textAlign: 'right' }}>SGST<br/>(%)</th>
                  <th style={{ padding: '8px 4px', border: '1px solid #1e40af', textAlign: 'right' }}>Amt (₹)</th>
                </>
              ) : (
                <>
                  <th style={{ padding: '8px 4px', border: '1px solid #1e40af', textAlign: 'right' }}>IGST<br/>(%)</th>
                  <th style={{ padding: '8px 4px', border: '1px solid #1e40af', textAlign: 'right' }}>Amt (₹)</th>
                </>
              )}
              <th style={{ padding: '8px 4px', border: '1px solid #1e40af', borderTopRightRadius: '6px', textAlign: 'right' }}>Total<br/>(₹)</th>
            </tr>
          </thead>
          <tbody>
            {invoiceItems.map((it) => (
              <tr key={it.sNo} style={{ borderBottom: '1px solid #e5e7eb', background: it.sNo % 2 === 0 ? '#f9fafb' : '#fff' }}>
                <td style={{ padding: '6px 4px', borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>{it.sNo}</td>
                <td style={{ padding: '6px 4px', borderRight: '1px solid #e5e7eb', textAlign: 'left', fontWeight: 600, color: '#1f2937' }}>{it.name}</td>
                <td style={{ padding: '6px 4px', borderRight: '1px solid #e5e7eb' }}>{it.hsn}</td>
                <td style={{ padding: '6px 4px', borderRight: '1px solid #e5e7eb' }}>{it.qty}</td>
                <td style={{ padding: '6px 4px', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>{it.rate.toFixed(2)}</td>
                <td style={{ padding: '6px 4px', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>{it.taxableVal.toFixed(2)}</td>
                {isLocal ? (
                  <>
                    <td style={{ padding: '6px 4px', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>{it.cgstRate}%</td>
                    <td style={{ padding: '6px 4px', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>{it.cgstAmt.toFixed(2)}</td>
                    <td style={{ padding: '6px 4px', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>{it.sgstRate}%</td>
                    <td style={{ padding: '6px 4px', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>{it.sgstAmt.toFixed(2)}</td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '6px 4px', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>{it.igstRate}%</td>
                    <td style={{ padding: '6px 4px', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>{it.igstAmt.toFixed(2)}</td>
                  </>
                )}
                <td style={{ padding: '6px 4px', borderRight: '1px solid #e5e7eb', textAlign: 'right', fontWeight: 'bold' }}>{it.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals & Words */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', gap: '20px' }}>
        <div style={{ flex: 1.5, background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Amount in Words:</span>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f172a' }}>{numberToWords(grandTotal)}</span>
        </div>

        <div style={{ flex: 1, padding: '10px 15px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <table style={{ width: '100%', fontSize: '10px' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 0', color: '#6b7280', textAlign: 'left' }}>Taxable Amount:</td>
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
          <div style={{ borderBottom: '1px solid #d1d5db', width: '150px', margin: '15px 0 5px 0' }}></div>
          <span style={{ fontSize: '8.5px', color: '#6b7280' }}>Authorized Signatory</span>
        </div>
      </div>
    </div>
  );
}

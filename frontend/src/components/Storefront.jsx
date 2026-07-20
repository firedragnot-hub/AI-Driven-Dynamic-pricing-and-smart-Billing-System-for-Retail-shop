import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Search, Package, CheckCircle, Trash2, Plus, Minus, X, Filter, ArrowLeft, ClipboardList, Loader2, MapPin, Phone, Mail, User, CreditCard, ChevronRight } from 'lucide-react';

const fmt = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);

const catColor = (cat) => {
  const map = {
    'Electronics': '#3b82f6',
    'Computers & Accessories': '#8b5cf6',
    'Clothing': '#ec4899',
    'Books & Stationery': '#f59e0b',
    'Home & Kitchen': '#10b981',
    'Sports & Outdoors': '#f97316',
    'Toys': '#06b6d4',
  };
  return map[cat] || '#6b7280';
};

function ProductCard({ product, cartQty, onAdd, onRemove }) {
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inStock = product.stock_level > 0;

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #f0f0f0',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.22s ease, transform 0.22s ease',
        boxShadow: hovered ? '0 12px 36px rgba(0,0,0,0.12)' : '0 2px 12px rgba(0,0,0,0.05)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ position: 'relative', height: '190px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {!imgError && product.image_url ? (
          <img src={product.image_url} alt={product.name} onError={() => setImgError(true)} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', padding: '12px' }} />
        ) : (
          <div style={{ color: '#cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Package size={44} />
            <span style={{ fontSize: '0.72rem' }}>No image</span>
          </div>
        )}
        <span style={{ position: 'absolute', top: '10px', left: '10px', background: catColor(product.category), color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
          {product.category}
        </span>
        {!inStock && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: '0.82rem', padding: '6px 16px', borderRadius: '20px' }}>OUT OF STOCK</span>
          </div>
        )}
        {cartQty > 0 && (
          <span style={{ position: 'absolute', top: '10px', right: '10px', background: 'linear-gradient(135deg, #eab308, #d1a007)', color: '#fff', fontWeight: 800, fontSize: '0.72rem', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(234,179,8,0.5)' }}>
            {cartQty}
          </span>
        )}
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', lineHeight: '1.35', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0 }} title={product.name}>
          {product.name}
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{fmt(product.current_price)}</div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>{inStock ? `${product.stock_level} in stock` : 'Unavailable'}</div>
          </div>
          {inStock && (
            cartQty === 0 ? (
              <button onClick={() => onAdd(product)} style={{ background: 'linear-gradient(135deg, #eab308, #d1a007)', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 14px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 3px 10px rgba(234,179,8,0.3)' }}>
                <Plus size={14} /> Add
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fefce8', border: '1.5px solid #eab308', borderRadius: '10px', padding: '4px 8px' }}>
                <button onClick={() => onRemove(product.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d97706', display: 'flex', padding: '2px' }}>
                  <Minus size={13} />
                </button>
                <span style={{ fontWeight: 800, fontSize: '0.9rem', minWidth: '18px', textAlign: 'center' }}>{cartQty}</span>
                <button onClick={() => onAdd(product)} disabled={cartQty >= product.stock_level} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d97706', display: 'flex', padding: '2px' }}>
                  <Plus size={13} />
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function CartSidebar({ cart, products, onAdd, onRemove, onRemoveAll, onClose, onCheckout }) {
  const productMap = useMemo(() => { const m = {}; products.forEach((p) => { m[p.id] = p; }); return m; }, [products]);
  const cartItems = Object.entries(cart).map(([id, qty]) => ({ product: productMap[parseInt(id)], qty })).filter(x => x.product);
  const subtotal = cartItems.reduce((sum, { product, qty }) => sum + product.current_price * qty, 0);
  const itemCount = Object.values(cart).reduce((a, b) => a + b, 0);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 900 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', background: '#ffffff', zIndex: 901, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)', animation: 'slideInRight 0.25s ease' }}>
        <div style={{ padding: '20px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #fefce8, #fff)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'linear-gradient(135deg, #eab308, #d1a007)', borderRadius: '10px', padding: '8px', display: 'flex' }}><ShoppingCart size={18} color="#fff" /></div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>Your Cart</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{itemCount} item{itemCount !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex' }}><X size={18} color="#64748b" /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {cartItems.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: '#94a3b8' }}>
              <ShoppingCart size={52} strokeWidth={1} />
              <div style={{ fontWeight: 600, fontSize: '1rem' }}>Your cart is empty</div>
              <div style={{ fontSize: '0.82rem' }}>Add products to get started</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cartItems.map(({ product, qty }) => (
                <div key={product.id} style={{ display: 'flex', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                  <div style={{ width: '52px', height: '52px', background: '#fff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {product.image_url ? <img src={product.image_url} alt={product.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <Package size={22} color="#cbd5e1" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{fmt(product.current_price)} each</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{fmt(product.current_price * qty)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '3px 6px' }}>
                      <button onClick={() => onRemove(product.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: '1px' }}><Minus size={12} /></button>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', minWidth: '20px', textAlign: 'center' }}>{qty}</span>
                      <button onClick={() => onAdd(product)} disabled={qty >= product.stock_level} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: '1px' }}><Plus size={12} /></button>
                    </div>
                    <button onClick={() => onRemoveAll(product.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex' }}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Subtotal</span>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>{fmt(subtotal)}</span>
            </div>
            <button onClick={onCheckout} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #eab308, #d1a007)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(234,179,8,0.35)' }}>
              Proceed to Checkout <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function CheckoutForm({ cart, products, user, token, onSuccess, onBack }) {
  const productMap = useMemo(() => { const m = {}; products.forEach((p) => { m[p.id] = p; }); return m; }, [products]);
  const cartItems = Object.entries(cart).map(([id, qty]) => ({ product: productMap[parseInt(id)], qty })).filter(x => x.product);
  const subtotal = cartItems.reduce((sum, { product, qty }) => sum + product.current_price * qty, 0);
  const [form, setForm] = useState({ customer_name: user?.username || '', email: '', phone: '', address: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handlePlaceOrder = async () => {
    if (!form.customer_name || !form.email || !form.phone || !form.address) { setError('Please fill in all fields.'); return; }
    setError(''); setLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('http://127.0.0.1:5000/api/orders', { method: 'POST', headers, body: JSON.stringify({ ...form, items: cartItems.map(({ product, qty }) => ({ product_id: product.id, quantity: qty })) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order failed');
      onSuccess(data);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 0 3rem' }}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontWeight: 600, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> Back to Shop
      </button>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem' }}>Checkout</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem' }}>
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontWeight: 700, color: '#0f172a', margin: 0 }}>Delivery Details</h3>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', color: '#dc2626', fontSize: '0.875rem' }}>{error}</div>}
          {[
            { name: 'customer_name', label: 'Full Name', icon: <User size={16} />, type: 'text', placeholder: 'John Doe' },
            { name: 'email', label: 'Email Address', icon: <Mail size={16} />, type: 'email', placeholder: 'john@example.com' },
            { name: 'phone', label: 'Phone Number', icon: <Phone size={16} />, type: 'tel', placeholder: '+91 98765 43210' },
          ].map(({ name, label, icon, type, placeholder }) => (
            <div key={name}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>{label}</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>{icon}</span>
                <input type={type} name={name} value={form[name]} onChange={handleChange} placeholder={placeholder} style={{ width: '100%', padding: '11px 12px 11px 36px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} onFocus={(e) => { e.target.style.borderColor = '#eab308'; }} onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }} />
              </div>
            </div>
          ))}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Delivery Address</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '14px', color: '#94a3b8' }}><MapPin size={16} /></span>
              <textarea name="address" value={form.address} onChange={handleChange} placeholder="Full street address, city, state, PIN..." rows={3} style={{ width: '100%', padding: '11px 12px 11px 36px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} onFocus={(e) => { e.target.style.borderColor = '#eab308'; }} onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }} />
            </div>
          </div>
          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={16} color="#d97706" />
            <span style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: 600 }}>Payment on Delivery (COD) — No online payment required</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <h3 style={{ fontWeight: 700, color: '#0f172a', marginBottom: '14px', marginTop: 0 }}>Order Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px', maxHeight: '260px', overflowY: 'auto' }}>
              {cartItems.map(({ product, qty }) => (
                <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ color: '#475569', flex: 1, lineHeight: '1.3' }}>{product.name.length > 34 ? `${product.name.substring(0, 32)}...` : product.name} ×{qty}</span>
                  <span style={{ fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>{fmt(product.current_price * qty)}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>Total</span>
              <span style={{ fontWeight: 900, fontSize: '1.2rem', color: '#0f172a' }}>{fmt(subtotal)}</span>
            </div>
          </div>
          <button onClick={handlePlaceOrder} disabled={loading} style={{ width: '100%', padding: '16px', background: loading ? '#fde68a' : 'linear-gradient(135deg, #eab308, #d1a007)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '1.05rem', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(234,179,8,0.35)' }}>
            {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Placing Order...</> : <>Place Order <CheckCircle size={18} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderSuccess({ order, onContinue }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', textAlign: 'center', padding: '2rem' }}>
      <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: '0 8px 24px rgba(16,185,129,0.35)', animation: 'popIn 0.4s ease' }}>
        <CheckCircle size={40} color="#fff" />
      </div>
      <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Order Placed!</h2>
      <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '24px' }}>Order <strong>#{order.id}</strong> confirmed. Updates will be sent to <strong>{order.email}</strong>.</p>
      <div style={{ background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', width: '100%', maxWidth: '480px', textAlign: 'left', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Total Amount</span>
          <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{fmt(order.total_amount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Status</span>
          <span style={{ background: '#fef3c7', color: '#92400e', fontWeight: 700, padding: '2px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>Pending</span>
        </div>
      </div>
      <button onClick={onContinue} style={{ padding: '12px 32px', background: 'linear-gradient(135deg, #eab308, #d1a007)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(234,179,8,0.3)' }}>
        Continue Shopping
      </button>
    </div>
  );
}

function MyOrders({ token }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch('http://127.0.0.1:5000/api/orders', { headers });
        if (res.ok) { const data = await res.json(); setOrders(data.filter(o => o.sale_type !== 'offline')); }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchOrders();
  }, [token]);

  const statusStyle = (status) => {
    const map = { Pending: { bg: '#fef3c7', color: '#92400e' }, Processing: { bg: '#dbeafe', color: '#1e40af' }, Shipped: { bg: '#e0f2fe', color: '#0369a1' }, Delivered: { bg: '#dcfce7', color: '#166534' }, Cancelled: { bg: '#fee2e2', color: '#991b1b' } };
    return map[status] || { bg: '#f1f5f9', color: '#475569' };
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 size={32} color="#eab308" style={{ animation: 'spin 1s linear infinite' }} /></div>;

  return (
    <div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem' }}>My Orders</h2>
      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
          <ClipboardList size={56} strokeWidth={1} style={{ marginBottom: '12px' }} />
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>No orders yet</div>
          <div style={{ fontSize: '0.85rem', marginTop: '6px' }}>Your completed orders will appear here</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {orders.map((order) => {
            const s = statusStyle(order.status);
            return (
              <div key={order.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>Order #{order.id}</div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>{new Date(order.timestamp).toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{fmt(order.total_amount)}</span>
                    <span style={{ background: s.bg, color: s.color, fontWeight: 700, padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem' }}>{order.status}</span>
                  </div>
                </div>
                {order.items && order.items.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {order.items.slice(0, 3).map((item) => (
                        <span key={item.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 8px', fontSize: '0.75rem', color: '#475569' }}>
                          {item.product_name?.length > 30 ? `${item.product_name.substring(0, 28)}...` : item.product_name} ×{item.quantity}
                        </span>
                      ))}
                      {order.items.length > 3 && <span style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '6px', padding: '3px 8px', fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>+{order.items.length - 3} more</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Storefront({ products, refreshProducts, token, user }) {
  const [activeTab, setActiveTab] = useState('shop');
  const [cart, setCart] = useState({});
  const [showCart, setShowCart] = useState(false);
  const [view, setView] = useState('list');
  const [lastOrder, setLastOrder] = useState(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');

  const categories = useMemo(() => { const cats = new Set(products.map((p) => p.category)); return ['All', ...Array.from(cats).sort()]; }, [products]);
  const filtered = useMemo(() => products.filter((p) => { const matchCat = catFilter === 'All' || p.category === catFilter; const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()); return matchCat && matchSearch; }), [products, search, catFilter]);
  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);

  const addToCart = (product) => setCart((prev) => { const cur = prev[product.id] || 0; if (cur >= product.stock_level) return prev; return { ...prev, [product.id]: cur + 1 }; });
  const removeFromCart = (productId) => setCart((prev) => { const cur = prev[productId] || 0; if (cur <= 1) { const next = { ...prev }; delete next[productId]; return next; } return { ...prev, [productId]: cur - 1 }; });
  const removeAllFromCart = (productId) => setCart((prev) => { const next = { ...prev }; delete next[productId]; return next; });
  const handleOrderSuccess = (order) => { setLastOrder(order); setCart({}); setView('success'); setShowCart(false); };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', position: 'relative' }}>
      {showCart && <CartSidebar cart={cart} products={products} onAdd={addToCart} onRemove={removeFromCart} onRemoveAll={removeAllFromCart} onClose={() => setShowCart(false)} onCheckout={() => { setShowCart(false); setView('checkout'); setActiveTab('shop'); }} />}

      {/* Storefront nav strip */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px', position: 'sticky', top: '69px', zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[{ key: 'shop', label: 'Shop', icon: '🛍️' }, { key: 'orders', label: 'My Orders', icon: '📦' }].map(({ key, label, icon }) => (
            <button key={key} onClick={() => { setActiveTab(key); setView('list'); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', border: 'none', borderRadius: '8px', fontWeight: activeTab === key ? 700 : 500, fontSize: '0.88rem', cursor: 'pointer', background: activeTab === key ? 'linear-gradient(135deg, #eab308, #d1a007)' : 'transparent', color: activeTab === key ? '#fff' : '#64748b', transition: 'all 0.18s', boxShadow: activeTab === key ? '0 3px 10px rgba(234,179,8,0.25)' : 'none', fontFamily: 'inherit' }}>
              {icon} {label}
            </button>
          ))}
        </div>
        {activeTab === 'shop' && view === 'list' && (
          <button onClick={() => setShowCart(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', background: totalItems > 0 ? 'linear-gradient(135deg, #eab308, #d1a007)' : '#f1f5f9', color: totalItems > 0 ? '#fff' : '#475569', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', boxShadow: totalItems > 0 ? '0 3px 12px rgba(234,179,8,0.3)' : 'none', transition: 'all 0.2s', fontFamily: 'inherit' }}>
            <ShoppingCart size={16} /> Cart {totalItems > 0 && <span style={{ background: '#fff', color: '#d97706', fontWeight: 900, padding: '1px 7px', borderRadius: '20px', fontSize: '0.78rem' }}>{totalItems}</span>}
          </button>
        )}
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 2rem 4rem' }}>
        {activeTab === 'orders' && <MyOrders token={token} />}
        {activeTab === 'shop' && view === 'success' && lastOrder && <OrderSuccess order={lastOrder} onContinue={() => { setView('list'); refreshProducts(); }} />}
        {activeTab === 'shop' && view === 'checkout' && <CheckoutForm cart={cart} products={products} user={user} token={token} onSuccess={handleOrderSuccess} onBack={() => setView('list')} />}
        {activeTab === 'shop' && view === 'list' && (
          <>
            {/* Search + Filter */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
                <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
                <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', padding: '11px 14px 11px 38px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }} onFocus={(e) => { e.target.style.borderColor = '#eab308'; }} onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <Filter size={14} color="#94a3b8" />
                {categories.map((cat) => (
                  <button key={cat} onClick={() => setCatFilter(cat)} style={{ padding: '6px 14px', border: '1.5px solid', borderColor: catFilter === cat ? '#eab308' : '#e2e8f0', borderRadius: '20px', background: catFilter === cat ? '#fefce8' : '#fff', color: catFilter === cat ? '#92400e' : '#64748b', fontWeight: catFilter === cat ? 700 : 500, fontSize: '0.79rem', cursor: 'pointer', transition: 'all 0.18s', fontFamily: 'inherit' }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1.25rem', fontWeight: 500 }}>
              Showing {filtered.length} product{filtered.length !== 1 ? 's' : ''}{catFilter !== 'All' ? ` in "${catFilter}"` : ''}{search ? ` for "${search}"` : ''}
            </div>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', color: '#94a3b8' }}>
                <Package size={56} strokeWidth={1} style={{ marginBottom: '14px' }} />
                <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>No products found</div>
                <div style={{ fontSize: '0.85rem', marginTop: '6px' }}>Try a different search or category</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
                {filtered.map((p) => (
                  <ProductCard key={p.id} product={p} cartQty={cart[p.id] || 0} onAdd={addToCart} onRemove={removeFromCart} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes popIn { 0% { transform: scale(0.5); opacity: 0; } 70% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}


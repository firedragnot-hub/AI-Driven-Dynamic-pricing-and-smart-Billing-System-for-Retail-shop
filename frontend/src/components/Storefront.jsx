import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import InvoiceTemplate from './InvoiceTemplate';
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
            <div style={{ fontSize: '0.72rem', marginTop: '2px' }}>
              {!inStock ? (
                <span style={{ color: '#ef4444', fontWeight: 600 }}>Out of stock</span>
              ) : product.stock_level <= 5 ? (
                <span style={{ color: '#dc2626', fontWeight: 700 }}>
                  🔥 Only {product.stock_level} left!
                </span>
              ) : (
                <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ In Stock</span>
              )}
            </div>
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

const fetchReverseGeocode = async (lat, lon) => {
  const apiKey = import.meta.env.VITE_LOCATIONIQ_TOKEN;
  try {
    const url = apiKey 
      ? `https://us1.locationiq.com/v1/reverse?key=${apiKey}&lat=${lat}&lon=${lon}&format=json`
      : `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const street = [addr.road, addr.suburb, addr.neighbourhood, addr.residential].filter(Boolean).join(', ') || '';
      const city = addr.city || addr.town || addr.village || addr.county || addr.district || '';
      const state = addr.state || '';
      const pincode = addr.postcode || '';
      return {
        fullAddress: data.display_name || `${street}${street ? ', ' : ''}${city}${city ? ', ' : ''}${state} ${pincode}`,
        street: street || data.display_name || '',
        city,
        state,
        pincode
      };
    }
  } catch (err) {
    console.error("Geocoding fetch failed:", err);
  }
  return null;
};

const fetchAutocompleteSuggestions = async (query) => {
  if (!query || query.trim().length < 3) return [];
  const apiKey = import.meta.env.VITE_LOCATIONIQ_TOKEN;
  try {
    const url = apiKey 
      ? `https://api.locationiq.com/v1/autocomplete?key=${apiKey}&q=${encodeURIComponent(query)}&limit=5&dedupe=1`
      : `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return (data || []).map(item => ({
        display_name: item.display_name,
        lat: item.lat,
        lon: item.lon,
        address: item.address || {}
      }));
    }
  } catch (err) {
    console.error("Autocomplete fetch failed:", err);
  }
  return [];
};

function CheckoutForm({ cart, products, user, token, onSuccess, onBack }) {
  const productMap = useMemo(() => { const m = {}; products.forEach((p) => { m[p.id] = p; }); return m; }, [products]);
  const cartItems = Object.entries(cart).map(([id, qty]) => ({ product: productMap[parseInt(id)], qty })).filter(x => x.product);
  const subtotal = cartItems.reduce((sum, { product, qty }) => sum + product.current_price * qty, 0);
  const [form, setForm] = useState({ 
    customer_name: user?.username || user?.name || '', 
    email: user?.email || '', 
    phone: user?.phone || '', 
    address: user?.address || '' 
  });

  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        customer_name: prev.customer_name || user.username || user.name || '',
        email: prev.email || user.email || ''
      }));
    }
  }, [user]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState('');

  // Payment Integration Mock States
  const [paymentOpt, setPaymentOpt] = useState('cod'); // 'cod' or 'card'
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [locating, setLocating] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleAddressChange = async (e) => {
    const val = e.target.value;
    setForm(prev => ({ ...prev, address: val }));
    if (val.trim().length >= 3) {
      const list = await fetchAutocompleteSuggestions(val);
      setSuggestions(list);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (sug) => {
    setForm(prev => ({ ...prev, address: sug.display_name }));
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const result = await fetchReverseGeocode(latitude, longitude);
        if (result && result.fullAddress) {
          setForm(prev => ({
            ...prev,
            address: result.fullAddress
          }));
        } else {
          alert("Could not determine address. Please enter manually.");
        }
        setLocating(false);
      },
      (err) => {
        alert("Location access denied or unavailable. Please enter address manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    const fetchSaved = async () => {
      try {
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch('/api/addresses', { headers });
        if (res.ok) {
          const data = await res.json();
          setSavedAddresses(data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    if (token) fetchSaved();
  }, [token]);

  const handleSelectSavedAddress = (e) => {
    const id = e.target.value;
    setSelectedAddrId(id);
    if (!id) return;
    const selected = savedAddresses.find(a => a.id === parseInt(id));
    if (selected) {
      setForm({
        customer_name: selected.name,
        email: user?.email || '',
        phone: selected.phone,
        address: `${selected.address_line}, ${selected.city} - ${selected.pincode}`
      });
    }
  };

  const executeOrderPlacement = async (paymentDetails = {}) => {
    setError(''); setLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (user?.email) headers['X-Clerk-User-Email'] = user.email;
      if (user?.username || user?.name) headers['X-Clerk-User-Name'] = user.username || user.name;
      const orderPayload = { 
        ...form, 
        items: cartItems.map(({ product, qty }) => ({ product_id: product.id, quantity: qty })),
        notes: paymentOpt === 'card' ? `Paid via Mock Card (Tx: ${Math.random().toString(36).substring(2, 10).toUpperCase()})` : 'COD'
      };
      
      const res = await fetch('/api/orders', { 
        method: 'POST', 
        headers, 
        body: JSON.stringify(orderPayload) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order failed');
      onSuccess(data);
    } catch (err) { 
      setError(err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const handlePlaceOrderSubmit = () => {
    if (!form.customer_name || !form.email || !form.phone || !form.address) { 
      setError('Please fill in all delivery fields.'); 
      return; 
    }
    
    if (paymentOpt === 'card' || paymentOpt === 'upi') {
      setShowPaymentModal(true);
    } else {
      executeOrderPlacement();
    }
  };

  const handleMockPaymentSubmit = (e) => {
    e.preventDefault();
    if (!cardNumber || !cardExpiry || !cardCvv || !cardName) {
      alert("Please fill in all credit card details.");
      return;
    }
    setPaymentLoading(true);
    setTimeout(() => {
      setPaymentLoading(false);
      setShowPaymentModal(false);
      executeOrderPlacement();
    }, 2000);
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
          
          {savedAddresses.length > 0 && (
            <div style={{ marginBottom: '8px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Select Saved Address</label>
              <select value={selectedAddrId} onChange={handleSelectSavedAddress} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', background: '#fff', fontFamily: 'inherit' }}>
                <option value="">-- Choose from your Saved Addresses --</option>
                {savedAddresses.map(a => (
                  <option key={a.id} value={a.id}>{a.name} - {a.address_line}, {a.city}</option>
                ))}
              </select>
            </div>
          )}

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', margin: 0 }}>Delivery Address</label>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={locating}
                style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  color: '#92400e',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: locating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {locating ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <MapPin size={12} />}
                {locating ? 'Detecting...' : '📍 Auto-Detect Location'}
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '14px', color: '#94a3b8' }}><MapPin size={16} /></span>
              <textarea 
                name="address" 
                value={form.address} 
                onChange={handleAddressChange} 
                placeholder="Full street address, city, state, PIN (type for suggestions)..." 
                rows={3} 
                style={{ width: '100%', padding: '11px 12px 11px 36px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} 
                onFocus={(e) => { e.target.style.borderColor = '#eab308'; if (suggestions.length > 0) setShowSuggestions(true); }} 
                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; setTimeout(() => setShowSuggestions(false), 250); }} 
              />
              {showSuggestions && suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', borderRadius: '10px', border: '1.5px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: '4px', overflow: 'hidden' }}>
                  {suggestions.map((sug, idx) => (
                    <div 
                      key={idx} 
                      onMouseDown={() => handleSelectSuggestion(sug)} 
                      style={{ padding: '10px 14px', fontSize: '0.82rem', color: '#334155', cursor: 'pointer', borderBottom: idx < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#fefce8'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                    >
                      <MapPin size={14} color="#d97706" style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sug.display_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Payment Method Selector */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '8px' }}>Select Payment Method</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div 
                onClick={() => setPaymentOpt('cod')} 
                style={{ 
                  flex: 1, 
                  minWidth: '120px',
                  padding: '12px', 
                  borderRadius: '10px', 
                  border: paymentOpt === 'cod' ? '2px solid #eab308' : '1.5px solid #e2e8f0', 
                  background: paymentOpt === 'cod' ? '#fefce8' : '#fff', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: paymentOpt === 'cod' ? '#92400e' : '#475569'
                }}
              >
                <input type="radio" checked={paymentOpt === 'cod'} readOnly style={{ accentColor: '#eab308' }} />
                Cash on Delivery
              </div>
              <div 
                onClick={() => setPaymentOpt('upi')} 
                style={{ 
                  flex: 1, 
                  minWidth: '120px',
                  padding: '12px', 
                  borderRadius: '10px', 
                  border: paymentOpt === 'upi' ? '2px solid #10b981' : '1.5px solid #e2e8f0', 
                  background: paymentOpt === 'upi' ? '#ecfdf5' : '#fff', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: paymentOpt === 'upi' ? '#065f46' : '#475569'
                }}
              >
                <input type="radio" checked={paymentOpt === 'upi'} readOnly style={{ accentColor: '#10b981' }} />
                UPI QR Code
              </div>
              <div 
                onClick={() => setPaymentOpt('card')} 
                style={{ 
                  flex: 1, 
                  minWidth: '120px',
                  padding: '12px', 
                  borderRadius: '10px', 
                  border: paymentOpt === 'card' ? '2px solid #eab308' : '1.5px solid #e2e8f0', 
                  background: paymentOpt === 'card' ? '#fefce8' : '#fff', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: paymentOpt === 'card' ? '#92400e' : '#475569'
                }}
              >
                <input type="radio" checked={paymentOpt === 'card'} readOnly style={{ accentColor: '#eab308' }} />
                Credit Card
              </div>
            </div>
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
          <button onClick={handlePlaceOrderSubmit} disabled={loading} style={{ width: '100%', padding: '16px', background: loading ? '#fde68a' : 'linear-gradient(135deg, #eab308, #d1a007)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '1.05rem', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(234,179,8,0.35)' }}>
            {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Placing Order...</> : <>Place Order <CheckCircle size={18} /></>}
          </button>
        </div>
      </div>

      {/* Mock Payment Gateway Modal Overlay */}
      {showPaymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 15px 50px rgba(0,0,0,0.2)', zIndex: 10001, width: '420px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: paymentOpt === 'upi' ? 'center' : 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>{paymentOpt === 'upi' ? '📱' : '💳'}</span>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                  {paymentOpt === 'upi' ? 'UPI Payment QR' : 'Stripe Checkout'}
                </span>
              </div>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>✕</button>
            </div>

            {paymentOpt === 'upi' ? (
              <>
                <div style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#fff', padding: '14px', borderRadius: '14px' }}>
                  <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', opacity: 0.9 }}>Amount Due</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{fmt(subtotal)}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Payee: aman singh (amasingha3639@kotak)</div>
                </div>

                <div style={{ background: '#fff', padding: '12px', borderRadius: '16px', border: '2px dashed #10b981', display: 'inline-block', margin: '0 auto' }}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(`upi://pay?pa=amasingha3639@kotak&pn=aman%20singh&am=${subtotal.toFixed(2)}&tn=Online%20Store%20Order&cu=INR`)}`} 
                    alt="UPI QR Code" 
                    style={{ width: '200px', height: '200px', display: 'block', borderRadius: '8px' }} 
                  />
                </div>

                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Scan using Google Pay, PhonePe, Paytm, or BHIM to complete payment.
                </div>

                <button 
                  type="button" 
                  disabled={paymentLoading} 
                  onClick={() => {
                    setPaymentLoading(true);
                    setTimeout(() => {
                      setPaymentLoading(false);
                      setShowPaymentModal(false);
                      executeOrderPlacement({ notes: 'Paid via Dynamic UPI QR Code (amasingha3639@kotak)' });
                    }, 1200);
                  }}
                  style={{ 
                    width: '100%', 
                    padding: '14px', 
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '10px', 
                    fontWeight: 800, 
                    fontSize: '1rem', 
                    cursor: paymentLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {paymentLoading ? 'Confirming Payment...' : 'I Have Completed UPI Payment'}
                </button>
              </>
            ) : (
              <>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#475569' }}>Total to Pay</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>{fmt(subtotal)}</span>
                </div>

                <form onSubmit={handleMockPaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Cardholder Name</label>
                    <input 
                      type="text" 
                      value={cardName} 
                      onChange={e => setCardName(e.target.value)} 
                      required 
                      placeholder="John Doe" 
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', outline: 'none', boxSizing: 'border-box' }} 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Card Number</label>
                    <input 
                      type="text" 
                      value={cardNumber} 
                      onChange={e => setCardNumber(e.target.value)} 
                      required 
                      placeholder="4242 4242 4242 4242" 
                      maxLength={19}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', outline: 'none', boxSizing: 'border-box' }} 
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Expiration (MM/YY)</label>
                      <input 
                        type="text" 
                        value={cardExpiry} 
                        onChange={e => setCardExpiry(e.target.value)} 
                        required 
                        placeholder="12/28" 
                        maxLength={5}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', outline: 'none', boxSizing: 'border-box' }} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>CVV</label>
                      <input 
                        type="password" 
                        value={cardCvv} 
                        onChange={e => setCardCvv(e.target.value)} 
                        required 
                        placeholder="***" 
                        maxLength={4}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', outline: 'none', boxSizing: 'border-box' }} 
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={paymentLoading} 
                    style={{ 
                      marginTop: '12px',
                      width: '100%', 
                      padding: '14px', 
                      background: paymentLoading ? '#fde68a' : '#635bff',
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: '10px', 
                      fontWeight: 800, 
                      fontSize: '1rem', 
                      cursor: paymentLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    {paymentLoading ? <>Processing Mock Payment...</> : <>Pay {fmt(subtotal)}</>}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
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

function MyOrders({ token, user, onPrintInvoice }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Return / Replacement request states
  const [returningOrder, setReturningOrder] = useState(null);
  const [returnForm, setReturnForm] = useState({ return_type: 'Return', product_id: '', quantity: 1, reason: 'Defective / Damaged Product' });
  const [returnError, setReturnError] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      if (user?.email) headers['X-Clerk-User-Email'] = user.email;
      if (user?.username || user?.name) headers['X-Clerk-User-Name'] = user.username || user.name;
      const res = await fetch('/api/orders', { headers });
      if (res.ok) { 
        const data = await res.json(); 
        const orderList = Array.isArray(data) ? data : (data.orders || []);
        setOrders(orderList.filter(o => o.sale_type !== 'offline')); 
      }
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token]);

  const handleOpenReturn = (order) => {
    setReturningOrder(order);
    setReturnError('');
    setReturnForm({
      return_type: 'Return',
      product_id: order.items && order.items.length > 0 ? order.items[0].product_id.toString() : '',
      quantity: 1,
      reason: 'Defective / Damaged Product',
      return_method: 'Online Pickup'
    });
  };

  const handleReturnSubmit = async (orderId) => {
    setReturnError('');
    setSubmittingReturn(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/orders/${orderId}/return-request`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          return_type: returnForm.return_type,
          product_id: returnForm.product_id ? parseInt(returnForm.product_id) : null,
          quantity: parseInt(returnForm.quantity) || 1,
          reason: returnForm.reason,
          return_method: returnForm.return_method
        })
      });
      const data = await res.json();
      if (res.ok) {
        setReturningOrder(null);
        fetchOrders();
        alert(`${returnForm.return_type} request submitted successfully! Status updated to ${data.order?.status || 'Requested'}.`);
      } else {
        setReturnError(data.error || 'Failed to submit request.');
      }
    } catch (err) {
      setReturnError(err.message);
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleDownloadInvoice = async (orderId) => {
    // Instead of downloading PDF, we just open the HTML print UI to match admin view.
    const order = orders.find(o => o.id === orderId);
    if (order && onPrintInvoice) {
      onPrintInvoice(order);
    }
  };

  const statusStyle = (status) => {
    const map = { 
      Pending: { bg: '#fef3c7', color: '#92400e' }, 
      Processing: { bg: '#dbeafe', color: '#1e40af' }, 
      Shipped: { bg: '#e0f2fe', color: '#0369a1' }, 
      Delivered: { bg: '#dcfce7', color: '#166534' }, 
      'Return Requested': { bg: '#fef3c7', color: '#d97706' },
      'Replacement Requested': { bg: '#fce7f3', color: '#be185d' },
      Returned: { bg: '#f1f5f9', color: '#475569' },
      Replaced: { bg: '#d1fae5', color: '#065f46' },
      Cancelled: { bg: '#fee2e2', color: '#991b1b' },
      'Partially Returned': { bg: '#ffedd5', color: '#c2410c' }
    };
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
            const orderDate = new Date(order.timestamp);
            const isDelivered = order.status === 'Delivered';

            return (
              <div key={order.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>Order #{order.id}</div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>{orderDate.toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{fmt(order.total_amount)}</span>
                    <span style={{ background: s.bg, color: s.color, fontWeight: 700, padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem' }}>{order.status}</span>
                  </div>
                </div>

                {order.items && order.items.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</div>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {/* Download Invoice Button */}
                        <button 
                          onClick={() => handleDownloadInvoice(order.id)} 
                          style={{ 
                            background: '#f8fafc', 
                            border: '1.5px solid #cbd5e1', 
                            color: '#334155', 
                            borderRadius: '8px', 
                            padding: '6px 12px', 
                            fontSize: '0.78rem', 
                            fontWeight: 700, 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          📄 Download Invoice
                        </button>

                        {/* Return / Replace Button */}
                        {isDelivered && (
                          <button 
                            onClick={() => handleOpenReturn(order)} 
                            style={{ 
                              background: 'linear-gradient(135deg, #f59e0b, #d97706)', 
                              border: 'none', 
                              color: '#fff', 
                              borderRadius: '8px', 
                              padding: '6px 12px', 
                              fontSize: '0.78rem', 
                              fontWeight: 700, 
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(245,158,11,0.3)'
                            }}
                          >
                            🔄 Return / Replace
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {order.items.map((item) => (
                        <span key={item.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 8px', fontSize: '0.75rem', color: '#475569' }}>
                          {item.product_name?.length > 30 ? `${item.product_name.substring(0, 28)}...` : item.product_name} ×{item.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Return / Replacement Modal */}
      {returningOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>Return or Replace (Order #{returningOrder.id})</h3>
              <button onClick={() => setReturningOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>
            {returnError && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '10px 14px', color: '#dc2626', fontSize: '0.8rem' }}>{returnError}</div>}
            
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Request Type</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setReturnForm({ ...returnForm, return_type: 'Return' })}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: `2px solid ${returnForm.return_type === 'Return' ? '#d97706' : '#e2e8f0'}`,
                    background: returnForm.return_type === 'Return' ? '#fef3c7' : '#fff',
                    color: returnForm.return_type === 'Return' ? '#92400e' : '#475569',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🔙 Return (Refund)
                </button>
                <button
                  type="button"
                  onClick={() => setReturnForm({ ...returnForm, return_type: 'Replacement' })}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: `2px solid ${returnForm.return_type === 'Replacement' ? '#ec4899' : '#e2e8f0'}`,
                    background: returnForm.return_type === 'Replacement' ? '#fce7f3' : '#fff',
                    color: returnForm.return_type === 'Replacement' ? '#be185d' : '#475569',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Replacement
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Select Product</label>
              <select value={returnForm.product_id} onChange={(e) => setReturnForm({ ...returnForm, product_id: e.target.value, quantity: 1 })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem' }}>
                {returningOrder.items.map(item => (
                  <option key={item.id} value={item.product_id.toString()}>{item.product_name} (Qty: {item.quantity})</option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Return Method</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setReturnForm({ ...returnForm, return_method: 'Store Drop-off' })}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer',
                    border: `2px solid ${returnForm.return_method === 'Store Drop-off' ? '#2563eb' : '#e2e8f0'}`,
                    background: returnForm.return_method === 'Store Drop-off' ? '#eff6ff' : '#fff',
                    color: returnForm.return_method === 'Store Drop-off' ? '#1e40af' : '#475569',
                    fontWeight: '700'
                  }}
                >🏪 Store Drop-off</button>
                <button
                  type="button"
                  onClick={() => setReturnForm({ ...returnForm, return_method: 'Online Pickup' })}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer',
                    border: `2px solid ${returnForm.return_method === 'Online Pickup' ? '#16a34a' : '#e2e8f0'}`,
                    background: returnForm.return_method === 'Online Pickup' ? '#f0fdf4' : '#fff',
                    color: returnForm.return_method === 'Online Pickup' ? '#166534' : '#475569',
                    fontWeight: '700'
                  }}
                >🚚 Online Pickup</button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Reason for {returnForm.return_type}</label>
              <select value={returnForm.reason} onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem' }}>
                <option value="Defective / Damaged Product">Defective / Damaged Product</option>
                <option value="Wrong Item Shipped">Wrong Item Shipped</option>
                <option value="Size or Model Issue">Size or Model Issue</option>
                <option value="Item not as Described">Item not as Described</option>
                <option value="No Longer Needed">No Longer Needed</option>
                <option value="Other Reason">Other Reason</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => handleReturnSubmit(returningOrder.id)} disabled={submittingReturn} className="btn btn-primary" style={{ padding: '11px 20px', flex: 1, fontSize: '0.9rem' }}>
                {submittingReturn ? 'Submitting Request...' : `Submit ${returnForm.return_type} Request`}
              </button>
              <button onClick={() => setReturningOrder(null)} style={{ padding: '11px 20px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MyAddresses({ token }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingAddr, setEditingAddr] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address_line: '', city: '', pincode: '' });
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const result = await fetchReverseGeocode(latitude, longitude);
        if (result) {
          setForm(prev => ({
            ...prev,
            address_line: result.street || result.fullAddress,
            city: result.city || prev.city,
            pincode: result.pincode || prev.pincode
          }));
        } else {
          alert("Could not determine address. Please enter manually.");
        }
        setLocating(false);
      },
      (err) => {
        alert("Location access denied or unavailable.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const fetchAddresses = async () => {
    setLoading(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/addresses', { headers });
      if (res.ok) {
        const data = await res.json();
        setAddresses(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.address_line || !form.city || !form.pincode) {
      setError('All fields are required.');
      return;
    }
    setError('');
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const method = editingAddr ? 'PUT' : 'POST';
      const url = editingAddr ? `/api/addresses/${editingAddr.id}` : '/api/addresses';
      
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(form)
      });
      
      if (res.ok) {
        setForm({ name: '', phone: '', address_line: '', city: '', pincode: '' });
        setEditingAddr(null);
        setShowForm(false);
        fetchAddresses();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save address.');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (addr) => {
    setEditingAddr(addr);
    setForm({
      name: addr.name,
      phone: addr.phone,
      address_line: addr.address_line,
      city: addr.city,
      pincode: addr.pincode
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this address?')) return;
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/addresses/${id}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        fetchAddresses();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 size={32} color="#eab308" style={{ animation: 'spin 1s linear infinite' }} /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>My Saved Addresses</h2>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setEditingAddr(null); setForm({ name: '', phone: '', address_line: '', city: '', pincode: '' }); }} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem' }}>
            <Plus size={16} /> Add New Address
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '600px' }}>
          <h3 style={{ fontWeight: 700, color: '#0f172a', margin: 0 }}>{editingAddr ? 'Edit Address' : 'Add New Address'}</h3>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', color: '#dc2626', fontSize: '0.875rem' }}>{error}</div>}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Phone</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', margin: 0 }}>Address Line</label>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={locating}
                style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  color: '#92400e',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: locating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {locating ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <MapPin size={12} />}
                {locating ? 'Detecting...' : '📍 Auto-Detect Location'}
              </button>
            </div>
            <input type="text" value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} placeholder="Apartment, Street address" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>City</label>
              <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Mumbai" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Pincode</label>
              <input type="text" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} placeholder="400001" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px', fontSize: '0.9rem' }}>Save Address</button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 20px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem' }}>Cancel</button>
          </div>
        </form>
      )}

      {addresses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <MapPin size={56} strokeWidth={1} style={{ marginBottom: '12px' }} />
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>No addresses saved yet</div>
          <div style={{ fontSize: '0.85rem', marginTop: '6px' }}>Add your shipping address to make checkout faster</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {addresses.map((addr) => (
            <div key={addr.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={15} color="#64748b" /> {addr.name}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={14} color="#94a3b8" /> {addr.phone}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '8px' }}>
                  <MapPin size={14} color="#94a3b8" style={{ marginTop: '3px', flexShrink: 0 }} />
                  <div>
                    {addr.address_line}<br />
                    {addr.city} - {addr.pincode}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid #f1f5f9', marginTop: '16px', paddingTop: '12px' }}>
                <button onClick={() => handleEdit(addr)} style={{ background: 'none', border: 'none', color: 'var(--primary-dark)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}>Edit</button>
                <button onClick={() => handleDelete(addr.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MyReturns({ token }) {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReturns = async () => {
      setLoading(true);
      try {
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch('/api/returns', { headers });
        if (res.ok) {
          const data = await res.json();
          setReturns(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchReturns();
  }, [token]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 size={32} color="#eab308" style={{ animation: 'spin 1s linear infinite' }} /></div>;

  return (
    <div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem' }}>My Returns</h2>
      {returns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <Package size={56} strokeWidth={1} style={{ marginBottom: '12px' }} />
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>No return requests yet</div>
          <div style={{ fontSize: '0.85rem', marginTop: '6px' }}>Eligible item returns will be listed here</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {returns.map((ret) => (
            <div key={ret.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>Return ID: #{ret.id}</div>
                  {ret.order_id && <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>Order: #{ret.order_id}</div>}
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>Date: {new Date(ret.timestamp).toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#dc2626' }}>Refunded: {fmt(ret.refund_amount)}</div>
                  <span style={{ background: '#dcfce7', color: '#166534', fontWeight: 700, padding: '2px 10px', borderRadius: '20px', fontSize: '0.72rem', display: 'inline-block', marginTop: '4px' }}>Processed</span>
                </div>
              </div>
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                  Returned Product: <b>{ret.product_name}</b> (Qty: {ret.quantity})
                </div>
                {ret.reason && (
                  <div style={{ fontSize: '0.8rem', color: '#64748b', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '4px' }}>
                    Reason: <i>{ret.reason}</i><br/>
                    Method: <b>{ret.return_method || 'Online Pickup'}</b>
                  </div>
                )}
              </div>
            </div>
          ))}
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
  const [productPage, setProductPage] = useState(1);
  const [activePrintOrder, setActivePrintOrder] = useState(null);

  const categories = useMemo(() => { const cats = new Set(products.map((p) => p.category)); return ['All', ...Array.from(cats).sort()]; }, [products]);
  const filtered = useMemo(() => products.filter((p) => { const matchCat = catFilter === 'All' || p.category === catFilter; const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()); return matchCat && matchSearch; }), [products, search, catFilter]);
  
  useEffect(() => {
    setProductPage(1);
  }, [search, catFilter]);
  
  const visibleProducts = useMemo(() => filtered.slice(0, productPage * 25), [filtered, productPage]);
  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);

  const addToCart = (product) => setCart((prev) => { const cur = prev[product.id] || 0; if (cur >= product.stock_level) return prev; return { ...prev, [product.id]: cur + 1 }; });
  const removeFromCart = (productId) => setCart((prev) => { const cur = prev[productId] || 0; if (cur <= 1) { const next = { ...prev }; delete next[productId]; return next; } return { ...prev, [productId]: cur - 1 }; });
  const removeAllFromCart = (productId) => setCart((prev) => { const next = { ...prev }; delete next[productId]; return next; });
  const handleOrderSuccess = (order) => { setLastOrder(order); setCart({}); setView('success'); setShowCart(false); };

  const handlePrintInvoice = (order) => {
    setActivePrintOrder(order);
    setTimeout(() => {
      window.print();
      setActivePrintOrder(null);
    }, 500);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--light)', position: 'relative' }}>
      {showCart && <CartSidebar cart={cart} products={products} onAdd={addToCart} onRemove={removeFromCart} onRemoveAll={removeAllFromCart} onClose={() => setShowCart(false)} onCheckout={() => { setShowCart(false); setView('checkout'); setActiveTab('shop'); }} />}

      <div className="store-nav-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="TEGL Logo" style={{ height: '38px', width: '38px', objectFit: 'contain' }} />
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { key: 'shop', label: 'Shop', icon: '🛍️' },
              { key: 'orders', label: 'My Orders', icon: '📦' },
              { key: 'addresses', label: 'My Addresses', icon: '📍' },
              { key: 'returns', label: 'My Returns', icon: '🔄' }
            ].map(({ key, label, icon }) => (
              <button key={key} onClick={() => { setActiveTab(key); setView('list'); }} className={`store-tab-btn ${activeTab === key ? 'active' : ''}`}>
                {icon} {label}
              </button>
            ))}
          </div>
        </div>
        {activeTab === 'shop' && view === 'list' && (
          <button onClick={() => setShowCart(true)} className="btn btn-primary" style={{ padding: '0.5rem 1.125rem', fontSize: '0.85rem' }}>
            <ShoppingCart size={16} /> Cart {totalItems > 0 && <span style={{ background: '#fff', color: 'var(--primary-dark)', fontWeight: 800, padding: '1px 7px', borderRadius: '20px', fontSize: '0.75rem' }}>{totalItems}</span>}
          </button>
        )}
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 2rem 4rem' }}>
        {activeTab === 'orders' && <MyOrders token={token} user={user} onPrintInvoice={handlePrintInvoice} />}
        {activeTab === 'addresses' && <MyAddresses token={token} user={user} />}
        {activeTab === 'returns' && <MyReturns token={token} user={user} />}
        {activeTab === 'shop' && view === 'success' && lastOrder && <OrderSuccess order={lastOrder} onContinue={() => { setView('list'); refreshProducts(); }} />}
        {activeTab === 'shop' && view === 'checkout' && <CheckoutForm cart={cart} products={products} user={user} token={token} onSuccess={handleOrderSuccess} onBack={() => setView('list')} />}
        {activeTab === 'shop' && view === 'list' && (
          <>
            <div className="store-hero">
              <div className="store-hero-content">
                <h2>Welcome to TEGL Store</h2>
                <p>Discover quality products with fast delivery and secure checkout. Browse our curated collection below.</p>
              </div>
              <div className="store-hero-stats">
                <div className="store-stat">
                  <div className="store-stat-value">{products.length}</div>
                  <div className="store-stat-label">Products</div>
                </div>
                <div className="store-stat">
                  <div className="store-stat-value">{categories.length - 1}</div>
                  <div className="store-stat-label">Categories</div>
                </div>
                <div className="store-stat">
                  <div className="store-stat-value">COD</div>
                  <div className="store-stat-label">Payment</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div className="search-bar">
                <Search size={16} />
                <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <Filter size={14} color="var(--text-muted)" />
                {categories.map((cat) => (
                  <button key={cat} onClick={() => setCatFilter(cat)} className={`category-pill ${catFilter === cat ? 'active' : ''}`}>
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
                {visibleProducts.map((p) => (
                  <ProductCard key={p.id} product={p} cartQty={cart[p.id] || 0} onAdd={addToCart} onRemove={removeFromCart} />
                ))}
                {/* Infinite Scroll Sentinel */}
                {visibleProducts.length < filtered.length && (
                  <div 
                    style={{ textAlign: 'center', padding: '2rem', gridColumn: '1 / -1' }}
                    ref={(node) => {
                      if (!node) return;
                      if (node._observer) node._observer.disconnect();
                      node._observer = new IntersectionObserver(entries => {
                        if (entries[0].isIntersecting) {
                          setProductPage(p => p + 1);
                        }
                      }, { threshold: 1.0 });
                      node._observer.observe(node);
                    }}
                  >
                    <span style={{ color: '#94a3b8' }}>Loading more...</span>
                  </div>
                )}
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
      {activePrintOrder && createPortal(<InvoiceTemplate order={activePrintOrder} />, document.body)}
    </div>
  );
}


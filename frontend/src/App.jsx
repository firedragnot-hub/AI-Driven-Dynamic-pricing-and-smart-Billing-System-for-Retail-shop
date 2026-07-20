import React, { useState, useEffect, lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./components/Dashboard'));
const POS = lazy(() => import('./components/POS'));
const Inventory = lazy(() => import('./components/Inventory'));
const MLForecast = lazy(() => import('./components/MLForecast'));
const Storefront = lazy(() => import('./components/Storefront'));
const OrdersList = lazy(() => import('./components/OrdersList'));
const GSTCompliance = lazy(() => import('./components/GSTCompliance'));
const FinancialDashboard = lazy(() => import('./components/FinancialDashboard'));
const ReviewsList = lazy(() => import('./components/ReviewsList'));
import { LayoutDashboard, ShoppingCart, Package, BrainCircuit, ClipboardList, Store, LogOut, User, Lock, Mail, ChevronRight, Landmark, BarChart3, Bell, MessageSquare, Calendar, AlertTriangle } from 'lucide-react';
import './App.css';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  
  // Auth Form State
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register' or 'changePassword'
  const [authRole, setAuthRole] = useState('customer'); // 'customer' or 'admin'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Portal State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Notifications State
  const [notifications, setNotifications] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!token) return;
    setNotifLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/notifications/summary');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error("Error fetching notifications", e);
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    if (token && user && user.role === 'admin') {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [token, user]);

  const fetchProducts = async () => {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('http://127.0.0.1:5000/api/products', { headers });
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      console.error('Error fetching products:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [token]);



  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    
    const url = 'http://127.0.0.1:5000/api/auth/login';
    const payload = { username: email, password }; // email field serves as username/email on login

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      
      // Default tab based on role
      if (data.user.role === 'admin') {
        setActiveTab('dashboard');
      } else {
        setActiveTab('shop');
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    
    try {
      const res = await fetch('http://127.0.0.1:5000/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: email,
          old_password: password,
          new_password: newPassword
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Password update failed');
      }

      alert('Password changed successfully! Please log in with your new password.');
      setAuthMode('login');
      setPassword('');
      setNewPassword('');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setAuthMode('login');
    setUsername('');
    setEmail('');
    setPassword('');
    setAuthError('');
  };

  if (!token || !user) {
    return (
      <div className="auth-page">
        <div className="hs hs1"></div>
        <div className="hs hs2"></div>
        
        <div className="auth-card">
          <div className="auth-logo">
            <img src="/logo.png" alt="TEGL Logo" className="portal-logo-img" style={{ height: '50px' }} />
            <h2>TEGL Retail Solutions</h2>
            <p>Smart Shop Management System</p>
          </div>
          <div className="auth-role-tabs">
            <button 
              className={`role-tab-btn ${authRole === 'customer' ? 'active' : ''}`}
              onClick={() => { setAuthRole('customer'); setAuthError(''); setAuthMode('login'); }}
            >
              Customer Portal
            </button>
            <button 
              className={`role-tab-btn ${authRole === 'admin' ? 'active' : ''}`}
              onClick={() => { setAuthRole('admin'); setAuthError(''); setAuthMode('login'); }}
            >
              Owner Portal
            </button>
          </div>

          {authMode === 'changePassword' ? (
            <form onSubmit={handlePasswordChange} className="auth-form">
              <h3>Change Password</h3>
              
              {authError && <div className="auth-error-msg">{authError}</div>}
              
              <div className="form-group-iconic">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  placeholder="Username or Email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group-iconic">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  placeholder="Old Password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group-iconic">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  placeholder="New Password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required 
                />
              </div>

              <button type="submit" className="auth-submit-btn" disabled={authLoading}>
                {authLoading ? 'Updating...' : 'Change Password'}
                <ChevronRight size={18} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="auth-form">
              <h3>{authMode === 'login' ? 'Sign In' : 'Create Account'}</h3>
              
              {authError && <div className="auth-error-msg">{authError}</div>}
              
              {authMode === 'register' && (
                <div className="form-group-iconic">
                  <User size={18} className="input-icon" />
                  <input 
                    type="text" 
                    placeholder="Username" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required 
                  />
                </div>
              )}

              <div className="form-group-iconic">
                {authMode === 'login' ? <User size={18} className="input-icon" /> : <Mail size={18} className="input-icon" />}
                <input 
                  type={authMode === 'login' ? 'text' : 'email'} 
                  placeholder={authMode === 'login' ? 'Username or Email' : 'Email Address'} 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group-iconic">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>

              <button type="submit" className="auth-submit-btn" disabled={authLoading}>
                {authLoading ? 'Verifying...' : (authMode === 'login' ? 'Login' : 'Sign Up')}
                <ChevronRight size={18} />
              </button>
            </form>
          )}

          <div className="auth-footer-toggle" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {authMode === 'changePassword' ? (
              <p><button onClick={() => { setAuthMode('login'); setAuthError(''); }}>Back to Sign In</button></p>
            ) : (
              <>
                {authRole === 'customer' && authMode === 'login' && (
                  <p>Don't have an account? <button onClick={() => { setAuthMode('register'); setAuthError(''); }}>Create account</button></p>
                )}
                {authRole === 'customer' && authMode === 'register' && (
                  <p>Already have an account? <button onClick={() => { setAuthMode('login'); setAuthError(''); }}>Sign In</button></p>
                )}
                <p>Forgot password? <button onClick={() => { setAuthMode('changePassword'); setAuthError(''); }}>Change password</button></p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="hs hs1"></div>
        <div className="hs hs2"></div>
        <p style={{ fontSize: '1.25rem', color: '#9ca3af', zIndex: 1 }}>Loading Smart Retail System...</p>
      </div>
    );
  }

  return (
    <div className={`portal-container ${user.role}-active`}>
      <div className="hs hs1"></div>
      <div className="hs hs2"></div>

      <header className="portal-header">
        <div className="portal-brand">
          <img src="/logo.png" alt="TEGL Logo" className="portal-logo-img" />
          <span className="brand-name">TEGL Retail</span>
          <span className="badge-role">{user.role === 'admin' ? 'Owner Portal' : 'Customer'}</span>
        </div>
        <div className="portal-user-meta" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {user.role === 'admin' && (
            <div style={{ position: 'relative' }}>
              {/* Bell Button with Pulse Ring */}
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                style={{ 
                  background: showNotifications ? 'rgba(234, 179, 8, 0.25)' : 'rgba(234, 179, 8, 0.08)', 
                  border: '2px solid rgba(234, 179, 8, 0.45)', 
                  color: 'var(--text-primary)', 
                  cursor: 'pointer', 
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  borderRadius: '10px',
                  width: '42px',
                  height: '42px',
                  boxShadow: '0 2px 8px rgba(234, 179, 8, 0.25)',
                  transition: 'all 0.2s ease',
                }}
              >
                <Bell size={20} color="var(--primary)" style={{ filter: 'drop-shadow(0 0 3px rgba(234, 179, 8, 0.4))' }} />
                {notifications && (notifications.pending_orders > 0 || notifications.low_stock > 0) && (
                  <>
                    {/* Pulsing ring */}
                    <span style={{ 
                      position: 'absolute', 
                      top: '-3px', 
                      right: '-3px', 
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'rgba(234, 179, 8, 0.35)',
                      animation: 'notif-pulse 1.8s ease infinite',
                      pointerEvents: 'none'
                    }} />
                    {/* Badge count */}
                    <span style={{ 
                      position: 'absolute', 
                      top: '-4px', 
                      right: '-4px', 
                      background: 'linear-gradient(135deg, #eab308, #d1a007)', 
                      color: 'white', 
                      borderRadius: '50%', 
                      width: '18px', 
                      height: '18px', 
                      fontSize: '0.6rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontWeight: '800',
                      boxShadow: '0 0 6px rgba(234, 179, 8, 0.7)',
                      border: '1.5px solid rgba(23,23,23,1)',
                      zIndex: 2
                    }}>
                      {Math.min(notifications.pending_orders + notifications.low_stock, 99)}
                    </span>
                  </>
                )}
              </button>

              {showNotifications && (
                <div style={{ 
                  position: 'absolute', 
                  right: 0, 
                  top: '50px', 
                  width: '360px', 
                  zIndex: 9999,
                  borderRadius: '16px',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.12), 0 0 0 1px rgba(234, 179, 8, 0.25)',
                  background: '#ffffff',
                  overflow: 'hidden',
                  animation: 'fadeSlideDown 0.2s ease',
                  textAlign: 'left'
                }}>
                  {/* Header */}
                  <div style={{ 
                    padding: '16px 18px 14px',
                    background: 'rgba(234, 179, 8, 0.05)',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ 
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: 'linear-gradient(135deg, #eab308, #d1a007)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 8px rgba(234, 179, 8, 0.3)'
                      }}>
                        <Bell size={13} color="white" />
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#0f172a' }}>Alerts Hub</div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Live store intelligence</div>
                      </div>
                    </div>
                    <button 
                      onClick={fetchNotifications} 
                      style={{ 
                        background: 'rgba(234, 179, 8, 0.12)', 
                        border: '1px solid rgba(234, 179, 8, 0.25)', 
                        color: 'var(--primary)', 
                        cursor: 'pointer', 
                        fontSize: '0.72rem',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                      }}
                    >
                      ↻ Refresh
                    </button>
                  </div>

                  <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
                    {notifications ? (
                      <>
                        {/* AI Summary card */}
                        <div 
                          onClick={() => { setActiveTab('ml'); setShowNotifications(false); }}
                          style={{ 
                            background: 'rgba(234, 179, 8, 0.04)',
                            border: '1px solid rgba(234, 179, 8, 0.2)',
                            borderRadius: '12px',
                            padding: '13px 14px',
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease',
                          }}
                          className="hover-scale"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '7px' }}>
                            <BrainCircuit size={18} color="#0f172a" style={{ strokeWidth: 1.8 }} />
                            <span style={{ 
                              fontWeight: '700', 
                              fontSize: '0.75rem', 
                              color: 'var(--primary)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              AI Store Briefing
                            </span>
                          </div>
                          <p style={{ 
                            fontSize: '0.8rem', 
                            lineHeight: '1.55', 
                            color: '#334155', 
                            margin: 0 
                          }}>
                            {notifications.ai_summary}
                          </p>
                        </div>

                        {/* Stat cards row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {/* Pending Orders */}
                          <div 
                            onClick={() => { setActiveTab('orders'); setShowNotifications(false); }}
                            style={{ 
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '10px',
                              padding: '11px 12px',
                              cursor: 'pointer'
                            }}
                            className="hover-scale"
                          >
                            <div style={{ marginBottom: '4px' }}>
                              <ShoppingCart size={18} color="#0f172a" style={{ strokeWidth: 1.8 }} />
                            </div>
                            <div style={{ 
                              fontSize: '1.4rem', 
                              fontWeight: '800', 
                              color: '#0f172a',
                              lineHeight: 1
                            }}>
                              {notifications.pending_orders}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '3px' }}>
                              Pending Orders
                            </div>
                          </div>

                          {/* Low Stock */}
                          <div 
                            onClick={() => { setActiveTab('inventory'); setShowNotifications(false); }}
                            style={{ 
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '10px',
                              padding: '11px 12px',
                              cursor: 'pointer'
                            }}
                            className="hover-scale"
                          >
                            <div style={{ marginBottom: '4px' }}>
                              <AlertTriangle size={18} color="#0f172a" style={{ strokeWidth: 1.8 }} />
                            </div>
                            <div style={{ 
                              fontSize: '1.4rem', 
                              fontWeight: '800', 
                              color: '#0f172a',
                              lineHeight: 1
                            }}>
                              {notifications.low_stock}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '3px' }}>
                              Low Stock Items
                            </div>
                          </div>
                        </div>

                        {/* Tax deadlines */}
                        <div style={{ 
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '2px' }}>
                            Tax Filing Deadlines
                          </div>
                          
                          {/* GST */}
                          <div 
                            onClick={() => { setActiveTab('gst'); setShowNotifications(false); }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                            className="hover-scale-row"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Calendar size={16} color="#0f172a" style={{ strokeWidth: 1.8 }} />
                              <span style={{ fontSize: '0.8rem', color: '#334155' }}>GST Monthly Return</span>
                            </div>
                            <span style={{ 
                              fontSize: '0.75rem', 
                              fontWeight: '700',
                              padding: '2px 10px',
                              borderRadius: '20px',
                              background: 'rgba(234, 179, 8, 0.12)',
                              color: 'var(--primary)',
                              border: '1px solid rgba(234, 179, 8, 0.25)'
                            }}>
                              {notifications.gst_days}d left
                            </span>
                          </div>

                          {/* ITR */}
                          <div 
                            onClick={() => { setActiveTab('finance'); setShowNotifications(false); }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                            className="hover-scale-row"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Landmark size={16} color="#0f172a" style={{ strokeWidth: 1.8 }} />
                              <span style={{ fontSize: '0.8rem', color: '#334155' }}>ITR Annual Return</span>
                            </div>
                            <span style={{ 
                              fontSize: '0.75rem', 
                              fontWeight: '700',
                              padding: '2px 10px',
                              borderRadius: '20px',
                              background: 'rgba(234, 179, 8, 0.12)',
                              color: 'var(--primary)',
                              border: '1px solid rgba(234, 179, 8, 0.25)'
                            }}>
                              {notifications.itr_days}d left
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '0.85rem' }}>
                        <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>⏳</div>
                        Fetching live alerts...
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{ 
                    padding: '10px 18px', 
                    borderTop: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '0.68rem',
                    color: '#94a3b8',
                    textAlign: 'center'
                  }}>
                    Auto-refreshes every 30 seconds · Powered by Groq AI
                  </div>
                </div>
              )}
            </div>
          )}
          <span className="user-welcome">Hello, <b>{user.username}</b></span>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {user.role === 'customer' ? (
        <div className="storefront-content">
          <Suspense fallback={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '1.5rem', animation: 'spin 1s linear infinite' }}>⏳</div>
              <div style={{ marginTop: '12px', fontSize: '0.85rem' }}>Loading Storefront...</div>
            </div>
          }>
            <Storefront products={products} refreshProducts={fetchProducts} token={token} user={user} />
          </Suspense>
        </div>
      ) : (
        <div className="app-container">
          <aside className="sidebar">
            <nav style={{ marginTop: '1rem' }}>
              <ul className="nav-links">
                <li>
                  <button 
                    className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('dashboard')}
                  >
                    <LayoutDashboard size={18} /> Dashboard
                  </button>
                </li>
                <li>
                  <button 
                    className={`nav-btn ${activeTab === 'pos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pos')}
                  >
                    <ShoppingCart size={18} /> POS Checkout
                  </button>
                </li>
                <li>
                  <button 
                    className={`nav-btn ${activeTab === 'inventory' ? 'active' : ''}`}
                    onClick={() => setActiveTab('inventory')}
                  >
                    <Package size={18} /> Inventory
                  </button>
                </li>
                <li>
                  <button 
                    className={`nav-btn ${activeTab === 'orders' ? 'active' : ''}`}
                    onClick={() => setActiveTab('orders')}
                  >
                    <ClipboardList size={18} /> Manage Orders
                  </button>
                </li>
                <li>
                  <button 
                    className={`nav-btn ${activeTab === 'ml' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ml')}
                  >
                    <BrainCircuit size={18} /> ML Forecast
                  </button>
                </li>
                <li>
                  <button 
                    className={`nav-btn ${activeTab === 'gst' ? 'active' : ''}`}
                    onClick={() => setActiveTab('gst')}
                  >
                    <Landmark size={18} /> GST Compliance
                  </button>
                </li>
                <li>
                  <button 
                    className={`nav-btn ${activeTab === 'finance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('finance')}
                  >
                    <BarChart3 size={18} /> Financial Dashboard
                  </button>
                </li>
                <li>
                  <button 
                    className={`nav-btn ${activeTab === 'reviews' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reviews')}
                  >
                    <MessageSquare size={18} /> Product Reviews
                  </button>
                </li>
              </ul>
            </nav>
          </aside>

          <main className="main-content">
            <Suspense fallback={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '1.8rem', animation: 'spin 1.5s linear infinite' }}>⏳</div>
                <div style={{ marginTop: '16px', fontSize: '0.9rem', fontWeight: 500 }}>Loading Portal Module...</div>
              </div>
            }>
              {activeTab === 'dashboard' && <Dashboard products={products} token={token} setActiveTab={setActiveTab} />}
              {activeTab === 'pos' && <POS products={products} refreshProducts={fetchProducts} token={token} />}
              {activeTab === 'inventory' && <Inventory products={products} refreshProducts={fetchProducts} token={token} />}
              {activeTab === 'orders' && <OrdersList token={token} />}
              {activeTab === 'ml' && <MLForecast token={token} />}
              {activeTab === 'gst' && <GSTCompliance token={token} />}
              {activeTab === 'finance' && <FinancialDashboard token={token} />}
              {activeTab === 'reviews' && <ReviewsList token={token} />}
            </Suspense>
          </main>
        </div>
      )}
    </div>
  );
}

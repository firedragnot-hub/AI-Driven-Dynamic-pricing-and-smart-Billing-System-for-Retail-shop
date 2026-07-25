import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

const Dashboard = lazy(() => import('./components/Dashboard'));
const POS = lazy(() => import('./components/POS'));
const Inventory = lazy(() => import('./components/Inventory'));
const MLForecast = lazy(() => import('./components/MLForecast'));
const Storefront = lazy(() => import('./components/Storefront'));
const OrdersList = lazy(() => import('./components/OrdersList'));
const GSTCompliance = lazy(() => import('./components/GSTCompliance'));
const FinancialDashboard = lazy(() => import('./components/FinancialDashboard'));
const ReviewsList = lazy(() => import('./components/ReviewsList'));
import { LayoutDashboard, ShoppingCart, Package, BrainCircuit, ClipboardList, Store, LogOut, User, Lock, Mail, ChevronRight, Landmark, BarChart3, Bell, MessageSquare, Calendar, AlertTriangle, Sparkles, TrendingUp, Shield, Menu, X } from 'lucide-react';
import './App.css';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (location.pathname === '/owner/login') {
      setAuthRole('admin');
    } else if (location.pathname === '/login') {
      setAuthRole('customer');
    }
  }, [location.pathname]);

  // Notifications State
  const [notifications, setNotifications] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!token) return;
    setNotifLoading(true);
    try {
      const res = await fetch('/api/notifications/summary');
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
      const res = await fetch('/api/products', { headers });
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
    
    const isLogin = authMode === 'login';
    const url = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin 
      ? { username: email, password } 
      : { username, email, password, role: authRole };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      let data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (isLogin ? 'Authentication failed' : 'Registration failed'));
      }

      if (isLogin) {
        if (authRole === 'customer' && data.user.role === 'admin') {
          throw new Error('Access denied: Admins cannot log in through the Customer Portal.');
        }
        if (authRole === 'admin' && data.user.role === 'customer') {
          throw new Error('Access denied: Customers cannot log in through the Owner Portal.');
        }
      }

      if (!isLogin) {
        // Automatically log in the user after registration
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: email, password })
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) {
          throw new Error(loginData.error || 'Authentication failed after registration');
        }
        data = loginData;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      
      // Default tab/path based on role
      if (data.user.role === 'admin') {
        setActiveTab('dashboard');
        navigate('/owner/dashboard');
      } else {
        setActiveTab('shop');
        navigate('/');
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
      const res = await fetch('/api/auth/change-password', {
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
    if (location.pathname.startsWith('/owner')) {
      navigate('/owner/login');
    } else {
      navigate('/login');
    }
  };

  const renderAuthPage = (role) => {
    return (
      <div className="auth-page">
        <div className="auth-hero">
          <div className="auth-hero-content">
            <div className="auth-hero-badge">
              <Sparkles size={14} /> AI-Powered Retail Platform
            </div>
            <h1>Manage Your Store <span>Smarter</span></h1>
            <p>Complete retail management with POS, inventory tracking, GST compliance, ML forecasting, and a beautiful customer storefront — all in one platform.</p>
            <div className="auth-features">
              <div className="auth-feature">
                <div className="auth-feature-icon"><TrendingUp size={18} /></div>
                Real-time sales analytics & financial dashboards
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon"><BrainCircuit size={18} /></div>
                AI-powered demand forecasting & store insights
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon"><Shield size={18} /></div>
                GST compliance & automated tax filing reminders
              </div>
            </div>
          </div>
        </div>

        <div className="auth-panel">
        <div className="auth-card">
          <div className="auth-logo">
            <img src="/logo.png" alt="TEGL Logo" className="portal-logo-img" style={{ height: '48px' }} />
            <h2>TEGL Retail Solutions</h2>
            <p>{role === 'admin' ? 'Owner Portal Login' : 'Customer Shop Sign In'}</p>
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
                {role === 'customer' && authMode === 'login' && (
                  <p>Don't have an account? <button onClick={() => { setAuthMode('register'); setAuthError(''); }}>Create account</button></p>
                )}
                {role === 'customer' && authMode === 'register' && (
                  <p>Already have an account? <button onClick={() => { setAuthMode('login'); setAuthError(''); }}>Sign In</button></p>
                )}
                <p>Forgot password? <button onClick={() => { setAuthMode('changePassword'); setAuthError(''); }}>Change password</button></p>
              </>
            )}
            
            {/* Switch between Owner and Customer portals */}
            {role === 'customer' ? (
              <p style={{ marginTop: '8px', borderTop: '1px solid var(--border-color, #eee)', paddingTop: '8px' }}>
                Are you a store owner? <button type="button" onClick={() => { navigate('/owner/login'); setAuthError(''); setAuthMode('login'); }}>Go to Owner Portal</button>
              </p>
            ) : (
              <p style={{ marginTop: '8px', borderTop: '1px solid var(--border-color, #eee)', paddingTop: '8px' }}>
                Want to shop instead? <button type="button" onClick={() => { navigate('/login'); setAuthError(''); setAuthMode('login'); }}>Go to Customer Shop</button>
              </p>
            )}
          </div>
        </div>
        </div>
      </div>
    );
  };

  const renderCustomerPortal = () => {
    return (
      <div className={`portal-container customer-active`}>
        <div className="hs hs1"></div>
        <div className="hs hs2"></div>

        <header className="portal-header">
          <div className="portal-brand">
            <img src="/logo.png" alt="TEGL Logo" className="portal-logo-img" />
            <span className="brand-name">TEGL Retail</span>
            <span className="badge-role">Customer</span>
          </div>
          <div className="portal-user-meta" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div className="user-avatar">{user.username?.charAt(0)?.toUpperCase() || 'U'}</div>
            <span className="user-welcome">Hello, <b>{user.username}</b></span>
            <button className="logout-btn" onClick={handleLogout}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </header>

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
      </div>
    );
  };

  const renderOwnerPortal = () => {
    return (
      <div className={`portal-container admin-active`}>
        <div className="hs hs1"></div>
        <div className="hs hs2"></div>

        <header className="portal-header">
          <div className="portal-brand">
            <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle Navigation Menu">
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <img src="/logo.png" alt="TEGL Logo" className="portal-logo-img" />
            <span className="brand-name">TEGL Retail</span>
            <span className="badge-role">Owner Portal</span>
          </div>
          <div className="portal-user-meta" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`notif-btn ${showNotifications ? 'active' : ''}`}
              >
                <Bell size={18} color="var(--primary-dark)" />
                {notifications && (notifications.pending_orders > 0 || notifications.low_stock > 0) && (
                  <>
                    <span className="notif-pulse-ring" />
                    <span className="notif-badge">
                      {Math.min(notifications.pending_orders + notifications.low_stock, 99)}
                    </span>
                  </>
                )}
              </button>

              {showNotifications && (
                <div className="notif-dropdown" style={{ textAlign: 'left' }}>
                  <div className="notif-dropdown-header">
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

                  <div className="notif-dropdown-body">
                    {notifications ? (
                      <>
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

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
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

                  <div className="notif-dropdown-footer">
                    Auto-refreshes every 30 seconds · Powered by Groq AI
                  </div>
                </div>
              )}
            </div>
            <div className="user-avatar">{user.username?.charAt(0)?.toUpperCase() || 'U'}</div>
            <span className="user-welcome">Hello, <b>{user.username}</b></span>
            <button className="logout-btn" onClick={handleLogout}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </header>

        <div className="app-container">
          {mobileMenuOpen && (
            <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)}></div>
          )}
          <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-brand">
              <img src="/logo.png" alt="TEGL" />
              <div className="sidebar-brand-text">
                TEGL Retail
                <span>Owner Portal</span>
              </div>
            </div>
            <nav>
              <div className="nav-section-label">Operations</div>
              <ul className="nav-links">
                <li>
                  <button className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}>
                    <LayoutDashboard size={18} /> Dashboard
                  </button>
                </li>
                <li>
                  <button className={`nav-btn ${activeTab === 'pos' ? 'active' : ''}`} onClick={() => { setActiveTab('pos'); setMobileMenuOpen(false); }}>
                    <ShoppingCart size={18} /> POS Checkout
                  </button>
                </li>
                <li>
                  <button className={`nav-btn ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => { setActiveTab('inventory'); setMobileMenuOpen(false); }}>
                    <Package size={18} /> Inventory
                  </button>
                </li>
                <li>
                  <button className={`nav-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => { setActiveTab('orders'); setMobileMenuOpen(false); }}>
                    <ClipboardList size={18} /> Manage Orders
                  </button>
                </li>
              </ul>
              <div className="nav-section-label">Analytics</div>
              <ul className="nav-links">
                <li>
                  <button className={`nav-btn ${activeTab === 'ml' ? 'active' : ''}`} onClick={() => { setActiveTab('ml'); setMobileMenuOpen(false); }}>
                    <BrainCircuit size={18} /> ML Forecast
                  </button>
                </li>
                <li>
                  <button className={`nav-btn ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => { setActiveTab('finance'); setMobileMenuOpen(false); }}>
                    <BarChart3 size={18} /> Financial Dashboard
                  </button>
                </li>
                <li>
                  <button className={`nav-btn ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => { setActiveTab('reviews'); setMobileMenuOpen(false); }}>
                    <MessageSquare size={18} /> Product Reviews
                  </button>
                </li>
              </ul>
              <div className="nav-section-label">Compliance</div>
              <ul className="nav-links">
                <li>
                  <button className={`nav-btn ${activeTab === 'gst' ? 'active' : ''}`} onClick={() => { setActiveTab('gst'); setMobileMenuOpen(false); }}>
                    <Landmark size={18} /> GST Compliance
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
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="hs hs1"></div>
        <div className="hs hs2"></div>
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading Smart Retail System...</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Customer Routes */}
      <Route 
        path="/login" 
        element={
          token && user ? (
            user.role === 'admin' ? <Navigate to="/owner/dashboard" replace /> : <Navigate to="/" replace />
          ) : (
            renderAuthPage('customer')
          )
        } 
      />
      <Route 
        path="/" 
        element={
          !token || !user ? (
            <Navigate to="/login" replace />
          ) : user.role === 'admin' ? (
            <Navigate to="/owner/dashboard" replace />
          ) : (
            renderCustomerPortal()
          )
        } 
      />

      {/* Owner Routes */}
      <Route 
        path="/owner/login" 
        element={
          token && user ? (
            user.role === 'admin' ? <Navigate to="/owner/dashboard" replace /> : <Navigate to="/" replace />
          ) : (
            renderAuthPage('admin')
          )
        } 
      />
      <Route 
        path="/owner/dashboard" 
        element={
          !token || !user ? (
            <Navigate to="/owner/login" replace />
          ) : user.role !== 'admin' ? (
            <Navigate to="/" replace />
          ) : (
            renderOwnerPortal()
          )
        } 
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

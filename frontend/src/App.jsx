import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';

const Dashboard = lazy(() => import('./components/Dashboard'));
const POS = lazy(() => import('./components/POS'));
const Inventory = lazy(() => import('./components/Inventory'));
const MLForecast = lazy(() => import('./components/MLForecast'));
const Storefront = lazy(() => import('./components/Storefront'));
const OrdersList = lazy(() => import('./components/OrdersList'));
const GSTCompliance = lazy(() => import('./components/GSTCompliance'));
const FinancialDashboard = lazy(() => import('./components/FinancialDashboard'));
const ReviewsList = lazy(() => import('./components/ReviewsList'));
import { useUser, SignIn, useClerk } from '@clerk/clerk-react';
import { LayoutDashboard, ShoppingCart, Package, BrainCircuit, ClipboardList, Store, LogOut, User, Lock, Mail, ChevronRight, Landmark, BarChart3, Bell, MessageSquare, Calendar, AlertTriangle, Sparkles, TrendingUp, Shield, Menu, X, FileText, Eye, EyeOff, Check, Copy } from 'lucide-react';
import './App.css';

// Check if Clerk key is valid (duplicated here for use in components)
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isValidClerkKey = PUBLISHABLE_KEY && PUBLISHABLE_KEY.startsWith('pk_') && !PUBLISHABLE_KEY.includes('...');

/**
 * ClerkSync — must be rendered INSIDE ClerkProvider.
 * It calls Clerk hooks unconditionally (as required by React rules)
 * and syncs the signed-in Clerk user into local app state.
 */
function ClerkSync({ onClerkAuth, onClerkSignOut }) {
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  useEffect(() => {
    // Expose the signOut function up to the parent
    onClerkSignOut(signOut);
  }, [signOut]);

  useEffect(() => {
    if (isSignedIn && user) {
      onClerkAuth(user);
    }
  }, [isSignedIn, user]);

  return null; // purely side-effect component
}

// Component for verification email landing page
function EmailVerification() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMsg('No verification token provided.');
      return;
    }
    
    const verifyToken = async () => {
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await res.json();
        if (res.ok) {
          setStatus('success');
          setMsg(data.message || 'Email verified successfully!');
        } else {
          setStatus('error');
          setMsg(data.error || 'Failed to verify email.');
        }
      } catch (err) {
        setStatus('error');
        setMsg('Connection error. Please try again.');
      }
    };
    
    verifyToken();
  }, [token]);

  return (
    <div className="auth-page" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div className="auth-card" style={{ maxWidth: '400px', width: '100%', margin: '0 auto', textAlign: 'center', padding: '30px' }}>
        <img src="/logo.png" alt="TEGL Logo" style={{ height: '48px', marginBottom: '15px' }} />
        <h2>Email Verification</h2>
        
        {status === 'verifying' && (
          <div style={{ margin: '20px 0' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 15px' }}></div>
            <p>Verifying your email address...</p>
          </div>
        )}
        
        {status === 'success' && (
          <div style={{ margin: '20px 0', color: '#2ec4b6' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>✓</div>
            <p style={{ fontWeight: 500 }}>{msg}</p>
          </div>
        )}
        
        {status === 'error' && (
          <div style={{ margin: '20px 0', color: '#e71d36' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>✗</div>
            <p style={{ fontWeight: 500 }}>{msg}</p>
          </div>
        )}
        
        <button 
          onClick={() => navigate('/login')} 
          className="auth-submit-btn" 
          style={{ width: '100%', marginTop: '15px' }}
        >
          Go to Login
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);

  // clerkSignOut is set by ClerkSync once ClerkProvider mounts
  const clerkSignOutRef = useRef(null);
  const clerkSignOut = clerkSignOutRef.current;

  // Called by ClerkSync when Clerk detects an authenticated user
  const handleClerkAuth = (clerkUser) => {
    if (!token || !user) {
      const customerUser = {
        id: clerkUser.id,
        username: clerkUser.fullName || clerkUser.firstName || clerkUser.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Customer',
        email: clerkUser.primaryEmailAddress?.emailAddress || '',
        role: 'customer'
      };
      const dummyToken = 'clerk_auth_' + clerkUser.id;
      localStorage.setItem('token', dummyToken);
      localStorage.setItem('user', JSON.stringify(customerUser));
      setToken(dummyToken);
      setUser(customerUser);
      navigate('/');
    }
  };

  const handleClerkSignOutRef = (signOutFn) => {
    clerkSignOutRef.current = signOutFn;
  };
  
  // Auth Form State
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register' or 'changePassword'
  const [authRole, setAuthRole] = useState('customer'); // 'customer' or 'admin'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Security & verification States
  const [turnstileToken, setTurnstileToken] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendSuccess, setResendSuccess] = useState('');

  // Load Cloudflare Turnstile & Google Identity Services dynamically
  useEffect(() => {
    // Turnstile script
    if (import.meta.env.VITE_TURNSTILE_SITE_KEY && !document.getElementById('cloudflare-turnstile-script')) {
      const script = document.createElement('script');
      script.id = 'cloudflare-turnstile-script';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    // Google GSI script
    if (!document.getElementById('google-gsi-script')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  // Initialize Google Login Button when on login screen
  useEffect(() => {
    if (authMode === 'login' && !token) {
      const timer = setInterval(() => {
        if (window.google && document.getElementById('google-signin-btn')) {
          clearInterval(timer);
          try {
            window.google.accounts.id.initialize({
              client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '62895284257-92r8hv8ja2l7guhgfkspmvoierbsqv6i.apps.googleusercontent.com',
              callback: handleGoogleLogin
            });
            window.google.accounts.id.renderButton(
              document.getElementById('google-signin-btn'),
              { theme: 'outline', size: 'large', width: '100%' }
            );
          } catch (e) {
            console.error("Google Sign-In initialization error:", e);
          }
        }
      }, 500);
      return () => clearInterval(timer);
    }
  }, [authMode, token, authRole]);

  // Turnstile render logic
  useEffect(() => {
    if (import.meta.env.VITE_TURNSTILE_SITE_KEY && (authMode === 'login' || authMode === 'register') && !token && !verificationSent) {
      const timer = setTimeout(() => {
        const container = document.getElementById('turnstile-container');
        if (window.turnstile && container) {
          try {
            window.turnstile.reset(container);
          } catch(e) {}
          
          try {
            window.turnstile.render(container, {
              sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
              callback: (tok) => {
                setTurnstileToken(tok);
              }
            });
          } catch(e) {
            console.error("Turnstile render error:", e);
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [authMode, token, verificationSent]);

  // Portal State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setEmail('');
    setUsername('');
    setPassword('');
    setAuthError('');
    setVerificationSent(false);
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
  const notifRef = useRef(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  const handleFillAdminCreds = () => {
    setEmail('admin');
    setPassword('adminpassword');
    setCopiedCreds(true);
    setTimeout(() => setCopiedCreds(false), 2500);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [notifRef]);

  const fetchNotifications = async () => {
    if (!token) return;
    setNotifLoading(true);
    try {
      const res = await fetch('/api/notifications/summary', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
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
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [token, user]);

  const fetchProducts = async () => {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/products', { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setProducts(data);
        } else if (data && Array.isArray(data.products)) {
          setProducts(data.products);
        } else {
          setProducts([]);
        }
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

  const handleGoogleLogin = async (response) => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const resText = await res.text();
      let data;
      try {
        data = JSON.parse(resText);
      } catch (jsonErr) {
        throw new Error(resText || 'Google Sign-In failed');
      }
      if (!res.ok) {
        throw new Error((data && data.error) || 'Google Sign-In failed');
      }

      if (authRole === 'customer' && data.user.role === 'admin') {
        throw new Error('Access denied: Admins cannot log in through the Customer Portal.');
      }
      if (authRole === 'admin' && data.user.role === 'customer') {
        throw new Error('Access denied: Customers cannot log in through the Owner Portal.');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      
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

  const handleResendVerification = async () => {
    setAuthError('');
    setResendSuccess('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail })
      });
      const resText = await res.text();
      let data;
      try {
        data = JSON.parse(resText);
      } catch (jsonErr) {
        throw new Error(resText || 'Failed to resend verification link.');
      }
      if (res.ok) {
        setResendSuccess('Verification link resent successfully! Please check your email.');
      } else {
        setAuthError((data && data.error) || 'Failed to resend verification link.');
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    
    const isLogin = authMode === 'login';
    const url = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin 
      ? { username: email, password, turnstile_token: turnstileToken } 
      : { username, email, password, role: authRole, turnstile_token: turnstileToken };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const resText = await res.text();
      let data;
      try {
        data = JSON.parse(resText);
      } catch (jsonErr) {
        throw new Error(resText.startsWith('<') ? 'Server error (Backend may be offline or returning HTML error).' : resText || 'A server error occurred. Please check backend.');
      }
      if (!res.ok) {
        if (res.status === 403 && data && data.unverified) {
          setUnverifiedEmail(data.email);
          setVerificationSent(true);
          throw new Error(data.error);
        }
        throw new Error((data && data.error) || (isLogin ? 'Authentication failed' : 'Registration failed'));
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
        // Prompt user to verify email instead of logging in automatically
        setUnverifiedEmail(email);
        setVerificationSent(true);
        setAuthLoading(false);
        return;
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

  const handleLogout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setAuthMode('login');
    setUsername('');
    setEmail('');
    setPassword('');
    setAuthError('');
    
    if (clerkSignOutRef.current) {
      try {
        await clerkSignOutRef.current();
      } catch (err) {
        console.error("Clerk sign-out error:", err);
      }
    }
    
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
              <div className="auth-logo-badge">
                <img src="/logo.png" alt="TEGL Logo" className="portal-logo-img" />
              </div>
              <h2>TEGL Retail Solutions</h2>
              <p className="auth-subtitle">{role === 'admin' ? 'Owner Portal Login' : 'Customer Shop Sign In'}</p>
            </div>

          {verificationSent ? (
            <div className="auth-form-clean" style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: '2.5rem', color: '#ffb703', marginBottom: '15px' }}>✉</div>
              <h3>Verify Your Email</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #666)', marginBottom: '15px' }}>
                A verification link has been sent to <strong>{unverifiedEmail}</strong>. Please check your inbox and verify your email before logging in.
              </p>
              {resendSuccess && <div style={{ color: '#2ec4b6', fontSize: '0.85rem', marginBottom: '10px' }}>{resendSuccess}</div>}
              {authError && <div className="auth-error-msg">{authError}</div>}
              <button 
                type="button" 
                onClick={handleResendVerification} 
                className="auth-continue-btn" 
                style={{ width: '100%', marginBottom: '10px' }}
                disabled={authLoading}
              >
                Resend Verification Link
              </button>
              <button 
                type="button" 
                onClick={() => { setVerificationSent(false); setAuthError(''); setResendSuccess(''); }}
                className="auth-continue-btn" 
                style={{ width: '100%', background: 'transparent', border: '1.5px solid var(--border-color, #eee)', color: 'var(--text-color, #333)', boxShadow: 'none' }}
              >
                Back to Sign In
              </button>
            </div>
          ) : authMode === 'changePassword' ? (
            <form onSubmit={handlePasswordChange} className="auth-form-clean">
              {authError && <div className="auth-error-msg">{authError}</div>}
              
              <div className="auth-field-group">
                <label className="auth-field-label">Username or Email</label>
                <input 
                  type="text" 
                  className="auth-clean-input"
                  placeholder="Enter username or email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>

              <div className="auth-field-group">
                <label className="auth-field-label">Old Password</label>
                <div className="auth-input-relative">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    className="auth-clean-input auth-password-input"
                    placeholder="Enter old password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                  <button 
                    type="button" 
                    className="auth-eye-toggle" 
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="auth-field-group">
                <label className="auth-field-label">New Password</label>
                <div className="auth-input-relative">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    className="auth-clean-input auth-password-input"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required 
                  />
                  <button 
                    type="button" 
                    className="auth-eye-toggle" 
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="auth-continue-btn" disabled={authLoading}>
                {authLoading ? 'Updating...' : <><span>Change Password</span> <span className="auth-btn-arrow">▶</span></>}
              </button>

              <p className="auth-switch-text">
                <button 
                  type="button" 
                  className="auth-switch-link" 
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                >
                  Back to Sign In
                </button>
              </p>
            </form>
          ) : role === 'customer' ? (
            <div className="clerk-auth-container" style={{ marginTop: '0.5rem', width: '100%' }}>
              {isValidClerkKey ? (
                <SignIn
                  routing="hash"
                  forceRedirectUrl="/"
                  appearance={{
                    variables: {
                      colorPrimary: '#f59e0b',
                      colorBackground: 'transparent',
                      colorText: '#0f172a',
                      colorTextSecondary: '#475569',
                      borderRadius: '12px',
                      fontFamily: 'var(--font-body)',
                    },
                    elements: {
                      cardBox: {
                        boxShadow: 'none',
                        border: 'none',
                        width: '100%',
                        background: 'transparent',
                        backgroundColor: 'transparent',
                      },
                      card: {
                        boxShadow: 'none',
                        border: 'none',
                        padding: '0',
                        width: '100%',
                        background: 'transparent',
                        backgroundColor: 'transparent',
                      },
                      scrollBox: {
                        background: 'transparent',
                        backgroundColor: 'transparent',
                      },
                      rootBox: {
                        width: '100%',
                        background: 'transparent',
                        backgroundColor: 'transparent',
                      },
                      header: {
                        display: 'none',
                      },
                      socialButtonsBlockButton: {
                        border: '1.5px solid var(--border-color)',
                        borderRadius: '12px',
                        backgroundColor: '#ffffff',
                      },
                      formButtonPrimary: {
                        backgroundColor: 'var(--primary)',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        textTransform: 'none',
                      },
                      formFieldInput: {
                        border: '1.5px solid var(--border-color)',
                        borderRadius: '12px',
                        backgroundColor: '#f1f5f9',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-body)',
                      },
                      footer: {
                        background: 'transparent',
                        backgroundColor: 'transparent',
                      },
                      footerAction: {
                        background: 'transparent',
                        backgroundColor: 'transparent',
                      },
                      footerActionLink: {
                        color: 'var(--primary-dark)',
                      }
                    }
                  }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '0.85rem' }}>⚠️ Clerk authentication is not configured.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>Please set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in your <code>.env</code> file.</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ width: '100%' }}>
              {authMode === 'login' && (
                <>
                  <div className="auth-social-wrapper">
                    <div id="google-signin-btn" className="google-gsi-slot"></div>
                    <button
                      type="button"
                      className="auth-google-btn"
                      onClick={() => {
                        const gsiBtn = document.querySelector('#google-signin-btn div[role=button]');
                        if (gsiBtn) {
                          gsiBtn.click();
                        } else if (window.google?.accounts?.id) {
                          window.google.accounts.id.prompt();
                        } else {
                          setAuthError('Google Sign-In is initializing. Please enter credentials below.');
                        }
                      }}
                    >
                      <svg className="google-svg" viewBox="0 0 24 24" width="18" height="18">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>Continue with Google</span>
                    </button>
                  </div>

                  <div className="auth-divider">
                    <span>or</span>
                  </div>
                </>
              )}

              <form onSubmit={handleAuth} className="auth-form-clean">
                {authError && <div className="auth-error-msg">{authError}</div>}
                
                {authMode === 'register' && (
                  <div className="auth-field-group">
                    <label className="auth-field-label">Username</label>
                    <input 
                      type="text" 
                      className="auth-clean-input"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required 
                    />
                  </div>
                )}

                <div className="auth-field-group">
                  <label className="auth-field-label">
                    {authMode === 'login' ? 'Email address or username' : 'Email Address'}
                  </label>
                  <input 
                    type={authMode === 'login' ? 'text' : 'email'} 
                    className="auth-clean-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>

                <div className="auth-field-group">
                  <div className="auth-field-header">
                    <label className="auth-field-label">Password</label>
                    {authMode === 'login' && (
                      <button 
                        type="button" 
                        className="auth-forgot-link" 
                        onClick={() => { setAuthMode('changePassword'); setAuthError(''); }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="auth-input-relative">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      className="auth-clean-input auth-password-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required 
                    />
                    <button 
                      type="button" 
                      className="auth-eye-toggle" 
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {import.meta.env.VITE_TURNSTILE_SITE_KEY && (
                  <div id="turnstile-container" style={{ margin: '8px 0', display: 'flex', justifyContent: 'center' }}></div>
                )}

                <button type="submit" className="auth-continue-btn" disabled={authLoading}>
                  {authLoading ? 'Verifying...' : (
                    <>
                      <span>Continue</span>
                      <span className="auth-btn-arrow">▶</span>
                    </>
                  )}
                </button>

                <p className="auth-switch-text">
                  {authMode === 'login' ? (
                    <>
                      Don't have an account?{' '}
                      <button 
                        type="button" 
                        className="auth-switch-link" 
                        onClick={() => { setAuthMode('register'); setAuthError(''); }}
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button 
                        type="button" 
                        className="auth-switch-link" 
                        onClick={() => { setAuthMode('login'); setAuthError(''); }}
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              </form>
            </div>
          )}

          <div className="auth-footer-shop-switch">
            {role === 'customer' ? (
              <p>
                Are you a store owner?{' '}
                <button type="button" onClick={() => { navigate('/owner/login'); setAuthError(''); setAuthMode('login'); setVerificationSent(false); setTurnstileToken(''); }}>
                  Go to Owner Portal
                </button>
              </p>
            ) : (
              <p>
                Want to shop instead?{' '}
                <button type="button" onClick={() => { navigate('/login'); setAuthError(''); setAuthMode('login'); setVerificationSent(false); setTurnstileToken(''); }}>
                  Go to Customer Shop
                </button>
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
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`notif-btn ${showNotifications ? 'active' : ''}`}
              >
                <Bell size={18} color="var(--primary-dark)" />
                {notifications && (notifications.pending_orders > 0 || notifications.low_stock > 0 || notifications.discrepancies > 0) && (
                  <>
                    <span className="notif-pulse-ring" />
                    <span className="notif-badge">
                      {Math.min(notifications.pending_orders + notifications.low_stock + (notifications.discrepancies || 0), 99)}
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

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
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
                          
                          <div 
                            onClick={() => { setActiveTab('ml'); setShowNotifications(false); }}
                            style={{ 
                              background: notifications.discrepancies > 0 ? '#fef2f2' : '#f8fafc',
                              border: notifications.discrepancies > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0',
                              borderRadius: '10px',
                              padding: '11px 12px',
                              cursor: 'pointer'
                            }}
                            className="hover-scale"
                          >
                            <div style={{ marginBottom: '4px' }}>
                              <FileText size={18} color={notifications.discrepancies > 0 ? "#b91c1c" : "#0f172a"} style={{ strokeWidth: 1.8 }} />
                            </div>
                            <div style={{ 
                              fontSize: '1.4rem', 
                              fontWeight: '800', 
                              color: notifications.discrepancies > 0 ? '#b91c1c' : '#0f172a',
                              lineHeight: 1
                            }}>
                              {notifications.discrepancies || 0}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: notifications.discrepancies > 0 ? '#b91c1c' : '#64748b', marginTop: '3px' }}>
                              Bill Issues
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
                <div className="tegl-t-loader-container">
                  <div className="tegl-t-loader-ring"></div>
                  <div className="tegl-t-logo-letter">T</div>
                </div>
                <div style={{ marginTop: '16px', fontSize: '0.9rem', fontWeight: 600, color: '#cd7f32' }}>Loading Module...</div>
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
        <div className="tegl-t-loader-container">
          <div className="tegl-t-loader-ring"></div>
          <div className="tegl-t-logo-letter">T</div>
        </div>
        <p className="loading-text" style={{ color: '#cd7f32', letterSpacing: '0.5px' }}>Loading Smart Retail System...</p>
      </div>
    );
  }

  return (
    <>
      {/* ClerkSync lives inside ClerkProvider (via main.jsx) and syncs auth state */}
      {isValidClerkKey && (
        <ClerkSync
          onClerkAuth={handleClerkAuth}
          onClerkSignOut={handleClerkSignOutRef}
        />
      )}
      <Routes>
        <Route path="/verify-email" element={<EmailVerification />} />
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
    </>
  );
}

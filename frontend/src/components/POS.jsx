import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, Plus, Minus, Trash, CheckCircle, FileText, Search, 
  Wifi, WifiOff, RefreshCw, Barcode, User, Tag, CreditCard, Clipboard, 
  Trash2, AlertTriangle, AlertCircle, Play 
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';


export default function POS({ products: onlineProducts, refreshProducts, token }) {
  // Connection State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [pingStatus, setPingStatus] = useState('online'); // 'online', 'offline', 'syncing'
  
  // Local Product Cache
  const [localProducts, setLocalProducts] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(localStorage.getItem('pos_last_sync_time') || '');
  
  // Cart & UI State
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState('default');
  
  // Checkout Info
  const [customerName, setCustomerName] = useState('Counter Customer');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [cashier, setCashier] = useState('Admin Cashier');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState('');
  
  // Transaction Sync Queue State
  const [syncQueue, setSyncQueue] = useState(JSON.parse(localStorage.getItem('pos_sync_queue')) || []);
  const [syncProgress, setSyncProgress] = useState({ active: false, total: 0, current: 0 });
  const [conflictItem, setConflictItem] = useState(null); // Holds transaction metadata for conflict resolution modal
  
  // Receipt/Checkout Modal
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // New Returns & Barcode Scanner States
  const [posMode, setPosMode] = useState('billing'); // 'billing' or 'returns'
  const [cameraOpen, setCameraOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotalCount, setTxTotalCount] = useState(0);
  const [returnsList, setReturnsList] = useState([]);
  const [searchTxQuery, setSearchTxQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState(null);
  const [returnQtyMap, setReturnQtyMap] = useState({});
  const [returnReasonMap, setReturnReasonMap] = useState({});
  const qrScannerRef = useRef(null);

  const safeFetchJson = async (res) => {
    try {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await res.json();
      }
      const text = await res.text();
      return { error: `Server response error (${res.status}): ${text.substring(0, 80)}` };
    } catch (err) {
      return { error: `Failed to read response: ${err.message}` };
    }
  };

  const fetchTxHistory = async (isAppend = false) => {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/transactions?page=${txPage}&limit=25`, { headers });
      if (res.ok) {
        const data = await safeFetchJson(res);
        if (data.transactions) {
          if (isAppend) {
            setTransactions(prev => {
              const newTxs = data.transactions.filter(t => !prev.some(p => p.id === t.id));
              return [...prev, ...newTxs];
            });
          } else {
            setTransactions(data.transactions);
          }
          setTxTotalCount(data.total_count);
        }
      }
    } catch (e) {
      console.error("Error fetching transactions", e);
    }
  };

  const fetchReturnsList = async () => {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/returns', { headers });
      if (res.ok) {
        const data = await res.json();
        setReturnsList(data);
      }
    } catch (e) {
      console.error("Error fetching returns list", e);
    }
  };

  useEffect(() => {
    if (posMode === 'returns') {
      fetchTxHistory(txPage > 1);
      if (txPage === 1) fetchReturnsList();
    }
  }, [posMode, txPage]);

  const handleReturnItem = async (transactionId, productId, quantity, reason) => {
    if (!quantity || quantity <= 0) {
      alert("Invalid return quantity");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          transaction_id: transactionId,
          product_id: productId,
          quantity: parseInt(quantity),
          reason: reason || 'Customer Return'
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Return processed successfully!");
        setTxPage(1);
        fetchTxHistory(false);
        fetchReturnsList();
        if (selectedTx && selectedTx.id === transactionId) {
          // Find the updated transaction in the refreshed list
          const updatedTxsRes = await fetch('/api/transactions', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });
          if (updatedTxsRes.ok) {
            const updatedTxs = await updatedTxsRes.json();
            const matchingTx = updatedTxs.find(t => t.id === transactionId);
            if (matchingTx) {
              setSelectedTx(matchingTx);
            }
          }
        }
        refreshProducts();
        syncInventoryDelta(true);
      } else {
        alert(`Return Failed: ${data.error}`);
      }
    } catch (e) {
      alert("Error processing return request");
    } finally {
      setLoading(false);
    }
  };

  // Camera scanner hook
  useEffect(() => {
    let html5QrCode = null;
    if (cameraOpen) {
      html5QrCode = new Html5Qrcode("reader");
      qrScannerRef.current = html5QrCode;
      
      html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (width, height) => {
            return { width: Math.min(width * 0.8, 250), height: Math.min(height * 0.4, 150) };
          }
        },
        (decodedText) => {
          playScanBeep();
          const match = localProducts.find(p => p.barcode === decodedText.trim());
          if (match) {
            addToCart(match);
            setCameraOpen(false);
          } else {
            alert(`Scanned barcode "${decodedText}" not recognized.`);
            setCameraOpen(false);
          }
        },
        (errorMessage) => {
          // ignore
        }
      ).catch(err => {
        console.error("Camera access failed", err);
        alert("Failed to access camera. Please check permissions.");
        setCameraOpen(false);
      });
    }

    return () => {
      if (html5QrCode) {
        html5QrCode.stop().catch(err => console.log("Stop error:", err));
      }
    };
  }, [cameraOpen]);

  // Sound/Vibration effects mockup
  const playScanBeep = () => {
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, context.currentTime);
      gain.gain.setValueAtTime(0.1, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + 0.15);
    } catch (e) {}
  };

  // 1. Connection Heartbeat Monitor
  useEffect(() => {
    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // Heartbeat check every 15 seconds
    const interval = setInterval(async () => {
      if (simulatedOffline) {
        setPingStatus('offline');
        return;
      }
      try {
        const res = await fetch('/api/ping', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          setPingStatus('online');
          setIsOnline(true);
        } else {
          setPingStatus('offline');
        }
      } catch (e) {
        setPingStatus('offline');
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      clearInterval(interval);
    };
  }, [simulatedOffline]);

  // Determine active online status
  const activeOnline = isOnline && pingStatus === 'online' && !simulatedOffline;

  // 2. Local Product Cache Loading & Auto-Sync
  useEffect(() => {
    // Load initial local products from cache or onlineProducts prop
    const cached = localStorage.getItem('pos_products');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setLocalProducts(parsed);
        } else if (parsed && Array.isArray(parsed.products)) {
          setLocalProducts(parsed.products);
        } else {
          setLocalProducts([]);
        }
      } catch (e) {
        setLocalProducts([]);
      }
    } else if (onlineProducts && onlineProducts.length > 0) {
      setLocalProducts(onlineProducts);
      localStorage.setItem('pos_products', JSON.stringify(onlineProducts));
    }
  }, [onlineProducts]);

  // Delta Synchronization routine
  const syncInventoryDelta = async (forceFull = false) => {
    if (!activeOnline) return;
    try {
      const since = forceFull ? '' : lastSyncTime;
      const res = await fetch(`/api/products?since=${since}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        
        let updatedList = [];
        let newSyncTime = '';
        
        if (forceFull || !since) {
          updatedList = Array.isArray(data) ? data : (data.products || []);
          newSyncTime = new Date().toISOString();
        } else {
          // Delta Update: merge changed products
          const deltaProducts = data.products || [];
          newSyncTime = data.server_time || new Date().toISOString();
          
          const currentProducts = Array.isArray(localProducts) ? localProducts : [];
          const cacheMap = new Map(currentProducts.map(p => [p.id, p]));
          deltaProducts.forEach(prod => {
            cacheMap.set(prod.id, prod);
          });
          updatedList = Array.from(cacheMap.values());
        }

        setLocalProducts(updatedList);
        localStorage.setItem('pos_products', JSON.stringify(updatedList));
        
        setLastSyncTime(newSyncTime);
        localStorage.setItem('pos_last_sync_time', newSyncTime);
      }
    } catch (e) {
      console.error('Inventory delta sync failed:', e);
    }
  };

  // Auto Product Refetch every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeOnline) {
        syncInventoryDelta();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [activeOnline, lastSyncTime, localProducts]);

  // Sync queue persist trigger
  useEffect(() => {
    localStorage.setItem('pos_sync_queue', JSON.stringify(syncQueue));
  }, [syncQueue]);

  // Trigger sync of transaction queue upon reconnect
  useEffect(() => {
    if (activeOnline && syncQueue.some(tx => tx.status === 'Pending' || tx.status === 'Failed')) {
      triggerQueueSync();
    }
  }, [activeOnline]);

  // 3. Barcode Scanner resolution
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const match = localProducts.find(p => p.barcode === barcodeInput.trim());
    if (match) {
      playScanBeep();
      addToCart(match);
      setBarcodeInput('');
    } else {
      alert(`Barcode "${barcodeInput}" not recognized.`);
    }
  };

  // Add Item to Cart
  const addToCart = (product) => {
    const existing = cart.find(item => item.product_id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock_level) {
        alert('Cannot sell beyond available stock level.');
        return;
      }
      setCart(cart.map(item =>
        item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      if (product.stock_level <= 0) {
        alert('Out of stock.');
        return;
      }
      setCart([...cart, {
        product_id: product.id,
        name: product.name,
        barcode: product.barcode,
        quantity: 1,
        price_at_sale: product.current_price,
        stock_level: product.stock_level,
        gst_rate: product.gst_rate || 18.0
      }]);
    }
  };

  const updateQuantity = (productId, delta) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null;
        if (newQty > item.stock_level) {
          alert('Cannot sell beyond available stock level.');
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  // Financial Calculations
  const calculateCartDetails = () => {
    let subtotal = 0;
    let totalTaxable = 0;
    let totalGst = 0;
    
    cart.forEach(item => {
      subtotal += item.price_at_sale * item.quantity;
    });

    const discountAmount = (subtotal * discountPercent) / 100.0;
    const finalSubtotal = subtotal - discountAmount;

    cart.forEach(item => {
      const itemShare = (item.price_at_sale * item.quantity) / (subtotal || 1);
      const allocatedDiscount = discountAmount * itemShare;
      const finalItemTotal = (item.price_at_sale * item.quantity) - allocatedDiscount;
      
      const taxable = finalItemTotal / (1 + (item.gst_rate / 100.0));
      const tax = finalItemTotal - taxable;
      
      totalTaxable += taxable;
      totalGst += tax;
    });

    return {
      subtotal,
      discountAmount,
      totalTaxable,
      totalGst,
      totalAmount: finalSubtotal
    };
  };

  const { subtotal, discountAmount, totalTaxable, totalGst, totalAmount } = calculateCartDetails();

  // 4. Checkout handler (Online sync attempt first, fallback to offline)
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    const transactionUUID = self.crypto.randomUUID();
    const invoicePayload = {
      uuid: transactionUUID,
      customer_name: customerName,
      payment_method: paymentMethod,
      cashier: cashier,
      notes: notes,
      items: cart.map(item => ({
        product_id: item.product_id,
        barcode: item.barcode,
        quantity: item.quantity,
        price_at_sale: item.price_at_sale
      })),
      discount: discountPercent,
      total_amount: parseFloat(totalAmount.toFixed(2)),
      timestamp: new Date().toISOString()
    };

    if (activeOnline) {
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(invoicePayload)
        });
        const data = await safeFetchJson(res);
        
        if (res.ok) {
          // Success Online
          setCheckoutResult({ ...data, isOfflineCheckout: false });
          // Deduct from local cache stock to keep state consistent immediately
          deductLocalStock(cart);
          setCart([]);
          resetCartForm();
          if (refreshProducts) refreshProducts();
          syncInventoryDelta();
        } else if (res.status === 409 && data.conflict) {
          // Stock Conflict
          alert(`Online Sync Conflict: ${data.error}. Saved transaction to queue to resolve.`);
          queueOfflineTransaction({ ...invoicePayload, status: 'Conflict', errorMessage: data.error });
          setCart([]);
        } else {
          // Other API error, fallback to offline checkout
          alert(`API Error: ${data.error || 'Server error'}. Saved to offline queue.`);
          queueOfflineTransaction({ ...invoicePayload, status: 'Failed', errorMessage: data.error });
          setCart([]);
        }
      } catch (e) {
        // Fetch failed, save to offline queue
        console.error('Online checkout failed, queuing offline:', e);
        queueOfflineTransaction({ ...invoicePayload, status: 'Pending' });
        setCart([]);
      } finally {
        setLoading(false);
      }
    } else {
      // Offline mode checkout
      queueOfflineTransaction({ ...invoicePayload, status: 'Pending' });
      setLoading(false);
    }
  };

  const queueOfflineTransaction = (invoice) => {
    // Add to Local Storage Sync Queue
    setSyncQueue(prev => [...prev, invoice]);
    
    // Deduct stock in local cache so stock counts are kept live offline
    deductLocalStock(invoice.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity
    })));

    setCheckoutResult({
      ...invoice,
      id: `OFFLINE-${invoice.uuid.substring(0, 8).toUpperCase()}`,
      isOfflineCheckout: true,
      items: invoice.items.map(item => {
        const match = localProducts.find(p => p.id === item.product_id);
        return {
          ...item,
          product_name: match ? match.name : 'Product',
          gst_rate: match ? match.gst_rate : 18.0
        };
      })
    });
    setCart([]);
    resetCartForm();
  };

  const deductLocalStock = (soldItems) => {
    const updated = localProducts.map(p => {
      const sold = soldItems.find(item => item.product_id === p.id);
      if (sold) {
        return { ...p, stock_level: Math.max(0, p.stock_level - sold.quantity) };
      }
      return p;
    });
    setLocalProducts(updated);
    localStorage.setItem('pos_products', JSON.stringify(updated));
  };

  const resetCartForm = () => {
    setCustomerName('Counter Customer');
    setPaymentMethod('Cash');
    setDiscountPercent(0);
    setNotes('');
  };

  // 5. Automatic Queue Synchronization Routine
  const triggerQueueSync = async () => {
    if (!activeOnline || syncProgress.active) return;
    
    const pendingTxList = syncQueue.filter(tx => tx.status === 'Pending' || tx.status === 'Failed');
    if (pendingTxList.length === 0) return;

    setSyncProgress({ active: true, total: pendingTxList.length, current: 0 });

    const updatedQueue = [...syncQueue];

    for (let i = 0; i < pendingTxList.length; i++) {
      const tx = pendingTxList[i];
      const indexInQueue = updatedQueue.findIndex(q => q.uuid === tx.uuid);
      
      try {
        const res = await fetch('/api/checkout/offline', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            items: tx.items,
            uuid: tx.uuid,
            payment_method: tx.payment_method,
            customer_name: tx.customer_name,
            notes: tx.notes,
            cashier: tx.cashier,
            discount: tx.discount,
            pos_device_id: localStorage.getItem('posDeviceId') || 'POS-001',
            is_offline_sync: true
          })
        });

        const data = await safeFetchJson(res);
        if (res.ok) {
          updatedQueue[indexInQueue] = { ...tx, status: 'Synced', id: data.id };
        } else if (res.status === 409 && data.conflict) {
          updatedQueue[indexInQueue] = { ...tx, status: 'Conflict', errorMessage: data.error };
        } else {
          updatedQueue[indexInQueue] = { ...tx, status: 'Failed', errorMessage: data.error };
        }
      } catch (e) {
        updatedQueue[indexInQueue] = { ...tx, status: 'Failed', errorMessage: 'Connection timed out' };
      }

      setSyncProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setSyncQueue(updatedQueue);
    setSyncProgress({ active: false, total: 0, current: 0 });
    refreshProducts();
    syncInventoryDelta(true);
  };

  // Conflict Resolution Action
  const resolveConflict = async (tx, action) => {
    // action: 'force' or 'delete'
    if (action === 'delete') {
      // Remove from queue
      setSyncQueue(prev => prev.filter(q => q.uuid !== tx.uuid));
      setConflictItem(null);
      return;
    }

    if (action === 'force') {
      setLoading(true);
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            items: tx.items,
            uuid: tx.uuid,
            payment_method: tx.payment_method,
            customer_name: tx.customer_name,
            notes: tx.notes,
            cashier: tx.cashier,
            discount: tx.discount,
            force: true // Pass force to skip server stock check
          })
        });
        const data = await safeFetchJson(res);
        if (res.ok) {
          setSyncQueue(prev => prev.map(q => q.uuid === tx.uuid ? { ...q, status: 'Synced', id: data.id } : q));
          alert("Transaction synced successfully!");
        } else {
          alert(`Sync Failed: ${data.error || 'Server error'}`);
        }
      } catch (e) {
        console.error("Resolve conflict error:", e);
        alert(`Server communication error: ${e.message || e}`);
      } finally {
        setConflictItem(null);
        setLoading(false);
        if (refreshProducts) refreshProducts();
        syncInventoryDelta(true);
      }
    }
  };

  // Filter & Search product cards
  const safeProducts = Array.isArray(localProducts) ? localProducts : [];
  const categories = ['All', ...new Set(safeProducts.map(p => p.category))];

  const filteredProducts = safeProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.category.toLowerCase().includes(search.toLowerCase()) ||
                          (p.barcode && p.barcode.includes(search));
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'sales') return b.sales_count - a.sales_count;
    if (sortBy === 'price_asc') return a.current_price - b.current_price;
    if (sortBy === 'price_desc') return b.current_price - a.current_price;
    if (sortBy === 'stock_asc') return a.stock_level - b.stock_level;
    return 0;
  });

  return (
    <div>
      <style>{`
        @keyframes scanner-laser {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        .active-row {
          background-color: rgba(99, 102, 241, 0.15) !important;
          border-left: 3px solid var(--primary);
        }
        .pos-table tbody tr:hover {
          background-color: rgba(255, 255, 255, 0.04);
        }
      `}</style>

      {/* 1. Header with Connection Pill & Sync Progress */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h1>Enterprise POS Billing</h1>
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '8px' }}>
              <button 
                className={`btn ${posMode === 'billing' ? 'btn-primary' : ''}`}
                style={{ padding: '6px 12px', fontSize: '0.85rem', marginBottom: 0, background: posMode === 'billing' ? 'var(--primary)' : 'transparent', border: 'none' }}
                onClick={() => setPosMode('billing')}
              >
                Billing Terminal
              </button>
              <button 
                className={`btn ${posMode === 'queue' ? 'btn-primary' : ''}`}
                style={{ padding: '6px 12px', fontSize: '0.85rem', marginBottom: 0, background: posMode === 'queue' ? 'var(--primary)' : 'transparent', border: 'none' }}
                onClick={() => setPosMode('queue')}
              >
                Register Sales ({syncQueue.length})
              </button>
              <button 
                className={`btn ${posMode === 'returns' ? 'btn-primary' : ''}`}
                style={{ padding: '6px 12px', fontSize: '0.85rem', marginBottom: 0, background: posMode === 'returns' ? 'var(--primary)' : 'transparent', border: 'none' }}
                onClick={() => setPosMode('returns')}
              >
                Returns & Logs
              </button>
            </div>
          </div>
          <p>Local-first checkout terminal with automatic cloud synchronization</p>
        </div>
        
        {/* Connection status bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {syncProgress.active && (
            <div className="glass-panel" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              <span className="animate-spin"><RefreshCw size={14} /></span>
              <span>Syncing queue ({syncProgress.current}/{syncProgress.total})...</span>
            </div>
          )}

          <div className="glass-panel" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-flex', width: '8px', height: '8px', borderRadius: '50%', background: activeOnline ? 'var(--success)' : '#ef4444' }}></span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {activeOnline ? '🟢 Online' : '🔴 Offline Mode'}
            </span>
          </div>

          <button 
            className="btn btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setSimulatedOffline(!simulatedOffline)}
          >
            {simulatedOffline ? <Wifi size={14} /> : <WifiOff size={14} />}
            {simulatedOffline ? 'Simulate Online' : 'Go Offline'}
          </button>
          
          <button 
            className="btn btn-secondary" 
            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            disabled={!activeOnline}
            onClick={() => syncInventoryDelta(true)}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* 2. Main POS Layout */}
      {posMode === 'billing' && (
        <>
          <div className="pos-layout">
            <div>
              {/* Barcode scanner and search options */}
              <div className="glass-panel" style={{ marginBottom: '1rem', padding: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', flex: 1, gap: '6px', minWidth: '220px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Barcode style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                    <input 
                      type="text" 
                      placeholder="Scan or type barcode (e.g. 8901234000000)..." 
                      className="form-control" 
                      style={{ paddingLeft: '40px', marginBottom: 0 }}
                      value={barcodeInput}
                      onChange={e => setBarcodeInput(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ padding: '0 16px', display: 'flex', alignItems: 'center' }}>
                    Scan
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => setCameraOpen(true)}
                  >
                    <Play size={16} /> Camera
                  </button>
                </form>

                <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                  <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                  <input 
                    type="text" 
                    placeholder="Search products..." 
                    className="form-control" 
                    style={{ paddingLeft: '40px', marginBottom: 0 }}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                
                <select className="form-control" style={{ width: '130px', marginBottom: 0 }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <select className="form-control" style={{ width: '150px', marginBottom: 0 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="default">Sort: Default</option>
                  <option value="sales">Top Selling</option>
                  <option value="price_asc">Price: Low-High</option>
                  <option value="price_desc">Price: High-Low</option>
                  <option value="stock_asc">Stock: Low-High</option>
                </select>
              </div>

              {/* Products Grid */}
              <div className="products-grid" style={{ minHeight: '400px' }}>
                {sortedProducts.map(p => {
                  const isLowStock = p.stock_level < 5;
                  return (
                    <div key={p.id} className="glass-panel pos-product-card" onClick={() => addToCart(p)}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="product-category">{p.category}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Barcode size={12} /> {p.barcode}
                          </span>
                        </div>
                        <h3 className="product-title">{p.name}</h3>
                      </div>
                      
                      <div className="product-pricing-row" style={{ marginTop: 'auto' }}>
                        <div>
                          <div className="price-label">Dynamic Price</div>
                          <div className="price-value">₹{p.current_price.toFixed(2)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="price-label">Stock Status</div>
                          <span className={`badge ${p.stock_level <= 0 ? 'badge-danger' : isLowStock ? 'badge-warning' : 'badge-success'}`}>
                            {p.stock_level <= 0 ? 'Out of stock' : `${p.stock_level} left`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Sidebar Cart & Form */}
            <div>
              <div className="glass-panel cart-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}><ShoppingCart /> Cart</h2>
                
                {/* Cashier / Customer Detail */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Customer Name</label>
                      <input type="text" className="form-control" style={{ padding: '6px 10px', height: '36px' }} value={customerName} onChange={e => setCustomerName(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cashier</label>
                      <input type="text" className="form-control" style={{ padding: '6px 10px', height: '36px', width: '110px' }} value={cashier} onChange={e => setCashier(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Cart Items list */}
                <div className="cart-items" style={{ minHeight: '80px', maxHeight: '360px', overflowY: 'auto', margin: '1rem 0' }}>
                  {cart.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#6b7280', marginTop: '4rem' }}>Cart is empty</div>
                  ) : (
                    cart.map(item => (
                      <div key={item.product_id} className="cart-item">
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem' }}>{item.product_name}</h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>₹{item.price_at_sale.toFixed(2)} each</span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button className="cart-qty-btn" onClick={() => updateQuantity(item.product_id, -1)}><Minus size={12} /></button>
                          <span style={{ fontSize: '0.9rem', fontWeight: 600, width: '20px', textAlign: 'center' }}>{item.quantity}</span>
                          <button className="cart-qty-btn" onClick={() => updateQuantity(item.product_id, 1)}><Plus size={12} /></button>
                          
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px', marginLeft: '6px', color: '#ef4444' }}
                            onClick={() => setCart(cart.filter(i => i.product_id !== item.product_id))}
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Cart Summary */}
                <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', flex: 1 }}>Discount (%):</span>
                    <input 
                      type="number" 
                      min="0" 
                      max="100" 
                      className="form-control" 
                      style={{ width: '70px', padding: '4px 8px', height: '30px', marginBottom: 0 }}
                      value={discountPercent} 
                      onChange={e => setDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', flex: 1 }}>Payment Method:</span>
                    <select 
                      className="form-control" 
                      style={{ width: '120px', padding: '4px 8px', height: '30px', marginBottom: 0 }}
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="UPI">UPI</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.2rem', marginBottom: '1rem', borderTop: '1px dashed var(--panel-border)', paddingTop: '10px' }}>
                    <span>Total Amount:</span>
                    <span>₹{totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', height: '42px', fontSize: '1rem' }} 
                  disabled={cart.length === 0 || loading} 
                  onClick={handleCheckout}
                >
                  {loading ? 'Processing...' : activeOnline ? 'Complete Cloud Checkout' : 'Complete Offline Checkout'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 3. Register Sales / Sync Queue Manager */}
      {posMode === 'queue' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Register Sales & Sync Queue</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>View, manage, and synchronize transactions recorded offline or during connection drops.</p>
            </div>
            <button 
              className="btn btn-primary" 
              disabled={!activeOnline || syncQueue.filter(tx => tx.status === 'Pending' || tx.status === 'Failed').length === 0}
              onClick={triggerQueueSync}
            >
              Force Queue Upload
            </button>
          </div>

          {syncQueue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              <CheckCircle size={36} style={{ color: 'var(--success)', marginBottom: '12px' }} />
              <div>No transactions waiting to be registered. All sales are successfully synchronized!</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="financial-table" style={{ width: '100%', fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th>Offline ID</th>
                    <th>Customer</th>
                    <th>Total Amount</th>
                    <th>Payment</th>
                    <th>Timestamp</th>
                    <th>Sync Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {syncQueue.map((tx, idx) => {
                    let badgeClass = 'badge-secondary';
                    if (tx.status === 'Synced') badgeClass = 'badge-success';
                    if (tx.status === 'Conflict') badgeClass = 'badge-warning';
                    if (tx.status === 'Failed') badgeClass = 'badge-danger';
                    
                    return (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{tx.id || tx.uuid.substring(0, 8).toUpperCase()}</td>
                        <td>{tx.customer_name}</td>
                        <td style={{ fontWeight: 600 }}>₹{tx.total_amount.toFixed(2)}</td>
                        <td>{tx.payment_method}</td>
                        <td>{new Date(tx.timestamp).toLocaleString()}</td>
                        <td>
                          <span className={`badge ${badgeClass}`}>{tx.status}</span>
                          {tx.errorMessage && <span style={{ display: 'block', fontSize: '0.75rem', color: '#ef4444', marginTop: '4px' }}>{tx.errorMessage}</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {(tx.status === 'Pending' || tx.status === 'Failed') && (
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '4px 10px', fontSize: '0.75rem', marginRight: '6px', marginBottom: 0 }} 
                              onClick={() => resolveConflict(tx, 'force')}
                            >
                              Sync Now
                            </button>
                          )}
                          {tx.status === 'Conflict' && (
                            <button className="btn btn-warning" style={{ padding: '4px 10px', fontSize: '0.75rem', marginRight: '6px', marginBottom: 0 }} onClick={() => setConflictItem(tx)}>
                              Resolve
                            </button>
                          )}

                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}


      {/* Returns & Refunds View */}
      {posMode === 'returns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top row: search & transaction details */}
          <div className="pos-layout">
            <div>
              <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Find Sale Transaction</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                    <input 
                      type="text" 
                      placeholder="Search by Transaction ID or Customer Name..." 
                      className="form-control" 
                      style={{ paddingLeft: '40px', marginBottom: 0 }}
                      value={searchTxQuery}
                      onChange={e => setSearchTxQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              <div className="glass-panel" style={{ padding: '1.25rem', maxHeight: '550px', overflowY: 'auto' }}>
                <h4 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Transaction History</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table className="financial-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Tx ID</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Items Count</th>
                        <th>Total Amt</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions
                        .filter(t => 
                          String(t.id).includes(searchTxQuery) || 
                          (t.customer_name && t.customer_name.toLowerCase().includes(searchTxQuery.toLowerCase()))
                        )
                        .map(t => (
                          <tr key={t.id} style={{ cursor: 'pointer' }} className={selectedTx?.id === t.id ? 'active-row' : ''} onClick={() => setSelectedTx(t)}>
                            <td><b>POS-{t.id}</b></td>
                            <td>{new Date(t.timestamp).toLocaleString()}</td>
                            <td>{t.customer_name}</td>
                            <td>{t.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}</td>
                            <td style={{ fontWeight: 600 }}>₹{t.total_amount?.toFixed(2)}</td>
                            <td>
                              <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); setSelectedTx(t); }}>
                                Select
                              </button>
                            </td>
                          </tr>
                        ))
                      }
                      {transactions.length < txTotalCount && (
                        <tr ref={(node) => {
                            if (!node || loading) return;
                            if (node._observer) node._observer.disconnect();
                            node._observer = new IntersectionObserver(entries => {
                              if (entries[0].isIntersecting) {
                                setTxPage(p => p + 1);
                              }
                            }, { threshold: 1.0 });
                            node._observer.observe(node);
                          }}>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                            Scroll for more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Selected Transaction Items & Return Processing Panel */}
            <div>
              <div className="glass-panel cart-panel" style={{ padding: '1.25rem', position: 'sticky', top: '20px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px' }}>
                  {selectedTx ? `POS-${selectedTx.id} Details` : 'Select a Transaction'}
                </h3>
                
                {selectedTx ? (
                  <div>
                    <div style={{ fontSize: '0.85rem', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Customer:</span> <span>{selectedTx.customer_name}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Cashier:</span> <span>{selectedTx.cashier || 'Admin'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Payment:</span> <span>{selectedTx.payment_method}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Date:</span> <span>{new Date(selectedTx.timestamp).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 'bold', marginTop: '6px', borderTop: '1px dashed var(--panel-border)', paddingTop: '6px' }}>
                        <span>Total Paid:</span> <span style={{ color: 'var(--primary)' }}>₹{selectedTx.total_amount?.toFixed(2)}</span>
                      </div>
                    </div>

                    <h4 style={{ fontSize: '0.9rem', marginBottom: '8px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '4px' }}>Items Sold:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', marginBottom: '12px' }}>
                      {selectedTx.items?.map(item => {
                        const remaining = item.quantity;
                        const itemKey = `${selectedTx.id}-${item.product_id}`;
                        const returnQty = returnQtyMap[itemKey] || 1;
                        const returnReason = returnReasonMap[itemKey] || 'Changed Mind';

                        return (
                          <div key={item.product_id} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--panel-border)', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                              <span>{item.product_name}</span>
                              <span>₹{item.price_at_sale}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
                              <span>Qty remaining: {remaining}</span>
                              <span>Total: ₹{(item.price_at_sale * remaining).toFixed(2)}</span>
                            </div>
                            
                            {remaining > 0 ? (
                              <div style={{ marginTop: '8px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <input 
                                  type="number" 
                                  min="1" 
                                  max={remaining}
                                  className="form-control"
                                  style={{ width: '60px', marginBottom: 0, padding: '4px 6px', fontSize: '0.8rem' }}
                                  value={returnQty}
                                  onChange={e => setReturnQtyMap({
                                    ...returnQtyMap,
                                    [itemKey]: Math.min(remaining, Math.max(1, parseInt(e.target.value) || 1))
                                  })}
                                />
                                <select 
                                  className="form-control"
                                  style={{ flex: 1, marginBottom: 0, padding: '4px 6px', fontSize: '0.8rem' }}
                                  value={returnReason}
                                  onChange={e => setReturnReasonMap({
                                    ...returnReasonMap,
                                    [itemKey]: e.target.value
                                  })}
                                >
                                  <option value="Changed Mind">Changed Mind</option>
                                  <option value="Defective">Defective / Damaged</option>
                                  <option value="Wrong Item">Wrong Item Shipped</option>
                                  <option value="Other">Other Reason</option>
                                </select>
                                <button 
                                  className="btn btn-danger"
                                  style={{ padding: '6px 10px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                                  onClick={() => handleReturnItem(selectedTx.id, item.product_id, returnQty, returnReason)}
                                >
                                  Return
                                </button>
                              </div>
                            ) : (
                              <div style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>
                                Fully Returned
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                    Select a transaction from the list on the left to see details and initiate a return.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Returns History Log Table */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Returns & Refunds Log</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="financial-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Return ID</th>
                    <th>Tx ID</th>
                    <th>Product</th>
                    <th>Qty Returned</th>
                    <th>Refund Amount</th>
                    <th>Reason</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {returnsList.length > 0 ? (
                    returnsList.map(ret => (
                      <tr key={ret.id}>
                        <td>#RET-{ret.id}</td>
                        <td><b>POS-{ret.transaction_id}</b></td>
                        <td>{ret.product_name}</td>
                        <td>{ret.quantity}</td>
                        <td style={{ fontWeight: 600 }}>₹{ret.refund_amount?.toFixed(2)}</td>
                        <td>
                          <span className="badge" style={{ 
                            backgroundColor: ret.reason === 'Defective' ? '#f87171' : 'rgba(255,255,255,0.08)',
                            color: ret.reason === 'Defective' ? '#000' : 'inherit'
                          }}>
                            {ret.reason}
                          </span>
                        </td>
                        <td>{new Date(ret.timestamp).toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2rem 0', color: '#9ca3af' }}>
                        No items have been returned yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner Modal overlay */}
      {cameraOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', padding: '20px', textAlign: 'center' }}>
            <h3 style={{ marginTop: 0 }}>Camera Barcode Scanner</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '15px' }}>Point your camera at a barcode to scan</p>
            
            <div style={{ width: '100%', height: '280px', background: '#000', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
              <div id="reader" style={{ width: '100%', height: '100%' }}></div>
              
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                border: '2px solid rgba(255,255,255,0.1)',
                pointerEvents: 'none',
                boxSizing: 'border-box'
              }}>
                <div style={{
                  width: '80%',
                  height: '40%',
                  margin: '15% auto',
                  border: '2px dashed var(--primary)',
                  boxShadow: '0 0 0 4000px rgba(0,0,0,0.6)',
                  position: 'relative'
                }}>
                  {/* laser line */}
                  <div style={{
                    width: '100%',
                    height: '2px',
                    backgroundColor: '#ef4444',
                    position: 'absolute',
                    top: '50%',
                    boxShadow: '0 0 8px #ef4444',
                    animation: 'scanner-laser 2s infinite ease-in-out'
                  }}></div>
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" style={{ marginBottom: 0 }} onClick={() => setCameraOpen(false)}>
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Success Invoice Modal (Offline compatible) */}
      {checkoutResult && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px', padding: '24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <CheckCircle size={50} color="#10b981" style={{ margin: '0 auto 0.5rem auto' }} />
              <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Checkout Successful!</h2>
              {checkoutResult.isOfflineCheckout && (
                <span className="badge badge-warning" style={{ marginTop: '5px', display: 'inline-block' }}>
                  ** PENDING CLOUD SYNC **
                </span>
              )}
            </div>

            {/* Receipt format */}
            <div style={{ borderTop: '2px dashed var(--panel-border)', borderBottom: '2px dashed var(--panel-border)', padding: '16px 0', margin: '16px 0', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span><b>Invoice:</b> {checkoutResult.id || checkoutResult.uuid.substring(0,8).toUpperCase()}</span>
                <span>{new Date(checkoutResult.timestamp).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span><b>Customer:</b> {checkoutResult.customer_name}</span>
                <span><b>Cashier:</b> {checkoutResult.cashier || 'Cashier'}</span>
              </div>
              
              <div style={{ borderBottom: '1px solid var(--panel-border)', margin: '10px 0' }}></div>
              
              {checkoutResult.items?.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                  <span>{item.product_name || `Product ID ${item.product_id}`} (x{item.quantity})</span>
                  <span>₹{(item.price_at_sale * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              
              <div style={{ borderBottom: '1px solid var(--panel-border)', margin: '10px 0' }}></div>

              {checkoutResult.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', color: 'var(--success)' }}>
                  <span>Discount ({checkoutResult.discount}%):</span>
                  <span>- ₹{((checkoutResult.total_amount * checkoutResult.discount) / (100 - checkoutResult.discount)).toFixed(2)}</span>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem', marginTop: '10px' }}>
                <span>Total Paid ({checkoutResult.payment_method}):</span>
                <span>₹{checkoutResult.total_amount.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {!checkoutResult.isOfflineCheckout && (
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => window.open(`/api/transactions/${checkoutResult.id}/invoice`, '_blank')}>
                  <FileText size={16} style={{ marginRight: '6px' }} /> Print Invoice PDF
                </button>
              )}
              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setCheckoutResult(null)}>
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Conflict Resolution Modal */}
      {conflictItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', padding: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '1.25rem' }}>
              <AlertTriangle size={40} color="#f59e0b" />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Inventory Sync Conflict</h2>
                <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '2px 0 0 0' }}>{conflictItem.errorMessage}</p>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              This transaction was placed offline, but online sales have reduced stock levels in the cloud. Force syncing will push this transaction and allow negative stock.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-danger" onClick={() => resolveConflict(conflictItem, 'delete')}>
                Cancel & Refund
              </button>
              <button className="btn btn-primary" onClick={() => resolveConflict(conflictItem, 'force')}>
                Force Sync (Overdraft Stock)
              </button>
              <button className="btn btn-secondary" onClick={() => setConflictItem(null)}>
                Close Dialog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

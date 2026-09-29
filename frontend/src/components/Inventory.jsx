import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash, PackagePlus, Download, Sparkles, AlertTriangle } from 'lucide-react';

export default function Inventory({ products, refreshProducts, token, user }) {
  const isReadOnly = user?.is_guest || user?.role === 'guest';
  useEffect(() => {
    if (refreshProducts) {
      refreshProducts();
    }
  }, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  
  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [baseCost, setBaseCost] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [stockLevel, setStockLevel] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [gstRate, setGstRate] = useState('18');
  const [description, setDescription] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  // GST Auto-Classifier States
  const [gstAutoClassifying, setGstAutoClassifying] = useState(false);
  const [gstClassificationNotice, setGstClassificationNotice] = useState(null);

  const handleAutoDetectGst = async () => {
    if (!name && !category) {
      alert("Please enter a Product Name or Category first.");
      return;
    }
    setGstAutoClassifying(true);
    setGstClassificationNotice(null);
    try {
      const res = await fetch('/api/gst/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          product_name: name,
          category: category,
          description: description
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.category_name && !category) {
          setCategory(data.category_name);
        }
        if (data.hsn_code) {
          setHsnCode(data.hsn_code);
        }
        if (data.gst_rate !== undefined) {
          setGstRate(data.gst_rate.toString());
        }
        setGstClassificationNotice({
          source: data.source,
          category: data.category_name,
          hsn: data.hsn_code,
          rate: data.gst_rate,
          confidence: data.confidence,
          requires_confirmation: data.requires_confirmation,
          explanation: data.explanation
        });
      } else {
        alert("Failed to auto-detect GST rate.");
      }
    } catch (err) {
      console.error(err);
      alert("Error auto-detecting GST rate.");
    } finally {
      setGstAutoClassifying(false);
    }
  };

  const handleAIDescription = async () => {
    if (!name || !category) {
      alert("Please fill in the Product Name and Category first.");
      return;
    }
    setAiGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ name, category })
      });
      const data = await res.json();
      if (res.ok) {
        setDescription(data.description);
      } else {
        alert(data.error || "Failed to generate description.");
      }
    } catch (e) {
      alert("Error generating description.");
    } finally {
      setAiGenerating(false);
    }
  };

  const openAddModal = () => {
    setEditProduct(null);
    setName('');
    setCategory('');
    setBaseCost('');
    setCurrentPrice('');
    setStockLevel('');
    setHsnCode('84733099');
    setGstRate('18');
    setDescription('');
    setGstClassificationNotice(null);
    setModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditProduct(product);
    setName(product.name);
    setCategory(product.category);
    setBaseCost(product.base_cost.toString());
    setCurrentPrice(product.current_price.toString());
    setStockLevel(product.stock_level.toString());
    setHsnCode((product.hsn_code || '84733099').toString());
    setGstRate((product.gst_rate || 18).toString());
    setDescription(product.description || '');
    setGstClassificationNotice(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name,
      category,
      base_cost: parseFloat(baseCost),
      current_price: parseFloat(currentPrice),
      stock_level: parseInt(stockLevel),
      hsn_code: hsnCode,
      gst_rate: parseFloat(gstRate),
      description
    };

    const url = editProduct 
      ? `/api/products/${editProduct.id}`
      : '/api/products';
    
    const method = editProduct ? 'PUT' : 'POST';

    try {
      const headers = { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        // Admin Learning: If AI/User auto-detected a GST category, save to GstCategoryMapping database table
        if (gstClassificationNotice && category && hsnCode && gstRate) {
          fetch('/api/gst/confirm-mapping', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              category_name: category,
              hsn_code: hsnCode,
              gst_rate: parseFloat(gstRate),
              keywords: `${name},${category}`.toLowerCase(),
              description: description || `Confirmed rate for ${name}`
            })
          }).catch(err => console.error("Admin learning sync error:", err));
        }

        setModalOpen(false);
        refreshProducts();
      } else {
        alert(data.error || 'Operation failed');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to database');
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        refreshProducts();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExport = async (format) => {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/reports/download?type=inventory&format=${format}`, { headers });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory_report.${format === 'excel' ? 'xlsx' : 'pdf'}`;
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

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const categories = ['All', ...new Set((products || []).map(p => p.category).filter(Boolean))];

  const filteredProducts = (products || []).filter(p => {
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    const matchesSearch = !searchTerm || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.hsn_code && p.hsn_code.includes(searchTerm)) ||
      (p.barcode && p.barcode.includes(searchTerm));
    return matchesCategory && matchesSearch;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Inventory Management</h1>
          <p>Real-time stock control, automated GST categorization, and catalog pricing</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {!isReadOnly && (
            <button className="ui-btn ui-btn-primary" onClick={openAddModal}>
              <Plus size={16} /> Add Product
            </button>
          )}
        </div>
      </div>

      <div className="ui-card" style={{ marginBottom: '1.5rem', padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input 
          type="text" 
          placeholder="Search by name, HSN, or barcode..." 
          className="ui-input" 
          style={{ flex: 1, minWidth: '220px' }}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <select 
          className="ui-input" 
          style={{ width: '180px' }}
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      <div className="ui-card">
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>HSN Code</th>
                <th>Base Cost</th>
                <th>Retail Price</th>
                <th>GST Rate</th>
                <th>Stock Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <div className="ui-empty-state" style={{ border: 'none', padding: '1rem' }}>
                      <p style={{ color: 'var(--text-muted)' }}>No inventory products match your search.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                [...filteredProducts].sort((a, b) => a.id - b.id).map(p => (
                  <tr key={p.id}>
                    <td className="tabular-nums" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>#{p.id}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                    <td>
                      <span className="ui-badge ui-badge-neutral ui-badge-sm">
                        {p.category}
                      </span>
                    </td>
                    <td><code style={{ fontSize: '0.82rem', background: 'var(--bg-surface-subtle)', padding: '0.2rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>{p.hsn_code || 'N/A'}</code></td>
                    <td className="tabular-nums">₹{p.base_cost.toFixed(2)}</td>
                    <td className="tabular-nums" style={{ fontWeight: 700 }}>₹{p.current_price.toFixed(2)}</td>
                    <td><span className="ui-badge ui-badge-warning ui-badge-sm">{p.gst_rate}%</span></td>
                    <td>
                      {p.stock_level === 0 ? (
                        <span className="ui-badge ui-badge-error ui-badge-sm">Out of Stock</span>
                      ) : p.stock_level < 15 ? (
                        <span className="ui-badge ui-badge-warning ui-badge-sm">{p.stock_level} (Low)</span>
                      ) : (
                        <span className="ui-badge ui-badge-success ui-badge-sm">{p.stock_level} In Stock</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        {isReadOnly ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.25rem 0.5rem' }}>View Only</span>
                        ) : (
                          <>
                            <button className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => openEditModal(p)} title="Edit product">
                              <Edit size={14} />
                            </button>
                            <button className="ui-btn ui-btn-secondary ui-btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(p.id)} title="Delete product">
                              <Trash size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PackagePlus size={22} color="#e8281a" /> {editProduct ? 'Edit Product' : 'Add New Product'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Product Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label>Category</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                  placeholder="e.g. Electronics, Groceries..."
                />
              </div>

              <div className="grid-2">
                <div className="input-group">
                  <label>Base Cost (₹)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    required 
                    value={baseCost} 
                    onChange={e => setBaseCost(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label>Retail Price (₹)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    required 
                    value={currentPrice} 
                    onChange={e => setCurrentPrice(e.target.value)}
                    placeholder="Optional (defaults to Cost * 1.25)"
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="input-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ margin: 0 }}>HSN Code</label>
                  </div>
                  <input 
                    type="text" 
                    className="form-control" 
                    required 
                    value={hsnCode} 
                    onChange={e => setHsnCode(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ margin: 0 }}>GST Rate (%)</label>
                    <button 
                      type="button" 
                      onClick={handleAutoDetectGst} 
                      disabled={gstAutoClassifying}
                      style={{ 
                        padding: '3px 8px', 
                        fontSize: '0.72rem', 
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)', 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: '6px', 
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Sparkles size={12} /> {gstAutoClassifying ? 'Checking...' : 'Auto-Detect GST'}
                    </button>
                  </div>
                  <select 
                    className="form-control" 
                    required
                    value={gstRate} 
                    onChange={e => setGstRate(e.target.value)}
                  >
                    <option value="0">0% (Exempt)</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              {/* GST Classification Notice */}
              {gstClassificationNotice && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  fontSize: '0.82rem',
                  background: gstClassificationNotice.source === 'database' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                  border: `1px solid ${gstClassificationNotice.source === 'database' ? '#10b981' : '#6366f1'}`,
                  color: 'var(--text-main)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '4px' }}>
                    <span>
                      {gstClassificationNotice.source === 'database' ? '✅ Database Rule Match' : '🤖 AI Recommended Classification'}
                    </span>
                    <span style={{ color: gstClassificationNotice.confidence >= 80 ? '#10b981' : '#f59e0b' }}>
                      Confidence: {gstClassificationNotice.confidence}%
                    </span>
                  </div>
                  <div>
                    Category: <strong>{gstClassificationNotice.category}</strong> | HSN: <strong>{gstClassificationNotice.hsn}</strong> | Rate: <strong>{gstClassificationNotice.rate}%</strong>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {gstClassificationNotice.explanation}
                  </div>
                </div>
              )}

              <div className="input-group">
                <label>Stock Level</label>
                <input 
                  type="number" 
                  className="form-control" 
                  required 
                  value={stockLevel} 
                  onChange={e => setStockLevel(e.target.value)}
                />
              </div>

              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ margin: 0 }}>Product Description</label>
                  <button 
                    type="button" 
                    onClick={handleAIDescription} 
                    disabled={aiGenerating}
                    style={{ 
                      padding: '4px 10px', 
                      fontSize: '0.72rem', 
                      background: 'linear-gradient(135deg, #eab308, #d1a007)', 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: '6px', 
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {aiGenerating ? 'Generating...' : '✨ Auto-Write Description'}
                  </button>
                </div>
                <textarea 
                  className="form-control" 
                  rows={3}
                  value={description} 
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the product details..."
                  style={{ resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
                />
              </div>

              <div className="flex-end" style={{ marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

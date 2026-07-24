import React, { useState } from 'react';
import { Plus, Edit, Trash, PackagePlus, Download } from 'lucide-react';

export default function Inventory({ products, refreshProducts, token }) {
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

  const openAddModal = () => {
    setEditProduct(null);
    setName('');
    setCategory('');
    setBaseCost('');
    setCurrentPrice('');
    setStockLevel('');
    setHsnCode('84733099');
    setGstRate('18');
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
      gst_rate: parseFloat(gstRate)
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Inventory Management</h1>
          <p>Manage store stock items, categories, cost bases and retail pricing</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => handleExport('pdf')}>
            <Download size={16} /> Export PDF
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('excel')}>
            <Download size={16} /> Export Excel
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      <div className="glass-panel">
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>HSN Code</th>
                <th>Base Cost</th>
                <th>Retail Price</th>
                <th>GST Rate</th>
                <th>Stock Level</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td style={{ fontWeight: 'bold' }}>{p.name}</td>
                  <td>
                    <span className="badge badge-success" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {p.category}
                    </span>
                  </td>
                  <td><code style={{ fontSize: '0.85rem', background: 'rgba(0,0,0,0.03)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>{p.hsn_code || 'N/A'}</code></td>
                  <td>₹{p.base_cost.toFixed(2)}</td>
                  <td>₹{p.current_price.toFixed(2)}</td>
                  <td><span className="badge badge-warning" style={{ background: 'rgba(246, 166, 35, 0.1)', color: '#d17c00' }}>{p.gst_rate}%</span></td>
                  <td>
                    {p.stock_level < 15 ? (
                      <span style={{ color: '#f43f5e', fontWeight: 'bold' }}>{p.stock_level} (Low)</span>
                    ) : (
                      <span>{p.stock_level}</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-icon" onClick={() => openEditModal(p)}>
                        <Edit size={14} />
                      </button>
                      <button className="btn-icon" style={{ color: '#f43f5e' }} onClick={() => handleDelete(p.id)}>
                        <Trash size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
                  <label>HSN Code</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    required 
                    value={hsnCode} 
                    onChange={e => setHsnCode(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label>GST Rate (%)</label>
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

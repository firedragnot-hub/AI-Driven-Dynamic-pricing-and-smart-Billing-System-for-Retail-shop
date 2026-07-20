import React, { useState, useEffect } from 'react';
import { User, Star, Search, RefreshCw, MessageSquare } from 'lucide-react';

export default function ReviewsList({ token }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('http://127.0.0.1:5000/api/reviews/admin', { headers });
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (e) {
      console.error("Error fetching reviews:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [token]);

  const filteredReviews = reviews.filter(rev => {
    const matchesRating = ratingFilter === 'All' || rev.rating === parseInt(ratingFilter);
    const matchesSearch = 
      rev.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rev.comment.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rev.username.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRating && matchesSearch;
  });

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, idx) => (
      <Star 
        key={idx} 
        size={14} 
        fill={idx < rating ? "#f59e0b" : "none"} 
        color={idx < rating ? "#f59e0b" : "#cbd5e1"} 
        style={{ marginRight: '2px' }}
      />
    ));
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Product Reviews Monitor</h1>
          <p>Read customer feedback, ratings, and testimonials across all inventory products</p>
        </div>
        <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={fetchReviews} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="glass-panel" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
          <input 
            type="text" 
            placeholder="Search by product, customer, or comment..." 
            className="form-control" 
            style={{ paddingLeft: '40px', marginBottom: 0 }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        
        <select 
          className="form-control" 
          style={{ width: '160px', marginBottom: 0 }} 
          value={ratingFilter} 
          onChange={e => setRatingFilter(e.target.value)}
        >
          <option value="All">All Ratings</option>
          <option value="5">5 Stars only</option>
          <option value="4">4 Stars & above</option>
          <option value="3">3 Stars</option>
          <option value="2">2 Stars</option>
          <option value="1">1 Star only</option>
        </select>
      </div>

      {loading ? (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: '4rem 0',
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
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Loading customer reviews...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          <MessageSquare size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
          <h3>No Reviews Found</h3>
          <p>No reviews match your filter parameters or search queries.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {filteredReviews.map(rev => (
            <div key={rev.id} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {rev.product_name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(rev.timestamp).toLocaleDateString()}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  {renderStars(rev.rating)}
                </div>

                <p style={{ fontSize: '0.9rem', fontStyle: 'italic', margin: '0 0 1rem 0', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                  "{rev.comment}"
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--panel-border)', paddingTop: '8px', marginTop: 'auto' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={14} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{rev.username}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Verified Customer</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

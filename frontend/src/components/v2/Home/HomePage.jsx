import React from 'react';
import '../../../styles/theme.css';
import { Search, Heart, User, ShoppingCart, MapPin, Truck, Phone, ChevronDown, ChevronRight, Star } from 'lucide-react';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* 1. Top Utility Bar */}
      <div style={{ backgroundColor: 'var(--secondary)', color: 'var(--primary)', padding: '0.5rem 0', fontSize: '0.85rem' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={14} /> Store Locator</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Truck size={14} /> Track Order</span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <span>Currency: USD <ChevronDown size={12} /></span>
            <span>Language: EN <ChevronDown size={12} /></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Phone size={14} /> 1-800-ECO-HOME</span>
          </div>
        </div>
      </div>

      {/* 2. Main Brand Header */}
      <header className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 2rem', gap: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', letterSpacing: '2px', color: 'var(--secondary)' }}>
          NATIVA
        </h1>
        
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid var(--gray-dark)', borderRadius: 'var(--border-radius)', overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem', borderRight: '1px solid var(--gray-dark)', backgroundColor: 'var(--white)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            All Categories <ChevronDown size={16} />
          </div>
          <input 
            type="text" 
            placeholder="Search for Products..." 
            style={{ flex: 1, padding: '0.75rem 1rem', border: 'none', outline: 'none' }} 
          />
          <div style={{ backgroundColor: 'var(--accent)', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Search color="white" size={20} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Heart size={24} style={{ cursor: 'pointer' }} />
          <User size={24} style={{ cursor: 'pointer' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <div style={{ position: 'relative' }}>
              <ShoppingCart size={24} />
              <span style={{ position: 'absolute', top: '-8px', right: '-8px', backgroundColor: 'var(--accent)', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>2</span>
            </div>
            <span style={{ fontWeight: 'bold' }}>$124.00</span>
          </div>
        </div>
      </header>

      {/* 3. Department & Quick Navigation */}
      <nav style={{ borderTop: '1px solid var(--divider)', borderBottom: '1px solid var(--divider)', backgroundColor: 'var(--white)' }}>
        <div className="container" style={{ display: 'flex', gap: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 0', fontWeight: 'bold', borderRight: '1px solid var(--divider)', paddingRight: '2rem', cursor: 'pointer' }}>
            SHOP BY DEPARTMENT <ChevronDown size={16} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flex: 1 }}>
            <a href="#" style={{ textDecoration: 'none', color: 'var(--secondary)', fontWeight: 600 }}>Super Deals</a>
            <a href="#" style={{ textDecoration: 'none', color: 'var(--secondary)', fontWeight: 600 }}>Featured Brands</a>
            <a href="#" style={{ textDecoration: 'none', color: 'var(--secondary)', fontWeight: 600 }}>Trending Styles</a>
            <a href="#" style={{ textDecoration: 'none', color: 'var(--secondary)', fontWeight: 600 }}>Gift Cards</a>
          </div>
        </div>
      </nav>

      {/* 4. Hero Feature Split-Banner */}
      <section className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', margin: '3rem auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem 0' }}>
          <h2 style={{ fontSize: '3.5rem', lineHeight: 1.1, marginBottom: '1rem' }}>THE NEW <br/> STANDARD</h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--gray-dark)', marginBottom: '2rem', maxWidth: '400px' }}>
            Discover our latest collection of eco-friendly, sustainable home essentials designed to elevate your everyday living.
          </p>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--secondary)', marginBottom: '2rem' }}>
            $89.<span style={{ fontSize: '1.5rem' }}>00</span>
          </div>
          <div>
            <button className="btn btn-accent" style={{ fontSize: '1.1rem', padding: '1rem 3rem' }}>
              Start Buying <ChevronRight size={18} style={{ verticalAlign: 'text-bottom' }} />
            </button>
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--gray-light)', borderRadius: 'var(--border-radius)', minHeight: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Placeholder for Hero Image */}
          <span style={{ color: 'var(--gray-dark)', fontSize: '1.5rem' }}>[ Hero Product Image ]</span>
        </div>
      </section>

      {/* 5. Special Offer & Countdown Grid */}
      <section className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', margin: '2rem auto 4rem auto' }}>
        {/* Left Column: Special Offer */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '2px solid var(--accent)' }}>
          <div style={{ backgroundColor: 'var(--accent)', color: 'white', padding: '0.25rem 1rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '1.5rem', alignSelf: 'flex-start' }}>
            Special Offer
          </div>
          <div style={{ width: '200px', height: '200px', backgroundColor: 'var(--gray-light)', borderRadius: '50%', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            [ Flagship Image ]
          </div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Ceramic Artisan Vase</h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent)' }}>$45.00</span>
            <span style={{ fontSize: '1rem', color: 'var(--gray-dark)', textDecoration: 'line-through' }}>$75.00</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ backgroundColor: 'var(--primary)', padding: '0.75rem', borderRadius: '4px', minWidth: '50px' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>12</div>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Hours</div>
            </div>
            <div style={{ fontSize: '1.5rem', alignSelf: 'center', fontWeight: 'bold' }}>:</div>
            <div style={{ backgroundColor: 'var(--primary)', padding: '0.75rem', borderRadius: '4px', minWidth: '50px' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>45</div>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Mins</div>
            </div>
            <div style={{ fontSize: '1.5rem', alignSelf: 'center', fontWeight: 'bold' }}>:</div>
            <div style={{ backgroundColor: 'var(--primary)', padding: '0.75rem', borderRadius: '4px', minWidth: '50px' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>30</div>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Secs</div>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-tab Grid */}
        <div>
          <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--divider)', marginBottom: '1.5rem' }}>
            <div style={{ paddingBottom: '0.75rem', borderBottom: '3px solid var(--accent)', fontWeight: 'bold', cursor: 'pointer' }}>Featured</div>
            <div style={{ paddingBottom: '0.75rem', color: 'var(--gray-dark)', cursor: 'pointer' }}>On Sale</div>
            <div style={{ paddingBottom: '0.75rem', color: 'var(--gray-dark)', cursor: 'pointer' }}>Top Rated</div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            {/* Product Item Mockup */}
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ height: '180px', backgroundColor: 'var(--gray-light)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  [ Image ]
                </div>
                <div style={{ display: 'flex', color: '#f6a623', fontSize: '0.8rem' }}>
                  <Star size={14} fill="#f6a623" /><Star size={14} fill="#f6a623" /><Star size={14} fill="#f6a623" /><Star size={14} fill="#f6a623" /><Star size={14} color="var(--gray-light)" />
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>Organic Linen Throw</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent)' }}>$32.00</span>
                  <button style={{ backgroundColor: 'transparent', border: '1px solid var(--divider)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ShoppingCart size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Footer Ecosystem */}
      <footer style={{ backgroundColor: 'var(--secondary)', color: 'var(--white)', padding: '4rem 0', marginTop: 'auto' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3rem' }}>
          <div>
            <h4 style={{ color: 'var(--gray-light)', marginBottom: '1.5rem' }}>Find It Fast</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li><a href="#" style={{ color: 'var(--white)', textDecoration: 'none' }}>Living Room</a></li>
              <li><a href="#" style={{ color: 'var(--white)', textDecoration: 'none' }}>Bedroom</a></li>
              <li><a href="#" style={{ color: 'var(--white)', textDecoration: 'none' }}>Kitchen & Dining</a></li>
              <li><a href="#" style={{ color: 'var(--white)', textDecoration: 'none' }}>Bath</a></li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: 'var(--gray-light)', marginBottom: '1.5rem' }}>Customer Care</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li><a href="#" style={{ color: 'var(--white)', textDecoration: 'none' }}>Help Center</a></li>
              <li><a href="#" style={{ color: 'var(--white)', textDecoration: 'none' }}>Track Your Order</a></li>
              <li><a href="#" style={{ color: 'var(--white)', textDecoration: 'none' }}>Returns & Exchanges</a></li>
              <li><a href="#" style={{ color: 'var(--white)', textDecoration: 'none' }}>Contact Us</a></li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: 'var(--gray-light)', marginBottom: '1.5rem' }}>About NATIVA</h4>
            <p style={{ color: 'var(--gray-light)', fontSize: '0.9rem' }}>
              We curate sustainable, beautifully designed home goods that don't compromise on quality or the environment.
            </p>
          </div>
          <div>
            <h4 style={{ color: 'var(--gray-light)', marginBottom: '1.5rem' }}>Sign Up to Newsletter</h4>
            <p style={{ color: 'var(--gray-light)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Get 15% off your first order when you subscribe.
            </p>
            <div style={{ display: 'flex' }}>
              <input type="email" placeholder="Your Email Address" style={{ padding: '0.75rem', flex: 1, border: 'none', outline: 'none' }} />
              <button className="btn btn-accent" style={{ borderRadius: 0, padding: '0.75rem 1rem' }}>Subscribe</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

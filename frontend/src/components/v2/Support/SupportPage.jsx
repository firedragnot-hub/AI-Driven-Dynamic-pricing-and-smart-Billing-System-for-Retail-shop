import React from 'react';
import '../../../styles/theme.css';
import { MapPin, Search } from 'lucide-react';

export default function SupportPage() {
  return (
    <div style={{ backgroundColor: 'var(--primary)', minHeight: '100vh', padding: '4rem 0' }}>
      <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
        
        {/* Section 1: Contact Us (Contact-V2 Dynamic Layout) */}
        <section>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2>Get in Touch</h2>
            <p style={{ color: 'var(--gray-dark)' }}>We'd love to hear from you. Our friendly team is always here to chat.</p>
          </div>
          
          <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', padding: '3rem' }}>
            {/* Interactive Communication Form */}
            <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>First Name</label>
                  <input type="text" className="input-field" placeholder="Jane" required />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Last Name</label>
                  <input type="text" className="input-field" placeholder="Doe" required />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Subject</label>
                <input type="text" className="input-field" placeholder="How can we help?" required />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Leave us a Message</label>
                <textarea 
                  className="input-field" 
                  rows="5" 
                  placeholder="Your detailed message..." 
                  style={{ resize: 'vertical' }}
                  required
                ></textarea>
              </div>

              <button type="submit" className="btn btn-accent" style={{ alignSelf: 'flex-start', padding: '1rem 2rem' }}>
                Send Message
              </button>
            </form>

            {/* Embedded Map Element */}
            <div style={{ backgroundColor: 'var(--gray-light)', borderRadius: 'var(--border-radius)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%236c6665\' fill-opacity=\'0.2\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
              <MapPin size={48} color="var(--accent)" style={{ zIndex: 1, marginBottom: '1rem' }} />
              <div style={{ zIndex: 1, textAlign: 'center', backgroundColor: 'var(--white)', padding: '1rem', borderRadius: 'var(--border-radius)', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Our Headquarters</h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--gray-dark)' }}>123 Eco Way<br/>Sustainable City, ST 12345</p>
              </div>
            </div>
          </div>
        </section>

        <div className="divider"></div>

        {/* Section 2: Track Your Order */}
        <section style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <div className="card" style={{ padding: '3rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <Search size={32} color="var(--accent)" style={{ marginBottom: '1rem' }} />
              <h2 style={{ fontSize: '1.5rem' }}>Track Your Order</h2>
              <p style={{ color: 'var(--gray-dark)', fontSize: '0.9rem' }}>
                Enter your order details below to check the real-time status of your delivery.
              </p>
            </div>
            
            <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Order ID</label>
                <input type="text" className="input-field" placeholder="e.g. NAT-123456" required />
                <span style={{ fontSize: '0.8rem', color: 'var(--gray-dark)', display: 'block', marginTop: '0.5rem' }}>Found in your order confirmation email.</span>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Billing Email</label>
                <input type="email" className="input-field" placeholder="Email used during checkout" required />
              </div>
              
              <button type="submit" className="btn btn-accent" style={{ width: '100%', marginTop: '1rem', padding: '1rem' }}>
                Track Order
              </button>
            </form>
          </div>
        </section>

      </div>
    </div>
  );
}

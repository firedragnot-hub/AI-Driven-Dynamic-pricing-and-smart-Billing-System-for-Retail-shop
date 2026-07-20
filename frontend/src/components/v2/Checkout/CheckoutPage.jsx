import React, { useState } from 'react';
import '../../../styles/theme.css';
import { Minus, Plus, Trash2, ShieldCheck, CreditCard, ChevronDown } from 'lucide-react';

export default function CheckoutPage() {
  const [paymentMethod, setPaymentMethod] = useState('');
  
  // Mock Cart Data
  const cartItems = [
    { id: 1, name: 'Ceramic Artisan Vase', price: 45.00, qty: 1 },
    { id: 2, name: 'Organic Linen Throw', price: 32.00, qty: 2 },
  ];
  
  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const shipping = 15.00;
  const total = subtotal + shipping;

  return (
    <div style={{ backgroundColor: 'var(--primary)', minHeight: '100vh', padding: '3rem 0' }}>
      <div className="container">
        <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem', color: 'var(--secondary)' }}>Checkout</h1>
        
        {/* 1. The Shopping Cart Matrix */}
        <section className="card" style={{ marginBottom: '3rem', overflowX: 'auto' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--divider)', paddingBottom: '1rem' }}>Shopping Cart Review</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--divider)', color: 'var(--gray-dark)' }}>
                <th style={{ padding: '1rem 0', fontWeight: 600 }}>Product</th>
                <th style={{ padding: '1rem 0', fontWeight: 600 }}>Price</th>
                <th style={{ padding: '1rem 0', fontWeight: 600, textAlign: 'center' }}>Quantity</th>
                <th style={{ padding: '1rem 0', fontWeight: 600, textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {cartItems.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--divider)' }}>
                  <td style={{ padding: '1.5rem 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '60px', height: '60px', backgroundColor: 'var(--gray-light)', borderRadius: 'var(--border-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--gray-dark)' }}>Image</div>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                        <button style={{ background: 'none', border: 'none', color: '#e74c3c', fontSize: '0.8rem', cursor: 'pointer', padding: 0, marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1.5rem 0', fontWeight: 600 }}>${item.price.toFixed(2)}</td>
                  <td style={{ padding: '1.5rem 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--divider)', borderRadius: 'var(--border-radius)', width: 'fit-content', margin: '0 auto' }}>
                      <button style={{ background: 'none', border: 'none', padding: '0.5rem', cursor: 'pointer', display: 'flex' }}><Minus size={14} /></button>
                      <span style={{ padding: '0 1rem', fontWeight: 600 }}>{item.qty}</span>
                      <button style={{ background: 'none', border: 'none', padding: '0.5rem', cursor: 'pointer', display: 'flex' }}><Plus size={14} /></button>
                    </div>
                  </td>
                  <td style={{ padding: '1.5rem 0', fontWeight: 'bold', textAlign: 'right', color: 'var(--accent)' }}>
                    ${(item.price * item.qty).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Cart Utilities */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <input type="text" className="input-field" placeholder="Coupon Code" style={{ maxWidth: '200px' }} />
              <button className="btn btn-secondary">Apply Coupon</button>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-secondary" style={{ backgroundColor: 'transparent', border: '1px solid var(--secondary)' }}>Update Cart</button>
              <button className="btn btn-accent">Proceed to Checkout</button>
            </div>
          </div>
        </section>

        {/* 2. The Checkout Engine */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '3rem', alignItems: 'start' }}>
          
          {/* Left Column: Billing & Logistics */}
          <div className="card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Billing Details</h2>
            <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>First Name *</label>
                  <input type="text" className="input-field" required />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Last Name *</label>
                  <input type="text" className="input-field" required />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Company Name (Optional)</label>
                <input type="text" className="input-field" />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Country / Region *</label>
                <div style={{ position: 'relative' }}>
                  <select className="input-field" style={{ appearance: 'none' }} required>
                    <option value="">Select a country...</option>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="UK">United Kingdom</option>
                  </select>
                  <ChevronDown size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--gray-dark)' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Street Address *</label>
                <input type="text" className="input-field" placeholder="House number and street name" style={{ marginBottom: '0.5rem' }} required />
                <input type="text" className="input-field" placeholder="Apartment, suite, unit, etc. (optional)" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Town / City *</label>
                  <input type="text" className="input-field" required />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>State / County *</label>
                  <input type="text" className="input-field" required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Postcode / ZIP *</label>
                  <input type="text" className="input-field" required />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Phone *</label>
                  <input type="tel" className="input-field" required />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Email Address *</label>
                <input type="email" className="input-field" required />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                  <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} /> Create an Account?
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                  <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} /> Ship to a different address?
                </label>
              </div>
            </form>
          </div>

          {/* Right Column: Order & Payment Architecture */}
          <div style={{ position: 'sticky', top: '2rem' }}>
            <div className="card" style={{ border: '2px solid var(--secondary)' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck color="var(--accent)" /> Your Order
              </h2>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid var(--divider)', fontWeight: 600 }}>
                <span>Product</span>
                <span>Subtotal</span>
              </div>
              
              <div style={{ padding: '1rem 0', borderBottom: '1px solid var(--divider)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {cartItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>{item.name} <span style={{ color: 'var(--gray-dark)' }}>× {item.qty}</span></span>
                    <span style={{ fontWeight: 600 }}>${(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div style={{ padding: '1rem 0', borderBottom: '1px solid var(--divider)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: 600 }}>${subtotal.toFixed(2)}</span>
              </div>
              
              <div style={{ padding: '1rem 0', borderBottom: '1px solid var(--divider)', display: 'flex', justifyContent: 'space-between', color: 'var(--gray-dark)' }}>
                <span>Flat Rate Shipping</span>
                <span>${shipping.toFixed(2)}</span>
              </div>
              
              <div style={{ padding: '1.5rem 0', display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold' }}>
                <span>Total</span>
                <span style={{ color: 'var(--accent)' }}>${total.toFixed(2)}</span>
              </div>

              {/* Payment Method Selector Accordion */}
              <div style={{ marginTop: '1rem', backgroundColor: 'var(--gray-light)', borderRadius: 'var(--border-radius)', padding: '1rem' }}>
                
                {/* Direct Bank Transfer */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
                    <input type="radio" name="payment" value="bank" checked={paymentMethod === 'bank'} onChange={() => setPaymentMethod('bank')} style={{ accentColor: 'var(--accent)' }} /> 
                    Direct Bank Transfer
                  </label>
                  {paymentMethod === 'bank' && (
                    <div style={{ padding: '1rem', backgroundColor: 'var(--white)', marginTop: '0.5rem', borderRadius: 'var(--border-radius)', fontSize: '0.85rem', color: 'var(--gray-dark)', borderLeft: '3px solid var(--accent)' }}>
                      Make your payment directly into our bank account. Please use your Order ID as the payment reference. Your order will not be shipped until the funds have cleared in our account.
                    </div>
                  )}
                </div>

                {/* Check Payments */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
                    <input type="radio" name="payment" value="check" checked={paymentMethod === 'check'} onChange={() => setPaymentMethod('check')} style={{ accentColor: 'var(--accent)' }} /> 
                    Check Payments
                  </label>
                </div>

                {/* Cash on Delivery */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
                    <input type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} style={{ accentColor: 'var(--accent)' }} /> 
                    Cash on Delivery
                  </label>
                </div>

                {/* PayPal */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
                    <input type="radio" name="payment" value="paypal" checked={paymentMethod === 'paypal'} onChange={() => setPaymentMethod('paypal')} style={{ accentColor: 'var(--accent)' }} /> 
                    <CreditCard size={18} /> PayPal
                  </label>
                </div>
              </div>

              <div style={{ margin: '1.5rem 0' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" required style={{ marginTop: '0.2rem', accentColor: 'var(--accent)' }} /> 
                  <span>I have read and agree to the website <a href="#" style={{ color: 'var(--accent)' }}>terms and conditions</a> *</span>
                </label>
              </div>

              <button className="btn btn-accent" style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem' }}>
                Place Order
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.jsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  console.error("Missing Publishable Key: Please set VITE_CLERK_PUBLISHABLE_KEY in your environment variables.")
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {PUBLISHABLE_KEY ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ClerkProvider>
    ) : (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <h2 style={{ color: '#e53e3e' }}>Configuration Required</h2>
        <p>
          Missing <code>VITE_CLERK_PUBLISHABLE_KEY</code> in environment variables.
        </p>
        <p style={{ color: '#718096', fontSize: '0.9rem' }}>
          Please add <strong>VITE_CLERK_PUBLISHABLE_KEY</strong> to your Vercel project's Environment Variables and redeploy.
        </p>
      </div>
    )}
  </StrictMode>,
)


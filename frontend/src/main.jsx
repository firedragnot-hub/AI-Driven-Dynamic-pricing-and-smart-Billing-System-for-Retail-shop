import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.jsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const isValidClerkKey = PUBLISHABLE_KEY && PUBLISHABLE_KEY.startsWith('pk_') && !PUBLISHABLE_KEY.includes('...')

if (!isValidClerkKey) {
  console.warn("Clerk Publishable Key is missing or invalid. Clerk features will be disabled.")
}

const content = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isValidClerkKey ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        {content}
      </ClerkProvider>
    ) : (
      content
    )}
  </StrictMode>,
)


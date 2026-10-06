// This file is no longer needed - auth is handled by Clerk (customer portal)
// and the Render backend (owner portal). Kept as placeholder to prevent
// Vercel from creating a serverless function.
export default function handler(req, res) {
  res.status(404).json({ error: 'Not found' });
}

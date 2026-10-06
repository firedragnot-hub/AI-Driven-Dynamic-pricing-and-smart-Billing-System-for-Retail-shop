import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    // If you are developing locally, it uses localhost. On Vercel, it uses your deployed URL.
    baseURL: typeof window !== 'undefined' && window.location.hostname === 'localhost' 
        ? "http://localhost:5173" 
        : "https://ai-driven-dynamic-pricing-and-smart-billing-system-9ola10gaw.vercel.app"
});

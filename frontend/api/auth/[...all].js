import { betterAuth } from "better-auth";
import { dash } from "@better-auth/infra";
import { toNodeHandler } from "better-auth/node";

export const auth = betterAuth({
    // IMPORTANT: Vercel serverless functions are ephemeral. 
    // You MUST configure a real Postgres database (like Supabase) here for production.
    // We are using a dummy SQLite config just to allow the server to start and connect to the dashboard.
    database: {
        provider: "sqlite",
        url: "/tmp/auth.db" 
    },
    secret: process.env.BETTER_AUTH_SECRET || "your-random-secret-key-change-this",
    plugins: [
        dash()
    ]
});

export default toNodeHandler(auth);

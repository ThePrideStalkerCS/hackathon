import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import agents from "agents/vite";
import { defineConfig } from "vite";

// The Cloudflare Vite plugin runs the Worker (API + agent) and the React frontend together,
// both in `vite dev` and in the production build.
// agents() compiles the @callable() decorators of the agent (TC39 decorators, needed for Vite 8).
//
// `pnpm dev:offline` (OFFLINE=1): no connection to Cloudflare, so no login is needed. Everything
// works except the AI chat (Workers AI is remote). Handy for design work.
export default defineConfig({
	plugins: [agents(), react(), cloudflare({ remoteBindings: process.env.OFFLINE !== "1" })],
});

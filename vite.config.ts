import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import agents from "agents/vite";
import { defineConfig } from "vite";

// The Cloudflare Vite plugin runs the Worker (API + agent) and the React frontend together,
// both in `vite dev` and in the production build.
// agents() compiles the @callable() decorators of the agent (TC39 decorators, needed for Vite 8).
export default defineConfig({
	plugins: [agents(), react(), cloudflare()],
});

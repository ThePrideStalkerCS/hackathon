import { cloudflareTest } from "@cloudflare/vitest-plugin";
import agents from "agents/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		// Compiles the @callable() decorators in src/agent/citizen-assistant.ts
		agents(),
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			// Unit tests never call Workers AI: no remote connection, so they run offline and without a Cloudflare login.
			remoteBindings: false,
		}),
	],
});

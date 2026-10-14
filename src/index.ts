/**
 * Worker entry point – a Hono app (https://hono.dev).
 *
 *   /api/gov/*            Mock e-government REST API (src/gov/routes.ts)
 *   /api/voice/*          Text-to-speech / speech-to-text via ElevenLabs (src/voice/elevenlabs.ts)
 *   /api/address/*        Address suggestions + check via Google Maps (src/address/google.ts)
 *   /api/evals/chat       Non-streaming assistant endpoint for automated tests (evals/run.ts)
 *   /agents/*             WebSocket + HTTP endpoint of the chat agent (Agents SDK)
 *   everything else       React frontend (static assets, built by Vite)
 */
import { routeAgentRequest } from "agents";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { MODEL_ID } from "./config";
import { runAssistant } from "./agent/run-assistant";
import { GovError } from "./gov/errors";
import { govRoutes } from "./gov/routes";
import { voiceRoutes } from "./voice/elevenlabs";
import { addressRoutes } from "./address/google";

// The Durable Object class must be exported from the entry point.
export { CitizenAssistant } from "./agent/citizen-assistant";

const app = new Hono<{ Bindings: Env }>();

// Allow other tools of your team (e.g. a separate dashboard) to call the API. Tighten for production.
app.use("/api/*", cors());

app.get("/api/health", (c) => c.json({ status: "ok", model: MODEL_ID }));

app.route("/api/gov", govRoutes);

app.route("/api/voice", voiceRoutes);

app.route("/api/address", addressRoutes);

// Used by `pnpm evals`. Write tools (EVAL_STUBBED_TOOLS in src/agent/tools.ts) never execute here.
app.post("/api/evals/chat", async (c) => {
	const input = z
		.object({
			messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).min(1),
			settings: z
				.object({
					personaId: z.string().optional(),
					language: z.enum(["de", "en"]).optional(),
				})
				.optional(),
		})
		.safeParse(await c.req.json().catch(() => ({})));
	if (!input.success) throw new GovError(400, `Invalid body: ${input.error.message}`);
	return c.json(await runAssistant(c.env, input.data.messages, input.data.settings));
});

// Chat agent (WebSocket). The frontend connects with useAgent({ agent: "CitizenAssistant", name: <sessionId> }).
app.all("/agents/*", async (c) => (await routeAgentRequest(c.req.raw, c.env)) ?? c.text("Agent not found", 404));

app.notFound((c) => c.json({ error: "Not found" }, 404));

// Expected errors (bad input, unknown ids, simulated outages) become clean JSON responses.
app.onError((err, c) => {
	if (err instanceof GovError) return c.json({ error: err.message }, err.status);
	console.error("[unhandled error]", err);
	return c.json({ error: "Internal error", detail: err instanceof Error ? err.message : String(err) }, 500);
});

export default app;

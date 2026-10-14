/**
 * Central configuration: change the AI model and AI Gateway settings here.
 */
import { createWorkersAI } from "workers-ai-provider";

/**
 * 👉 EXTEND HERE: choose the Workers AI model.
 * It needs good German + tool calling. Model catalog: https://developers.cloudflare.com/workers-ai/models/
 * Worth comparing (run `pnpm evals` after switching):
 *   "@cf/zai-org/glm-4.7-flash"                 default: reliable multi-step tool calling, streams reasoning
 *   "@cf/meta/llama-4-scout-17b-16e-instruct"   often writes follow-up tool calls as plain text
 *                                                (e.g. "[get_my_profile()]") instead of calling them
 *
 * Want Claude / GPT (e.g. via your AWS Bedrock credits)? Route them through AI Gateway –
 * see "Switching models" in the README.
 */
export const MODEL_ID = "@cf/zai-org/glm-4.7-flash";

/**
 * AI Gateway logs every model call (prompt, response, latency, cost) – great for debugging and
 * for the "system logs" deliverable. "default" is created automatically on first use.
 * Set to "" to call Workers AI directly without the gateway.
 */
export const AI_GATEWAY_ID = "default";

/** Maximum number of model/tool steps per answer. */
export const MAX_STEPS = 8;

/** Display name of the assistant (used in the system prompt). 👉 EXTEND HERE: brand it! */
export const ASSISTANT_NAME = "Digital-Assistent 2030";

/** Returns the language model, routed through AI Gateway with optional log metadata. */
export function getModel(env: Env, metadata: Record<string, string> = {}) {
	const workersai = createWorkersAI({
		binding: env.AI,
		...(AI_GATEWAY_ID ? { gateway: { id: AI_GATEWAY_ID, metadata } } : {}),
	});
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return workersai(MODEL_ID as any);
}

/**
 * A secret that is empty or still the placeholder from .dev.vars.example ("your_…_here") counts as
 * missing, so the app falls back (browser voice, plain address field) instead of failing silently.
 */
export function realSecret(value: string | undefined): string | undefined {
	const v = value?.trim();
	return v && !/^your_|_here$/i.test(v) ? v : undefined;
}

/**
 * Non-streaming version of the assistant, used by the evaluation endpoint (/api/evals/chat).
 * Same model, system prompt and tools as the live chat – but write tools (EVAL_STUBBED_TOOLS) never execute.
 */
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { getModel, MAX_STEPS } from "../config";
import { DEFAULT_SETTINGS, type AssistantSettings } from "../shared/types";
import { routeIntent } from "./router";
import { buildSystemPrompt } from "./system-prompt";
import { buildTools } from "./tools";

export type EvalTurn = { role: "user" | "assistant"; content: string };

export async function runAssistant(env: Env, turns: EvalTurn[], partialSettings: Partial<AssistantSettings> = {}) {
	const settings = { ...DEFAULT_SETTINGS, ...partialSettings };
	const sessionId = `eval-${crypto.randomUUID().slice(0, 8)}`;
	const started = Date.now();

	const lastUserText = [...turns].reverse().find((t) => t.role === "user")?.content ?? "";
	const route = routeIntent(lastUserText, false, settings.language);

	const result = await generateText({
		model: getModel(env, { app: "gov-assistant-evals", session: sessionId, persona: settings.personaId }),
		system: buildSystemPrompt(settings, { route }),
		prepareStep: ({ stepNumber }) =>
			stepNumber === 0 && route.forceTool ? { toolChoice: { type: "tool", toolName: route.forceTool } } : undefined,
		messages: turns as ModelMessage[],
		tools: buildTools({ env, settings, sessionId, mode: "eval", replyLanguage: route.language }),
		stopWhen: stepCountIs(MAX_STEPS),
	});

	const toolCalls = result.steps.flatMap((step) =>
		step.toolCalls.map((call) => {
			const toolResult = step.toolResults.find((r) => r.toolCallId === call.toolCallId);
			return { tool: call.toolName, input: call.input, output: toolResult?.output };
		}),
	);

	return {
		sessionId,
		text: result.text,
		toolCalls,
		steps: result.steps.length,
		durationMs: Date.now() - started,
		usage: result.totalUsage,
	};
}

/**
 * The tools the AI assistant can use. Shared by the live chat agent and the evaluation endpoint
 * (/api/evals/chat), so tests exercise exactly the same logic.
 *
 * Design of this project (see docs/CORE.md):
 *   - The AI UNDERSTANDS (intent, dialect, free-text answers) and EXPLAINS (follow-up questions).
 *   - The walkthrough engine (src/walkthrough/) SHOWS the citizen the form step by step.
 *   - Only the CITIZEN submits or books, by pressing the confirm button. There is deliberately no
 *     submit/book tool: the model cannot take an administrative action, however it is prompted.
 *
 * Rule worth copying: `citizenId` comes from the session (the simulated ID Austria login),
 * NEVER from the model's input.
 *
 * Backend functions available for new tools (src/gov/service.ts):
 *   findServices, getServiceInfo, checkEligibility, getAppointmentSlots, createHandoff, …
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { AssistantSettings, Language } from "../shared/types";
import * as gov from "../gov/service";
import { SERVICES } from "../gov/data/services";
import { createMemoryHost, handoffSummary, type WalkthroughHost } from "../walkthrough/controller";
import { summarizeForModel } from "../walkthrough/engine";

export type ToolContext = {
	env: Env;
	settings: AssistantSettings;
	sessionId: string;
	/** "eval" replaces the tools in EVAL_STUBBED_TOOLS with stubs that never execute. */
	mode: "chat" | "eval";
	/** Holds the guided walkthrough. The chat agent passes itself; evals get an in-memory host. */
	walkthrough?: WalkthroughHost;
	/** Language of the citizen's latest message (src/agent/router.ts). */
	replyLanguage?: Language;
};

/** What the assistant says after opening a walkthrough. Fixed, so it is never wrong or in the wrong language. */
const START_SENTENCE: Record<Language, string> = {
	de: "Ihr Laufzettel ist geöffnet. Die Ämter füllen aus, was sie wissen.",
	en: "Your routing slip is open. The offices fill in what they know.",
};

/**
 * Tools that change something. In eval mode they are replaced by stubs, so `pnpm evals` can see
 * that the model TRIED to call them, but nothing is ever written.
 * (start_guided_walkthrough and fill_form_field are safe in evals: they use the in-memory host.)
 */
export const EVAL_STUBBED_TOOLS = ["request_human_help"];

const SERVICE_IDS = SERVICES.map((s) => s.id) as [string, ...string[]];

/** Turns backend errors into something the model can explain instead of crashing the turn. */
async function safe<T>(fn: () => Promise<T>) {
	try {
		return await fn();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { error: message, hint: "Tell the citizen briefly what went wrong in plain language and offer to try again or to talk to a person." };
	}
}

export function buildTools(ctx: ToolContext): ToolSet {
	const { env, settings } = ctx;
	const citizenId = settings.personaId; // from the session – never from the model
	const host = ctx.walkthrough ?? createMemoryHost(env, citizenId, settings.language);
	const lang = ctx.replyLanguage ?? settings.language;

	const tools: ToolSet = {
		get_my_profile: tool({
			description:
				"Get the logged-in citizen's profile: name, addresses, documents (with expiry status), household, residence status. Use it instead of asking for data you already have.",
			inputSchema: z.object({}),
			execute: async () => safe(() => gov.getCitizenProfile(env, citizenId)),
		}),

		find_services: tool({
			description:
				"Find the public service that matches what the citizen wants, from colloquial words (e.g. 'umzogn', 'Pass abgelaufen', 'baby'). Returns matching service ids.",
			inputSchema: z.object({ query: z.string().describe("Keywords from the citizen's message") }),
			execute: async ({ query }) => gov.findServices(query, settings.language),
		}),

		get_service_info: tool({
			description:
				"Official facts about a service (requirements, documents, authority) with the source URL. Use it before answering factual questions. If factsVerified is false, say the information is 'according to our documents' and may need checking.",
			inputSchema: z.object({ serviceId: z.enum(SERVICE_IDS) }),
			execute: async ({ serviceId }) => safe(async () => gov.getServiceInfo(serviceId, settings.language)),
		}),

		check_eligibility: tool({
			description: "Check whether the logged-in citizen can apply for a service and which documents or data are missing.",
			inputSchema: z.object({ serviceId: z.enum(SERVICE_IDS) }),
			execute: async ({ serviceId }) => safe(() => gov.checkEligibility(env, citizenId, serviceId)),
		}),

		start_guided_walkthrough: tool({
			description:
				"Start the visual step-by-step walkthrough: the citizen sees the official form being filled in, hears an explanation and only answers what you don't know. " +
				"Call it as soon as you know which service the citizen needs. For combined requests pass several service ids in a sensible order; they run one after another. " +
				"Only pass services the citizen actually asked for. Never use it for requests outside these services. " +
				"This does NOT submit anything – the citizen confirms at the end with a button.",
			inputSchema: z.object({
				serviceIds: z.array(z.enum(SERVICE_IDS)).min(1).max(3).describe("Services in the order they should be done"),
			}),
			execute: async ({ serviceIds }) =>
				safe(async () => {
					const w = await host.startServices(serviceIds, lang);
					return {
						started: summarizeForModel(w),
						queuedAfterwards: host.getServiceQueue(),
						say: START_SENTENCE[lang],
						note: "The citizen now sees the form and hears the narration of each step. Reply with exactly the sentence in `say`, nothing else.",
					};
				}),
		}),

		fill_form_field: tool({
			description:
				"Fill a field of the active walkthrough form with what the citizen just said (e.g. 'I moved in on the 1st' -> move_in_date 2026-11-01). " +
				"Normalize: dates as YYYY-MM-DD, select fields with the option value, yes/no fields with 'yes' or 'no'. Only for the active walkthrough. Never invent values.",
			inputSchema: z.object({
				fieldId: z.string().describe("Field id from the current walkthrough, e.g. new_address"),
				value: z.string().describe("Normalized value"),
			}),
			execute: async ({ fieldId, value }) =>
				safe(async () => {
					if (!host.getWalkthrough()) return { ok: false, problem: "No walkthrough is active. Start one first." };
					const result = await host.fillField(fieldId, value);
					return { ok: result.ok, problem: result.problem, walkthrough: summarizeForModel(result.walkthrough) };
				}),
		}),

		request_human_help: tool({
			description:
				"Create a ticket so a human case worker calls the citizen back. Use it when the citizen asks for a person, is stuck or frustrated, or the case is unusual (e.g. special residence status). The case worker sees where the citizen stopped.",
			inputSchema: z.object({
				reason: z.string().describe("Short reason, in English"),
				summary: z.string().describe("What the citizen wants and what is unclear, in English"),
			}),
			execute: async ({ reason, summary }) =>
				gov.createHandoff(
					env,
					{ citizenId, sessionId: ctx.sessionId, reason, summary: `${summary}\n\n${handoffSummary(host.getWalkthrough())}` },
					settings.language,
				),
		}),
	};

	if (ctx.mode === "eval") {
		for (const name of EVAL_STUBBED_TOOLS) {
			const original = tools[name];
			if (!original) continue;
			tools[name] = tool({
				description: original.description,
				inputSchema: original.inputSchema,
				execute: async () => ({ status: "not_executed", note: "Eval mode: nothing was submitted or booked." }),
			});
		}
	}
	return tools;
}

/**
 * The tools the AI assistant can use. Each tool calls the mock government backend.
 *
 * Shared by the live chat agent and the evaluation endpoint (/api/evals/chat), so tests
 * exercise exactly the same logic.
 *
 * Rules (see AGENTS.md):
 *  - `citizenId` comes from the session (the simulated ID Austria login), NEVER from the model's input.
 *  - Anything the model passes as an `applicationId` is checked to belong to the logged-in citizen.
 *  - Write tools need the citizen's approval (`needsApproval`) and are listed in EVAL_STUBBED_TOOLS.
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { AssistantSettings } from "../shared/types";
import { dbGetApplication, dbGetSlot, ensureSeeded } from "../gov/db";
import { GovError } from "../gov/errors";
import * as gov from "../gov/service";
import { buildTutorial } from "./tutorial";

export type ToolContext = {
	env: Env;
	settings: AssistantSettings;
	sessionId: string;
	/** "eval" replaces the tools in EVAL_STUBBED_TOOLS with stubs that never execute. */
	mode: "chat" | "eval";
};

/**
 * Tools that change something (submit, book, …). In eval mode they are replaced by stubs, so
 * `pnpm evals` can see that the model TRIED to call them, but nothing is ever written.
 */
export const EVAL_STUBBED_TOOLS = [
	"start_application",
	"update_application",
	"submit_application",
	"book_appointment",
	"request_human_handoff",
];

/** Form values the model may send. Booleans are converted to "yes"/"no" by the backend. */
const formData = z.record(z.string(), z.union([z.string(), z.boolean()]));

/**
 * Expected backend errors (unknown id, validation, simulated outage) become a normal tool result
 * with an `error` field, so the model can explain it to the citizen instead of crashing the turn.
 */
async function safe<T>(fn: () => Promise<T> | T): Promise<T | { error: string }> {
	try {
		return await fn();
	} catch (err) {
		if (err instanceof GovError) return { error: err.message };
		throw err;
	}
}

/** "2026-10-20T09:30" (Vienna local time) -> "Di., 20.10.2026, 09:30" / "Tue, 20 Oct 2026, 09:30". */
function formatSlotTime(slotTime: string, lang: "de" | "en"): string {
	// The string is already local Vienna time, so we format it as if it were UTC to avoid any shift.
	const date = new Date(`${slotTime}:00Z`);
	return new Intl.DateTimeFormat(lang === "de" ? "de-AT" : "en-GB", {
		timeZone: "UTC",
		weekday: "short",
		day: "2-digit",
		month: lang === "de" ? "2-digit" : "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

export function buildTools(ctx: ToolContext): ToolSet {
	const { env, settings } = ctx;
	const citizenId = settings.personaId; // from the session – never from the model
	const lang = settings.language;

	/** The model could pass any application id. Only allow the logged-in citizen's own applications. */
	async function requireOwnApplication(applicationId: string) {
		await ensureSeeded(env.GOV_DB);
		const app = await dbGetApplication(env.GOV_DB, applicationId);
		// Same error for "missing" and "belongs to someone else", so nothing leaks.
		if (!app || app.citizenId !== citizenId) throw new GovError(404, `Unknown application "${applicationId}"`);
		return app;
	}

	const tools: ToolSet = {
		// ---------------------------------------------------------------------------------------
		// Read tools
		// ---------------------------------------------------------------------------------------
		get_my_profile: tool({
			description:
				"Get the logged-in citizen's profile: name, addresses, documents (with expiry status), household, residence status. Use it instead of asking for data you already have.",
			inputSchema: z.object({}),
			execute: async () => safe(() => gov.getCitizenProfile(env, citizenId)),
		}),

		find_services: tool({
			description:
				"Find which public service fits the citizen's request (keyword search, works with German and English, dialect and typos are only partly handled). Returns service ids to use with the other tools.",
			inputSchema: z.object({ query: z.string().describe("The citizen's request in a few keywords, e.g. 'umzug' or 'passport expired'") }),
			execute: async ({ query }) => safe(() => gov.findServices(query, lang)),
		}),

		get_service_info: tool({
			description:
				"Get the official facts for a service (what is needed, who is responsible), the form fields, next steps and the SOURCE URL. Base every factual answer on this and name the source. If factsVerified is false, tell the citizen the information is not yet verified.",
			inputSchema: z.object({ serviceId: z.string() }),
			execute: async ({ serviceId }) => safe(() => gov.getServiceInfo(serviceId, lang)),
		}),

		check_my_eligibility: tool({
			description:
				"Check whether the logged-in citizen can use a service and which documents or data are missing for them. Call it before starting an application.",
			inputSchema: z.object({ serviceId: z.string() }),
			execute: async ({ serviceId }) => safe(() => gov.checkEligibility(env, citizenId, serviceId)),
		}),

		get_appointment_slots: tool({
			description:
				"List the free appointment slots for a service (only passport-renewal has slots). Each slot has a number (`option`), a readable `label`, the office and a slotId. Show ALL returned slots to the citizen as a numbered list (label + office) and ask which one they want. Never book before the citizen has chosen.",
			inputSchema: z.object({ serviceId: z.string(), limit: z.number().int().min(1).max(10).optional() }),
			execute: async ({ serviceId, limit }) =>
				safe(async () => {
					const result = await gov.getAppointmentSlots(env, serviceId, limit ?? 6);
					return {
						...result,
						slots: result.slots.map((s, i) => ({ option: i + 1, label: formatSlotTime(s.slotTime, lang), office: s.office, slotId: s.id })),
					};
				}),
		}),

		get_application: tool({
			description: "Look up one of the citizen's own applications: status, entered data and what is still missing.",
			inputSchema: z.object({ applicationId: z.string() }),
			execute: async ({ applicationId }) =>
				safe(async () => {
					await requireOwnApplication(applicationId);
					return gov.getApplication(env, applicationId, lang);
				}),
		}),

		// ---------------------------------------------------------------------------------------
		// Tutorial
		// ---------------------------------------------------------------------------------------
		create_tutorial: tool({
			description:
				"Create a short step-by-step video-style tutorial for a service (narrated slides that the chat plays). Use it when the citizen asks 'how does it work', 'explain', 'show me' or 'tutorial'. The scenes are built from verified backend data and the citizen's own situation. After the call, introduce the tutorial in ONE or TWO sentences. Do not repeat the scene content in your answer.",
			inputSchema: z.object({
				serviceId: z.string(),
				language: z.enum(["de", "en"]).optional().describe("Tutorial language. Set it to the language the citizen writes in."),
			}),
			execute: async ({ serviceId, language }) =>
				safe(async () => {
					// Personalise with the citizen's own eligibility result. A backend outage must not block the tutorial.
					const eligibility = await gov.checkEligibility(env, citizenId, serviceId).catch(() => null);
					return buildTutorial({ serviceId, lang: language ?? lang, eligibility });
				}),
		}),

		// ---------------------------------------------------------------------------------------
		// Write tools (listed in EVAL_STUBBED_TOOLS)
		// ---------------------------------------------------------------------------------------
		start_application: tool({
			description:
				"Create a draft application, pre-filled from the citizen's profile (or continue the existing draft). It only creates a draft and submits nothing. Pass any values the citizen already told you in `data` (field ids from get_service_info).",
			inputSchema: z.object({ serviceId: z.string(), data: formData.optional() }),
			execute: async ({ serviceId, data }) => safe(() => gov.startApplication(env, citizenId, serviceId, data ?? {}, lang)),
		}),

		update_application: tool({
			description:
				"Add or correct values in the citizen's draft. Returns what is still missing. Only use values the citizen actually gave you; never guess.",
			inputSchema: z.object({ applicationId: z.string(), data: formData }),
			execute: async ({ applicationId, data }) =>
				safe(async () => {
					await requireOwnApplication(applicationId);
					return gov.updateApplication(env, applicationId, data, lang);
				}),
		}),

		submit_application: tool({
			description:
				"Submit a COMPLETE draft (readyToSubmit = true). The citizen must approve first. Before calling, summarise the entered data to the citizen. Never claim to have submitted unless this returned a reference number.",
			inputSchema: z.object({ applicationId: z.string() }),
			needsApproval: true,
			execute: async ({ applicationId }) =>
				safe(async () => {
					await requireOwnApplication(applicationId);
					return gov.submitApplication(env, applicationId, lang);
				}),
		}),

		book_appointment: tool({
			description:
				"Book the slot the citizen CHOSE. Only call it after get_appointment_slots was shown and the citizen picked one (by number, date or time). Use the slotId of exactly that option, never guess or invent a slotId. If the choice is unclear, ask again. Never claim to have booked unless this returned a reference number.",
			inputSchema: z.object({ slotId: z.string().describe("slotId of the option the citizen chose, copied from get_appointment_slots") }),
			execute: async ({ slotId }) =>
				safe(async () => {
					// Server-side guard: only book if this citizen is eligible for the slot's service.
					await ensureSeeded(env.GOV_DB);
					const slot = await dbGetSlot(env.GOV_DB, slotId);
					if (slot) {
						const eligibility = await gov.checkEligibility(env, citizenId, slot.serviceId);
						if (!eligibility.eligible) return { error: `Not eligible for this service: ${eligibility.reasons.join(" ")}` };
					}
					const booking = await gov.bookAppointment(env, citizenId, slotId, lang);
					return { ...booking, label: slot ? formatSlotTime(slot.slotTime, lang) : booking.slotTime };
				}),
		}),

		request_human_handoff: tool({
			description:
				"Create a callback ticket for a human case worker. Use it when the citizen asks for a person, is stuck or upset, the case is complicated (e.g. unusual residency status), or the backend keeps failing. Write the summary so the case worker does not have to ask again.",
			inputSchema: z.object({
				reason: z.string().describe("Why a human is needed, one sentence"),
				summary: z.string().describe("What the citizen wanted and what was already done"),
				preferredChannel: z.enum(["phone", "office"]).optional(),
			}),
			execute: async ({ reason, summary, preferredChannel }) =>
				safe(() =>
					gov.createHandoff(env, { citizenId, sessionId: ctx.sessionId, reason, summary, preferredChannel: preferredChannel ?? null }, lang),
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
				execute: async () => ({ status: "not_executed", note: "Eval mode: nothing was submitted, booked or saved." }),
			});
		}
	}
	return tools;
}

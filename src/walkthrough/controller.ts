/**
 * Connects the pure walkthrough engine (./engine.ts) to the mock backend (src/gov/service.ts).
 *
 * Two hosts implement the same interface:
 *   - the chat agent (src/agent/citizen-assistant.ts): persists the walkthrough in the agent state,
 *     which is synced live to the browser
 *   - createMemoryHost() below: used by the evals, keeps everything in memory and never writes
 *     to the database
 *
 * Rule: nothing here submits or books on behalf of the AI. `submitWalkthrough` is only called by
 * the agent's `submit` callable, i.e. by the citizen pressing "Yes, submit".
 */
import type { Language } from "../shared/types";
import type { QueuedService, SubmissionSummary, Walkthrough } from "../shared/walkthrough";
import { openConfirmation } from "../gov/data/confirmations";
import { nearbyFirst } from "../gov/data/offices";
import { getServiceDefinition } from "../gov/data/services";
import { GovError } from "../gov/errors";
import * as gov from "../gov/service";
import { getKnowledge } from "../knowledge";
import * as engine from "./engine";
import { getGuide, phrase } from "./guides";

/** What the AI tools need from whoever holds the walkthrough. */
export interface WalkthroughHost {
	getWalkthrough(): Walkthrough | null;
	getServiceQueue(): QueuedService[];
	/** Starts the first service now, queues the rest (combined requests). */
	startServices(serviceIds: string[], language?: Language): Promise<Walkthrough>;
	/** Fills a field of the active walkthrough (citizen said the answer in words). */
	fillField(fieldId: string, value: string): Promise<engine.AnswerResult>;
}

function requireDefinition(serviceId: string) {
	const def = getServiceDefinition(serviceId);
	if (!def) throw new GovError(404, `Unknown service "${serviceId}"`);
	return def;
}

/**
 * Loads everything a walkthrough needs and builds it.
 * persist = true creates (or reuses) a draft application in the backend.
 */
export async function createWalkthrough(env: Env, citizenId: string, serviceId: string, lang: Language, persist: boolean): Promise<Walkthrough> {
	const def = requireDefinition(serviceId);
	const citizen = await gov.getCitizenProfile(env, citizenId);
	const eligibility = await gov.checkEligibility(env, citizenId, serviceId);
	const today = gov.today();
	const slots = def.requiresAppointment ? nearbyFirst((await gov.getAppointmentSlots(env, serviceId, 40)).slots, citizen.primaryAddress, 6) : [];

	const profileData = def.prefill(citizen, today);
	const confirmation = openConfirmation(citizen, serviceId);
	const confirmedData = Object.fromEntries(Object.entries(confirmation?.data(today) ?? {}).filter(([id]) => !profileData[id]));
	const suggested: Record<string, string> = {};
	for (const [fieldId, fg] of Object.entries(getGuide(serviceId)?.fields ?? {})) {
		const value = fg.suggest?.(citizen, today);
		if (value && !profileData[fieldId] && !confirmedData[fieldId]) suggested[fieldId] = value;
	}

	let data: Record<string, string> = { ...profileData, ...confirmedData, ...suggested };
	let applicationId: string | null = null;
	if (persist && eligibility.eligible) {
		const draft = await gov.startApplication(env, citizenId, serviceId, { ...confirmedData, ...suggested }, lang);
		applicationId = draft.applicationId;
		data = draft.data;
	}

	const knowledge = getKnowledge(serviceId);
	return engine.buildWalkthrough({
		def,
		citizen,
		eligibility,
		data,
		profileKeys: Object.keys(profileData),
		assistantKeys: Object.keys(suggested),
		confirmed: confirmation && {
			keys: Object.keys(confirmedData),
			name: confirmation.by.name,
			role: confirmation.by.role[lang],
			yourRole: confirmation.by.yourRole[lang],
		},
		slots,
		applicationId,
		lang,
		sourceUrl: knowledge?.sourceUrl ?? null,
		factsVerified: knowledge?.verified ?? false,
	});
}

/**
 * What a slip will look like before it is opened (desk card): rows in total, rows the offices fill
 * (check + autofill), questions for the citizen (ask + appointment). Null if the citizen cannot apply.
 * Counts the same step kinds as the slip rows in frontend/laufzettel/stations.ts.
 */
export async function previewSlip(env: Env, citizenId: string, serviceId: string, lang: Language): Promise<{ rows: number; byOffices: number; questions: number } | null> {
	const w = await createWalkthrough(env, citizenId, serviceId, lang, false);
	if (w.status === "blocked" || w.steps.some((s) => s.kind === "blocked")) return null;
	const count = (...kinds: string[]) => w.steps.filter((s) => kinds.includes(s.kind)).length;
	return { rows: count("check", "autofill", "ask", "appointment", "review"), byOffices: count("check", "autofill"), questions: count("ask", "appointment") };
}

/** Rebuilds the walkthrough in another language and keeps the citizen's progress (not after submitting). */
export async function relocalize(env: Env, citizenId: string, w: Walkthrough, lang: Language): Promise<Walkthrough> {
	if (w.language === lang || w.result) return w;
	const fresh = await createWalkthrough(env, citizenId, w.serviceId, lang, Boolean(w.applicationId));
	return engine.carryProgress(fresh, w);
}

/** Sets a field locally, then saves it to the draft. A failed save is not fatal: submit saves everything again. */
export async function answerAndSave(env: Env, w: Walkthrough, fieldId: string, value: string | boolean, source: "citizen" | "assistant"): Promise<engine.AnswerResult> {
	const def = requireDefinition(w.serviceId);
	const result = engine.answerField(w, def, fieldId, value, source, gov.validateApplicationData);
	if (!result.ok || !w.applicationId) return result;
	const saved = result.walkthrough.fields.find((f) => f.id === fieldId)?.value;
	if (!saved) return result;
	try {
		await gov.updateApplication(env, w.applicationId, { [fieldId]: saved }, w.language);
		return { ...result, walkthrough: engine.withError(result.walkthrough, undefined) };
	} catch (err) {
		console.warn("[walkthrough] saving draft failed, will retry on submit", err);
		return result;
	}
}

/**
 * Submits the application (and books the chosen appointment). ONLY called after the citizen
 * pressed the confirm button. The backend validates again – the AI is never trusted with that.
 */
export async function submitWalkthrough(env: Env, citizenId: string, w: Walkthrough): Promise<Walkthrough> {
	if (w.status !== "review" || !w.applicationId) return w;
	const lang = w.language;
	try {
		// Save everything once more (earlier saves may have failed during an outage).
		const view = await gov.updateApplication(env, w.applicationId, engine.formData(w), lang);
		if (!view.readyToSubmit) return engine.withError(engine.applyBackendProblems(w, view.missingOrInvalid), phrase("reviewProblems", lang));

		let appointment: SubmissionSummary["appointment"];
		if (w.selectedSlot) {
			try {
				const booking = await gov.bookAppointment(env, citizenId, w.selectedSlot.id, lang);
				appointment = { office: booking.office, slotTime: booking.slotTime, referenceNumber: booking.referenceNumber };
			} catch (err) {
				if (err instanceof GovError && err.status === 409) {
					// Slot gone: send the citizen back to the appointment step with fresh slots.
					const citizen = await gov.getCitizenProfile(env, citizenId);
					const fresh = nearbyFirst((await gov.getAppointmentSlots(env, w.serviceId, 40)).slots, citizen.primaryAddress, 6);
					const next = structuredClone(w);
					const i = next.steps.findIndex((s) => s.kind === "appointment");
					next.steps[i] = { ...next.steps[i], slots: fresh, done: false };
					delete next.selectedSlot;
					next.current = i;
					return engine.withError(next, phrase("slotTaken", lang));
				}
				throw err;
			}
		}

		const result = await gov.submitApplication(env, w.applicationId, lang);
		return engine.markSubmitted(w, {
			referenceNumber: result.referenceNumber!,
			authority: result.authority,
			submittedAt: result.submittedAt!,
			nextSteps: result.nextSteps,
			appointment,
		});
	} catch (err) {
		console.error("[walkthrough] submit failed", err);
		if (err instanceof GovError && err.status === 400) return engine.withError(w, phrase("reviewProblems", lang));
		return engine.withError(w, phrase("outage", lang));
	}
}

/** Builds the summary a human case worker sees when the citizen asks for help mid-walkthrough. */
export function handoffSummary(w: Walkthrough | null): string {
	if (!w) return "No guided walkthrough active.";
	const step = w.steps[w.current];
	const filled = w.fields.filter((f) => f.value).map((f) => `${f.label}: ${f.displayValue ?? f.value}`);
	const problems = w.fields.filter((f) => f.problem).map((f) => `${f.label}: ${f.problem}`);
	return [
		`Service: ${w.serviceName} (${w.serviceId}), status: ${w.status}`,
		`Stopped at step ${w.current + 1}/${w.steps.length}: ${step?.title ?? "-"}`,
		filled.length ? `Filled: ${filled.join("; ")}` : "Nothing filled yet",
		problems.length ? `Problems: ${problems.join("; ")}` : "",
		w.applicationId ? `Draft application: ${w.applicationId}` : "",
	]
		.filter(Boolean)
		.join("\n");
}

/** In-memory host for the evals: same logic, nothing is written to the database. */
export function createMemoryHost(env: Env, citizenId: string, lang: Language): WalkthroughHost {
	let walkthrough: Walkthrough | null = null;
	let queue: QueuedService[] = [];
	return {
		getWalkthrough: () => walkthrough,
		getServiceQueue: () => queue,
		async startServices(serviceIds, language = lang) {
			const [first, ...rest] = serviceIds;
			walkthrough = await createWalkthrough(env, citizenId, first, language, false);
			queue = rest.map((id) => ({ serviceId: id, name: getServiceDefinition(id)?.name[language] ?? id }));
			return walkthrough;
		},
		async fillField(fieldId, value) {
			if (!walkthrough) return { walkthrough: null as never, ok: false, problem: "No walkthrough active." };
			const result = engine.answerField(walkthrough, requireDefinition(walkthrough.serviceId), fieldId, value, "assistant", gov.validateApplicationData);
			walkthrough = result.walkthrough;
			return result;
		},
	};
}

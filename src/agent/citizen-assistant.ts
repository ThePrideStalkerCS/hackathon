/**
 * The agent. One instance (a Durable Object with its own SQLite) per browser session.
 *
 * It does two jobs:
 *   1. Chat (onChatMessage): understands what the citizen says or types, starts walkthroughs,
 *      fills fields from spoken answers, explains. Streams to the browser.
 *   2. Walkthrough host: keeps the guided walkthrough in its state. The state is synced live to the
 *      browser, which renders the portal page, the coach card and the progress bar from it.
 *      The browser changes it ONLY through the @callable() methods below (agent.call("answer", …)).
 *
 * Docs: https://developers.cloudflare.com/agents/  (callable methods: node_modules/agents/docs/callable-methods.md)
 */
import { AIChatAgent } from "@cloudflare/ai-chat";
import { callable, type Connection } from "agents";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, pruneMessages, stepCountIs, streamText } from "ai";
import { getModel, MAX_STEPS } from "../config";
import { DEFAULT_STATE, type AssistantSettings, type AssistantState, type Language } from "../shared/types";
import type { Suggestion, Walkthrough } from "../shared/walkthrough";
import { PERSONAS } from "../gov/data/personas";
import { getServiceDefinition } from "../gov/data/services";
import { dbListApplications } from "../gov/db";
import * as gov from "../gov/service";
import * as engine from "../walkthrough/engine";
import { answerAndSave, createWalkthrough, handoffSummary, submitWalkthrough, type WalkthroughHost } from "../walkthrough/controller";
import { getSuggestions as proactiveSuggestions } from "../walkthrough/proactive";
import { routeIntent } from "./router";
import { buildSystemPrompt } from "./system-prompt";
import { buildTools } from "./tools";

export class CitizenAssistant extends AIChatAgent<Env, AssistantState> implements WalkthroughHost {
	initialState: AssistantState = DEFAULT_STATE;

	/** State with defaults (sessions created before a new field was added still work). */
	private get st(): AssistantState {
		return { ...DEFAULT_STATE, ...this.state };
	}

	/** Only the server may change the state. Clients use the callables below. */
	validateStateChange(next: AssistantState, source: Connection | "server") {
		if (source !== "server") throw new Error("State is server-controlled. Use the callable methods.");
		if (!PERSONAS.some((p) => p.id === next.personaId)) throw new Error(`Unknown persona ${next.personaId}`);
		if (next.language !== "de" && next.language !== "en") throw new Error("language must be de or en");
	}

	private setWalkthrough(walkthrough: Walkthrough | null, patch: Partial<AssistantState> = {}) {
		this.setState({ ...this.st, ...patch, walkthrough });
	}

	// -------------------------------------------------------------------------------------------
	// Chat
	// -------------------------------------------------------------------------------------------

	async onChatMessage() {
		const settings = this.st;
		const citizen = await gov.getCitizenProfile(this.env, settings.personaId).catch(() => null);
		const lastUserText = [...this.messages]
			.reverse()
			.find((m) => m.role === "user")
			?.parts.flatMap((p) => (p.type === "text" ? [p.text] : []))
			.join(" ") ?? "";
		let w = settings.walkthrough;
		const route = routeIntent(lastUserText, Boolean(w && w.status !== "submitted" && w.status !== "blocked"), settings.language);

		// Deterministic first: if the walkthrough waits for a date / yes-no / choice and the message
		// contains it, enter it directly. The model only acknowledges (and can't claim a fill that didn't happen).
		let autoFilled: { fieldId: string; value: string; ok: boolean; problem?: string } | undefined;
		const step = w?.steps[w.current];
		const field = step?.kind === "ask" && step.fieldId ? w?.fields.find((f) => f.id === step.fieldId) : undefined;
		const extracted = field ? engine.extractAnswer(field, lastUserText, gov.today()) : null;
		if (w && field && extracted) {
			const result = await answerAndSave(this.env, w, field.id, extracted, "citizen");
			this.setWalkthrough(result.walkthrough);
			w = result.walkthrough;
			autoFilled = { fieldId: field.id, value: extracted, ok: result.ok, problem: result.problem };

			// Short, clear answer ("am 1. Oktober", "jo", "Hauptwohnsitz"): no need to ask the model at all.
			// The walkthrough moves on and narrates the next question; we just confirm. Fast and never wrong.
			if (result.ok && lastUserText.trim().split(/\s+/).length <= 8) {
				const shown = result.walkthrough.fields.find((f) => f.id === field.id)?.displayValue ?? extracted;
				return fixedReply(settings.language === "de" ? `Danke, eingetragen: ${shown}.` : `Thanks, entered: ${shown}.`);
			}
		}

		const result = streamText({
			// Metadata shows up in AI Gateway logs – filter by session or persona when debugging.
			model: getModel(this.env, { app: "gov-assistant", session: this.name, persona: settings.personaId }),
			system: buildSystemPrompt(settings, { walkthrough: w, queue: settings.queue, citizen, route, autoFilled }),
			// Clear request → open the walkthrough; question about own data → look at the profile (see router.ts).
			prepareStep: ({ stepNumber }) =>
				stepNumber === 0 && route.forceTool ? { toolChoice: { type: "tool", toolName: route.forceTool } } : undefined,
			messages: pruneMessages({
				messages: await convertToModelMessages(this.messages),
				toolCalls: "before-last-2-messages",
			}),
			tools: buildTools({ env: this.env, settings, sessionId: this.name, mode: "chat", walkthrough: this, replyLanguage: route.language }),
			stopWhen: stepCountIs(MAX_STEPS),
			onError: ({ error }) => console.error("[agent error]", error),
		});

		return result.toUIMessageStreamResponse();
	}

	// -------------------------------------------------------------------------------------------
	// WalkthroughHost (used by the AI tools)
	// -------------------------------------------------------------------------------------------

	getWalkthrough() {
		return this.st.walkthrough;
	}

	getServiceQueue() {
		return this.st.queue;
	}

	/** Starts the first service, queues the rest. `language`: the language the citizen speaks (the UI follows it). */
	async startServices(serviceIds: string[], language: Language = this.st.language) {
		const { personaId } = this.st;
		const [first, ...rest] = serviceIds;
		const walkthrough = await createWalkthrough(this.env, personaId, first, language, true);
		const queue = rest.map((id) => ({ serviceId: id, name: getServiceDefinition(id)?.name[language] ?? id }));
		this.setWalkthrough(walkthrough, { queue, language });
		return walkthrough;
	}

	async fillField(fieldId: string, value: string) {
		const w = this.st.walkthrough;
		if (!w) throw new Error("No walkthrough active");
		const result = await answerAndSave(this.env, w, fieldId, value, "assistant");
		this.setWalkthrough(result.walkthrough);
		return result;
	}

	// -------------------------------------------------------------------------------------------
	// Callables (the browser drives the walkthrough with these)
	// -------------------------------------------------------------------------------------------

	@callable({ description: "Change persona or language. Switching persona closes the walkthrough." })
	updateSettings(patch: Partial<AssistantSettings>) {
		const current = this.st;
		const next = { ...current, ...patch };
		const personaChanged = next.personaId !== current.personaId;
		this.setState({ ...next, ...(personaChanged ? { walkthrough: null, queue: [] } : {}) });
		return this.st;
	}

	@callable({ description: "Proactive suggestions for the logged-in citizen (expired documents, new baby, …)" })
	async getSuggestions(): Promise<Suggestion[]> {
		const { personaId, language } = this.st;
		const citizen = await gov.getCitizenProfile(this.env, personaId);
		const submitted = (await dbListApplications(this.env.GOV_DB, personaId)).filter((a) => a.status === "submitted").map((a) => a.serviceId);
		return proactiveSuggestions(citizen, gov.today(), language, submitted);
	}

	@callable({ description: "Start a walkthrough directly (e.g. from a suggestion card), without the AI" })
	async startWalkthrough(serviceId: string) {
		await this.startServices([serviceId]);
	}

	@callable({ description: "A step that plays automatically has finished (narration over)" })
	advance(fromIndex: number) {
		const w = this.st.walkthrough;
		if (w) this.setWalkthrough(engine.advance(w, fromIndex));
	}

	@callable()
	back() {
		const w = this.st.walkthrough;
		if (w) this.setWalkthrough(engine.back(w));
	}

	@callable()
	goTo(index: number) {
		const w = this.st.walkthrough;
		if (w) this.setWalkthrough(engine.goTo(w, index));
	}

	@callable({ description: "The citizen answered the current question in the UI" })
	async answer(fieldId: string, value: string | boolean) {
		const w = this.st.walkthrough;
		if (!w) return { ok: false, problem: "No walkthrough active" };
		const result = await answerAndSave(this.env, w, fieldId, value, "citizen");
		this.setWalkthrough(result.walkthrough);
		return { ok: result.ok, problem: result.problem };
	}

	@callable({ description: "Turn a filled field back into a question" })
	editField(fieldId: string) {
		const w = this.st.walkthrough;
		if (w) this.setWalkthrough(engine.editField(w, fieldId));
	}

	@callable()
	chooseSlot(slotId: string) {
		const w = this.st.walkthrough;
		if (w) this.setWalkthrough(engine.chooseSlot(w, slotId));
	}

	/**
	 * The ONLY way an application is submitted (and an appointment booked): the citizen pressed
	 * "Yes, submit like this" on the review step. The AI has no tool that leads here.
	 */
	@callable({ description: "The citizen confirmed the review step" })
	async submit() {
		const w = this.st.walkthrough;
		if (!w || w.status !== "review") return;
		this.setWalkthrough({ ...w, status: "submitting" });
		this.setWalkthrough(await submitWalkthrough(this.env, this.st.personaId, w));
	}

	@callable({ description: "Close the walkthrough (cancel or finished)" })
	closeWalkthrough() {
		this.setWalkthrough(null);
	}

	@callable({ description: "Start the next queued service of a combined request" })
	async startNext() {
		const [next, ...rest] = this.st.queue;
		if (!next) return this.setWalkthrough(null);
		const { personaId, language } = this.st;
		const walkthrough = await createWalkthrough(this.env, personaId, next.serviceId, language, true);
		this.setWalkthrough(walkthrough, { queue: rest });
	}

	@callable({ description: "Citizen pressed 'Talk to a person'" })
	async requestHuman(reason: string) {
		const { personaId, language, walkthrough } = this.st;
		const lastWords = this.messages
			.filter((m) => m.role === "user")
			.slice(-3)
			.flatMap((m) => m.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text));
		return gov.createHandoff(
			this.env,
			{
				citizenId: personaId,
				sessionId: this.name,
				reason: reason || "Citizen asked for a person",
				summary: [handoffSummary(walkthrough), lastWords.length ? `Last messages: ${lastWords.join(" | ")}` : ""].filter(Boolean).join("\n"),
			},
			language,
		);
	}
}

/** A chat answer that doesn't come from the model (same stream format the frontend expects). */
function fixedReply(text: string): Response {
	const id = crypto.randomUUID();
	const stream = createUIMessageStream({
		execute: ({ writer }) => {
			writer.write({ type: "text-start", id });
			writer.write({ type: "text-delta", id, delta: text });
			writer.write({ type: "text-end", id });
		},
	});
	return createUIMessageStreamResponse({ stream });
}

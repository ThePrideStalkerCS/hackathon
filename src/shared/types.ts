/**
 * Types shared between the Worker (server) and the React frontend.
 * Keep this file free of runtime dependencies so both sides can import it.
 */
import type { QueuedService, Walkthrough } from "./walkthrough";

export type Language = "de" | "en";

/** Settings the frontend syncs to the chat agent (via Agent state). */
export type AssistantSettings = {
	/** Which synthetic citizen is "logged in" (simulated ID Austria login). */
	personaId: string;
	/** Default reply language. The agent still answers in the language the citizen writes in. */
	language: Language;
};

export const DEFAULT_SETTINGS: AssistantSettings = {
	personaId: "lena-huber",
	// The showcase runs in English; citizens switch to German (or back) in the top bar.
	language: "en",
};

/**
 * Full agent state, synced to the browser. Only the server changes it: the frontend changes
 * settings through the `updateSettings` callable and drives the walkthrough through callables
 * (see src/agent/citizen-assistant.ts), never with `setState`.
 */
export type AssistantState = AssistantSettings & {
	walkthrough: Walkthrough | null;
	queue: QueuedService[];
};

export const DEFAULT_STATE: AssistantState = {
	...DEFAULT_SETTINGS,
	walkthrough: null,
	queue: [],
};

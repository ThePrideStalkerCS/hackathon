/** Small helpers for calling the Worker's REST API from the browser. */
import type { Language } from "../src/shared/types";

export type Persona = { id: string; name: string; preferredLanguage: Language; scenarioHint: string };

export type HandoffResult = {
	type: "handoff_result";
	ticketId: string;
	phone: string;
	hours: string;
	office: string;
	message: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
	if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? res.statusText);
	return res.json() as Promise<T>;
}

export const api = {
	personas: () => request<Persona[]>("/api/gov/citizens"),
	/** Creates a human handoff ticket via REST (the UI uses the agent's requestHuman callable, which adds the walkthrough position). */
	handoff: (input: { citizenId: string; sessionId: string; reason: string; summary: string }, language: Language) =>
		request<HandoffResult>(`/api/gov/handoffs?lang=${language}`, { method: "POST", body: JSON.stringify(input) }),
};

/**
 * Types of the guided walkthrough ("tutorial mode"), shared by the Worker and the React frontend.
 * Keep this file free of runtime dependencies so both sides can import it.
 *
 * The idea: instead of a chat answer, the citizen watches the assistant fill in the official form
 * step by step, like a YouTube tutorial. Every step has a narration (spoken + subtitles), the
 * official term next to a plain-language explanation, and, if the assistant needs something from
 * the citizen, an input widget. See docs/CORE.md.
 */

/** Chapters shown in the timeline (like YouTube chapters). */
export type Chapter = "understand" | "check" | "fill" | "review" | "done";
export const CHAPTERS: Chapter[] = ["understand", "check", "fill", "review", "done"];

export type StepKind =
	| "intro" // what we are about to do and why (plays automatically)
	| "check" // prerequisites from the eligibility check (plays automatically)
	| "autofill" // field the assistant fills from the citizen's data (plays automatically, can be changed)
	| "ask" // field only the citizen can answer (waits)
	| "appointment" // pick a slot (waits; booked together with the submission)
	| "review" // summary + the citizen's explicit confirmation (waits)
	| "done" // submitted: reference number + next steps
	| "blocked"; // the citizen can't continue (not eligible) – explain and offer a human

export type FieldInputType = "text" | "date" | "select" | "boolean";

export type FieldOption = { value: string; label: string; explain?: string };

/** One field of the simulated portal form. */
export type PortalField = {
	id: string;
	/** Label as printed on the official form. */
	label: string;
	type: FieldInputType;
	required: boolean;
	mustBeTrue?: boolean;
	options?: FieldOption[];
	hint?: string;
	/** Raw value as sent to the backend ("yes"/"no" for booleans, option value for selects). */
	value?: string;
	/** Human-readable value (option label, "Ja"/"Nein", formatted date). */
	displayValue?: string;
	/** Where the value came from. "confirmed" = a third party confirmed it to the state (see confirmedBy). */
	source?: "profile" | "draft" | "citizen" | "assistant" | "confirmed";
	/** Who confirmed the value, e.g. { name: "Karl Steiner", role: "Landlord" }. */
	confirmedBy?: { name: string; role: string };
	/** Validation problem reported by the backend for this field. */
	problem?: string;
};

export type CheckItem = { status: "ok" | "warn" | "fail"; text: string };

export type SlotOption = { id: string; office: string; slotTime: string };

export type WalkthroughStep = {
	id: string;
	kind: StepKind;
	chapter: Chapter;
	/** Short heading in plain language. */
	title: string;
	/** What the assistant says: spoken via TTS and shown as subtitles. */
	narration: string;
	/** Portal field this step is about (highlighted in the portal view). */
	fieldId?: string;
	/** The official ("Amtsdeutsch") term … */
	officialTerm?: string;
	/** … and what it means in plain language. */
	plainExplanation?: string;
	/** Result of the prerequisite check (kind "check" and "blocked"). */
	checks?: CheckItem[];
	/** Free appointment slots (kind "appointment"). */
	slots?: SlotOption[];
	/** Optional fields can be skipped. */
	skippable?: boolean;
	/** true = the walkthrough stops here until the citizen acts. */
	waitsForCitizen: boolean;
	done: boolean;
};

export type WalkthroughStatus = "playing" | "waiting" | "review" | "submitting" | "submitted" | "blocked";

export type SubmissionSummary = {
	referenceNumber: string;
	authority: string;
	submittedAt: string;
	nextSteps: string[];
	appointment?: { office: string; slotTime: string; referenceNumber: string };
};

export type Walkthrough = {
	id: string;
	serviceId: string;
	serviceName: string;
	authority: string;
	/** Draft application in the mock backend (null in eval/preview mode). */
	applicationId: string | null;
	/** Title of the simulated portal page, e.g. "Meldezettel – Wohnsitz anmelden". */
	portalTitle: string;
	/** Simulated address bar of the portal. */
	portalUrl: string;
	fields: PortalField[];
	steps: WalkthroughStep[];
	/** Index of the active step. */
	current: number;
	status: WalkthroughStatus;
	/** Slot the citizen picked; booked only on confirmation. */
	selectedSlot?: SlotOption;
	sourceUrl: string | null;
	factsVerified: boolean;
	/** Implementation level of the mock service ("mock" = simplified rules, say so). */
	implementation: "full" | "mock";
	result?: SubmissionSummary;
	/** Last error (e.g. backend outage) – shown to the citizen with a retry. */
	error?: string;
	language: "de" | "en";
};

/** Proactive hint derived from the citizen's data ("Your passport expired …"). */
export type Suggestion = {
	serviceId: string;
	title: string;
	reason: string;
	urgency: "high" | "normal";
	/** What the slip will look like, for the desk card: rows in total, rows the offices fill, questions left for the citizen. */
	preview?: { rows: number; byOffices: number; questions: number };
	/** Legal deadline (ISO date), e.g. three days after moving in for the registration. */
	due?: string;
};

/** Services waiting in line after the current walkthrough (combined requests). */
export type QueuedService = { serviceId: string; name: string };

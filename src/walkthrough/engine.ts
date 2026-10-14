/**
 * The walkthrough engine: turns a service definition + the citizen's data into a sequence of
 * tutorial steps, and moves through them.
 *
 * Everything in this file is PURE (no database, no AI, no network): every function takes a
 * Walkthrough and returns a new one. That keeps the core deterministic and unit-testable
 * (test/walkthrough.spec.ts). Talking to the backend happens in ./controller.ts.
 *
 * Step order for every service:
 *   intro → check → one step per form field (autofill or ask) → [appointment] → review → done
 *   (or intro → blocked, if the citizen is not eligible)
 */
import type { Language } from "../shared/types";
import type {
	CheckItem,
	FieldOption,
	PortalField,
	SlotOption,
	SubmissionSummary,
	Walkthrough,
	WalkthroughStatus,
	WalkthroughStep,
} from "../shared/walkthrough";
import type { Citizen, EligibilityResult, FormField, ServiceDefinition } from "../gov/types";
import { fill, formatDate, formatSlot, getGuide, phrase, rewriteCheck, type FieldGuide } from "./guides";

export type BuildInput = {
	def: ServiceDefinition;
	citizen: Citizen;
	eligibility: EligibilityResult;
	/** Initial form data (draft from the backend, or prefill in preview mode). */
	data: Record<string, string>;
	/** Field ids whose value comes from official records (shown as "from your data"). */
	profileKeys: string[];
	/** Field ids the assistant derived itself (guide.suggest). */
	assistantKeys: string[];
	slots: SlotOption[];
	applicationId: string | null;
	lang: Language;
	sourceUrl: string | null;
	factsVerified: boolean;
};

// ---------------------------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------------------------

export function buildWalkthrough(input: BuildInput): Walkthrough {
	const { def, eligibility, lang } = input;
	const guide = getGuide(def.id);
	const fields = def.fields.map((f) => toPortalField(f, input, guide?.fields[f.id]));

	const steps: WalkthroughStep[] = [];
	const intro = (count: number): WalkthroughStep => ({
		id: "intro",
		kind: "intro",
		chapter: "understand",
		title: guide?.title[lang] ?? def.name[lang],
		narration: guide ? fill(guide.intro[lang], { count }) : def.summary[lang],
		waitsForCitizen: false,
		done: false,
	});

	// Not eligible: explain why and stop. No draft, no form.
	if (!eligibility.eligible) {
		steps.push(intro(0));
		const checks = toChecks(eligibility, lang);
		steps.push({
			id: "blocked",
			kind: "blocked",
			chapter: "check",
			title: phrase("blockedTitle", lang),
			narration: [phrase("blockedIntro", lang), ...checks.filter((c) => c.status === "fail").map((c) => c.text), phrase("blockedHelp", lang)].join(" "),
			checks,
			waitsForCitizen: true,
			done: false,
		});
		return finalize(baseWalkthrough(input, guide, fields, steps));
	}

	const checks = toChecks(eligibility, lang);
	steps.push({
		id: "check",
		kind: "check",
		chapter: "check",
		title: phrase("checkTitle", lang),
		narration: [
			phrase("checkIntro", lang),
			...checks.map((c) => c.text),
			checks.some((c) => c.status !== "ok") ? phrase("checkWithNotes", lang) : phrase("checkAllGood", lang),
		].join(" "),
		checks,
		waitsForCitizen: false,
		done: false,
	});

	for (const field of fields) {
		const fg = guide?.fields[field.id];
		if (fg?.onlyIfFilled && !input.data[fg.onlyIfFilled]) continue;
		steps.push(field.value ? autofillStep(field, fg, lang) : askStep(field, fg, lang));
	}

	if (def.requiresAppointment) {
		steps.push({
			id: "appointment",
			kind: "appointment",
			chapter: "fill",
			title: phrase("appointmentTitle", lang),
			narration: input.slots.length ? (guide?.appointment?.[lang] ?? phrase("appointmentGeneric", lang)) : phrase("noSlots", lang),
			slots: input.slots,
			waitsForCitizen: true,
			done: false,
		});
	}

	steps.push({
		id: "review",
		kind: "review",
		chapter: "review",
		title: phrase("reviewTitle", lang),
		narration: phrase("review", lang),
		waitsForCitizen: true,
		done: false,
	});

	const questions = steps.filter((s) => s.waitsForCitizen && s.kind !== "review").length;
	steps.unshift(intro(questions));
	return finalize(baseWalkthrough(input, guide, fields, steps));
}

function baseWalkthrough(input: BuildInput, guide: ReturnType<typeof getGuide>, fields: PortalField[], steps: WalkthroughStep[]): Walkthrough {
	const { def, lang } = input;
	return {
		id: `wt-${crypto.randomUUID().slice(0, 8)}`,
		serviceId: def.id,
		serviceName: def.name[lang],
		authority: def.authority[lang],
		applicationId: input.applicationId,
		portalTitle: guide?.portalTitle[lang] ?? def.name[lang],
		portalUrl: guide?.portalUrl ?? `portal.amt.example/${def.id}`,
		fields,
		steps,
		current: 0,
		status: "playing",
		sourceUrl: input.sourceUrl,
		factsVerified: input.factsVerified,
		implementation: def.implementation,
		language: lang,
	};
}

function toPortalField(f: FormField, input: BuildInput, fg: FieldGuide | undefined): PortalField {
	const { lang } = input;
	const options: FieldOption[] | undefined = f.options?.map((o) => ({
		value: o.value,
		label: o.label[lang],
		explain: fg?.optionExplain?.[o.value]?.[lang],
	}));
	const field: PortalField = {
		id: f.id,
		label: f.label[lang],
		type: f.type,
		required: f.required,
		...(f.mustBeTrue ? { mustBeTrue: true } : {}),
		...(options ? { options } : {}),
		...(f.hint ? { hint: f.hint[lang] } : {}),
	};
	const value = input.data[f.id];
	if (value) {
		const source = input.profileKeys.includes(f.id) ? "profile" : input.assistantKeys.includes(f.id) ? "assistant" : "draft";
		Object.assign(field, { value, displayValue: displayValue(field, value, lang), source });
	}
	return field;
}

function autofillStep(field: PortalField, fg: FieldGuide | undefined, lang: Language): WalkthroughStep {
	const template = fg?.autofill?.[lang] ?? phrase("autofillGeneric", lang);
	return {
		id: `field:${field.id}`,
		kind: "autofill",
		chapter: "fill",
		title: field.label,
		narration: fill(template, { value: field.displayValue ?? field.value ?? "" }),
		fieldId: field.id,
		officialTerm: fg?.officialTerm?.[lang] ?? field.label,
		plainExplanation: fg?.explain?.[lang] ?? field.hint,
		waitsForCitizen: false,
		done: false,
	};
}

function askStep(field: PortalField, fg: FieldGuide | undefined, lang: Language): WalkthroughStep {
	return {
		id: `field:${field.id}`,
		kind: "ask",
		chapter: "fill",
		title: fg?.question?.[lang] ?? field.label,
		narration: [fg?.question?.[lang] ?? phrase("askGeneric", lang, { label: field.label }), fg?.explain?.[lang]].filter(Boolean).join(" "),
		fieldId: field.id,
		officialTerm: fg?.officialTerm?.[lang] ?? field.label,
		plainExplanation: fg?.explain?.[lang] ?? field.hint,
		skippable: !field.required,
		waitsForCitizen: true,
		done: false,
	};
}

function toChecks(e: EligibilityResult, lang: Language): CheckItem[] {
	const blocking = !e.eligible;
	return [
		...e.reasons.map((t): CheckItem => ({ status: blocking ? "fail" : "ok", text: rewriteCheck(t, lang) })),
		...e.missing.map((t): CheckItem => ({ status: blocking ? "fail" : "warn", text: rewriteCheck(t, lang) })),
		...e.warnings.map((t): CheckItem => ({ status: "warn", text: rewriteCheck(t, lang) })),
	];
}

/** Human-readable value for the portal and the review table. */
export function displayValue(field: PortalField, value: string, lang: Language): string {
	if (field.type === "boolean") return value === "yes" ? phrase("yes", lang) : value === "no" ? phrase("no", lang) : value;
	if (field.type === "select") return field.options?.find((o) => o.value === value)?.label ?? value;
	if (field.type === "date") return formatDate(value, lang);
	if (field.id === "id_document" && lang === "de") return value.replace(/^Passport/, "Reisepass").replace(/^ID card/, "Personalausweis");
	return value;
}

// ---------------------------------------------------------------------------------------------
// Moving through the steps
// ---------------------------------------------------------------------------------------------

function finalize(w: Walkthrough): Walkthrough {
	return { ...w, status: statusOf(w) };
}

function statusOf(w: Walkthrough): WalkthroughStatus {
	if (w.result) return "submitted";
	const step = w.steps[w.current];
	if (!step) return "playing";
	if (step.kind === "blocked") return "blocked";
	if (step.kind === "review") return "review";
	if (step.kind === "done") return "submitted";
	return step.waitsForCitizen && !step.done ? "waiting" : "playing";
}

function clone(w: Walkthrough): Walkthrough {
	return structuredClone(w);
}

function isLocked(w: Walkthrough) {
	return Boolean(w.result) || w.status === "blocked";
}

/** First step after `from` that is not done yet (falls back to the review step). */
function nextOpenIndex(w: Walkthrough, from: number): number {
	for (let i = from + 1; i < w.steps.length; i++) if (!w.steps[i].done) return i;
	for (let i = 0; i < w.steps.length; i++) if (!w.steps[i].done) return i;
	return w.steps.length - 1;
}

/**
 * The frontend calls this when a step that doesn't need the citizen has finished playing
 * (narration over), or when the citizen presses "next" on a step they already answered.
 * Idempotent: `fromIndex` must be the current step, so double calls do nothing.
 */
export function advance(w: Walkthrough, fromIndex: number): Walkthrough {
	if (w.current !== fromIndex || isLocked(w)) return w;
	const step = w.steps[fromIndex];
	if (!step || (step.waitsForCitizen && !step.done) || step.kind === "review" || step.kind === "done") return w;
	const next = clone(w);
	next.steps[fromIndex].done = true;
	next.current = Math.min(fromIndex + 1, next.steps.length - 1);
	return finalize(next);
}

/** Previous step (replays its narration). */
export function back(w: Walkthrough): Walkthrough {
	if (isLocked(w) || w.current === 0) return w;
	return finalize({ ...clone(w), current: w.current - 1 });
}

/** Jump to a step from the timeline. Only to steps already reached. */
export function goTo(w: Walkthrough, index: number): Walkthrough {
	if (isLocked(w) || index < 0 || index >= w.steps.length) return w;
	const reachable = w.steps.slice(0, index).every((s) => s.done) || index <= w.current;
	if (!reachable) return w;
	return finalize({ ...clone(w), current: index });
}

export type AnswerResult = { walkthrough: Walkthrough; ok: boolean; problem?: string };

/**
 * Sets a form field (from a click in the UI, or from the LLM after the citizen said it in words).
 * Validates the single field with the same rules as the backend; on a problem the step stays open.
 */
export function answerField(
	w: Walkthrough,
	def: ServiceDefinition,
	fieldId: string,
	rawValue: string | boolean,
	source: "citizen" | "assistant",
	validate: (def: ServiceDefinition, data: Record<string, string>, lang: Language) => string[],
): AnswerResult {
	if (isLocked(w)) return { walkthrough: w, ok: false, problem: "locked" };
	const next = clone(w);
	const field = next.fields.find((f) => f.id === fieldId);
	const stepIndex = next.steps.findIndex((s) => s.fieldId === fieldId);
	if (!field || stepIndex < 0) return { walkthrough: w, ok: false, problem: `Unknown field "${fieldId}" for this form.` };
	const step = next.steps[stepIndex];
	const value = normalizeValue(field, rawValue);

	// Skipping an optional field
	if (!value) {
		if (field.required) return { walkthrough: w, ok: false, problem: "required" };
		delete field.value;
		delete field.displayValue;
		delete field.problem;
		step.done = true;
		next.current = nextOpenIndex(next, stepIndex);
		return { walkthrough: finalize(next), ok: true };
	}

	const lang = w.language;
	const problems = validate(def, { [fieldId]: value }, lang).filter((p) => p.includes(`(${fieldId})`) && !p.startsWith("Missing"));
	const fg = getGuide(def.id)?.fields[fieldId];
	const mustBeYesButNo = field.mustBeTrue && value !== "yes";

	field.value = value;
	field.displayValue = displayValue(field, value, lang);
	field.source = source;

	if (problems.length || mustBeYesButNo) {
		field.problem = mustBeYesButNo ? (fg?.ifNo?.[lang] ?? problems[0]) : problems[0];
		step.done = false;
		next.current = stepIndex;
		return { walkthrough: finalize(next), ok: false, problem: field.problem };
	}

	delete field.problem;
	step.done = true;
	next.current = nextOpenIndex(next, stepIndex);
	return { walkthrough: finalize(next), ok: true };
}

/** "Change" button on an autofilled field or in the review table: turns it into a question. */
export function editField(w: Walkthrough, fieldId: string): Walkthrough {
	if (isLocked(w)) return w;
	const next = clone(w);
	const index = next.steps.findIndex((s) => s.fieldId === fieldId);
	if (index < 0) return w;
	const step = next.steps[index];
	const field = next.fields.find((f) => f.id === fieldId)!;
	const fg = getGuide(next.serviceId)?.fields[fieldId];
	Object.assign(step, askStep(field, fg, w.language), { done: false });
	next.current = index;
	// The review must be confirmed again after a change.
	for (const s of next.steps) if (s.kind === "review") s.done = false;
	return finalize(next);
}

export function chooseSlot(w: Walkthrough, slotId: string): Walkthrough {
	if (isLocked(w)) return w;
	const next = clone(w);
	const index = next.steps.findIndex((s) => s.kind === "appointment");
	const slot = next.steps[index]?.slots?.find((s) => s.id === slotId);
	if (!slot) return w;
	next.selectedSlot = slot;
	next.steps[index].done = true;
	next.current = nextOpenIndex(next, index);
	return finalize(next);
}

/** Applies validation problems reported by the backend (e.g. right before submitting). */
export function applyBackendProblems(w: Walkthrough, problems: string[]): Walkthrough {
	const next = clone(w);
	for (const f of next.fields) {
		const p = problems.find((x) => x.includes(`(${f.id})`));
		if (p) f.problem = p;
		else delete f.problem;
	}
	return finalize(next);
}

export function withError(w: Walkthrough, error: string | undefined): Walkthrough {
	const next = clone(w);
	if (error) next.error = error;
	else delete next.error;
	return finalize(next);
}

/** After a successful submission: add the "done" step and lock the walkthrough. */
export function markSubmitted(w: Walkthrough, result: SubmissionSummary): Walkthrough {
	const next = clone(w);
	const lang = w.language;
	for (const s of next.steps) s.done = true;
	const appointment = result.appointment ? " " + phrase("doneAppointment", lang, { slot: formatSlot(result.appointment.slotTime, lang), office: result.appointment.office }) : "";
	next.steps.push({
		id: "done",
		kind: "done",
		chapter: "done",
		title: phrase("doneTitle", lang),
		narration: phrase("done", lang, { ref: spellReference(result.referenceNumber) }) + appointment,
		waitsForCitizen: true,
		done: true,
	});
	next.current = next.steps.length - 1;
	next.result = result;
	delete next.error;
	return finalize(next);
}

/**
 * Language switch mid-walkthrough: `fresh` is the same walkthrough rebuilt in the new language.
 * Carry over where the citizen is and what they already answered.
 */
export function carryProgress(fresh: Walkthrough, old: Walkthrough): Walkthrough {
	const next = clone(fresh);
	const done = new Set(old.steps.filter((s) => s.done).map((s) => s.id));
	for (const s of next.steps) if (done.has(s.id)) s.done = true;
	for (const f of next.fields) {
		const before = old.fields.find((o) => o.id === f.id);
		if (before?.value && !f.value) Object.assign(f, { value: before.value, displayValue: displayValue(f, before.value, next.language), source: before.source });
	}
	const currentId = old.steps[old.current]?.id;
	const index = next.steps.findIndex((s) => s.id === currentId);
	next.current = index >= 0 ? index : 0;
	if (old.selectedSlot) next.selectedSlot = old.selectedSlot;
	return finalize(next);
}

/** The form data as the backend expects it. */
export function formData(w: Walkthrough): Record<string, string> {
	return Object.fromEntries(w.fields.filter((f) => f.value).map((f) => [f.id, f.value!]));
}

function normalizeValue(field: PortalField, raw: string | boolean): string {
	if (typeof raw === "boolean") return raw ? "yes" : "no";
	const v = String(raw).trim();
	if (field.type === "boolean") {
		if (/^(yes|ja|true|y|j)$/i.test(v)) return "yes";
		if (/^(no|nein|false|n)$/i.test(v)) return "no";
	}
	if (field.type === "select" && field.options) {
		const hit = field.options.find((o) => o.value.toLowerCase() === v.toLowerCase() || o.label.toLowerCase() === v.toLowerCase());
		if (hit) return hit.value;
	}
	if (field.type === "date") return normalizeDate(v) ?? v;
	return v;
}

/**
 * Deterministic answer extraction for the current question, used BEFORE the LLM: if the citizen
 * says "eingezogen bin i am 1. Oktober" while the walkthrough waits for a date, we take the date
 * directly. Works for dates, yes/no and choices. Free text (addresses, names) is left to the LLM.
 * Returns null when unsure.
 */
export function extractAnswer(field: PortalField, text: string, today = new Date().toISOString().slice(0, 10)): string | null {
	const t = text.toLowerCase().trim();
	const words = t.split(/\s+/).length;

	if (field.type === "date") {
		if (/\b(heute|today)\b/.test(t)) return today;
		if (/\b(gestern|yesterday)\b/.test(t)) {
			const d = new Date(today);
			d.setDate(d.getDate() - 1);
			return d.toISOString().slice(0, 10);
		}
		const year = Number(today.slice(0, 4));
		const numeric = t.match(/\b(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{4}))?/);
		if (numeric) return normalizeDate(`${numeric[1]}.${numeric[2]}.${numeric[3] ?? ""}`, year);
		const named = t.match(/\b(\d{1,2})(?:\.|st|nd|rd|th)?\s+([a-zäöü]{3,})\.?,?(?:\s+(\d{4}))?/);
		if (named && MONTHS[named[2].slice(0, 3)]) return normalizeDate(`${named[1]} ${named[2]} ${named[3] ?? ""}`.trim(), year);
		return null;
	}

	if (field.type === "boolean" && words <= 6) {
		if (/^(ja|jo|jawohl|genau|sicher|passt|yes|yep|yeah|sure|of course|natürlich)\b/.test(t)) return "yes";
		if (/^(nein|na|naa|ned|nicht|no|nope|not yet|noch nicht)\b/.test(t)) return "no";
		return null;
	}

	if (field.type === "select" && field.options) {
		// An option wins if one of its distinctive words (or its value) appears in the message.
		const hits = field.options.filter((o) => {
			const own = `${o.value.replace(/_/g, " ")} ${o.label}`.toLowerCase().split(/[^a-zäöüß]+/).filter((w) => w.length >= 4);
			const others = field.options!.filter((x) => x !== o).flatMap((x) => `${x.value} ${x.label}`.toLowerCase().split(/[^a-zäöüß]+/));
			return own.filter((w) => !others.includes(w)).some((w) => t.includes(w.slice(0, Math.max(4, w.length - 3))));
		});
		return hits.length === 1 ? hits[0].value : null;
	}
	return null;
}

const MONTHS: Record<string, number> = {
	jan: 1, jän: 1, feb: 2, mär: 3, mar: 3, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dez: 12, dec: 12,
};

/**
 * Understands the ways people say dates: "1.11.2026", "1.11.", "1. November", "am 1. Okt 2026",
 * "1 October", "November 1st". Without a year, the current year is assumed.
 */
export function normalizeDate(input: string, year = new Date().getFullYear()): string | null {
	const v = input.toLowerCase().replace(/^(am|on|the)\s+/, "").trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
	const iso = (y: number, m: number, d: number) =>
		m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;

	const numeric = v.match(/^(\d{1,2})\.\s*(\d{1,2})\.?\s*(\d{4})?$/); // 1.11.2026 / 1.11.
	if (numeric) return iso(Number(numeric[3] ?? year), Number(numeric[2]), Number(numeric[1]));

	const dayFirst = v.match(/^(\d{1,2})(?:\.|st|nd|rd|th)?\s+([a-zäöü]+)\.?,?\s*(\d{4})?$/); // 1. Oktober 2026 / 1 October
	const monthFirst = v.match(/^([a-zäöü]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?$/); // November 1st, 2026
	const parts = dayFirst ? { d: dayFirst[1], m: dayFirst[2], y: dayFirst[3] } : monthFirst ? { d: monthFirst[2], m: monthFirst[1], y: monthFirst[3] } : null;
	if (!parts) return null;
	const month = MONTHS[parts.m.slice(0, 3)];
	return month ? iso(Number(parts.y ?? year), month, Number(parts.d)) : null;
}

/** Reference numbers are read aloud: "MEL-2026-123456" -> "MEL 2026 123456". */
function spellReference(ref: string): string {
	return ref.replace(/-/g, " ");
}

// ---------------------------------------------------------------------------------------------
// Compact view for the LLM (system prompt + tool results)
// ---------------------------------------------------------------------------------------------

export function summarizeForModel(w: Walkthrough | null) {
	if (!w) return null;
	const step = w.steps[w.current];
	const field = step?.fieldId ? w.fields.find((f) => f.id === step.fieldId) : undefined;
	return {
		serviceId: w.serviceId,
		service: w.serviceName,
		status: w.status,
		currentStep: step
			? {
					index: w.current,
					of: w.steps.length,
					kind: step.kind,
					title: step.title,
					fieldId: step.fieldId,
					expects: field
						? { type: field.type, required: field.required, options: field.options?.map((o) => o.value), mustBeYes: field.mustBeTrue }
						: undefined,
					problem: field?.problem,
				}
			: null,
		filled: Object.fromEntries(w.fields.filter((f) => f.value).map((f) => [f.id, f.displayValue ?? f.value])),
		stillOpen: w.fields.filter((f) => f.required && !f.value).map((f) => f.id),
		appointment: w.selectedSlot ? `${w.selectedSlot.slotTime} – ${w.selectedSlot.office}` : undefined,
		referenceNumber: w.result?.referenceNumber,
		error: w.error,
		factsVerified: w.factsVerified,
		implementation: w.implementation,
	};
}

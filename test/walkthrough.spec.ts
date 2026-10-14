/**
 * Tests for the guided walkthrough core (no AI calls). Run: pnpm test
 */
import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { getServiceDefinition } from "../src/gov/data/services";
import * as gov from "../src/gov/service";
import { createWalkthrough, submitWalkthrough } from "../src/walkthrough/controller";
import * as engine from "../src/walkthrough/engine";
import { getSuggestions } from "../src/walkthrough/proactive";
import { detectLanguage, routeIntent } from "../src/agent/router";
import type { Walkthrough } from "../src/shared/walkthrough";

const residence = getServiceDefinition("change-of-residence")!;

/** Plays all automatic steps until the walkthrough waits for the citizen. */
function playUntilWaiting(w: Walkthrough): Walkthrough {
	for (let i = 0; i < 50 && w.status === "playing"; i++) w = engine.advance(w, w.current);
	return w;
}

function answer(w: Walkthrough, fieldId: string, value: string | boolean) {
	return engine.answerField(w, residence, fieldId, value, "citizen", gov.validateApplicationData);
}

describe("guided walkthrough", () => {
	beforeAll(async () => {
		await SELF.fetch("https://example.com/api/gov/admin/reset", { method: "POST" });
	});

	it("builds the change-of-residence tutorial: profile data is filled, the rest is asked", async () => {
		const w = await createWalkthrough(env, "lena-huber", "change-of-residence", "de", false);
		const kinds = w.steps.map((s) => `${s.kind}${s.fieldId ? `:${s.fieldId}` : ""}`);
		expect(kinds).toEqual([
			"intro",
			"check",
			"ask:new_address",
			"ask:move_in_date",
			"ask:residence_type",
			"autofill:previous_address",
			"ask:deregister_previous",
			"ask:landlord_signature",
			"autofill:id_document",
			"review",
		]);
		expect(w.steps[0].narration).toContain("5 Fragen");
		expect(w.fields.find((f) => f.id === "id_document")?.displayValue).toBe("Personalausweis ID1234567");
		expect(w.status).toBe("playing");
	});

	it("never plays past a question, and advance is idempotent", async () => {
		let w = await createWalkthrough(env, "lena-huber", "change-of-residence", "de", false);
		w = engine.advance(w, 0);
		expect(engine.advance(w, 0)).toBe(w); // double call (e.g. two tabs) does nothing
		w = playUntilWaiting(w);
		expect(w.status).toBe("waiting");
		expect(w.steps[w.current].fieldId).toBe("new_address");
		expect(engine.advance(w, w.current)).toBe(w);
	});

	it("normalizes answers and keeps the step open on problems", async () => {
		let w = playUntilWaiting(await createWalkthrough(env, "lena-huber", "change-of-residence", "de", false));
		w = answer(w, "new_address", "Kaiserstraße 1/5, 1070 Wien").walkthrough;
		const date = answer(w, "move_in_date", "1.11.2026");
		expect(date.ok).toBe(true);
		expect(date.walkthrough.fields.find((f) => f.id === "move_in_date")?.value).toBe("2026-11-01");

		const noSignature = answer(w, "landlord_signature", "nein");
		expect(noSignature.ok).toBe(false);
		expect(noSignature.problem).toContain("Unterschrift");
		expect(noSignature.walkthrough.steps[noSignature.walkthrough.current].fieldId).toBe("landlord_signature");

		const badSelect = answer(w, "residence_type", "Villa");
		expect(badSelect.ok).toBe(false);
	});

	it("goes back to the review after changing a field from the review", async () => {
		let w = playUntilWaiting(await createWalkthrough(env, "lena-huber", "change-of-residence", "de", false));
		for (const [id, v] of [
			["new_address", "Kaiserstraße 1/5, 1070 Wien"],
			["move_in_date", "2026-10-01"],
			["residence_type", "main"],
		] as const)
			w = playUntilWaiting(answer(w, id, v).walkthrough);
		w = playUntilWaiting(answer(w, "deregister_previous", true).walkthrough);
		w = answer(w, "landlord_signature", true).walkthrough;
		w = playUntilWaiting(w);
		expect(w.status).toBe("review");

		w = engine.editField(w, "new_address");
		expect(w.status).toBe("waiting");
		w = answer(w, "new_address", "Neubaugasse 2, 1070 Wien").walkthrough;
		expect(w.status).toBe("review");
	});

	it("passport: derives the reason, offers appointments, blocks non-Austrians", async () => {
		const josef = await createWalkthrough(env, "josef-gruber", "passport-renewal", "de", false);
		const reason = josef.fields.find((f) => f.id === "reason");
		expect(reason?.value).toBe("expired");
		expect(reason?.source).toBe("assistant");
		expect(josef.steps.find((s) => s.kind === "appointment")?.slots?.length).toBeGreaterThan(0);

		const amira = await createWalkthrough(env, "amira-haddad", "passport-renewal", "en", false);
		expect(amira.steps.map((s) => s.kind)).toEqual(["intro", "blocked"]);
		expect(amira.applicationId).toBeNull();
	});

	it("submits only through the review step, with server-side validation", async () => {
		let w = playUntilWaiting(await createWalkthrough(env, "sofia-rossi", "change-of-residence", "en", true));
		expect(w.applicationId).toBeTruthy();
		expect(await submitWalkthrough(env, "sofia-rossi", w)).toBe(w); // not in review yet: nothing happens

		const answers: [string, string | boolean][] = [
			["new_address", "Neubaugasse 12/4, 1070 Wien"],
			["move_in_date", "2026-10-10"],
			["residence_type", "main"],
			["deregister_previous", true],
			["landlord_signature", true],
		];
		for (const [id, v] of answers) {
			w = playUntilWaiting(answer(w, id, v).walkthrough);
		}
		expect(w.status).toBe("review");
		const done = await submitWalkthrough(env, "sofia-rossi", w);
		expect(done.status).toBe("submitted");
		expect(done.result?.referenceNumber).toMatch(/^MEL-\d{4}-\d{6}$/);
		expect(done.steps.at(-1)?.kind).toBe("done");
	});

	it("suggests errands proactively from the citizen's data", async () => {
		const today = gov.today();
		const josef = await gov.getCitizenProfile(env, "josef-gruber");
		expect(getSuggestions(josef, today, "de")[0]).toMatchObject({ serviceId: "passport-renewal", urgency: "high" });
		const thomas = await gov.getCitizenProfile(env, "thomas-berger");
		expect(getSuggestions(thomas, today, "de").map((s) => s.serviceId)).toContain("childcare-subsidy");
		const david = await gov.getCitizenProfile(env, "david-novak");
		expect(getSuggestions(david, today, "de").map((s) => s.serviceId)).toContain("change-of-residence");
		// Already applied: don't suggest it again.
		expect(getSuggestions(josef, today, "de", ["passport-renewal"])).toEqual([]);
	});
});

describe("date understanding", () => {
	it("understands how people say dates", () => {
		expect(engine.normalizeDate("1.11.2026")).toBe("2026-11-01");
		expect(engine.normalizeDate("1. Oktober", 2026)).toBe("2026-10-01");
		expect(engine.normalizeDate("am 3. Jänner 2027")).toBe("2027-01-03");
		expect(engine.normalizeDate("1 October", 2026)).toBe("2026-10-01");
		expect(engine.normalizeDate("November 1st, 2026")).toBe("2026-11-01");
		expect(engine.normalizeDate("irgendwann")).toBeNull();
	});
});

describe("answer extraction (before the LLM)", () => {
	const field = (type: "date" | "boolean" | "select", options?: { value: string; label: string }[]) => ({ id: "x", label: "x", type, required: true, options });

	it("finds dates inside sentences", () => {
		expect(engine.extractAnswer(field("date"), "eingezogen bin i am 1. Oktober", "2026-10-14")).toBe("2026-10-01");
		expect(engine.extractAnswer(field("date"), "seit 3.10.", "2026-10-14")).toBe("2026-10-03");
		expect(engine.extractAnswer(field("date"), "I moved in on 5 October 2026", "2026-10-14")).toBe("2026-10-05");
		expect(engine.extractAnswer(field("date"), "heute", "2026-10-14")).toBe("2026-10-14");
		expect(engine.extractAnswer(field("date"), "was heißt das?", "2026-10-14")).toBeNull();
	});

	it("understands yes/no only in short answers", () => {
		expect(engine.extractAnswer(field("boolean"), "Jo, hat er")).toBe("yes");
		expect(engine.extractAnswer(field("boolean"), "Nein, noch nicht")).toBe("no");
		expect(engine.extractAnswer(field("boolean"), "Ja aber was ist wenn der Vermieter im Urlaub ist und nicht unterschreiben kann?")).toBeNull();
	});

	it("matches choices by their distinctive words", () => {
		const residence = field("select", [
			{ value: "main", label: "Hauptwohnsitz" },
			{ value: "secondary", label: "Nebenwohnsitz" },
		]);
		expect(engine.extractAnswer(residence, "des is mei Hauptwohnsitz")).toBe("main");
		expect(engine.extractAnswer(residence, "nur Nebenwohnsitz, i studier do")).toBe("secondary");
		expect(engine.extractAnswer(residence, "keine Ahnung")).toBeNull();
	});
});

describe("router", () => {
	it("detects the language, including Austrian dialect", () => {
		expect(detectLanguage("mia ham a baby kriagt, kriag i do a göd?", "en")).toBe("de");
		expect(detectLanguage("Servus, i bin grad nach Wien zogn, was muss i tun?", "en")).toBe("de");
		expect(detectLanguage("My passport expired.", "de")).toBe("en");
		expect(detectLanguage("We just had a baby, is there any support?", "de")).toBe("en");
		expect(detectLanguage("ok", "de")).toBe("de");
	});

	it("forces the walkthrough only for clear requests", () => {
		expect(routeIntent("mia ham a baby kriagt, kriag i do a göd?", false, "de")).toMatchObject({ forceTool: "start_guided_walkthrough", candidates: ["childcare-subsidy"] });
		expect(routeIntent("Ist mein Reisepass noch gültig?", false, "de").forceTool).toBe("get_my_profile");
		expect(routeIntent("Ich möchte einen Hund anmelden.", false, "de").forceTool).toBeNull();
		expect(routeIntent("Mein Reisepass is abgloffen.", true, "de").forceTool).toBeNull(); // walkthrough already open
	});
});

/**
 * Tests for the guided walkthrough core (no AI calls). Run: pnpm test
 */
import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { nearbyFirst } from "../src/gov/data/offices";
import { getServiceDefinition } from "../src/gov/data/services";
import * as gov from "../src/gov/service";
import { createWalkthrough, submitWalkthrough } from "../src/walkthrough/controller";
import * as engine from "../src/walkthrough/engine";
import { getSuggestions } from "../src/walkthrough/proactive";
import { detectLanguage, routeIntent } from "../src/agent/router";
import { buildOverview } from "../src/walkthrough/overview";
import { cityOf, formatMinutes, stampForApplication } from "../src/shared/stamps";
import { extractDoor, toVerifiedAddress, withDoor } from "../src/shared/address";
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
		const w = await createWalkthrough(env, "sofia-rossi", "change-of-residence", "de", false);
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
		expect(w.fields.find((f) => f.id === "id_document")?.displayValue).toBe("Personalausweis IT-CA1234567");
		expect(w.status).toBe("playing");
	});

	it("never plays past a question, and advance is idempotent", async () => {
		let w = await createWalkthrough(env, "sofia-rossi", "change-of-residence", "de", false);
		w = engine.advance(w, 0);
		expect(engine.advance(w, 0)).toBe(w); // double call (e.g. two tabs) does nothing
		w = playUntilWaiting(w);
		expect(w.status).toBe("waiting");
		expect(w.steps[w.current].fieldId).toBe("new_address");
		expect(engine.advance(w, w.current)).toBe(w);
	});

	it("normalizes answers and keeps the step open on problems", async () => {
		let w = playUntilWaiting(await createWalkthrough(env, "sofia-rossi", "change-of-residence", "de", false));
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
		let w = playUntilWaiting(await createWalkthrough(env, "sofia-rossi", "change-of-residence", "de", false));
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

	it("landlord confirmed the move: open slip on the desk, rows filled with the landlord as source", async () => {
		const lena = await gov.getCitizenProfile(env, "lena-huber");
		const [move] = getSuggestions(lena, gov.today(), "en");
		expect(move).toMatchObject({ serviceId: "change-of-residence", title: "Register your new address" });
		expect(move.reason).toContain("Karl Steiner");
		expect(move.reason).toContain("Florianigasse 18/5, 1080 Wien");

		const w = await createWalkthrough(env, "lena-huber", "change-of-residence", "en", false);
		expect(w.steps.map((s) => `${s.kind}${s.fieldId ? `:${s.fieldId}` : ""}`)).toEqual([
			"intro",
			"check",
			"autofill:new_address",
			"autofill:move_in_date",
			"ask:residence_type",
			"autofill:previous_address",
			"ask:deregister_previous",
			"autofill:landlord_signature",
			"autofill:id_document",
			"review",
		]);
		expect(w.steps[0].narration).toContain("You answer 2 questions.");
		const address = w.fields.find((f) => f.id === "new_address")!;
		expect(address).toMatchObject({ value: "Florianigasse 18/5, 1080 Wien", source: "confirmed", confirmedBy: { name: "Karl Steiner", role: "Landlord" } });
		expect(w.steps.find((s) => s.fieldId === "new_address")?.narration).toBe(
			"Your landlord Karl Steiner confirmed your new address: Florianigasse 18/5, 1080 Wien.",
		);
		expect(w.fields.find((f) => f.id === "previous_address")?.source).toBe("profile");

		// Changing a confirmed value makes it the citizen's own answer.
		const changed = answer(engine.editField(playUntilWaiting(w), "new_address"), "new_address", "Lange Gasse 3/1, 1080 Wien").walkthrough;
		expect(changed.fields.find((f) => f.id === "new_address")).toMatchObject({ source: "citizen" });
		expect(changed.fields.find((f) => f.id === "new_address")?.confirmedBy).toBeUndefined();

		// Settled once she is registered there: no slip on the desk any more.
		expect(getSuggestions({ ...lena, primaryAddress: "Florianigasse 18/5, 1080 Wien" }, gov.today(), "en")).toEqual([]);
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

describe("address check helpers (Google Maps)", () => {
	const graz = toVerifiedAddress(
		[
			{ longText: "Annenstraße", types: ["route"] },
			{ longText: "24", types: ["street_number"] },
			{ longText: "8020", types: ["postal_code"] },
			{ longText: "Graz", types: ["locality", "political"] },
			{ longText: "Österreich", shortText: "AT", types: ["country"] },
		],
		"Annenstraße 24, 8020 Graz, Österreich",
	);

	it("builds the Austrian address format", () => {
		expect(graz.formatted).toBe("Annenstraße 24, 8020 Graz");
		expect(graz.precise).toBe(true);
		expect(toVerifiedAddress([{ longText: "Annenstraße", types: ["route"] }], "x").precise).toBe(false);
	});

	it("keeps the door number the citizen typed", () => {
		expect(extractDoor("Annenstraße 24/3", "24")).toBe("3");
		expect(extractDoor("Kaiserstr. 40/2/8, 1070 Wien", "40")).toBe("2/8");
		expect(extractDoor("Hauptplatz 7", "7")).toBeNull();
		expect(withDoor(graz, "3")).toBe("Annenstraße 24/3, 8020 Graz");
		expect(withDoor(graz, "")).toBe("Annenstraße 24, 8020 Graz");
	});
});

describe("Stempelpass and time saved", () => {
	it("reads the town from an Austrian address", () => {
		expect(cityOf("Neubaugasse 12/4, 1070 Wien")).toBe("Wien");
		expect(cityOf("Annenstraße 24/3, 8020 Graz")).toBe("Graz");
		expect(cityOf("somewhere")).toBeNull();
	});

	it("gives a submitted errand its stamp", () => {
		const stamp = stampForApplication({ id: "a1", serviceId: "change-of-residence", data: { new_address: "Neubaugasse 12/4, 1070 Wien" }, submittedAt: "2026-10-15T10:00:00Z" }, "de");
		expect(stamp).toMatchObject({ lines: ["Gemeldet", "Wien"], date: "15.10.2026", source: "submitted" });
		expect(formatMinutes(135, "de")).toBe("2 Std. 15 Min.");
		expect(formatMinutes(45, "en")).toBe("45 min");
	});

	it("builds the overview: open areas, time saved, stamps from records", async () => {
		const today = gov.today();
		const josef = await gov.getCitizenProfile(env, "josef-gruber");
		const open = buildOverview(josef, getSuggestions(josef, today, "de"), [], today, "de");
		expect(open.areas.find((a) => a.id === "travel")?.status).toBe("open");
		expect(open.timeSavedMin).toBe(0);
		expect(open.stamps.some((s) => s.lines[1] === "Linz")).toBe(true); // registered residence, from the records

		const done = buildOverview(
			josef,
			[],
			[{ id: "a1", citizenId: "josef-gruber", serviceId: "passport-renewal", status: "submitted", data: {}, referenceNumber: "PASS-1", createdAt: "", submittedAt: `${today}T09:00:00Z` }],
			today,
			"de",
		);
		expect(done.areas.find((a) => a.id === "travel")?.status).toBe("done");
		expect(done.timeSavedMin).toBe(30);
		expect(done.stamps[0]).toMatchObject({ lines: ["Reisepass", "beantragt"], source: "submitted" });
	});
});

describe("voice of the texts (docs/redesign/LAUFZETTEL.md)", () => {
	it("speaks without exclamation marks or prototype labels, in every case and language", async () => {
		const texts: string[] = [];
		for (const persona of ["lena-huber", "josef-gruber", "amira-haddad", "thomas-berger", "sofia-rossi", "david-novak"])
			for (const service of ["change-of-residence", "passport-renewal", "childcare-subsidy"])
				for (const lang of ["de", "en"] as const) {
					const w = await createWalkthrough(env, persona, service, lang, false);
					for (const s of w.steps) texts.push(s.title, s.narration, ...(s.checks ?? []).map((c) => c.text));
					const done = engine.markSubmitted(w, { referenceNumber: "MEL-2026-123456", authority: w.authority, submittedAt: "2026-10-15T10:00:00Z", nextSteps: getServiceDefinition(service)!.nextSteps[lang] });
					texts.push(done.steps.at(-1)!.title, done.steps.at(-1)!.narration, ...done.result!.nextSteps);
				}
		expect(texts.filter((t) => t.includes("!"))).toEqual([]);
		expect(texts.filter((t) => /mock|prototyp|simulation/i.test(t))).toEqual([]);
	});

	it("counts the questions in plain words", async () => {
		const josef = await createWalkthrough(env, "josef-gruber", "passport-renewal", "en", false);
		expect(josef.steps[0].narration).toContain("You answer 2 questions.");
		expect(josef.steps[0].narration).not.toContain("{");
	});
});

describe("language switch", () => {
	it("keeps step and answers when the walkthrough is rebuilt in another language", async () => {
		let de = playUntilWaiting(await createWalkthrough(env, "sofia-rossi", "change-of-residence", "de", false));
		de = playUntilWaiting(answer(de, "new_address", "Neubaugasse 12/4, 1070 Wien").walkthrough);
		const en = engine.carryProgress(await createWalkthrough(env, "sofia-rossi", "change-of-residence", "en", false), de);
		expect(en.language).toBe("en");
		expect(en.steps[en.current].id).toBe(de.steps[de.current].id);
		expect(en.fields.find((f) => f.id === "new_address")?.value).toBe("Neubaugasse 12/4, 1070 Wien");
		expect(en.steps[en.current].title).toBe("When did you move in?");
	});

	it("keeps the citizen's own answer over a value the rebuild fills in again", async () => {
		let de = await createWalkthrough(env, "lena-huber", "change-of-residence", "de", false);
		de = answer(engine.editField(playUntilWaiting(de), "new_address"), "new_address", "Lange Gasse 3/1, 1080 Wien").walkthrough;
		const en = engine.carryProgress(await createWalkthrough(env, "lena-huber", "change-of-residence", "en", false), de);
		expect(en.fields.find((f) => f.id === "new_address")).toMatchObject({ value: "Lange Gasse 3/1, 1080 Wien", source: "citizen" });
		expect(en.fields.find((f) => f.id === "new_address")?.confirmedBy).toBeUndefined();
		expect(en.fields.find((f) => f.id === "move_in_date")?.confirmedBy?.role).toBe("Landlord");
	});
});

describe("appointment offices", () => {
	it("offers the office in the citizen's region first", async () => {
		const josef = await createWalkthrough(env, "josef-gruber", "passport-renewal", "en", false);
		const slots = josef.steps.find((s) => s.kind === "appointment")?.slots ?? [];
		expect(slots.length).toBeGreaterThanOrEqual(3);
		expect(slots.slice(0, 3).map((s) => s.office)).toEqual(Array(3).fill("Bezirkshauptmannschaft Linz-Land"));
	});

	it("keeps time order inside each group and falls back to all offices", () => {
		const slots = [
			{ office: "Passbehörde Wien – Bezirksamt Mitte", slotTime: "2026-10-16T08:00" },
			{ office: "Bezirkshauptmannschaft Linz-Land", slotTime: "2026-10-16T11:00" },
			{ office: "Bezirkshauptmannschaft Linz-Land", slotTime: "2026-10-16T09:30" },
		];
		expect(nearbyFirst(slots, "Hauptplatz 7, 4020 Linz", 3).map((s) => s.slotTime)).toEqual(["2026-10-16T09:30", "2026-10-16T11:00", "2026-10-16T08:00"]);
		expect(nearbyFirst(slots, null, 2).map((s) => s.slotTime)).toEqual(["2026-10-16T08:00", "2026-10-16T09:30"]);
	});
});

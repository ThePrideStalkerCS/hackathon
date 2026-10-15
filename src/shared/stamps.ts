/**
 * Stempelpass + "time saved": the reward layer (nudging). Shared by the Worker and the frontend,
 * so keep it free of runtime dependencies.
 *
 * Nudging rules of this project (docs/CORE.md): voluntary, private (no ranking, no comparison),
 * only positive (never a penalty), only for official errands (never everyday behaviour), and every
 * rule is explained openly. A stamp records that YOU finished an errand. Nothing else.
 */
import type { Language } from "./types";

/**
 * Estimated minutes a citizen saves per errand compared with the paper route (getting the form,
 * travelling to the office, waiting, filling it in). ESTIMATES for the prototype, not official
 * figures; always shown as "geschätzt" / "estimated".
 * 👉 EXTEND HERE: replace with measured numbers from the administration.
 */
export const TIME_SAVED_MINUTES: Record<string, number> = {
	"change-of-residence": 45,
	"passport-renewal": 30,
	"childcare-subsidy": 90,
};

export type Ink = "red" | "blue" | "violet" | "green";

export type Stamp = {
	id: string;
	/** Two short lines, printed in capitals on the stamp. */
	lines: [string, string];
	/** "15.10.2026", or empty for stamps derived from records without a date. */
	date: string;
	ink: Ink;
	/** "submitted": an errand finished in this app. "record": derived from the citizen's data. */
	source: "submitted" | "record";
	/** Submitted errands: which service (picks the emblem motif in the collection). */
	serviceId?: string;
};

/** Life areas shown in the ring on the start page. */
export type AreaId = "home" | "travel" | "family" | "mobility";
export type AreaStatus = "open" | "done" | "ok";
export type Area = { id: AreaId; status: AreaStatus; serviceId?: string };

export type Overview = {
	areas: Area[];
	/** Sum of TIME_SAVED_MINUTES over the citizen's submitted applications. */
	timeSavedMin: number;
	stamps: Stamp[];
};

/** Which life area a service belongs to. */
export const SERVICE_AREA: Record<string, AreaId> = {
	"change-of-residence": "home",
	"passport-renewal": "travel",
	"childcare-subsidy": "family",
};

/** "Neubaugasse 12/4, 1070 Wien" -> "Wien" (Austrian 4-digit postcode followed by the town). */
export function cityOf(address?: string | null): string | null {
	const m = address?.match(/\b\d{4}\s+([^,\d]+?)\s*$/);
	return m ? m[1].trim() : null;
}

export function dateOf(iso: string | null | undefined): string {
	const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
	return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/** The stamp an errand earns when it is submitted. */
export function stampForApplication(app: { id: string; serviceId: string; data: Record<string, string>; submittedAt: string | null }, lang: Language): Stamp {
	const de = lang === "de";
	const date = dateOf(app.submittedAt);
	switch (app.serviceId) {
		case "change-of-residence":
			return { id: app.id, lines: [de ? "Gemeldet" : "Registered", cityOf(app.data.new_address) ?? (de ? "Wohnsitz" : "Residence")], date, ink: "red", source: "submitted", serviceId: app.serviceId };
		case "passport-renewal":
			return { id: app.id, lines: [de ? "Reisepass" : "Passport", de ? "beantragt" : "applied"], date, ink: "violet", source: "submitted", serviceId: app.serviceId };
		case "childcare-subsidy":
			return { id: app.id, lines: [de ? "Kinderbetreuung" : "Childcare", de ? "beantragt" : "applied"], date, ink: "green", source: "submitted", serviceId: app.serviceId };
		default:
			return { id: app.id, lines: [de ? "Erledigt" : "Done", app.serviceId], date, ink: "blue", source: "submitted", serviceId: app.serviceId };
	}
}

/** "1 Std. 25 Min." / "1 h 25 min" */
export function formatMinutes(min: number, lang: Language): string {
	const h = Math.floor(min / 60);
	const m = min % 60;
	if (lang === "de") return h ? `${h} Std.${m ? ` ${m} Min.` : ""}` : `${m} Min.`;
	return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

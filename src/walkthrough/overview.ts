/**
 * The start page overview: the life-areas ring, time saved and the Stempelpass.
 * Pure function, built from the citizen's data, the proactive suggestions and their applications.
 */
import type { Language } from "../shared/types";
import type { Suggestion } from "../shared/walkthrough";
import { SERVICE_AREA, TIME_SAVED_MINUTES, cityOf, dateOf, stampForApplication, type Area, type AreaId, type Overview, type Stamp } from "../shared/stamps";
import type { Application, Citizen } from "../gov/types";

const AREAS: AreaId[] = ["home", "travel", "family", "mobility"];

export function buildOverview(citizen: Citizen, suggestions: Suggestion[], applications: Application[], today: string, lang: Language): Overview {
	const submitted = applications.filter((a) => a.status === "submitted");
	const de = lang === "de";

	const areas: Area[] = AREAS.map((id) => {
		const open = suggestions.find((s) => SERVICE_AREA[s.serviceId] === id);
		if (open) return { id, status: "open", serviceId: open.serviceId };
		const done = submitted.find((a) => SERVICE_AREA[a.serviceId] === id);
		if (done) return { id, status: "done", serviceId: done.serviceId };
		return { id, status: "ok" };
	});

	// Stamps from errands finished here, newest first …
	const stamps: Stamp[] = submitted
		.slice()
		.sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""))
		.map((a) => stampForApplication(a, lang));

	// … plus what the citizen's records already show (marked as such). A change of residence
	// submitted here updates the record at once: the new town, dated the day it was signed.
	const moved = submitted.find((a) => a.serviceId === "change-of-residence");
	const city = cityOf(moved?.data.new_address ?? citizen.primaryAddress);
	if (city) {
		stamps.push({ id: "record-home", lines: [de ? "Wohnsitz" : "Residence", city], date: dateOf(moved?.submittedAt), ink: "blue", source: "record" });
	}
	for (const doc of citizen.documents) {
		if (!doc.validUntil || doc.validUntil < today) continue;
		const label = { passport: de ? "Reisepass" : "Passport", id_card: de ? "Ausweis" : "ID card", residence_permit: de ? "Aufenthalt" : "Residence permit", eu_registration_certificate: de ? "EU-Anmeldung" : "EU registration" }[doc.type];
		stamps.push({ id: `record-${doc.id}`, lines: [label, `${de ? "bis" : "until"} ${doc.validUntil.slice(0, 4)}`], date: "", ink: "violet", source: "record" });
	}

	return {
		areas,
		timeSavedMin: submitted.reduce((sum, a) => sum + (TIME_SAVED_MINUTES[a.serviceId] ?? 0), 0),
		stamps,
	};
}

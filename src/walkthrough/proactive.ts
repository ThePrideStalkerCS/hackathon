/**
 * Proactive assistance: right after login, look at the citizen's data and suggest the errands
 * that are probably due ("Your passport expired", "You had a baby"). Deterministic rules, no AI,
 * so a suggestion never shows up by accident.
 *
 * 👉 EXTEND HERE: more life events (residence permit expiring, child turns 6 → school, moving
 *    detected from a forwarding order, …). Keep each rule explainable in one sentence.
 */
import type { Language } from "../shared/types";
import type { Suggestion } from "../shared/walkthrough";
import type { Citizen } from "../gov/types";
import { formatDate } from "./guides";

function addMonths(isoDate: string, months: number): string {
	const d = new Date(isoDate);
	d.setMonth(d.getMonth() + months);
	return d.toISOString().slice(0, 10);
}

/** `alreadySubmitted`: services the citizen has already applied for (no need to suggest them again). */
export function getSuggestions(citizen: Citizen, today: string, lang: Language, alreadySubmitted: string[] = []): Suggestion[] {
	return collect(citizen, today, lang).filter((s) => !alreadySubmitted.includes(s.serviceId));
}

function collect(citizen: Citizen, today: string, lang: Language): Suggestion[] {
	const out: Suggestion[] = [];
	const de = lang === "de";

	// 1. Passport expired or expiring within 6 months (Austrian citizens only).
	const passport = citizen.documents.find((d) => d.type === "passport");
	if (citizen.nationality === "AT" && passport?.validUntil) {
		if (passport.validUntil < today) {
			out.push({
				serviceId: "passport-renewal",
				urgency: "high",
				title: de ? "Reisepass erneuern" : "Renew your passport",
				reason: de ? `Ihr Reisepass ist seit ${formatDate(passport.validUntil, "de")} abgelaufen.` : `Your passport expired on ${formatDate(passport.validUntil, "en")}.`,
			});
		} else if (passport.validUntil <= addMonths(today, 6)) {
			out.push({
				serviceId: "passport-renewal",
				urgency: "normal",
				title: de ? "Reisepass erneuern" : "Renew your passport",
				reason: de ? `Ihr Reisepass läuft am ${formatDate(passport.validUntil, "de")} ab.` : `Your passport expires on ${formatDate(passport.validUntil, "en")}.`,
			});
		}
	}

	// 2. Child younger than 1 year in the household → childcare benefit is probably relevant.
	const baby = citizen.household.find((m) => m.relation === "child" && m.birthDate >= addMonths(today, -12));
	if (baby) {
		out.push({
			serviceId: "childcare-subsidy",
			urgency: "normal",
			title: de ? "Kinderbetreuungsgeld beantragen" : "Apply for childcare benefit",
			reason: de ? `Herzlichen Glückwunsch zu ${baby.name}. Sie haben wahrscheinlich Anspruch auf Kinderbetreuungsgeld.` : `Congratulations on ${baby.name}. You are probably entitled to childcare benefit.`,
		});
	}

	// 3. No registered address.
	if (!citizen.primaryAddress) {
		out.push({
			serviceId: "change-of-residence",
			urgency: "high",
			title: de ? "Wohnsitz anmelden" : "Register your address",
			reason: de ? "Bei uns ist keine Adresse von Ihnen gemeldet." : "We have no registered address for you.",
		});
	}

	return out;
}

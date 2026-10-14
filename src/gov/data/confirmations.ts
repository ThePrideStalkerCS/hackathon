/**
 * Confirmations a third party has already given to the state. ALL DATA IS FICTIONAL.
 *
 * The 2030 idea: the landlord confirms the move in their own ID Austria app instead of signing a
 * paper Meldezettel. The registration office then knows about the new home before the citizen
 * asks, the desk shows an open routing slip (src/walkthrough/proactive.ts), and the walkthrough
 * fills the confirmed rows with the landlord as the source (field source "confirmed").
 *
 * 👉 EXTEND HERE: other third parties (employer confirms a new job, hospital reports a birth).
 */
import type { Citizen, Localized } from "../types";

export type Confirmation = {
	citizenId: string;
	serviceId: string;
	/** Who confirmed. `role` goes on the stamp ("Landlord · K. Steiner"), `yourRole` into the narration. */
	by: { name: string; role: Localized; yourRole: Localized };
	/** Form data the confirmation covers. Dates are relative to `today` so the story stays current. */
	data: (today: string) => Record<string, string>;
	/** Done once the citizen is registered at the confirmed address. */
	settled: (citizen: Citizen) => boolean;
};

function addDays(isoDate: string, days: number): string {
	const d = new Date(`${isoDate}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

const STEINER_FLAT = "Florianigasse 18/5, 1080 Wien";

export const CONFIRMATIONS: Confirmation[] = [
	{
		citizenId: "lena-huber",
		serviceId: "change-of-residence",
		by: { name: "Karl Steiner", role: { de: "Vermieter", en: "Landlord" }, yourRole: { de: "Ihr Vermieter", en: "Your landlord" } },
		data: (today) => ({ new_address: STEINER_FLAT, move_in_date: addDays(today, -1), landlord_signature: "yes" }),
		settled: (c) => c.primaryAddress === STEINER_FLAT || c.secondaryAddress === STEINER_FLAT,
	},
];

/** Confirmations for this citizen that still wait for the citizen's part. */
export function openConfirmations(citizen: Citizen): Confirmation[] {
	return CONFIRMATIONS.filter((c) => c.citizenId === citizen.id && !c.settled(citizen));
}

export function openConfirmation(citizen: Citizen, serviceId: string): Confirmation | undefined {
	return openConfirmations(citizen).find((c) => c.serviceId === serviceId);
}

/**
 * Fictional appointment offices of the mock backend (all data in this project is synthetic), and
 * which part of Austria each one serves: the first digit of the postcode (1 Wien, 4 Oberösterreich).
 */
export const OFFICES = [
	{ name: "Passbehörde Wien – Bezirksamt Mitte", region: "1" },
	{ name: "Bezirkshauptmannschaft Linz-Land", region: "4" },
];

/** "Hauptplatz 7, 4020 Linz" → "4". */
export function postcodeRegion(address: string | null | undefined): string | null {
	const m = address?.match(/\b(\d)\d{3}\b/);
	return m ? m[1] : null;
}

/** Slots at an office in the citizen's region first (each group in time order), then the rest. */
export function nearbyFirst<T extends { office: string; slotTime: string }>(slots: T[], address: string | null | undefined, limit: number): T[] {
	const region = postcodeRegion(address);
	const near = (s: T) => OFFICES.some((o) => o.name === s.office && o.region === region);
	const byTime = (a: T, b: T) => a.slotTime.localeCompare(b.slotTime);
	return [...slots.filter(near).sort(byTime), ...slots.filter((s) => !near(s)).sort(byTime)].slice(0, limit);
}

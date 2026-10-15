/**
 * German terms inside English narration keep their German pronunciation.
 *
 * The English showcase still says "Meldezettel", "Hauptwohnsitz" or "Florianigasse": these are the
 * words the citizen will meet on letters and at the counter, so they are kept, and spoken the way an
 * Austrian official says them. The narration is split into language runs; the voice routes speak each
 * run in its own language (src/voice/elevenlabs.ts on the server, frontend/voice.ts in the browser).
 *
 * Shared by Worker and frontend, so no runtime dependencies.
 * 👉 EXTEND HERE: add terms that appear in new guides (src/walkthrough/guides.ts).
 */
import type { Language } from "./types";

export type Run = { text: string; lang: Language };

/** Official German words that appear in the English texts. Longest first, so compounds win. */
export const GERMAN_TERMS = [
	"Zentrales Melderegister",
	"Gipfelstempel",
	"Organstrafverfügung",
	"Parkraumüberwachung",
	"Kinderbetreuungsgeld",
	"Anonymverfügung",
	"Strafverfügung",
	"Familienbeihilfe",
	"Unterkunftgeber",
	"Zulassungsstelle",
	"Nebenwohnsitz",
	"Hauptwohnsitz",
	"Melderegister",
	"Bürgerservice",
	"Meldezettel",
	"Bezirksamt",
	"Laufzettel",
	"Parkpickerl",
	"Josefstadt",
	"Finanzamt",
	"Magistrat",
	"Meldeamt",
	"Wien",
	"ÖGK",
];

const L = "\\p{L}";
const STREET = `[\\p{Lu}][\\p{Ll}ß]+(?:gasse|straße|strasse|platz|weg|ring|kai|zeile|gürtel)`;
const PATTERN = new RegExp(`(?<!${L})(?:${[...GERMAN_TERMS].sort((a, b) => b.length - a.length).join("|")}|${STREET})(?!${L})`, "gu");

/**
 * Splits a text into language runs. German texts stay one run; English texts get a German run for
 * every official German term. Whitespace and punctuation stay in the English runs.
 */
export function languageRuns(text: string, lang: Language): Run[] {
	if (lang !== "en") return [{ text, lang }];
	const runs: Run[] = [];
	let last = 0;
	for (const m of text.matchAll(PATTERN)) {
		const start = m.index ?? 0;
		if (start > last) runs.push({ text: text.slice(last, start), lang: "en" });
		runs.push({ text: m[0], lang: "de" });
		last = start + m[0].length;
	}
	if (last < text.length) runs.push({ text: text.slice(last), lang: "en" });
	// Runs of only spaces or punctuation are merged into their neighbour: nothing to speak on their own.
	const out: Run[] = [];
	for (const r of runs) {
		const prev = out[out.length - 1];
		if (prev && (prev.lang === r.lang || !/[\p{L}\p{N}]/u.test(r.text))) prev.text += r.text;
		else out.push({ ...r });
	}
	return out.filter((r) => r.text.length > 0);
}

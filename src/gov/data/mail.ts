/**
 * The citizen's digital Postfach: official letters. ALL DATA IS FICTIONAL.
 *
 * The demo story (docs/redesign/LAUFZETTEL.md): while Lena registers her new address, a parking fine
 * from the City of Vienna arrives. The Laufzettel shows the original letter and says in plain words
 * what it is, by when to pay, what happens if nothing is done, and what it has to do with the move
 * (with the new main residence she can get a Parkpickerl for the district).
 *
 * Facts (checked 15 Oct 2026 against court decisions on § 50 VStG; verify on wien.gv.at before the demo):
 *   - Vienna usually issues an Organstrafverfügung of 36 euros for parking without a ticket.
 *   - It lapses if it is not paid within two weeks; then a new notice (Anonymverfügung, more
 *     expensive) or a penalty procedure follows.
 *   - There is no appeal against the Organstrafverfügung itself (§ 50 Abs. 6 VStG).
 *   - A Parkpickerl needs the main residence in the district.
 *
 * 👉 EXTEND HERE: more letters (tax assessment, school enrolment), each with a plain-language reading.
 */
import type { Letter } from "../../shared/mail";
import type { Language } from "../../shared/types";
import type { Localized } from "../types";

type LetterDef = {
	id: string;
	citizenId: string;
	arrivesDuring?: string;
	from: string;
	kind: string;
	title: Localized;
	reference: string;
	/** Days before today the letter was issued; keeps the story current. */
	issuedDaysAgo: number;
	payWithinDays: number;
	amountEur: number;
	original: (v: { issued: string }) => string[];
	plain: (v: { issued: string; due: string }) => Record<keyof Letter["plain"], Localized>;
	spoken: (v: { due: string }) => Localized;
	sourceUrl: string;
	verified: boolean;
};

const L = (de: string, en: string): Localized => ({ de, en });

const LETTERS: LetterDef[] = [
	{
		id: "parking-fine-lange-gasse",
		citizenId: "lena-huber",
		arrivesDuring: "change-of-residence",
		from: "Magistrat der Stadt Wien · Parkraumüberwachung",
		kind: "Organstrafverfügung",
		title: L("Parkstrafe: 36 €", "Parking fine: €36"),
		reference: "OM 2026/1080/447 113",
		issuedDaysAgo: 1,
		payWithinDays: 14,
		amountEur: 36,
		original: ({ issued }) => [
			"Organstrafverfügung gemäß § 50 VStG",
			"Tatort: 1080 Wien, Lange Gasse 32",
			`Tatzeit: ${issued}, 09:42 Uhr`,
			"Kennzeichen: G 482 KL",
			"Übertretung: Abstellen eines mehrspurigen Kraftfahrzeuges in einer gebührenpflichtigen Kurzparkzone ohne gültigen Parkschein (Parkometerabgabeverordnung).",
			"Strafbetrag: EUR 36,00",
			"Die Organstrafverfügung wird gegenstandslos, wenn der Strafbetrag nicht binnen zwei Wochen ab Ausfertigung eingezahlt wird. In diesem Fall wird ein Verwaltungsstrafverfahren eingeleitet. Gegen die Organstrafverfügung ist kein Rechtsmittel zulässig.",
		],
		plain: ({ issued, due }) => ({
			what: L(
				`Ihr Auto G 482 KL stand am ${issued} um 9:42 in der Lange Gasse, 1080 Wien. Dort ist Kurzparkzone, und es lag kein Parkschein im Auto.`,
				`Your car G 482 KL was parked in Lange Gasse, 1080 Wien, on ${issued} at 9:42. It is a short-term parking zone, and there was no parking ticket.`,
			),
			deadline: L(`Zahlen Sie 36 € bis ${due}. Das sind zwei Wochen ab Ausstellung.`, `Pay €36 by ${due}. That is two weeks from the date of the fine.`),
			ifNothing: L(
				"Ist bis dahin nicht bezahlt, verfällt diese Strafe. Dann kommt eine neue, die mehr kostet, die Anonymverfügung.",
				"If it is not paid by then, this fine lapses and a new one follows that costs more, the Anonymverfügung.",
			),
			disagree: L(
				"Einspruch gegen diesen Strafzettel ist nicht möglich. Halten Sie ihn für falsch, zahlen Sie nicht: Im folgenden Verfahren können Sie sich wehren.",
				"You cannot appeal this ticket itself. If you think it is wrong, don't pay: you can object in the procedure that follows.",
			),
			move: L(
				"Gut zu wissen: Sobald die Florianigasse Ihr Hauptwohnsitz ist, können Sie ein Parkpickerl für den 8. Bezirk beantragen. Dann parken Sie dort ohne Parkschein.",
				"Good to know: once Florianigasse is your Hauptwohnsitz, you can apply for a Parkpickerl for the 8th district. Then you park there without a ticket.",
			),
		}),
		spoken: ({ due }) =>
			L(
				`Ein Strafzettel der Stadt Wien: 36 Euro, zahlbar bis ${due}. Danach wird es teurer. Mit dem neuen Hauptwohnsitz bekommen Sie ein Parkpickerl.`,
				`A parking fine from the City of Vienna: 36 euros, due by ${due}. After that it costs more. With your new Hauptwohnsitz you can get a Parkpickerl.`,
			),
		sourceUrl: "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10005770",
		verified: false,
	},
];

function addDays(isoDate: string, days: number): string {
	const d = new Date(`${isoDate}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

function longDate(iso: string, lang: Language): string {
	return new Intl.DateTimeFormat(lang === "de" ? "de-AT" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}

/** The citizen's letters in one language. `today` is an ISO date. */
export function lettersFor(citizenId: string, lang: Language, today: string): Letter[] {
	return LETTERS.filter((l) => l.citizenId === citizenId).map((l) => {
		const issuedIso = addDays(today, -l.issuedDaysAgo);
		const dueIso = addDays(issuedIso, l.payWithinDays);
		const issued = longDate(issuedIso, lang);
		const due = longDate(dueIso, lang);
		const plain = l.plain({ issued, due });
		return {
			id: l.id,
			...(l.arrivesDuring ? { arrivesDuring: l.arrivesDuring } : {}),
			from: l.from,
			kind: l.kind,
			title: l.title[lang],
			reference: l.reference,
			issued: issuedIso,
			due: dueIso,
			amountEur: l.amountEur,
			original: l.original({ issued: longDate(issuedIso, "de") }),
			plain: {
				what: plain.what[lang],
				deadline: plain.deadline[lang],
				ifNothing: plain.ifNothing[lang],
				disagree: plain.disagree[lang],
				move: plain.move[lang],
			},
			spoken: l.spoken({ due })[lang],
			sourceUrl: l.sourceUrl,
			verified: l.verified,
		};
	});
}

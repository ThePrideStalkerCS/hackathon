/**
 * Curated knowledge about each public service. The assistant must base factual answers on this
 * content (via the get_service_info tool) and cite the source URL.
 *
 * Checked on 16 Oct 2026 against the official pages on oesterreich.gv.at (links in `sourceUrl`).
 * Re-check fees and limits before a live demo: they change every year.
 * 2030 concept, not today's law: the passport photo reaching the office online (src/gov/data/services.ts).
 *
 * 👉 EXTEND HERE: for larger content, consider Cloudflare AI Search (RAG over official pages):
 *    https://developers.cloudflare.com/ai-search/
 */
import type { Language } from "../shared/types";

export type KnowledgeEntry = {
	serviceId: string;
	sourceUrl: string;
	verified: boolean;
	content: Record<Language, string>;
};


export const KNOWLEDGE: KnowledgeEntry[] = [
	{
		serviceId: "change-of-residence",
		sourceUrl: "https://www.oesterreich.gv.at/en/themen/persoenliche_dokumente_und_bestaetigungen/an__abmeldung_des_wohnsitzes/Seite.1180200",
		verified: true,
		content: {
			de: `Meldepflicht: Wer in eine Wohnung zieht, muss sich innerhalb von drei Tagen nach dem Einzug bei der Meldebehörde (Gemeindeamt bzw. Magistrat) anmelden.
Benötigt wird: ein ausgefüllter Meldezettel, der von der Unterkunftgeberin bzw. dem Unterkunftgeber (z. B. Vermieter:in) unterschrieben ist, sowie ein amtlicher Lichtbildausweis. Nicht-österreichische Staatsangehörige bringen zusätzlich ein Reisedokument bzw. ihren Aufenthaltstitel mit.
Hauptwohnsitz ist der Ort, an dem man den Mittelpunkt seiner Lebensbeziehungen hat. Man kann daneben Nebenwohnsitze haben.
Die Abmeldung der alten Adresse kann bei der Ummeldung gleichzeitig erledigt werden.
Die Anmeldung ist persönlich, per Post oder online mit ID Austria möglich (nicht per E-Mail oder Fax). Sie ist kostenlos.
Zuständig ist die Meldebehörde des neuen Wohnorts: Gemeindeamt, in Statutarstädten der Magistrat, in Wien das Magistratische Bezirksamt.
Wer sich nicht rechtzeitig anmeldet, begeht eine Verwaltungsübertretung (Geldstrafe bis zu 726 Euro).`,
			en: `Registration obligation: anyone who moves into a home must register with the registration office (municipal office) within three days of moving in.
You need: a completed registration form (Meldezettel) signed by the accommodation provider (e.g. landlord), and an official photo ID. Non-Austrian citizens also bring their travel document or residence title.
The main residence is where your life is centred. You can also have secondary residences.
Deregistering the old address can be done at the same time.
You can register in person, by post or online with ID Austria (not by e-mail or fax). It is free of charge.
The registration office of the new place of residence is responsible: the municipal office, in statutory cities the Magistrat, in Vienna the municipal district office.
Registering late is an administrative offence (fine of up to 726 euros).`,
		},
	},
	{
		serviceId: "passport-renewal",
		sourceUrl: "https://www.oesterreich.gv.at/de/themen/persoenliche_dokumente_und_bestaetigungen/reisepass/Seite.020100",
		verified: true,
		content: {
			de: `Ein Reisepass wird persönlich bei einer Passbehörde beantragt (in Österreich: Bezirkshauptmannschaft bzw. Magistrat; im Ausland: österreichische Botschaft oder Konsulat). Bei der Antragstellung werden Fingerabdrücke abgenommen.
Mitzubringen sind in der Regel: der bisherige Reisepass (falls vorhanden), ein aktuelles Passfoto und ein Lichtbildausweis. In bestimmten Fällen sind weitere Dokumente nötig (z. B. Staatsbürgerschaftsnachweis).
Ein Reisepass kostet 112 Euro (Expresspass 148 Euro). Online kann er nicht beantragt werden. Der Pass wird innerhalb von etwa fünf Arbeitstagen per Post an die angegebene Adresse zugestellt.
Österreichische Reisepässe werden nur an österreichische Staatsbürger:innen ausgestellt.`,
			en: `A passport is applied for in person at a passport authority (in Austria: the district authority or municipal office; abroad: the Austrian embassy or consulate). Fingerprints are taken when you apply.
You usually bring: your old passport (if you have one), a current passport photo and a photo ID. In some cases further documents are needed (e.g. proof of citizenship).
A passport costs 112 euros (express passport 148 euros). It cannot be applied for online. It is delivered by post to the address you give within about five working days.
Austrian passports are only issued to Austrian citizens.`,
		},
	},
	{
		serviceId: "childcare-subsidy",
		sourceUrl: "https://www.oesterreich.gv.at/de/themen/familie_und_partnerschaft/finanzielle-unterstuetzungen/3/2/Seite.080613",
		verified: true,
		content: {
			de: `Kinderbetreuungsgeld ist eine finanzielle Leistung für Eltern von Kleinkindern. Es gibt zwei Systeme: das pauschale Kinderbetreuungsgeld-Konto und das einkommensabhängige Kinderbetreuungsgeld.
Zuständig ist der Krankenversicherungsträger (z. B. die Österreichische Gesundheitskasse, ÖGK).
Wichtige Voraussetzungen sind u. a.: Bezug der Familienbeihilfe für das Kind, gemeinsamer Haushalt mit dem Kind, Lebensmittelpunkt in Österreich, rechtmäßiger Aufenthalt und die Durchführung der Eltern-Kind-Pass-Untersuchungen.
Der Antrag kann frühestens ab dem Tag der Geburt gestellt werden, rückwirkend bis zu 182 Tage. Er ist kostenlos und auch online mit ID Austria möglich.
Ein Wechsel zwischen den beiden Systemen ist nur innerhalb von 14 Tagen nach dem ersten Antrag möglich und bindet auch den anderen Elternteil.
Das einkommensabhängige Kinderbetreuungsgeld beträgt 80 Prozent des letzten Einkommens, höchstens 80,12 Euro pro Tag, und setzt 182 Tage durchgehende Erwerbstätigkeit vor der Geburt voraus.`,
			en: `Childcare benefit (Kinderbetreuungsgeld) is financial support for parents of young children. There are two systems: the flat-rate childcare benefit account and the income-related childcare benefit.
It is handled by the health insurance provider (e.g. the Austrian Health Insurance Fund, ÖGK).
Key requirements include: receiving family allowance (Familienbeihilfe) for the child, living in the same household as the child, centre of life in Austria, lawful residence, and completing the Eltern-Kind-Pass (parent-child health booklet) examinations.
You can apply from the day of birth at the earliest, and up to 182 days retroactively. It is free and also possible online with ID Austria.
Switching between the two systems is only possible within 14 days of the first application, and the choice binds the other parent too.
The income-related benefit is 80 percent of the last income, at most 80.12 euros per day, and requires 182 days of continuous employment before the birth.`,
		},
	},
];

export function getKnowledge(serviceId: string): KnowledgeEntry | undefined {
	return KNOWLEDGE.find((k) => k.serviceId === serviceId);
}

/**
 * Gamified goals: each government errand is a "quest" with a progress bar made of steps.
 *
 * This is a frontend-only prototype (no agent state yet). Progress is kept in localStorage so the
 * demo survives a reload. Step texts follow src/knowledge/index.ts; facts there are NOT verified yet.
 *
 * 👉 EXTEND HERE: move progress into the agent state (AssistantState) so the assistant can tick off
 * steps itself (e.g. "age" from the population register) and the progress follows the citizen.
 */
import type { Language } from "../../src/shared/types";

type L = Record<Language, string>;

export type GoalIconName = "home" | "car" | "passport" | "eu" | "family";

export type GoalStep = {
	id: string;
	title: L;
	/** Plain-language explanation shown under the step. */
	hint: L;
	/** "system" = the assistant can check it from the citizen's data, "citizen" = you have to do it. */
	who: "system" | "citizen";
};

export type Goal = {
	id: string;
	/** Line icon, drawn in goals/shared.tsx (GoalIcon). */
	icon: GoalIconName;
	name: L;
	/** Wording of the completion record shown when the bar reaches 100 %. */
	badge: L;
	/** Service id of a guided walkthrough, if one exists (see src/gov/data/services.ts). */
	serviceId?: string;
	sourceUrl: string;
	steps: GoalStep[];
};

export const GOALS: Goal[] = [
	{
		id: "registration",
		icon: "home",
		name: { de: "Meldezettel (Wohnsitz anmelden)", en: "Registration form (Meldezettel)" },
		badge: { de: "Wohnsitz gemeldet", en: "Residence registered" },
		serviceId: "change-of-residence",
		sourceUrl: "https://www.oesterreich.gv.at/en/formsearch",
		steps: [
			{ id: "form", who: "citizen", title: { de: "Meldezettel ausfüllen", en: "Fill in the registration form" }, hint: { de: "Ich zeige Ihnen Feld für Feld, was hineingehört.", en: "I'll show you field by field what goes where." } },
			{ id: "signature", who: "citizen", title: { de: "Unterschrift der Unterkunftgeberin / des Unterkunftgebers", en: "Signature of the accommodation provider" }, hint: { de: "Zum Beispiel Ihre Vermieterin oder Ihr Vermieter.", en: "For example your landlord." } },
			{ id: "id", who: "system", title: { de: "Amtlicher Lichtbildausweis", en: "Official photo ID" }, hint: { de: "Pass oder Personalausweis. Wir sehen ihn in Ihren Daten.", en: "Passport or ID card. We can see it in your data." } },
			{ id: "submit", who: "citizen", title: { de: "Bei der Meldebehörde abgeben", en: "Hand it in at the registration office" }, hint: { de: "Am Gemeindeamt / Magistrat oder online mit ID Austria.", en: "At the municipal office or online with ID Austria." } },
		],
	},
	{
		id: "driving-licence",
		icon: "car",
		name: { de: "Führerschein", en: "Driving licence" },
		badge: { de: "Lenkberechtigung erworben", en: "Driving licence obtained" },
		sourceUrl: "https://www.oesterreich.gv.at/en/themen/persoenliche_dokumente_und_bestaetigungen/fuehrerschein/1/1/Seite.040160",
		steps: [
			{ id: "age", who: "system", title: { de: "Mindestalter erreicht", en: "You have reached the minimum age" }, hint: { de: "Wir prüfen das aus Ihrem Geburtsdatum.", en: "We check this from your date of birth." } },
			{ id: "medical", who: "citizen", title: { de: "Ärztliches Gutachten", en: "Medical certificate" }, hint: { de: "Eine Ärztin oder ein Arzt bestätigt, dass Sie fahrtauglich sind.", en: "A doctor confirms that you are fit to drive." } },
			{ id: "first-aid", who: "citizen", title: { de: "Kurs: Lebensrettende Sofortmaßnahmen", en: "Emergency life-saving training" }, hint: { de: "Ein Erste-Hilfe-Kurs, zum Beispiel beim Roten Kreuz.", en: "A first-aid course, for example at the Red Cross." } },
			{ id: "theory", who: "citizen", title: { de: "Theorieprüfung bestanden", en: "Theory test passed" }, hint: { de: "Die Prüfung am Computer über Verkehrsregeln.", en: "The computer test about traffic rules." } },
			{ id: "practical", who: "citizen", title: { de: "Praktische Fahrprüfung", en: "Practical driving test" }, hint: { de: "Die Fahrt mit der Prüferin oder dem Prüfer. Danach bekommen Sie Ihren Führerschein.", en: "The drive with the examiner. After that you get your licence." } },
		],
	},
	{
		id: "passport",
		icon: "passport",
		name: { de: "Reisepass erneuern", en: "Renew the passport" },
		badge: { de: "Reisepass erneuert", en: "Passport renewed" },
		serviceId: "passport-renewal",
		sourceUrl: "https://www.oesterreich.gv.at/en/formsearch",
		steps: [
			{ id: "photo", who: "citizen", title: { de: "Aktuelles Passfoto", en: "Current passport photo" }, hint: { de: "Ein neues Foto, das den Passbild-Kriterien entspricht.", en: "A new photo that meets the passport photo rules." } },
			{ id: "old", who: "system", title: { de: "Alten Pass bereithalten", en: "Have your old passport ready" }, hint: { de: "Falls Sie einen haben. Wir sehen das Ablaufdatum in Ihren Daten.", en: "If you have one. We can see the expiry date in your data." } },
			{ id: "appointment", who: "citizen", title: { de: "Termin bei der Passbehörde", en: "Appointment at the passport office" }, hint: { de: "Persönlich, dort werden Fingerabdrücke abgenommen.", en: "In person, your fingerprints are taken there." } },
			{ id: "delivery", who: "citizen", title: { de: "Pass per Post erhalten", en: "Receive the passport by post" }, hint: { de: "Der neue Pass kommt in der Regel per Post.", en: "The new passport usually arrives by post." } },
		],
	},
	{
		id: "eu-residence",
		icon: "eu",
		name: { de: "Wohnsitzwechsel (EU-Bürger:innen)", en: "Change of residence (EU citizens)" },
		badge: { de: "Aufenthalt bescheinigt", en: "Residence certified" },
		sourceUrl: "https://www.oesterreich.gv.at/en/formsearch",
		steps: [
			{ id: "register", who: "citizen", title: { de: "Wohnsitz anmelden (Meldezettel)", en: "Register your address (Meldezettel)" }, hint: { de: "Der erste Schritt nach dem Umzug.", en: "The first step after you move." } },
			{ id: "proof", who: "citizen", title: { de: "Nachweis über Arbeit oder ausreichende Mittel", en: "Proof of work or sufficient funds" }, hint: { de: "Zum Beispiel ein Arbeitsvertrag.", en: "For example an employment contract." } },
			{ id: "insurance", who: "citizen", title: { de: "Krankenversicherung nachweisen", en: "Proof of health insurance" }, hint: { de: "Ihre e-card oder ein Versicherungsnachweis.", en: "Your e-card or proof of insurance." } },
			{ id: "certificate", who: "citizen", title: { de: "Anmeldebescheinigung beantragen", en: "Apply for the registration certificate" }, hint: { de: "Bei der Aufenthaltsbehörde Ihres Wohnorts.", en: "At the residence authority where you live." } },
		],
	},
	{
		id: "childcare",
		icon: "family",
		name: { de: "Kinderbetreuungsgeld", en: "Childcare benefit" },
		badge: { de: "Kinderbetreuungsgeld beantragt", en: "Childcare benefit applied for" },
		serviceId: "childcare-subsidy",
		sourceUrl: "https://www.oesterreich.gv.at/en/formsearch",
		steps: [
			{ id: "child", who: "system", title: { de: "Geburt des Kindes eingetragen", en: "Child's birth registered" }, hint: { de: "Wir sehen Ihr Kind bereits in Ihren Daten.", en: "We can already see your child in your data." } },
			{ id: "family-allowance", who: "system", title: { de: "Familienbeihilfe bezogen", en: "Receiving family allowance" }, hint: { de: "Wir prüfen das automatisch.", en: "We check this automatically." } },
			{ id: "model", who: "citizen", title: { de: "Modell wählen", en: "Choose a model" }, hint: { de: "Pauschal (Konto) oder einkommensabhängig. Ich erkläre den Unterschied.", en: "Flat-rate (account) or income-related. I'll explain the difference." } },
			{ id: "iban", who: "citizen", title: { de: "Konto für die Auszahlung angeben", en: "Enter your bank account" }, hint: { de: "Ihre IBAN, damit das Geld ankommt.", en: "Your IBAN so the money arrives." } },
			{ id: "submit", who: "citizen", title: { de: "Antrag absenden", en: "Submit the application" }, hint: { de: "Nur Sie drücken den Knopf, nicht der Assistent.", en: "Only you press the button, not the assistant." } },
		],
	},
];

/** Demo progress: which steps are already done (step ids per goal). */
const DEMO_PROGRESS: Record<string, string[]> = {
	registration: ["form", "signature", "id"],
	"driving-licence": ["age", "medical"],
	passport: ["old"],
	"eu-residence": [],
	childcare: ["child", "family-allowance", "model"],
};

const STORAGE_KEY = "goalProgress";

export type Progress = Record<string, string[]>;

export function loadProgress(): Progress {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return { ...DEMO_PROGRESS, ...JSON.parse(raw) };
	} catch {
		// Storage blocked (private mode): fall back to the demo data.
	}
	return { ...DEMO_PROGRESS };
}

export function saveProgress(p: Progress | null): Progress {
	try {
		if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
		else localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
	return p ?? { ...DEMO_PROGRESS };
}

export function percent(goal: Goal, done: string[]): number {
	return Math.round((goal.steps.filter((s) => done.includes(s.id)).length / goal.steps.length) * 100);
}

/**
 * Plain-language "script" for each service: what the narrator says at every step, the official
 * term next to its plain-language explanation, and the questions for the citizen.
 *
 * Written by hand on purpose: these texts are spoken to the citizen, so they must be correct and
 * must not change between runs. The LLM is only used for follow-up questions ("What does that
 * mean?") and for understanding free-text / voice answers.
 *
 * Placeholders: {value} (field value), {questions} ("You only answer two questions."), {name} (first name,
 * or in `confirmed` texts the person who confirmed), {yourRole} ("Your landlord").
 *
 * ⚠️ Facts in these texts (deadlines, requirements) must match src/knowledge/ and be verified on
 *    oesterreich.gv.at before the demo. Explanations of terms are fine as they are.
 *
 * 👉 EXTEND HERE: add a guide for every new service in src/gov/data/services.ts. Services without a
 *    guide still work: the engine falls back to the form labels and hints.
 */
import type { Language } from "../shared/types";
import type { Citizen, Localized } from "../gov/types";

export type FieldGuide = {
	/** Question for the citizen (ask step). */
	question?: Localized;
	/** Narration when the assistant fills the field itself (autofill step). */
	autofill?: Localized;
	/** Narration when a third party already confirmed the value (src/gov/data/confirmations.ts). */
	confirmed?: Localized;
	/** Official term as it appears on forms (shown as "Amtsdeutsch"). Defaults to the field label. */
	officialTerm?: Localized;
	/** What the official term means, in plain language. */
	explain?: Localized;
	/** Shown when a "must be yes" field is answered with "no". */
	ifNo?: Localized;
	/** Plain-language explanation per select option. */
	optionExplain?: Record<string, Localized>;
	/** Skip this field entirely unless another field has a value (e.g. deregister only if there was a previous address). */
	onlyIfFilled?: string;
	/** Value the assistant can derive from the citizen's data (shown as "assistant" source, the citizen can change it). */
	suggest?: (citizen: Citizen, today: string) => string | undefined;
};

export type ServiceGuide = {
	/** Short task title, e.g. "Wohnsitz ummelden". */
	title: Localized;
	/** Title of the simulated portal page. */
	portalTitle: Localized;
	/** Simulated address bar. Deliberately not a real domain. */
	portalUrl: string;
	intro: Localized;
	fields: Record<string, FieldGuide>;
	appointment?: Localized;
};

const L = (de: string, en: string): Localized => ({ de, en });

export const GUIDES: Record<string, ServiceGuide> = {
	"change-of-residence": {
		title: L("Wohnsitz ummelden", "Register your new address"),
		portalTitle: L("Meldezettel – Wohnsitz an- oder ummelden", "Registration form (Meldezettel) – register your residence"),
		portalUrl: "portal.amt.example/meldewesen/meldezettel",
		intro: L(
			"Sie sind umgezogen. Wir melden die neue Adresse mit dem Meldezettel an. Was die Ämter wissen, tragen sie selbst ein. {questions}",
			"You moved, so we register your new address on the Meldezettel. The offices fill in what they know. {questions}",
		),
		fields: {
			new_address: {
				confirmed: L(
					"{yourRole} {name} hat die neue Adresse bestätigt: {value}.",
					"{yourRole} {name} confirmed your new address: {value}.",
				),
				question: L("Wie lautet Ihre neue Adresse?", "What is your new address?"),
				officialTerm: L("Unterkunft (neue Adresse)", "Accommodation (new address)"),
				explain: L(
					"Die Adresse der Wohnung, in die Sie eingezogen sind: Straße, Hausnummer, Tür, Postleitzahl und Ort.",
					"The address of the home you moved into: street, house number, door, postcode and town.",
				),
			},
			move_in_date: {
				confirmed: L("Eingezogen am {value}.", "Moved in on {value}."),
				question: L("Wann sind Sie eingezogen?", "When did you move in?"),
				officialTerm: L("Einzugsdatum", "Move-in date"),
				explain: L(
					"Der Tag, an dem Sie in die neue Wohnung gezogen sind. Laut unseren Unterlagen müssen Sie sich innerhalb von 3 Tagen danach anmelden.",
					"The day you moved into the new home. According to our information, you have to register within 3 days.",
				),
			},
			residence_type: {
				question: L("Ist das jetzt Ihre Hauptwohnung?", "Is this now your main home?"),
				officialTerm: L("Hauptwohnsitz oder Nebenwohnsitz", "Main or secondary residence"),
				explain: L(
					"Hauptwohnsitz ist, wo Sie hauptsächlich leben. Nebenwohnsitz ist eine zusätzliche Wohnung, etwa fürs Studium.",
					"Hauptwohnsitz is where you mainly live. Nebenwohnsitz is an extra home, for example for studying.",
				),
				optionExplain: {
					main: L("Hier lebe ich hauptsächlich.", "This is where I mainly live."),
					secondary: L("Eine zusätzliche Wohnung, ich lebe hauptsächlich woanders.", "An additional home, I mainly live somewhere else."),
				},
			},
			previous_address: {
				autofill: L(
					"Die alte Adresse kommt aus dem Melderegister: {value}.",
					"Your old address comes from the Melderegister: {value}.",
				),
				question: L(
					"Wo haben Sie bisher gewohnt? Wenn Sie aus dem Ausland kommen, können Sie das überspringen.",
					"Where did you live before? If you are coming from abroad, you can skip this.",
				),
				officialTerm: L("Bisherige Unterkunft", "Previous accommodation"),
				explain: L("Die Adresse, an der Sie vor dem Umzug gemeldet waren.", "The address where you were registered before you moved."),
			},
			deregister_previous: {
				onlyIfFilled: "previous_address",
				question: L("Soll ich Ihre alte Adresse gleich abmelden?", "Shall I deregister your old address at the same time?"),
				officialTerm: L("Abmeldung", "Deregistration"),
				explain: L(
					"Dann ist die alte Adresse im selben Schritt abgemeldet.",
					"Then the old address is closed in the same step.",
				),
			},
			landlord_signature: {
				confirmed: L(
					"{name} hat als Vermieter digital unterschrieben.",
					"{name} signed digitally as your landlord.",
				),
				question: L(
					"Hat Ihre Vermieterin oder Ihr Vermieter den Meldezettel unterschrieben?",
					"Has your landlord signed the registration form?",
				),
				officialTerm: L("Unterschrift der Unterkunftgeberin / des Unterkunftgebers", "Signature of the accommodation provider"),
				explain: L(
					"Unterkunftgeber ist die Person, die Ihnen die Wohnung überlässt, meistens die Vermieterin oder der Vermieter. Mit der Unterschrift bestätigt sie, dass Sie dort wohnen.",
					"The accommodation provider is the person who lets you live in the home, usually your landlord. By signing, they confirm that you live there.",
				),
				ifNo: L(
					"Ohne diese Unterschrift kann ich den Antrag nicht einreichen. Bitten Sie Ihre Vermieterin oder Ihren Vermieter darum. Ihre Angaben bleiben gespeichert, Sie können später hier weitermachen.",
					"I can't submit the application without this signature. Please ask your landlord to sign. Your answers are saved and you can continue here later.",
				),
			},
			id_document: {
				autofill: L(
					"Ihr {value} aus dem Register gilt als Ausweis.",
					"Your {value} from the register counts as your ID.",
				),
				question: L(
					"Ich habe keinen gültigen Ausweis mit Foto von Ihnen gefunden. Haben Sie einen anderen? Bitte nennen Sie die Art und die Nummer.",
					"I couldn't find a valid photo ID for you. Do you have another one? Please tell me the type and the number.",
				),
				officialTerm: L("Amtlicher Lichtbildausweis", "Official photo ID"),
				explain: L(
					"Ein gültiger Ausweis mit Foto, den eine Behörde ausgestellt hat, zum Beispiel Reisepass oder Personalausweis.",
					"A valid ID with a photo issued by an authority, for example a passport or an ID card.",
				),
			},
		},
	},

	"passport-renewal": {
		title: L("Reisepass erneuern", "Renew your passport"),
		portalTitle: L("Reisepass – Antrag vorbereiten und Termin buchen", "Passport – prepare the application and book an appointment"),
		portalUrl: "portal.amt.example/reisedokumente/reisepass",
		intro: L(
			"Einen neuen Reisepass beantragt man persönlich bei der Passbehörde, weil dort Fingerabdrücke genommen werden. Ich bereite den Antrag mit Ihnen vor und suche einen Termin. {questions}",
			"You apply for a new passport in person at the passport office, because your fingerprints are taken there. I'll prepare the application with you and find an appointment. {questions}",
		),
		fields: {
			reason: {
				question: L("Was ist mit Ihrem bisherigen Pass?", "What is the situation with your current passport?"),
				autofill: L(
					"Ihr Pass ist abgelaufen oder läuft bald ab. Als Grund ist deshalb „{value}“ vorbefüllt. Sie können das ändern.",
					"Your passport has expired or expires soon, so “{value}” is prefilled as the reason. You can change it.",
				),
				officialTerm: L("Antragsgrund", "Reason for application"),
				explain: L("Wählen Sie, was auf Sie zutrifft.", "Choose what applies to you."),
				optionExplain: {
					expired: L("Der Pass gilt nicht mehr oder läuft in den nächsten Monaten ab.", "The passport is no longer valid or runs out in the next few months."),
					lost_or_stolen: L("Sie haben den Pass nicht mehr.", "You no longer have the passport."),
					damaged: L("Der Pass ist kaputt, zum Beispiel nass geworden oder eingerissen.", "The passport is broken, for example wet or torn."),
					name_change: L("Sie heißen jetzt anders, zum Beispiel nach einer Heirat.", "Your name has changed, for example after a marriage."),
				},
				suggest: (c, today) => {
					const passport = c.documents.find((d) => d.type === "passport");
					if (!passport?.validUntil) return undefined;
					const inSixMonths = new Date(today);
					inSixMonths.setMonth(inSixMonths.getMonth() + 6);
					return passport.validUntil <= inSixMonths.toISOString().slice(0, 10) ? "expired" : undefined;
				},
			},
			delivery_address: {
				autofill: L(
					"Der neue Pass kommt per Post, an Ihre Adresse im Melderegister: {value}.",
					"The new passport is sent by post to your address in the population register: {value}.",
				),
				question: L("An welche Adresse sollen wir den neuen Pass schicken?", "Where should we send the new passport?"),
				officialTerm: L("Zustelladresse", "Delivery address"),
				explain: L("Die Adresse, an die die Post den fertigen Pass bringt.", "The address where the post delivers the finished passport."),
			},
			biometric_photo: {
				question: L("Bringen Sie ein aktuelles Passfoto zum Termin mit?", "Will you bring a current passport photo to the appointment?"),
				officialTerm: L("Biometrisches Lichtbild", "Biometric photo"),
				explain: L(
					"Ein Foto, das den Regeln für Passfotos entspricht. Fotografen und Fotoautomaten kennen diese Regeln.",
					"A photo that meets the rules for passport photos. Photographers and photo booths know these rules.",
				),
				ifNo: L(
					"Für den Antrag brauchen Sie ein Passfoto. Lassen Sie eines beim Fotografen oder am Fotoautomaten machen und antworten Sie dann mit Ja.",
					"You need a passport photo for the application. Get one at a photographer or photo booth, then answer yes.",
				),
			},
		},
		appointment: L(
			"Jetzt suchen wir einen Termin bei der Passbehörde. Wählen Sie einen, der Ihnen passt. Gebucht wird er erst, wenn Sie am Ende bestätigen.",
			"Now let's find an appointment at the passport office. Pick one that suits you. It is only booked when you confirm at the end.",
		),
	},

	"childcare-subsidy": {
		title: L("Kinderbetreuungsgeld beantragen", "Apply for childcare benefit"),
		portalTitle: L("Antrag auf Kinderbetreuungsgeld", "Application for childcare benefit (Kinderbetreuungsgeld)"),
		portalUrl: "portal.amt.example/familie/kinderbetreuungsgeld",
		intro: L(
			"Kinderbetreuungsgeld ist Geld vom Staat für Eltern von kleinen Kindern. Zuständig ist Ihre Krankenkasse. Ich fülle den Antrag mit Ihnen aus. {questions}",
			"Childcare benefit is money from the state for parents of young children. Your health insurance handles it. I'll fill in the application with you. {questions}",
		),
		fields: {
			child_name: {
				autofill: L("Ihr Kind {value} ist bei Ihnen gemeldet. Der Name kommt aus dem Melderegister.", "Your child {value} is registered with you. The name comes from the population register."),
				question: L("Wie heißt Ihr Kind?", "What is your child's name?"),
				officialTerm: L("Name des Kindes", "Child's name"),
			},
			child_birth_date: {
				autofill: L("Auch das Geburtsdatum steht im Register: {value}.", "The register has the date of birth too: {value}."),
				question: L("Wann wurde Ihr Kind geboren?", "When was your child born?"),
				officialTerm: L("Geburtsdatum des Kindes", "Child's date of birth"),
			},
			benefit_model: {
				question: L("Welche Art von Kinderbetreuungsgeld möchten Sie?", "Which type of childcare benefit would you like?"),
				officialTerm: L(
					"Kinderbetreuungsgeld-Konto oder einkommensabhängiges Kinderbetreuungsgeld",
					"Childcare benefit account or income-related childcare benefit",
				),
				explain: L(
					"Es gibt zwei Arten. Beim Konto wählen Sie, wie lange Sie das Geld bekommen: je kürzer, desto mehr pro Tag. Die einkommensabhängige Art richtet sich nach Ihrem Einkommen vor der Geburt und ist für Eltern gedacht, die vorher gearbeitet haben. Wenn Sie unsicher sind, fragen Sie mich oder einen Menschen.",
					"There are two types. With the account, you choose how long you receive the money: the shorter, the more per day. The income-related type depends on your income before the birth and is meant for parents who worked before. If you're unsure, ask me or a person.",
				),
				optionExplain: {
					flat_rate_account: L("Fester Betrag, Dauer wählbar.", "Fixed amount, you choose the duration."),
					income_related: L("Hängt von Ihrem Einkommen vor der Geburt ab.", "Depends on your income before the birth."),
				},
			},
			receives_family_allowance: {
				question: L("Bekommen Sie für Ihr Kind schon Familienbeihilfe?", "Do you already receive family allowance for your child?"),
				officialTerm: L("Bezug der Familienbeihilfe", "Receipt of family allowance (Familienbeihilfe)"),
				explain: L(
					"Familienbeihilfe ist eine andere Leistung für Familien. Sie ist eine Voraussetzung für das Kinderbetreuungsgeld.",
					"Family allowance is a different benefit for families. It is a requirement for childcare benefit.",
				),
				ifNo: L(
					"Ohne Familienbeihilfe kann der Antrag nicht eingereicht werden. Ein Mensch vom Amt kann Ihnen sagen, wie Sie sie bekommen.",
					"The application can't be submitted without family allowance. A member of staff can tell you how to get it.",
				),
			},
			iban: {
				question: L("Auf welches Konto soll das Geld kommen? Ich brauche Ihre IBAN.", "Which account should the money go to? I need your IBAN."),
				officialTerm: L("IBAN", "IBAN"),
				explain: L(
					"Die IBAN ist Ihre Kontonummer. Sie finden sie im Online-Banking oder auf Ihren Kontoauszügen. In Österreich beginnt sie mit AT.",
					"The IBAN is your account number. You find it in your online banking or on your bank statements. In Austria it starts with AT.",
				),
			},
		},
	},
};

export function getGuide(serviceId: string): ServiceGuide | undefined {
	return GUIDES[serviceId];
}

/** Fills {placeholders} in a text. */
export function fill(text: string, vars: Record<string, string | number>): string {
	return text.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`));
}

// ---------------------------------------------------------------------------------------------
// Narration building blocks shared by all services
// ---------------------------------------------------------------------------------------------

export const PHRASES = {
	checkTitle: L("Voraussetzungen prüfen", "Checking the requirements"),
	checkIntro: L("Ich habe die Voraussetzungen geprüft.", "I checked the requirements."),
	checkAllGood: L("Alles passt.", "All fine."),
	checkWithNotes: L("Bitte beachten Sie die Hinweise.", "Please note the remarks."),
	blockedTitle: L("Das geht leider so nicht", "This isn't possible like this"),
	blockedIntro: L("Diesen Antrag können Sie leider nicht stellen.", "Unfortunately you can't submit this application."),
	blockedHelp: L(
		"Ein Mensch vom Amt kann Ihnen weiterhelfen. Drücken Sie dafür auf „Mit einem Menschen sprechen“.",
		"A member of staff can help you. Press “Talk to a person” for that.",
	),
	autofillGeneric: L("Das kommt aus Ihren Daten beim Amt: {value}.", "This comes from your records: {value}."),
	confirmedGeneric: L("Das hat {name} schon bestätigt: {value}.", "{name} has already confirmed this: {value}."),
	askGeneric: L("Bitte geben Sie an: {label}.", "Please enter: {label}."),
	appointmentTitle: L("Termin aussuchen", "Choose an appointment"),
	appointmentGeneric: L("Wählen Sie bitte einen Termin aus.", "Please choose an appointment."),
	noSlots: L(
		"Gerade gibt es online keine freien Termine. Ein Mensch vom Amt kann Ihnen einen Termin geben.",
		"There are no free appointments online right now. A member of staff can give you an appointment.",
	),
	reviewTitle: L("Alles prüfen und bestätigen", "Check everything and confirm"),
	review: L(
		"Alles ausgefüllt. Lesen Sie noch einmal drüber, dann halten Sie Ihr Siegel gedrückt. Das können nur Sie.",
		"All filled in. Read it once more, then hold your seal to sign. Only you can do that.",
	),
	reviewProblems: L(
		"Es fehlt noch etwas. Drücken Sie in der rot markierten Zeile auf „Ändern“.",
		"Something is still missing. Press “Change” in the row marked in red.",
	),
	doneTitle: L("Eingereicht", "Submitted"),
	done: L(
		"Unterschrieben und eingereicht. Ihre Nummer ist {ref}.",
		"Signed and submitted. Your number is {ref}.",
	),
	questionsNone: L("Sie unterschreiben nur noch.", "You only sign."),
	questionsOne: L("Sie beantworten eine Frage.", "You answer one question."),
	questionsMany: L("Sie beantworten {count} Fragen.", "You answer {count} questions."),
	doneAppointment: L("Ihr Termin: {slot}, {office}.", "Your appointment: {slot}, {office}."),
	yes: L("Ja", "Yes"),
	no: L("Nein", "No"),
	outage: L(
		"Das Amt ist gerade nicht erreichbar. Ihre Angaben sind gespeichert. Versuchen Sie es gleich noch einmal oder sprechen Sie mit einem Menschen.",
		"The office can't be reached right now. Your answers are saved. Try again in a moment or talk to a person.",
	),
	slotTaken: L(
		"Dieser Termin wurde gerade vergeben. Bitte wählen Sie einen anderen.",
		"This appointment was just taken. Please choose another one.",
	),
} satisfies Record<string, Localized>;

export function phrase(key: keyof typeof PHRASES, lang: Language, vars: Record<string, string | number> = {}): string {
	return fill(PHRASES[key][lang], vars);
}

// ---------------------------------------------------------------------------------------------
// Eligibility texts: the mock backend returns English, third-person notes for the AI.
// For the citizen we rewrite them in second person, in their language.
// 👉 EXTEND HERE when you add eligibility rules in src/gov/data/services.ts.
// ---------------------------------------------------------------------------------------------

type CheckRewrite = [RegExp, (m: RegExpMatchArray) => Localized];

const CHECK_REWRITES: CheckRewrite[] = [
	[/^A valid official photo ID/, () => L("Wir haben keinen gültigen Ausweis mit Foto von Ihnen. Ihr Ausweis ist abgelaufen oder fehlt.", "We have no valid photo ID for you. Your ID has expired or is missing.")],
	[/^No current registered address/, () => L("Sie haben gerade keine gemeldete Adresse. Die bisherige Adresse kann leer bleiben.", "You have no registered address at the moment. The previous address can stay empty.")],
	[/^Non-EU citizens should also bring/, () => L("Nehmen Sie auch Ihren Aufenthaltstitel mit.", "Also bring your residence permit.")],
	[/^Everyone who moves into a home/, () => L("Wer in Österreich umzieht, muss die neue Adresse melden.", "Anyone who moves in Austria has to register the new address.")],
	[/^Austrian passports are only issued/, () => L("Österreichische Reisepässe bekommen nur österreichische Staatsbürgerinnen und Staatsbürger. Wenden Sie sich bitte an die Botschaft oder das Konsulat Ihres Landes.", "Austrian passports are only issued to Austrian citizens. Please contact the embassy or consulate of your country.")],
	[/^The citizen is an Austrian citizen/, () => L("Sie sind österreichische Staatsbürgerin oder Staatsbürger.", "You are an Austrian citizen.")],
	[/^No passport on file/, () => L("Sie haben noch keinen Reisepass. Sie können einen ersten Pass beantragen.", "You don't have a passport yet. You can apply for your first one.")],
	[/^The passport on file \((.+)\) expired on (\d{4}-\d{2}-\d{2})/, (m) => L(`Ihr Reisepass ist seit ${formatDate(m[2], "de")} abgelaufen.`, `Your passport expired on ${formatDate(m[2], "en")}.`)],
	[/^The current passport is still valid until (\d{4}-\d{2}-\d{2})/, (m) => L(`Ihr jetziger Pass ist noch bis ${formatDate(m[1], "de")} gültig.`, `Your current passport is valid until ${formatDate(m[1], "en")}.`)],
	[/^MOCK RULES/, () => L("Das ist eine erste Prüfung mit Ihren Daten. Genau prüft Ihre Krankenkasse.", "This is a first check with your data. Your health insurance checks it in detail.")],
	[/^No child younger than 3/, () => L("In Ihrem Haushalt ist kein Kind unter 3 Jahren gemeldet.", "No child under 3 is registered in your household.")],
	[/^Child in household: (.+)\.$/, (m) => L(`Kind im Haushalt: ${m[1].replace("born", "geboren")}.`, `Child in your household: ${m[1]}.`)],
	[/^Valid residence permit on file/, () => L("Sie haben einen gültigen Aufenthaltstitel.", "You have a valid residence permit.")],
	[/^A valid residence title is required/, () => L("Sie brauchen einen gültigen Aufenthaltstitel.", "You need a valid residence permit.")],
	[/^Non-standard residency status/, () => L("Bei Ihrem Aufenthaltsstatus sollte ein Mensch vom Amt die Details bestätigen.", "With your residence status, a member of staff should confirm the details.")],
	[/^Have ready: /, () => L("Halten Sie bereit: Geburtsurkunde des Kindes und Nachweis der Eltern-Kind-Pass-Untersuchungen.", "Have ready: your child's birth certificate and proof of the Eltern-Kind-Pass examinations.")],
];

export function rewriteCheck(text: string, lang: Language): string {
	for (const [pattern, build] of CHECK_REWRITES) {
		const m = text.match(pattern);
		if (m) return build(m)[lang];
	}
	return text;
}

/** "2026-11-01" -> "01.11.2026" (de) / "1 November 2026" (en). */
export function formatDate(iso: string, lang: Language): string {
	const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return iso;
	if (lang === "de") return `${m[3]}.${m[2]}.${m[1]}`;
	const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
	return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

/** "2026-10-20T09:30" -> "Dienstag, 20.10.2026, 09:30 Uhr" / "Tuesday, 20 October 2026, 09:30". */
export function formatSlot(slotTime: string, lang: Language): string {
	const [date, time] = slotTime.split("T");
	const weekday = new Intl.DateTimeFormat(lang === "de" ? "de-AT" : "en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
	return lang === "de" ? `${weekday}, ${formatDate(date, "de")}, ${time} Uhr` : `${weekday}, ${formatDate(date, "en")}, ${time}`;
}

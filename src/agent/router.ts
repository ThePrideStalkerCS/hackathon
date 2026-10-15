/**
 * Intent router: a cheap, deterministic first pass before the LLM.
 *
 * Small models like to answer "what do I have to do?" with a long, partly invented text instead
 * of opening the walkthrough. So when the citizen clearly wants to GET SOMETHING DONE and a
 * service-specific keyword matches, we force the model's first step to be start_guided_walkthrough
 * (the model still chooses which service ids and their order).
 * Pure questions ("Is my passport still valid?") and unclear ones ("Ich möchte einen Hund anmelden")
 * are left to the model.
 *
 * Also detects the language of the message, so the reply (and a new walkthrough) follow the
 * language the citizen actually uses.
 *
 * 👉 EXTEND HERE: replace the keyword lists with embeddings / a small classifier, add services.
 */
import type { Language } from "../shared/types";

/** Keywords that clearly point to one service (lowercase substrings, de + dialect + en). Generic words like "anmelden" are NOT here. */
const STRONG_KEYWORDS: Record<string, string[]> = {
	"change-of-residence": ["umzug", "umgezogen", "umzogn", "zogn", "zogen", "übersiedel", "ummeld", "meldezettel", "wohnsitz", "neue wohnung", "new flat", "new apartment", "moved", "moving", "move to", "relocat"],
	"passport-renewal": ["reisepass", "pass is", "pass ist", "mein pass", "mei pass", "passport"],
	"childcare-subsidy": ["kinderbetreuungsgeld", "kbg", "baby", "geburt", "geboren", "karenz", "childcare", "child care", "newborn", "parental leave"],
};

/** Words that signal "I need to do something" or a life event. */
const ACTION_WORDS = [
	"muss", "muass", "müss", "brauch", "möcht", "will ", "wollen", "beantrag", "antrag", "anmeld", "ummeld", "erneuer",
	"umgezogen", "zogn", "zogen", "umzug", "übersiedel", "was tun", "was soll", "tun?", "mochn", "machen", "hilf",
	"abgelaufen", "abgloffen", "verloren", "gestohlen", "baby", "geburt", "bekommen", "kriagt", "unterstützung",
	"need", "have to", "want", "apply", "renew", "register", "moved", "moving", "expired", "lost", "stolen",
	"what do i", "what should i", "help", "had a baby", "support",
];

// Standard German + Austrian dialect markers. ("i" is NOT an English signal here: in dialect it means "ich".)
const GERMAN_HINTS = /\b(und|der|die|das|ich|bin|ist|nicht|bitte|mein|mei|meine|wir|haben|muss|was|wie|wo|einen|eine|ein|mit|für|servus|grüß|mia|ham|hob|hab|kriag\w*|net|ned|des|scho|jo|wos|wia|göd|oba|nix|zogn|umzogn|abgloffen|muass|mochn|grad)\b/gi;
const ENGLISH_HINTS = /\b(and|the|i'm|i've|you|your|is|not|please|my|we|have|need|what|how|where|just|to|for|with|moved|expired|baby's|our)\b/gi;

/** Questions about the citizen's own data ("Is my passport still valid?", "Which address do you have?"). */
const OWN_DATA_WORDS = ["gültig", "valid", "läuft ab", "lauft ab", "expire", "adresse", "address", "on file", "gespeichert", "meine daten", "my data", "gemeldet"];

/** Questions about facts of a service (fees, deadlines, documents): answered from src/knowledge, never from memory. */
const FACT_WORDS = ["kost", "gebühr", "preis", "wie viel", "wieviel", "frist", "unterlagen", "dokumente", "mitbringen", "wie lange", "cost", "fee", "price", "how much", "deadline", "documents", "bring", "how long"];

export type Route = {
	/** Services with a clear keyword match. */
	candidates: string[];
	/** Tool the model's first step must call (null = model decides). */
	forceTool: "start_guided_walkthrough" | "get_my_profile" | "get_service_info" | null;
	/** true = force start_guided_walkthrough as the first step. */
	forceWalkthrough: boolean;
	/** Language the citizen wrote in (falls back to the session language). */
	language: Language;
};

/**
 * Language of a message. Only overrides the session language when the evidence is clear,
 * because switching language by mistake is worse than not switching.
 */
export function detectLanguage(text: string, fallback: Language): Language {
	const umlauts = /[äöüß]/i.test(text) ? 2 : 0;
	const de = (text.match(GERMAN_HINTS)?.length ?? 0) + umlauts;
	const en = text.match(ENGLISH_HINTS)?.length ?? 0;
	if (de - en >= 2 || (de >= 1 && en === 0)) return "de";
	if (en - de >= 2 || (en >= 1 && de === 0)) return "en";
	return fallback;
}

export function routeIntent(text: string, walkthroughActive: boolean, fallbackLanguage: Language): Route {
	const lower = ` ${text.toLowerCase()} `;
	const candidates = Object.entries(STRONG_KEYWORDS)
		.filter(([, words]) => words.some((w) => lower.includes(w)))
		.map(([id]) => id);
	const wantsAction = ACTION_WORDS.some((w) => lower.includes(w));
	const forceWalkthrough = !walkthroughActive && candidates.length > 0 && wantsAction;
	// A question about their own data is answered from the profile, not from the model's imagination.
	const asksOwnData = !forceWalkthrough && text.trim().endsWith("?") && OWN_DATA_WORDS.some((w) => lower.includes(w));
	// A question about fees, deadlines or documents of a known service is answered from the official facts.
	const asksFacts = !forceWalkthrough && !asksOwnData && candidates.length > 0 && FACT_WORDS.some((w) => lower.includes(w));
	return {
		candidates,
		forceTool: forceWalkthrough ? "start_guided_walkthrough" : asksOwnData ? "get_my_profile" : asksFacts ? "get_service_info" : null,
		forceWalkthrough,
		language: detectLanguage(text, fallbackLanguage),
	};
}

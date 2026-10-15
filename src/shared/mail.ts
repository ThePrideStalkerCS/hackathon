/**
 * A letter in the citizen's digital Postfach (shared by Worker and frontend, no runtime code).
 * Data: src/gov/data/mail.ts. UI: frontend/laufzettel/Postfach.tsx.
 */
export type Letter = {
	id: string;
	/** The letter arrives while the citizen runs this errand (demo timing); without it, it is there from the start. */
	arrivesDuring?: string;
	from: string;
	/** Official name of the document, always German. */
	kind: string;
	/** Plain title, e.g. "Parking fine: €36". */
	title: string;
	reference: string;
	issued: string;
	due: string;
	amountEur: number;
	/** The original wording, always German (letters from Austrian offices are German). */
	original: string[];
	plain: { what: string; deadline: string; ifNothing: string; disagree: string; move: string };
	/** One short spoken summary. */
	spoken: string;
	sourceUrl: string;
	verified: boolean;
};

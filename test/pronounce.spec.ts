import { describe, expect, it } from "vitest";
import { languageRuns } from "../src/shared/pronounce";

describe("languageRuns: German terms keep their German pronunciation", () => {
	it("splits official German words out of English narration", () => {
		expect(languageRuns("The form is called Meldezettel. I fill it in.", "en")).toEqual([
			{ text: "The form is called ", lang: "en" },
			{ text: "Meldezettel", lang: "de" },
			{ text: ". I fill it in.", lang: "en" },
		]);
	});

	it("speaks street names in German, numbers stay with the English run", () => {
		expect(languageRuns("You moved into Florianigasse 18/5, 1080 Wien.", "en")).toEqual([
			{ text: "You moved into ", lang: "en" },
			{ text: "Florianigasse", lang: "de" },
			{ text: " 18/5, 1080 ", lang: "en" },
			{ text: "Wien.", lang: "de" },
		]);
	});

	it("leaves German narration and words inside other words alone", () => {
		expect(languageRuns("Der Meldezettel ist fertig.", "de")).toEqual([{ text: "Der Meldezettel ist fertig.", lang: "de" }]);
		expect(languageRuns("Viennese coffee", "en")).toEqual([{ text: "Viennese coffee", lang: "en" }]);
	});
});

/**
 * Address types + pure helpers, shared by the Worker (src/address/google.ts) and the frontend
 * (frontend/walkthrough/AddressInput.tsx). No I/O, no dependencies, easy to unit-test.
 *
 * Google knows streets and house numbers, but not Austrian door/staircase numbers
 * ("Annenstraße 24/3" = house 24, door 3). We keep the door part the citizen typed and
 * append it to the verified address.
 */

/** Shared with the frontend: result of resolving one Google suggestion. */
export type VerifiedAddress = {
	/** Austrian format: "Annenstraße 24, 8020 Graz" (door is added separately). */
	formatted: string;
	street: string | null;
	houseNumber: string | null;
	postalCode: string | null;
	city: string | null;
	country: string | null;
	/** true = Google found the exact building (street + house number). */
	precise: boolean;
};

/** One entry in the suggestion dropdown. */
export type AddressSuggestion = { placeId: string; main: string; secondary: string };

/** Subset of a Google Places (New) addressComponent. */
export type GoogleAddressComponent = { longText?: string; shortText?: string; types?: string[] };

/** Builds an Austrian-style address from Google's address components. */
export function toVerifiedAddress(components: GoogleAddressComponent[], fallback: string): VerifiedAddress {
	const pick = (type: string) => components.find((c) => c.types?.includes(type))?.longText ?? null;
	const street = pick("route");
	const houseNumber = pick("street_number");
	const postalCode = pick("postal_code");
	// Vienna districts come back as "sublocality"; the city is "locality".
	const city = pick("locality") ?? pick("postal_town") ?? pick("administrative_area_level_2");
	const country = components.find((c) => c.types?.includes("country"))?.shortText ?? null;

	const line1 = [street, houseNumber].filter(Boolean).join(" ");
	const line2 = [postalCode, city].filter(Boolean).join(" ");
	const formatted = [line1, line2].filter(Boolean).join(", ") || fallback;

	return { formatted, street, houseNumber, postalCode, city, country, precise: Boolean(street && houseNumber) };
}

/**
 * Finds the door/staircase part the citizen typed after the house number:
 * "Annenstraße 24/3"      -> "3"
 * "Kaiserstr. 40/2/8, …"  -> "2/8"
 * "Hauptplatz 7"          -> null
 */
export function extractDoor(typed: string, houseNumber: string | null): string | null {
	if (!houseNumber) return null;
	const escaped = houseNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = typed.match(new RegExp(`(?:^|\\s)${escaped}\\s*/\\s*([\\w/\\s-]+?)(?=,|$)`, "i"));
	return match ? match[1].replace(/\s+/g, "") : null;
}

/** "Annenstraße 24, 8020 Graz" + "3" -> "Annenstraße 24/3, 8020 Graz" */
export function withDoor(address: VerifiedAddress, door: string | null | undefined): string {
	const d = door?.trim().replace(/^\/+/, "");
	if (!d || !address.street || !address.houseNumber) return address.formatted;
	const line1 = `${address.street} ${address.houseNumber}/${d}`;
	const line2 = [address.postalCode, address.city].filter(Boolean).join(" ");
	return [line1, line2].filter(Boolean).join(", ");
}

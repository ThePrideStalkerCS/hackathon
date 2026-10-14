/**
 * Address check via Google Maps (Places API "New").
 *
 *   GET /api/address/status                        -> { google: boolean }
 *   GET /api/address/suggest?q=…&lang=de&session=… -> { suggestions: AddressSuggestion[] }
 *   GET /api/address/details?id=…&lang=de&session=… -> VerifiedAddress
 *
 * The API key stays on the server (secret GOOGLE_MAPS_API_KEY). Without a key, the endpoints
 * answer 501 and the frontend falls back to a plain text field ("custom address").
 *
 * Setup:
 *   Google Cloud Console -> APIs & Services -> enable "Places API (New)" -> create an API key
 *   local:      add GOOGLE_MAPS_API_KEY=… to .dev.vars
 *   deployed:   npx wrangler secret put GOOGLE_MAPS_API_KEY
 *
 * `session` is a random token per address field: Google bills autocomplete + details of one
 * session as a single request.
 *
 * Docs: https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
 *       https://developers.google.com/maps/documentation/places/web-service/place-details
 *
 * 👉 EXTEND HERE: swap Google for the official Austrian address register (BEV Adressregister)
 *    or OpenStreetMap by replacing the two fetch calls below. The frontend doesn't change.
 */
import { Hono } from "hono";
import { z } from "zod";
import { type AddressSuggestion, type GoogleAddressComponent, toVerifiedAddress } from "../shared/address";

type AddressEnv = { GOOGLE_MAPS_API_KEY?: string };

const PLACES = "https://places.googleapis.com/v1";
/** Only Austrian addresses (this is an Austrian government portal). 👉 EXTEND HERE for addresses abroad. */
const REGIONS = ["at"];
/** Prediction types that are actual addresses (not shops, restaurants, …). */
const ADDRESS_TYPES = ["street_address", "premise", "subpremise", "route", "geocode"];

export const addressRoutes = new Hono<{ Bindings: Env }>();

const key = (env: Env) => (env as Env & AddressEnv).GOOGLE_MAPS_API_KEY;

addressRoutes.get("/status", (c) => c.json({ google: Boolean(key(c.env)) }));

addressRoutes.get("/suggest", async (c) => {
	const apiKey = key(c.env);
	if (!apiKey) return c.json({ error: "address_not_configured" }, 501);

	const input = z
		.object({ q: z.string().trim().min(3).max(200), lang: z.enum(["de", "en"]).default("de"), session: z.string().max(64).optional() })
		.safeParse(c.req.query());
	if (!input.success) return c.json({ error: input.error.message }, 400);
	const { q, lang, session } = input.data;

	const res = await fetch(`${PLACES}/places:autocomplete`, {
		method: "POST",
		headers: { "content-type": "application/json", "X-Goog-Api-Key": apiKey },
		body: JSON.stringify({ input: q, includedRegionCodes: REGIONS, languageCode: lang, ...(session ? { sessionToken: session } : {}) }),
	});
	if (!res.ok) {
		console.error("[address] autocomplete error", res.status, await res.text().catch(() => ""));
		return c.json({ error: "address_lookup_failed" }, 502);
	}

	type Prediction = {
		placeId: string;
		types?: string[];
		text?: { text?: string };
		structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
	};
	const data = (await res.json()) as { suggestions?: { placePrediction?: Prediction }[] };
	const predictions = (data.suggestions ?? []).map((s) => s.placePrediction).filter((p): p is Prediction => Boolean(p?.placeId));
	// Prefer real addresses; if Google only returns places (e.g. a shop name), show those.
	const addresses = predictions.filter((p) => !p.types || p.types.some((t) => ADDRESS_TYPES.includes(t)));

	const suggestions: AddressSuggestion[] = (addresses.length ? addresses : predictions).slice(0, 5).map((p) => ({
		placeId: p.placeId,
		main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
		secondary: p.structuredFormat?.secondaryText?.text ?? "",
	}));
	return c.json({ suggestions });
});

addressRoutes.get("/details", async (c) => {
	const apiKey = key(c.env);
	if (!apiKey) return c.json({ error: "address_not_configured" }, 501);

	const input = z
		.object({ id: z.string().min(1).max(300), lang: z.enum(["de", "en"]).default("de"), session: z.string().max(64).optional() })
		.safeParse(c.req.query());
	if (!input.success) return c.json({ error: input.error.message }, 400);
	const { id, lang, session } = input.data;

	const params = new URLSearchParams({ languageCode: lang, regionCode: "at", ...(session ? { sessionToken: session } : {}) });
	const res = await fetch(`${PLACES}/places/${encodeURIComponent(id)}?${params}`, {
		headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "formattedAddress,addressComponents" },
	});
	if (!res.ok) {
		console.error("[address] details error", res.status, await res.text().catch(() => ""));
		return c.json({ error: "address_lookup_failed" }, 502);
	}
	const place = (await res.json()) as { formattedAddress?: string; addressComponents?: GoogleAddressComponent[] };
	return c.json(toVerifiedAddress(place.addressComponents ?? [], place.formattedAddress ?? ""));
});

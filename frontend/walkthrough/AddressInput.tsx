/**
 * Address field with suggestions from Google Maps (via our Worker, src/address/google.ts).
 *
 * - The citizen types, we show matching Austrian addresses below the field.
 * - Picking one fills in the full address and marks it as found on Google Maps.
 * - If nothing is found, we offer "use my own address" so nobody gets stuck.
 * - Google doesn't know Austrian door numbers ("24/3"), so there is a small extra field for them.
 *
 * Without a Google key on the server, this is just a normal text field.
 */
import { useEffect, useRef, useState } from "react";
import type { PortalField } from "../../src/shared/walkthrough";
import { type AddressSuggestion, type VerifiedAddress, extractDoor, withDoor } from "../../src/shared/address";
import { tpl, type UIText } from "../i18n";

/** Fields that get address suggestions. 👉 EXTEND HERE when a service adds a new address field. */
export const ADDRESS_FIELDS = new Set(["new_address", "previous_address", "delivery_address"]);

type Props = {
	field: PortalField;
	t: UIText;
	language: "de" | "en";
	/** Called with the final address text (verified or custom). */
	onAnswer: (value: string) => void;
};

/** Asked once per page load: is Google Maps configured on the server? */
let googleAvailable: Promise<boolean> | null = null;
function checkGoogle(): Promise<boolean> {
	googleAvailable ??= fetch("/api/address/status")
		.then((r) => (r.ok ? (r.json() as Promise<{ google: boolean }>) : { google: false }))
		.then((d) => d.google)
		.catch(() => false);
	return googleAvailable;
}

const newSession = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

export function AddressInput({ field, t, language, onAnswer }: Props) {
	const [text, setText] = useState(field.value ?? "");
	const [google, setGoogle] = useState(false);
	const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
	const [searching, setSearching] = useState(false);
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(-1);
	/** "verified" = picked from Google, "custom" = citizen chose their own text. */
	const [verified, setVerified] = useState<VerifiedAddress | null>(null);
	const [custom, setCustom] = useState(false);
	const [door, setDoor] = useState("");
	const session = useRef(newSession());
	/** Skip the next search (after we set the text ourselves, e.g. by picking a suggestion). */
	const skipSearch = useRef(true);

	useEffect(() => {
		checkGoogle().then(setGoogle);
	}, []);

	// Search while typing (debounced, at least 3 characters).
	useEffect(() => {
		if (!google) return;
		if (skipSearch.current) {
			skipSearch.current = false;
			return;
		}
		const q = text.trim();
		if (q.length < 3) {
			setSuggestions([]);
			setOpen(false);
			return;
		}
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			setSearching(true);
			try {
				const params = new URLSearchParams({ q, lang: language, session: session.current });
				const res = await fetch(`/api/address/suggest?${params}`, { signal: controller.signal });
				const data = res.ok ? ((await res.json()) as { suggestions: AddressSuggestion[] }) : { suggestions: [] };
				setSuggestions(data.suggestions);
				setActive(-1);
				setOpen(true);
			} catch {
				// aborted (citizen kept typing) or network error: keep the plain field usable
			} finally {
				if (!controller.signal.aborted) setSearching(false);
			}
		}, 300);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [text, google, language]);

	const pick = async (s: AddressSuggestion) => {
		setOpen(false);
		try {
			const params = new URLSearchParams({ id: s.placeId, lang: language, session: session.current });
			const res = await fetch(`/api/address/details?${params}`);
			if (!res.ok) throw new Error(String(res.status));
			const address = (await res.json()) as VerifiedAddress;
			setDoor(extractDoor(text, address.houseNumber) ?? "");
			setVerified(address);
			setCustom(false);
			skipSearch.current = true;
			setText(address.formatted);
		} catch {
			chooseCustom();
		}
		session.current = newSession(); // one Google session = typing + one pick
	};

	const chooseCustom = () => {
		setOpen(false);
		setVerified(null);
		setCustom(true);
	};

	const submit = () => {
		const value = verified ? withDoor(verified, door) : text.trim();
		if (value) onAnswer(value);
	};

	// Options in the dropdown: Google's suggestions, then "use my own address".
	const options: ({ kind: "place"; s: AddressSuggestion } | { kind: "custom" })[] = [
		...suggestions.map((s) => ({ kind: "place" as const, s })),
		{ kind: "custom" as const },
	];
	const choose = (i: number) => {
		const o = options[i];
		if (!o) return;
		if (o.kind === "place") void pick(o.s);
		else chooseCustom();
	};

	const listId = `addr-list-${field.id}`;
	const showList = google && open && text.trim().length >= 3 && !searching;

	return (
		<form
			className="field-form"
			onSubmit={(e) => {
				e.preventDefault();
				// Enter inside the open list picks the highlighted option instead of submitting.
				if (showList && active >= 0) choose(active);
				else submit();
			}}
		>
			<label htmlFor={`in-${field.id}`}>{field.label}</label>
			<div className="address-combo">
				<input
					id={`in-${field.id}`}
					type="text"
					value={text}
					placeholder={field.hint}
					autoComplete="off"
					role={google ? "combobox" : undefined}
					aria-expanded={google ? showList : undefined}
					aria-controls={google ? listId : undefined}
					aria-autocomplete={google ? "list" : undefined}
					aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
					onChange={(e) => {
						setText(e.target.value);
						setVerified(null); // edited by hand: no longer the address Google found
						setCustom(false);
					}}
					onKeyDown={(e) => {
						if (!showList) return;
						if (e.key === "ArrowDown") {
							e.preventDefault();
							setActive((a) => (a + 1) % options.length);
						} else if (e.key === "ArrowUp") {
							e.preventDefault();
							setActive((a) => (a <= 0 ? options.length - 1 : a - 1));
						} else if (e.key === "Escape") {
							setOpen(false);
						}
					}}
					onBlur={() => setTimeout(() => setOpen(false), 150)}
				/>

				{showList && (
					<ul className="address-list" id={listId} role="listbox" aria-label={t.addressPoweredBy}>
						{suggestions.length === 0 && (
							<li className="address-empty" role="presentation">
								{t.addressNotFound}
							</li>
						)}
						{options.map((o, i) => (
							<li
								key={o.kind === "place" ? o.s.placeId : "custom"}
								id={`${listId}-${i}`}
								role="option"
								aria-selected={i === active}
								className={[
									i === active && "is-active",
									o.kind === "custom" && "address-custom",
									o.kind === "custom" && suggestions.length === 0 && "is-suggested",
								]
									.filter(Boolean)
									.join(" ")}
								// mousedown, not click: fires before the input's blur closes the list
								onMouseDown={(e) => {
									e.preventDefault();
									choose(i);
								}}
							>
								<span aria-hidden="true">{o.kind === "place" ? "📍" : "✏️"}</span>
								{o.kind === "place" ? (
									<span>
										<strong>{o.s.main}</strong>
										<small>{o.s.secondary}</small>
									</span>
								) : (
									<span>{tpl(t.addressCustom, { text: text.trim() })}</span>
								)}
							</li>
						))}
					</ul>
				)}
			</div>

			{verified && (
				<label className="address-door">
					<span>{t.addressDoor}</span>
					<input type="text" value={door} placeholder={t.addressDoorHint} onChange={(e) => setDoor(e.target.value)} />
				</label>
			)}

			<p className="address-status" aria-live="polite">
				{searching && <span className="muted">{t.addressSearching}</span>}
				{!searching && verified && <span className={`badge ${verified.precise ? "ok" : "warn"}`}>{verified.precise ? t.addressFound : t.addressPartial}</span>}
				{!searching && custom && <span className="badge warn">{t.addressCustomNote}</span>}
			</p>

			<div className="button-row">
				<button type="submit" className="primary" disabled={!text.trim()}>
					{t.apply}
				</button>
			</div>
		</form>
	);
}

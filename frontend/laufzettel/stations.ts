/**
 * Walkthrough → Laufzettel. Pure mapping from the engine's steps to the rows ("stations") of the
 * routing slip. The engine does not know about the slip; this file is the only translation.
 * The table in docs/redesign/LAUFZETTEL.md ("How the engine maps onto the slip") describes it.
 *
 * 👉 EXTEND HERE: give each service its own register name on the round stamps (e.g. "ZMR" for the
 * Meldezettel, "Passregister" for passports) instead of the generic stampRegisterRing text.
 */
import type { PortalField, Walkthrough, WalkthroughStep } from "../../src/shared/walkthrough";
import type { StampSpec } from "../brand/Brand";
import type { UIText } from "../i18n";

export type StationState = "done" | "active" | "pending";

export type Station = {
	/** Step id (stable key). */
	id: string;
	/** Index in w.steps. */
	index: number;
	step: WalkthroughStep;
	field?: PortalField;
	state: StationState;
	/** The row is the step the walkthrough is on right now (also when it is already done, e.g. after "back"). */
	current: boolean;
	/** Left column: the office or the official field name. */
	label: string;
	/** Small line under the label. */
	sub?: string;
	/** The stamp this station gets once it is done. */
	stamp?: StampSpec;
};

/** Steps that become a row. The intro is only narrated; "done" turns the whole slip into the confirmation. */
const ROW_KINDS = new Set(["check", "autofill", "ask", "appointment", "review", "blocked"]);

/** "15 OCT" / "15. OKT." */
export function stampDate(lang: "de" | "en", date = new Date()): string {
	return new Intl.DateTimeFormat(lang === "de" ? "de-AT" : "en-GB", { day: "numeric", month: "short" }).format(date);
}

/** A slightly different angle per row, like a stamp set by hand. Deterministic, so it does not jump. */
function angle(i: number): number {
	return ((i * 37) % 13) - 6;
}

/** Short office name for the top line of a stamp: "Magistrat der Stadt Wien (MA 62)" → "Magistrat der Stadt Wien". */
function office(authority: string): string {
	return authority.replace(/\s*\(.*?\)\s*/g, " ").split(/[,–-]/)[0].trim();
}

/** "Karl Steiner" → "K. Steiner" */
function shortName(name: string): string {
	const parts = name.split(" ").filter(Boolean);
	return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : name;
}

export function initials(name?: string): string {
	return (name ?? "")
		.split(" ")
		.filter(Boolean)
		.map((p) => p[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

export function buildStations(w: Walkthrough, t: UIText, citizenName?: string): Station[] {
	const date = stampDate(w.language);
	const stations: Station[] = [];

	w.steps.forEach((step, index) => {
		if (!ROW_KINDS.has(step.kind)) return;
		const field = step.fieldId ? w.fields.find((f) => f.id === step.fieldId) : undefined;
		const done = step.kind === "review" ? Boolean(w.result) : step.done;
		const current = index === w.current;
		const state: StationState = done ? "done" : current ? "active" : "pending";
		const rotate = angle(stations.length);
		const base = { id: step.id, index, step, field, state, current };

		switch (step.kind) {
			case "check":
				stations.push({ ...base, label: t.lzRequirements, sub: office(w.authority), stamp: { shape: "oct", top: t.stampCheckTop, main: t.stampChecked, date, rotate } });
				break;
			case "blocked":
				stations.push({ ...base, label: t.lzStopped, sub: office(w.authority) });
				break;
			case "autofill": {
				const fromRegister = field?.source === "profile";
				const by = field?.source === "confirmed" ? field.confirmedBy : undefined;
				stations.push({
					...base,
					label: field?.label ?? step.title,
					sub: by
						? t.lzFromConfirmed.replace("{name}", by.name)
						: fromRegister
							? t.lzFromRegister
							: field?.source === "citizen"
								? t.lzFromYou
								: field?.source === "draft"
									? t.lzFromDraft
									: t.lzSuggested,
					stamp: by
						? { shape: "ticket", top: `${by.role} · ${shortName(by.name)}`, main: t.stampConfirmed, date, rotate }
						: fromRegister
							? { shape: "round", ring: t.stampRegisterRing, main: t.stampFilled, date, rotate }
							: { shape: "ticket", top: office(w.authority), main: t.stampPrefilled, date, rotate },
				});
				break;
			}
			case "ask":
				stations.push({
					...base,
					label: field?.label ?? step.title,
					sub: done ? t.lzFromYou : t.lzYourTurn,
					stamp: { shape: "rect", top: office(w.authority), main: t.stampReceived, date, rotate },
				});
				break;
			case "appointment":
				stations.push({
					...base,
					label: t.lzAppointment,
					sub: w.selectedSlot?.office ?? office(w.authority),
					stamp: { shape: "oval", top: office(w.selectedSlot?.office ?? w.authority), main: t.stampReserved, date, rotate },
				});
				break;
			case "review":
				stations.push({
					...base,
					label: t.lzYou,
					sub: citizenName,
					stamp: {
						shape: "round",
						ink: "red",
						big: true,
						ring: `${citizenName ?? ""} · ${t.stampSigned} · ${w.result?.referenceNumber ?? ""} · `,
						main: initials(citizenName) || "OK",
						date,
						rotate: -9,
					},
				});
				break;
		}
	});
	return stations;
}

/** Short slip number for the header: "L-4F2A". */
export function slipNumber(w: Walkthrough): string {
	const raw = (w.applicationId ?? w.id).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
	return `L-${raw.slice(-4) || "0000"}`;
}

/**
 * The answer widgets inside the slip row that needs the citizen (Slip.tsx):
 *   AskInput    yes/no, choices, text, date, and the address input with suggestions
 *   SlotPicker  three appointments at a time, more on request
 * Plus the callables the slip uses (WalkthroughActions). Big answer targets, one question at a time.
 *
 * 👉 EXTEND HERE: pictograms per question, "explain it even simpler" (ask the model), sign language video.
 */
import { useEffect, useRef, useState } from "react";
import type { PortalField, Walkthrough, WalkthroughStep } from "../../src/shared/walkthrough";
import { ADDRESS_FIELDS, AddressInput } from "./AddressInput";
import { Icon } from "../icons";
import { tpl, type UIText } from "../i18n";

export type WalkthroughActions = {
	answer: (fieldId: string, value: string | boolean) => void;
	editField: (fieldId: string) => void;
	chooseSlot: (slotId: string) => void;
	advance: () => void;
	submit: () => void;
	close: () => void;
	startNext: () => void;
	askHuman: () => void;
};

export function AskInput(props: { field: PortalField; step: WalkthroughStep; t: UIText; actions: WalkthroughActions; language: "de" | "en" }) {
	const { field, step, t, actions } = props;
	// Address fields: suggestions + check via Google Maps, with a "custom address" fallback.
	const isAddress = field.type === "text" && ADDRESS_FIELDS.has(field.id);
	const [text, setText] = useState(field.value ?? "");
	useEffect(() => setText(field.value ?? ""), [field.value]);
	const submitText = () => text.trim() && actions.answer(field.id, text.trim());

	return (
		<>
			{field.type === "boolean" && (
				<div className="choices two">
					<button type="button" className="choice big" aria-pressed={field.value === "yes"} onClick={() => actions.answer(field.id, true)}>
						<Icon name="check" /> {t.yes}
					</button>
					<button type="button" className="choice big" aria-pressed={field.value === "no"} onClick={() => actions.answer(field.id, false)}>
						<Icon name="close" /> {t.no}
					</button>
				</div>
			)}

			{field.type === "select" && (
				<div className={`choices ${(field.options?.length ?? 0) <= 2 ? "two" : ""}`}>
					{field.options?.map((o) => (
						<button key={o.value} type="button" className="choice" aria-pressed={field.value === o.value} onClick={() => actions.answer(field.id, o.value)}>
							<span>
								<strong>{o.label}</strong>
								{o.explain && <small>{o.explain}</small>}
							</span>
						</button>
					))}
				</div>
			)}

			{isAddress && <AddressInput field={field} t={t} language={props.language} onAnswer={(value) => actions.answer(field.id, value)} />}

			{!isAddress && (field.type === "text" || field.type === "date") && (
				<form
					className="coach-input"
					onSubmit={(e) => {
						e.preventDefault();
						submitText();
					}}
				>
					<label htmlFor={`in-${field.id}`} className="visually-hidden">
						{field.label}
					</label>
					<input
						id={`in-${field.id}`}
						type={field.type === "date" ? "date" : "text"}
						value={text}
						placeholder={field.hint ?? field.label}
						autoComplete={field.id === "new_address" ? "street-address" : "off"}
						onChange={(e) => setText(e.target.value)}
					/>
					{field.type === "date" && (
						<button type="button" className="chip" onClick={() => actions.answer(field.id, new Date().toISOString().slice(0, 10))}>
							{t.today}
						</button>
					)}
					<button type="submit" className="round-button" disabled={!text.trim()} aria-label={t.apply}>
						<Icon name="arrowRight" />
					</button>
				</form>
			)}

			<div className="coach-foot">
				<span className="coach-fine">
					<Icon name="mic" size={16} /> {t.orSay}
				</span>
				{step.skippable && (
					<button type="button" className="link" onClick={() => actions.answer(field.id, "")}>
						{t.skipField}
					</button>
				)}
				{step.done && (
					<button type="button" className="link" onClick={actions.advance}>
						{t.continue} →
					</button>
				)}
			</div>
		</>
	);
}

/** Three appointments at a time (fewer choices = easier), more on request. */
export function SlotPicker({ w, step, t, actions }: { w: Walkthrough; step: WalkthroughStep; t: UIText; actions: WalkthroughActions }) {
	const [all, setAll] = useState(false);
	const slots = step.slots ?? [];
	if (!slots.length) {
		return (
			<button type="button" className="btn primary" onClick={actions.askHuman}>
				<Icon name="headset" /> {t.humanLong}
			</button>
		);
	}
	const locale = w.language === "de" ? "de-AT" : "en-GB";
	return (
		<>
			<div className="slots">
				{(all ? slots : slots.slice(0, 3)).map((slot) => {
					const d = new Date(`${slot.slotTime}:00`);
					return (
						<button key={slot.id} type="button" className="slot" aria-pressed={w.selectedSlot?.id === slot.id} onClick={() => actions.chooseSlot(slot.id)}>
							<span className="slot-day">{new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(d)}</span>
							<strong className="slot-time">{new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(d)}</strong>
							<span className="slot-office">{slot.office.replace(" (Mock)", "")}</span>
						</button>
					);
				})}
			</div>
			{!all && slots.length > 3 && (
				<button type="button" className="link" onClick={() => setAll(true)}>
					{t.moreSlots}
				</button>
			)}
		</>
	);
}

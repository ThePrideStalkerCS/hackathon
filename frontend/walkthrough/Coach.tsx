/**
 * The assistant's card, attached right below the element it is about (see Portal.tsx).
 * It appears ONLY when the citizen has to do something: answer a question, pick an appointment,
 * confirm, or decide what to do when blocked. Everything else plays by itself, narrated in the dock.
 *
 * One question, big answer targets, the official term explained in plain words. Nothing else.
 *
 * 👉 EXTEND HERE: pictograms per question, "explain it even simpler" (ask the model), sign language video.
 */
import { useEffect, useRef, useState } from "react";
import type { PortalField, Walkthrough, WalkthroughStep } from "../../src/shared/walkthrough";
import { VoiceMark } from "../components";
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

type Props = { w: Walkthrough; t: UIText; actions: WalkthroughActions; queueNext?: string };

/** Which steps get a card at all. */
export function needsCoach(step: WalkthroughStep | undefined): boolean {
	return Boolean(step && ["ask", "appointment", "review", "done", "blocked"].includes(step.kind));
}

export function Coach({ w, t, actions, queueNext }: Props) {
	const step = w.steps[w.current];
	const ref = useRef<HTMLDivElement>(null);
	const field = step?.fieldId ? w.fields.find((f) => f.id === step.fieldId) : undefined;

	// Keyboard and screen-reader users land on the question (without jumping the page).
	useEffect(() => {
		ref.current?.focus({ preventScroll: true });
	}, [step?.id]);

	if (!step || !needsCoach(step)) return null;

	const title = step.kind === "review" ? t.reviewTitle : step.kind === "done" ? t.doneTitle : step.title;
	const problem = field?.problem ?? w.error;

	return (
		<div className={`coach coach-${step.kind}`} ref={ref} tabIndex={-1} role="group" aria-labelledby="coach-title">
			{/* On the confirmation page the page itself says "submitted": the card only offers what's next. */}
			<div className={`coach-head ${step.kind === "done" ? "visually-hidden" : ""}`}>
				<span className="coach-label">
					<VoiceMark state="idle" size="sm" /> {t.assistant}
				</span>
				<h3 id="coach-title">{title}</h3>
			</div>

			{step.kind === "ask" && step.plainExplanation && <p className="coach-help">{step.plainExplanation}</p>}
			{step.kind === "ask" && step.officialTerm && step.officialTerm !== step.title && (
				<p className="coach-official">
					{t.onTheForm} <strong>{step.officialTerm}</strong>
				</p>
			)}

			{problem && (
				<p className="coach-problem" role="alert">
					<Icon name="alert" size={20} /> {problem}
				</p>
			)}

			{step.kind === "ask" && field && <AskInput key={step.id} field={field} step={step} t={t} actions={actions} />}

			{step.kind === "appointment" && <SlotPicker w={w} step={step} t={t} actions={actions} />}

			{step.kind === "review" && (
				<>
					<p className="coach-text">{t.reviewHint}</p>
					<p className="coach-text strong">
						<Icon name="arrowDown" size={18} /> {t.reviewGo}
					</p>
					<p className="coach-fine">{t.reviewOnlyYou}</p>
				</>
			)}

			{step.kind === "done" && (
				<div className="coach-actions">
					{queueNext && (
						<button type="button" className="btn primary" onClick={actions.startNext}>
							{tpl(t.upNext, { name: queueNext })} <Icon name="arrowRight" size={20} />
						</button>
					)}
					<button type="button" className={`btn ${queueNext ? "ghost" : "primary"}`} onClick={actions.close}>
						{t.finish}
					</button>
				</div>
			)}

			{step.kind === "blocked" && (
				<div className="coach-actions">
					<button type="button" className="btn primary" onClick={actions.askHuman}>
						<Icon name="headset" /> {t.humanLong}
					</button>
					<button type="button" className="btn ghost" onClick={actions.close}>
						{t.toStart}
					</button>
				</div>
			)}
		</div>
	);
}

function AskInput({ field, step, t, actions }: { field: PortalField; step: WalkthroughStep; t: UIText; actions: WalkthroughActions }) {
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

			{(field.type === "text" || field.type === "date") && (
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
function SlotPicker({ w, step, t, actions }: { w: Walkthrough; step: WalkthroughStep; t: UIText; actions: WalkthroughActions }) {
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

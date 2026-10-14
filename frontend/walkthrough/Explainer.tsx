/**
 * The explanation window next to the portal ("contextual window"): what is happening right now,
 * the subtitles of the narration, the official term next to its plain-language meaning, and the
 * one thing the citizen has to do in this step (big buttons, no forms to hunt through).
 *
 * 👉 EXTEND HERE: pictograms per step, sign-language video slot, "explain it even simpler" button.
 */
import { useEffect, useState } from "react";
import type { PortalField, Walkthrough, WalkthroughStep } from "../../src/shared/walkthrough";
import { tpl, type UIText } from "../i18n";
import { ADDRESS_FIELDS, AddressInput } from "./AddressInput";

export type WalkthroughActions = {
	answer: (fieldId: string, value: string | boolean) => void;
	editField: (fieldId: string) => void;
	chooseSlot: (slotId: string) => void;
	advance: () => void;
	submit: () => void;
	replay: () => void;
	close: () => void;
	startNext: () => void;
	askHuman: () => void;
};

type Props = { w: Walkthrough; t: UIText; actions: WalkthroughActions; queueNext?: string };

export function Explainer({ w, t, actions, queueNext }: Props) {
	const step = w.steps[w.current];
	if (!step) return null;
	const field = step.fieldId ? w.fields.find((f) => f.id === step.fieldId) : undefined;

	return (
		<div className="explainer-step">
			<p className="step-counter">
				{tpl(t.stepOf, { n: w.current + 1, total: w.steps.length })} · {t.chapters[step.chapter]}
			</p>
			<h2 className="step-title">{step.title}</h2>

			<div className="subtitles">
				<p aria-live="polite">{step.narration}</p>
				<button type="button" className="link-button" onClick={actions.replay}>
					🔁 {t.replay}
				</button>
			</div>

			{step.officialTerm && step.plainExplanation && (
				<dl className="term">
					<div>
						<dt>{t.official}</dt>
						<dd className="official">{step.officialTerm}</dd>
					</div>
					<div>
						<dt>{t.plain}</dt>
						<dd>{step.plainExplanation}</dd>
					</div>
				</dl>
			)}

			{w.error && (
				<p className="alert" role="alert">
					{w.error}
				</p>
			)}
			{field?.problem && (
				<p className="alert" role="alert">
					{field.problem}
				</p>
			)}

			<StepAction w={w} step={step} field={field} t={t} actions={actions} queueNext={queueNext} />

			{!w.factsVerified && step.kind !== "done" && (
				<p className="fine-print">
					{t.factsUnverified}
					{w.sourceUrl && (
						<>
							{" "}
							{t.source}:{" "}
							<a href={w.sourceUrl} target="_blank" rel="noreferrer">
								oesterreich.gv.at
							</a>
						</>
					)}
				</p>
			)}
		</div>
	);
}

function StepAction({ w, step, field, t, actions, queueNext }: Props & { step: WalkthroughStep; field?: PortalField }) {
	switch (step.kind) {
		case "ask":
			return field ? <AskWidget key={step.id} field={field} step={step} t={t} actions={actions} language={w.language} /> : null;

		case "autofill":
			return field ? (
				<div className="answer-box">
					<p className="value">{field.displayValue ?? field.value}</p>
					<p className="source">{sourceLabel(field, t)}</p>
					<div className="button-row">
						<button type="button" onClick={() => actions.editField(field.id)}>
							{t.change}
						</button>
					</div>
				</div>
			) : null;

		case "appointment":
			return (
				<div className="choice-list">
					{(step.slots ?? []).map((slot) => (
						<button
							key={slot.id}
							type="button"
							className="choice"
							aria-pressed={w.selectedSlot?.id === slot.id}
							onClick={() => actions.chooseSlot(slot.id)}
						>
							<strong>{formatSlot(slot.slotTime, w.language)}</strong>
							<span>{slot.office}</span>
						</button>
					))}
					{!step.slots?.length && (
						<button type="button" className="primary" onClick={actions.askHuman}>
							☎ {t.human}
						</button>
					)}
				</div>
			);

		case "review":
			return <Review w={w} t={t} actions={actions} />;

		case "done":
			return (
				<div className="done-box">
					<p className="reference">
						{t.referenceNumber}: <strong>{w.result?.referenceNumber}</strong>
					</p>
					{w.result?.appointment && (
						<p>
							{t.appointment}: <strong>{formatSlot(w.result.appointment.slotTime, w.language)}</strong>, {w.result.appointment.office}
						</p>
					)}
					<h3>{t.nextSteps}</h3>
					<ul>
						{w.result?.nextSteps.map((s) => (
							<li key={s}>{s}</li>
						))}
					</ul>
					<div className="button-row">
						{queueNext ? (
							<button type="button" className="primary" onClick={actions.startNext}>
								{tpl(t.upNext, { name: queueNext })} →
							</button>
						) : null}
						<button type="button" onClick={actions.close}>
							{t.finish}
						</button>
					</div>
				</div>
			);

		case "blocked":
			return (
				<div className="blocked-box">
					<ul className="checks">
						{step.checks?.map((c, i) => (
							<li key={i} className={`check ${c.status}`}>
								{c.text}
							</li>
						))}
					</ul>
					<div className="button-row">
						<button type="button" className="primary" onClick={actions.askHuman}>
							☎ {t.human}
						</button>
						<button type="button" onClick={actions.close}>
							{t.backToStart}
						</button>
					</div>
				</div>
			);

		default:
			// intro / check: play automatically; "next" is in the timeline controls
			return step.checks?.length ? (
				<ul className="checks">
					{step.checks.map((c, i) => (
						<li key={i} className={`check ${c.status}`}>
							<span aria-hidden="true">{c.status === "ok" ? "✓" : c.status === "warn" ? "!" : "✕"}</span> {c.text}
						</li>
					))}
				</ul>
			) : null;
	}
}

function AskWidget({
	field,
	step,
	t,
	actions,
	language,
}: {
	field: PortalField;
	step: WalkthroughStep;
	t: UIText;
	actions: WalkthroughActions;
	language: "de" | "en";
}) {
	const isAddress = field.type === "text" && ADDRESS_FIELDS.has(field.id);

	const [text, setText] = useState(field.value ?? "");
	useEffect(() => setText(field.value ?? ""), [field.value]);

	const submitText = () => text.trim() && actions.answer(field.id, text.trim());

	return (
		<div className="ask">
			{field.type === "boolean" && (
				<div className="button-row big">
					<button type="button" className="choice" aria-pressed={field.value === "yes"} onClick={() => actions.answer(field.id, true)}>
						{t.yes}
					</button>
					<button type="button" className="choice" aria-pressed={field.value === "no"} onClick={() => actions.answer(field.id, false)}>
						{t.no}
					</button>
				</div>
			)}

			{field.type === "select" && (
				<div className="choice-list">
					{field.options?.map((o) => (
						<button key={o.value} type="button" className="choice" aria-pressed={field.value === o.value} onClick={() => actions.answer(field.id, o.value)}>
							<strong>{o.label}</strong>
							{o.explain && <span>{o.explain}</span>}
						</button>
					))}
				</div>
			)}

			{/* Address fields: suggestions + check via Google Maps, with a "custom address" fallback. */}
			{isAddress && <AddressInput field={field} t={t} language={language} onAnswer={(value) => actions.answer(field.id, value)} />}

			{!isAddress && (field.type === "text" || field.type === "date") && (
				<form
					className="field-form"
					onSubmit={(e) => {
						e.preventDefault();
						submitText();
					}}
				>
					<label htmlFor={`in-${field.id}`}>{field.label}</label>
					<input
						id={`in-${field.id}`}
						type={field.type === "date" ? "date" : "text"}
						value={text}
						placeholder={field.hint}
						autoComplete={field.id === "new_address" ? "street-address" : "off"}
						onChange={(e) => setText(e.target.value)}
					/>
					<div className="button-row">
						{field.type === "date" && (
							<button type="button" onClick={() => actions.answer(field.id, new Date().toISOString().slice(0, 10))}>
								{t.today}
							</button>
						)}
						<button type="submit" className="primary" disabled={!text.trim()}>
							{t.apply}
						</button>
					</div>
				</form>
			)}

			<div className="button-row">
				{step.skippable && (
					<button type="button" className="link-button" onClick={() => actions.answer(field.id, "")}>
						{t.skipField}
					</button>
				)}
				{step.done && (
					<button type="button" onClick={actions.advance}>
						{t.continue} →
					</button>
				)}
			</div>
			<p className="fine-print">{t.youCanSay}</p>
		</div>
	);
}

function Review({ w, t, actions }: { w: Walkthrough; t: UIText; actions: WalkthroughActions }) {
	const shown = w.fields.filter((f) => w.steps.some((s) => s.fieldId === f.id));
	const blocked = shown.some((f) => f.problem || (f.required && !f.value));
	const submitting = w.status === "submitting";
	return (
		<div className="review">
			<h3>{t.reviewTable}</h3>
			<table>
				<tbody>
					{shown.map((f) => (
						<tr key={f.id} className={f.problem || (f.required && !f.value) ? "has-problem" : ""}>
							<th scope="row">{f.label}</th>
							<td>{f.displayValue ?? f.value ?? "–"}</td>
							<td>
								<button type="button" className="link-button" onClick={() => actions.editField(f.id)} disabled={submitting}>
									{t.change}
								</button>
							</td>
						</tr>
					))}
					{w.selectedSlot && (
						<tr>
							<th scope="row">{t.appointment}</th>
							<td>
								{formatSlot(w.selectedSlot.slotTime, w.language)}, {w.selectedSlot.office}
							</td>
							<td />
						</tr>
					)}
				</tbody>
			</table>
			<button type="button" className="primary big confirm" onClick={actions.submit} disabled={blocked || submitting}>
				{submitting ? t.submitting : `✓ ${t.confirm}`}
			</button>
			<p className="fine-print">{t.confirmNote}</p>
		</div>
	);
}

function sourceLabel(field: PortalField, t: UIText): string {
	switch (field.source) {
		case "profile":
			return t.sourceProfile;
		case "assistant":
			return t.sourceAssistant;
		case "draft":
			return t.sourceDraft;
		default:
			return t.sourceCitizen;
	}
}

function formatSlot(slotTime: string, lang: "de" | "en"): string {
	const d = new Date(`${slotTime}:00`);
	return new Intl.DateTimeFormat(lang === "de" ? "de-AT" : "en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d);
}

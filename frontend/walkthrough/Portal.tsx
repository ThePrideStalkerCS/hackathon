/**
 * The authority's web page – the MAIN WINDOW of the app. It looks like the portal the citizen
 * would use alone (that's the learning effect). The assistant is a layer on top of it:
 *   - a ghost cursor that moves to what it is working on and types values in
 *   - a glowing highlight on the active field
 *   - the coach card (Coach.tsx), attached right below the element it is about
 *
 * Fields can be tapped to change them. The page's own "Submit application" button is the only
 * way to submit; it is enabled on the review step only.
 *
 * 👉 EXTEND HERE: make it look like the real portal, "expert mode" with direct typing.
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { PortalField, Walkthrough } from "../../src/shared/walkthrough";
import { Icon } from "../icons";
import { formatSlot, type UIText } from "../i18n";

type Props = {
	w: Walkthrough;
	t: UIText;
	/** The assistant's card for the current step (or null). Rendered under the active element. */
	coach: ReactNode;
	onEditField: (fieldId: string) => void;
	onSubmit: () => void;
};

/** The element the assistant is working on right now. */
function anchorFor(w: Walkthrough): string {
	const step = w.steps[w.current];
	if (!step) return "title";
	if (step.fieldId) return `field-${step.fieldId}`;
	if (step.kind === "check" || step.kind === "blocked") return "requirements";
	if (step.kind === "appointment") return "appointment";
	if (step.kind === "review") return "submit";
	if (step.kind === "done") return "done";
	return "title";
}

export function Portal({ w, t, coach, onEditField, onSubmit }: Props) {
	const step = w.steps[w.current];
	const pageRef = useRef<HTMLElement>(null);
	const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
	const anchor = anchorFor(w);
	const locked = Boolean(w.result) || w.status === "blocked";

	// Move the ghost cursor to the active element and bring it into view (window scroll:
	// the page is the main window). Deferred: a smooth scroll started during a re-render is cancelled.
	useLayoutEffect(() => {
		const page = pageRef.current;
		const el = page?.querySelector<HTMLElement>(`[data-anchor="${anchor}"]`);
		if (!page || !el) return;
		const pageBox = page.getBoundingClientRect();
		const box = el.getBoundingClientRect();
		setCursor({ x: box.left - pageBox.left + Math.min(box.width * 0.55, 300), y: box.top - pageBox.top + Math.min(box.height * 0.6, 40) });
		const timer = setTimeout(() => {
			const top = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.22;
			window.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
		}, 80);
		return () => clearTimeout(timer);
	}, [anchor, w.current]);

	const checks = w.steps.find((s) => s.kind === "check" || s.kind === "blocked")?.checks ?? [];
	const checksReached = w.steps.slice(0, w.current + 1).some((s) => s.kind === "check" || s.kind === "blocked");
	const formFields = w.fields.filter((f) => w.steps.some((s) => s.fieldId === f.id));
	const isReview = step?.kind === "review";
	const submitBlocked = formFields.some((f) => f.problem || (f.required && !f.value));

	// Submitted: the portal shows its confirmation page.
	if (w.result) {
		return (
			<article className="page success" ref={pageRef}>
				<div className="success-mark" data-anchor="done">
					<Icon name="check" size={40} strokeWidth={2.5} />
				</div>
				<p className="authority">{w.authority}</p>
				<h1>{t.submittedTitle}</h1>
				<p className="success-service">{w.serviceName}</p>
				<div className="reference">
					<span>{t.referenceNumber}</span>
					<strong>{w.result.referenceNumber}</strong>
				</div>
				{w.result.appointment && (
					<div className="appointment-ticket">
						<Icon name="calendar" />
						<div>
							<strong>{formatSlot(w.result.appointment.slotTime, w.language)}</strong>
							<span>{w.result.appointment.office}</span>
						</div>
					</div>
				)}
				{coach}
				<h2>{t.nextSteps}</h2>
				<ol className="next-steps">
					{w.result.nextSteps.map((s) => (
						<li key={s}>{s}</li>
					))}
				</ol>
			</article>
		);
	}

	return (
		<article className="page" ref={pageRef} aria-label={`${t.simulation}: ${w.portalTitle}`}>
			{cursor && (
				<div className="ghost-cursor" aria-hidden="true" style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}>
					{/* An ordinary mouse pointer: it should feel like a screen recording, not like magic. */}
					<svg width="24" height="30" viewBox="0 0 22 28">
						<path d="M1 1 L1 22 L7 17 L11 26 L15 24 L11 15 L19 15 Z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
					</svg>
				</div>
			)}

			<header className="page-head">
				<p className="authority">{w.authority}</p>
				<h1 data-anchor="title" className={anchor === "title" ? "is-active" : ""}>
					{w.portalTitle}
				</h1>
				{w.implementation === "mock" && <span className="tag">{t.mockService}</span>}
			</header>
			{anchor === "title" && coach}

			<section className={`block requirements ${anchor === "requirements" ? "is-active" : ""}`} data-anchor="requirements">
				<h2>{t.portalRequirements}</h2>
				{checksReached ? (
					<ul className="checks">
						{checks.map((c, i) => (
							<li key={i} className={`check ${c.status}`}>
								<Icon name={c.status === "ok" ? "checkCircle" : c.status === "warn" ? "alert" : "x"} size={20} />
								<span>{c.text}</span>
							</li>
						))}
					</ul>
				) : (
					<div className="skeleton" aria-hidden="true">
						<span />
						<span />
					</div>
				)}
			</section>
			{anchor === "requirements" && coach}

			{w.status !== "blocked" && (
				<section className="block form">
					{formFields.map((f) => {
						// Like a screen recording: a field only shows its value once the cursor got there.
						const index = w.steps.findIndex((s) => s.fieldId === f.id);
						const reached = index <= w.current || w.steps[index].done;
						const active = anchor === `field-${f.id}`;
						return (
							<Fragment key={f.id}>
								<FieldRow
									field={reached ? f : { ...f, value: undefined, displayValue: undefined, problem: undefined }}
									t={t}
									active={active}
									typing={active && step?.kind === "autofill"}
									waiting={active && step?.kind === "ask"}
									editable={!locked && reached && Boolean(f.value) && !active}
									onEdit={() => onEditField(f.id)}
								/>
								{active && coach}
							</Fragment>
						);
					})}

					{w.steps.some((s) => s.kind === "appointment") && (
						<>
							<div className={`field ${anchor === "appointment" ? "is-active" : ""} ${w.selectedSlot ? "is-filled" : ""}`} data-anchor="appointment">
								<span className="field-label">{t.appointment}</span>
								<span className="field-value">
									{w.selectedSlot ? (
										<>
											{formatSlot(w.selectedSlot.slotTime, w.language)} · {w.selectedSlot.office}
										</>
									) : (
										<span className="placeholder">{anchor === "appointment" ? t.portalWaiting : ""}</span>
									)}
								</span>
							</div>
							{anchor === "appointment" && coach}
						</>
					)}
				</section>
			)}

			{w.status !== "blocked" && (
				<footer className="page-submit" data-anchor="submit">
					{anchor === "submit" && coach}
					<button
						type="button"
						className={`gov-button ${isReview && !submitBlocked ? "is-ready" : ""}`}
						disabled={!isReview || submitBlocked || w.status === "submitting"}
						onClick={onSubmit}
					>
						{w.status === "submitting" ? t.submitting : t.portalSubmit}
						<Icon name="arrowRight" size={20} />
					</button>
				</footer>
			)}

			<p className="page-fine">
				{t.factsUnverified}
				{w.sourceUrl && (
					<>
						{" "}
						<a href={w.sourceUrl} target="_blank" rel="noreferrer">
							{t.source}: oesterreich.gv.at
						</a>
					</>
				)}
			</p>
		</article>
	);
}

function FieldRow(props: { field: PortalField; t: UIText; active: boolean; typing: boolean; waiting: boolean; editable: boolean; onEdit: () => void }) {
	const { field, t, active, typing, waiting, editable, onEdit } = props;
	const text = field.displayValue ?? field.value ?? "";
	const shown = useTypewriter(text, typing);
	const classes = ["field", active && "is-active", field.problem && "has-problem", field.value && "is-filled", editable && "is-editable"].filter(Boolean).join(" ");
	const source = field.source === "profile" ? t.fromYourData : field.source === "assistant" ? t.suggested : null;

	const value = (
		<>
			<span className="field-label">
				{field.label}
				{field.required && (
					<span className="req" aria-hidden="true">
						{" "}
						*
					</span>
				)}
			</span>
			<span className="field-value">
				<span className="field-text">{shown}</span>
				{(typing && shown.length < text.length) || (waiting && !text) ? <span className="caret" aria-hidden="true" /> : null}
				{waiting && !text && <span className="placeholder">{t.portalWaiting}</span>}
				{editable && (
					<span className="field-edit">
						<Icon name="pencil" size={16} /> {t.change}
					</span>
				)}
			</span>
			{field.value && source && !active && <span className="field-source">{source}</span>}
		</>
	);

	return editable ? (
		<button type="button" className={classes} data-anchor={`field-${field.id}`} onClick={onEdit}>
			{value}
		</button>
	) : (
		<div className={classes} data-anchor={`field-${field.id}`}>
			{value}
		</div>
	);
}

/** Types `text` character by character while `animate` is true (max ~1.4 s). */
function useTypewriter(text: string, animate: boolean): string {
	const [count, setCount] = useState(animate ? 0 : text.length);
	useEffect(() => {
		if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			setCount(text.length);
			return;
		}
		setCount(0);
		const perChar = Math.max(18, Math.min(60, 1400 / Math.max(1, text.length)));
		const id = setInterval(() => setCount((c) => (c >= text.length ? (clearInterval(id), c) : c + 1)), perChar);
		return () => clearInterval(id);
	}, [text, animate]);
	return text.slice(0, count);
}

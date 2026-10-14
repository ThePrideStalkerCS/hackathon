/**
 * The "screen recording" part of the tutorial: a simulated government portal page with the
 * official form. The assistant's ghost cursor moves to the field it is working on, types in values
 * it knows, and highlights what the citizen needs to answer.
 *
 * It is a VISUAL demonstration: the citizen answers in the explanation window (Explainer.tsx).
 * Filled fields can be clicked to change them.
 *
 * 👉 EXTEND HERE: make it look like the real portal the citizen will later use alone (that is the
 *    learning effect), an "expert mode" where the citizen types directly into the form.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PortalField, Walkthrough } from "../../src/shared/walkthrough";
import type { UIText } from "../i18n";

type Props = {
	w: Walkthrough;
	t: UIText;
	onEditField: (fieldId: string) => void;
};

/** Where the cursor points for steps that aren't about a field. */
function anchorFor(w: Walkthrough): string {
	const step = w.steps[w.current];
	if (!step) return "title";
	if (step.fieldId) return `field-${step.fieldId}`;
	if (step.kind === "check" || step.kind === "blocked") return "requirements";
	if (step.kind === "appointment") return "appointment";
	if (step.kind === "review" || step.kind === "done") return "submit";
	return "title";
}

export function Portal({ w, t, onEditField }: Props) {
	const step = w.steps[w.current];
	const pageRef = useRef<HTMLDivElement>(null);
	const [cursor, setCursor] = useState({ x: 24, y: 24 });
	const anchor = anchorFor(w);

	// Move the ghost cursor to the active element and scroll it into view.
	useLayoutEffect(() => {
		const page = pageRef.current;
		const el = page?.querySelector<HTMLElement>(`[data-anchor="${anchor}"]`);
		if (!page || !el) return;
		// .portal-page is the offsetParent of every anchor, so offsets are in page coordinates.
		setCursor({ x: el.offsetLeft + Math.min(el.offsetWidth * 0.6, 260), y: el.offsetTop + el.offsetHeight * 0.6 });
		// Scroll only inside the portal, never the whole page (the explanation window must stay in view).
		// Deferred: a smooth scroll started during the re-render gets cancelled by the browser.
		const timer = setTimeout(() => {
			page.scrollTo({
				top: el.offsetTop - page.clientHeight / 2 + el.offsetHeight / 2,
				behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
			});
		}, 80);
		return () => clearTimeout(timer);
	}, [anchor, w.current]);

	const checks = w.steps.find((s) => s.kind === "check" || s.kind === "blocked")?.checks ?? [];
	const showChecks = w.steps.slice(0, w.current + 1).some((s) => s.kind === "check" || s.kind === "blocked");

	return (
		<section className="portal" aria-label={`${t.portalSimulation}: ${w.portalTitle}`}>
			<div className="portal-chrome" aria-hidden="true">
				<span className="dots">
					<i />
					<i />
					<i />
				</span>
				<span className="portal-url">🔒 {w.portalUrl}</span>
				<span className="sim-badge">{t.portalSimulation}</span>
			</div>

			<div className="portal-page" ref={pageRef}>
				<div className="ghost-cursor" aria-hidden="true" style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}>
					<svg width="22" height="28" viewBox="0 0 22 28">
						<path d="M1 1 L1 22 L7 17 L11 26 L15 24 L11 15 L19 15 Z" fill="var(--cursor)" stroke="#fff" strokeWidth="1.5" />
					</svg>
				</div>

				<header className="portal-header">
					<span className="portal-logo">Amtsportal</span>
					<span className="portal-authority">{w.authority}</span>
				</header>

				<h2 className={`portal-title ${anchor === "title" ? "is-active" : ""}`} data-anchor="title">
					{w.portalTitle}
				</h2>
				{w.implementation === "mock" && <p className="portal-mock">{t.mockService}</p>}

				<div className={`portal-box ${anchor === "requirements" ? "is-active" : ""}`} data-anchor="requirements">
					<h3>{t.portalRequirements}</h3>
					{showChecks ? (
						<ul className="checks">
							{checks.map((c, i) => (
								<li key={i} className={`check ${c.status}`}>
									<span aria-hidden="true">{c.status === "ok" ? "✓" : c.status === "warn" ? "!" : "✕"}</span> {c.text}
								</li>
							))}
						</ul>
					) : (
						<p className="muted">…</p>
					)}
				</div>

				<div className="portal-form">
					{w.fields
						.filter((f) => w.steps.some((s) => s.fieldId === f.id))
						.map((f) => {
							// Like a screen recording: a field only shows its value once the cursor got there.
							const index = w.steps.findIndex((s) => s.fieldId === f.id);
							const reached = index <= w.current || w.steps[index].done;
							return (
								<PortalFieldView
									key={f.id}
									field={reached ? f : { ...f, value: undefined, displayValue: undefined, problem: undefined }}
									t={t}
									active={step?.fieldId === f.id}
									typing={step?.fieldId === f.id && step.kind === "autofill"}
									waiting={step?.fieldId === f.id && step.kind === "ask"}
									editable={!w.result && w.status !== "blocked" && reached && Boolean(f.value) && step?.fieldId !== f.id}
									onEdit={() => onEditField(f.id)}
								/>
							);
						})}

					{w.steps.some((s) => s.kind === "appointment") && (
						<div className={`portal-field ${anchor === "appointment" ? "is-active" : ""}`} data-anchor="appointment">
							<span className="portal-label">{t.appointment}</span>
							<span className="portal-input">{w.selectedSlot ? `${w.selectedSlot.slotTime.replace("T", " ")} · ${w.selectedSlot.office}` : ""}</span>
						</div>
					)}
				</div>

				<div className={`portal-submit ${anchor === "submit" ? "is-active" : ""}`} data-anchor="submit">
					{w.result ? (
						<p className="portal-submitted">
							✓ {t.portalSubmitted}: <strong>{w.result.referenceNumber}</strong>
						</p>
					) : (
						<span className="portal-button" aria-hidden="true">
							{t.portalSubmit}
						</span>
					)}
				</div>
			</div>
		</section>
	);
}

function PortalFieldView(props: {
	field: PortalField;
	t: UIText;
	active: boolean;
	typing: boolean;
	waiting: boolean;
	editable: boolean;
	onEdit: () => void;
}) {
	const { field, t, active, typing, waiting, editable, onEdit } = props;
	const text = field.displayValue ?? field.value ?? "";
	const shown = useTypewriter(text, typing);
	const classes = ["portal-field", active && "is-active", field.problem && "has-problem", field.value && "is-filled"].filter(Boolean).join(" ");

	return (
		<div className={classes} data-anchor={`field-${field.id}`}>
			<span className="portal-label">
				{field.label}
				{field.required && <span aria-hidden="true"> *</span>}
			</span>
			<span className="portal-input">
				{shown}
				{(typing && shown.length < text.length) || waiting ? <span className="caret" aria-hidden="true" /> : null}
				{waiting && !text && <span className="portal-waiting">{t.portalWaiting}</span>}
			</span>
			{editable && (
				<button type="button" className="link-button" onClick={onEdit}>
					{t.change}
				</button>
			)}
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

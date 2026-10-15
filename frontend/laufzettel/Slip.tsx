/**
 * The Laufzettel view of a running walkthrough (the main window while a service is in progress).
 *
 *   Hero          the life event ("Register your new address"), the official form name once in small
 *                 type, and the emblem; the slip head shows its small emblem only once this one has
 *                 scrolled away, so there is one big emblem on screen
 *   Slip          perforated paper with the security-print band; one row per station (stations.ts)
 *                 done rows carry a blue stamp, the current row is highlighted, the one question that
 *                 needs the citizen gets the yellow marker and its answer widgets right in the row
 *   Last row      "You": the red seal, hold to sign = submit (only the citizen can do this)
 *   Confirmation  after submitting the slip turns into the confirmation document with the full seal
 *
 * The playback loop in App.tsx is unchanged: autofill rows get stamped one by one while the caption
 * bar narrates. See docs/DESIGN.md.
 */
import { useEffect, useRef, useState } from "react";
import type { Walkthrough } from "../../src/shared/walkthrough";
import { TIME_SAVED_MINUTES, formatMinutes } from "../../src/shared/stamps";
import { Band, Lockup, Stamp } from "../brand/Brand";
import { Emblem, motifFor } from "../brand/Emblem";
import { formatSlot, tpl, type UIText } from "../i18n";
import { Icon } from "../icons";
import { AskInput, SlotPicker, type WalkthroughActions } from "../walkthrough/Answers";
import { stampSound } from "../brand/thump";
import { HoldSeal } from "./HoldSeal";
import { buildStations, initials, slipNumber, type Station } from "./stations";

type Props = { w: Walkthrough; t: UIText; actions: WalkthroughActions; citizenName?: string; queueNext?: string; showSeal?: boolean; sound?: boolean };

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Slip({ w, t, actions, citizenName, queueNext, showSeal = true, sound = false }: Props) {
	const stations = buildStations(w, t, citizenName);
	const total = stations.length;
	const done = stations.filter((s) => s.state === "done").length;

	// A stamp lands: a soft thump (only with the voice on). Not on the first render of a slip.
	const lastDone = useRef<{ id: string; done: number } | null>(null);
	useEffect(() => {
		const before = lastDone.current;
		lastDone.current = { id: w.id, done };
		if (sound && before?.id === w.id && done > before.done) stampSound();
	}, [w.id, done, sound]);
	const answersLeft = stations.filter((s) => (s.step.kind === "ask" || s.step.kind === "appointment") && s.state !== "done").length;
	const minutes = TIME_SAVED_MINUTES[w.serviceId];
	const motif = motifFor(w.serviceId);
	const serial = `Nr. ${slipNumber(w)}`;
	const progress = [
		tpl(t.lzStamped, { done, total }),
		w.status === "blocked" ? null : answersLeft > 1 ? tpl(t.lzLeftMany, { n: answersLeft }) : answersLeft === 1 ? t.lzLeftOne : t.lzLeftSign,
		showSeal && minutes && w.status !== "blocked" ? tpl(t.lzKeepEst, { time: formatMinutes(minutes, w.language) }) : null,
	].filter(Boolean);
	const progressShort = [
		tpl(t.lzHeadOf, { done, total }),
		w.status === "blocked" ? null : answersLeft > 0 ? tpl(t.lzHeadLeft, { n: answersLeft }) : t.lzHeadSign,
		showSeal && minutes && w.status !== "blocked" ? tpl(t.lzHeadKeep, { time: formatMinutes(minutes, w.language) }) : null,
	]
		.filter(Boolean)
		.join(" · ");
	const listRef = useRef<HTMLOListElement>(null);
	const heroSealRef = useRef<HTMLElement>(null);
	const [heroSealInView, setHeroSealInView] = useState(true);
	const lifeEvent = lifeEventTitle(w);

	useEffect(() => {
		const el = heroSealRef.current;
		if (!el) {
			setHeroSealInView(false);
			return;
		}
		const top = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--lz-top-h")) || 64;
		const io = new IntersectionObserver(([e]) => setHeroSealInView(e.isIntersecting), { rootMargin: `-${top + 60}px 0px 0px 0px` });
		io.observe(el);
		return () => io.disconnect();
	}, [showSeal, Boolean(w.result)]);

	// Bring the current row into view, and put keyboard focus on a question that waits for the citizen.
	// The row is centred in the room between the sticky heads and the captions; a row taller than that
	// room (a question on a phone) starts just below the heads, so its title is never covered.
	useEffect(() => {
		const row = listRef.current?.querySelector<HTMLElement>(".lz-row.is-current");
		if (!row) return;
		const timer = setTimeout(() => {
			const above = (document.querySelector(".lz-top")?.getBoundingClientRect().height ?? 0) + (row.closest(".lz-slip")?.querySelector(".lz-slip-head")?.getBoundingClientRect().height ?? 0) + 12;
			const below = (document.querySelector(".lz-captions")?.getBoundingClientRect().height ?? 0) + 12;
			const room = window.innerHeight - above - below;
			const r = row.getBoundingClientRect();
			const top = r.top + window.scrollY - above - Math.max(0, (room - r.height) / 2);
			window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? "auto" : "smooth" });
			row.querySelector<HTMLElement>("[data-focus]")?.focus({ preventScroll: true });
		}, 120);
		return () => clearTimeout(timer);
	}, [w.current, w.id]);

	if (w.result) return <Confirmation w={w} t={t} actions={actions} citizenName={citizenName} queueNext={queueNext} total={total} showSeal={showSeal} />;

	return (
		<article className="lz-view" aria-label={w.portalTitle}>
			<header className="lz-hero">
				<div className="lz-hero-text">
					<p className="lz-kicker">
						<i aria-hidden="true" />
						{w.authority}
					</p>
					<h1 className="lz-title">{lifeEvent}</h1>
					<p className="lz-hero-form">
						{t.lzOfficialForm} <span>{w.portalTitle}</span>
					</p>
					{queueNext && (
						<p className="lz-hero-form lz-hero-next">
							{t.lzAfterThis} <span>{queueNext}</span>
						</p>
					)}
					{w.sourceUrl && (
						<p className="lz-source">
							<a href={w.sourceUrl} target="_blank" rel="noreferrer">
								<Icon name={w.factsVerified ? "checkCircle" : "alert"} size={16} /> {w.factsVerified ? t.lzSourceChecked : t.lzSourceOpen}
							</a>
						</p>
					)}
				</div>
				{showSeal && (
					<figure className="lz-hero-seal" ref={heroSealRef}>
						<Emblem motif={motif} done={done} total={total} serial={serial} label={tpl(t.lzSealLabel, { done, total })} />
						<figcaption>{t.lzPeakGrows}</figcaption>
					</figure>
				)}
			</header>

			<div className="lz-slip-wrap">
				<div className="lz-slip">
					<Band />
					<div className={`lz-slip-head ${showSeal && heroSealInView ? "is-hero-seal" : ""}`}>
						{showSeal && <Emblem motif={motif} done={done} total={total} size="xs" label={heroSealInView ? "" : tpl(t.lzSealLabel, { done, total })} />}
						<div className="lz-head-text">
							<p className="lz-head-name">
								<span className="lz-slip-name">Laufzettel</span>
								<span className="lz-head-no">{slipNumber(w)}</span>
							</p>
							<p className="lz-head-progress" aria-live="polite">
								{progress.map((p, i) => (
									<span key={i}>{i === 0 ? <b>{p}</b> : p}</span>
								))}
							</p>
							<p className="lz-head-short" aria-hidden="true">
								{progressShort}
							</p>
						</div>
					</div>
					<ol className="lz-rows" ref={listRef}>
						{stations.map((s) => (
							<Row key={s.id} s={s} w={w} t={t} actions={actions} citizenName={citizenName} />
						))}
					</ol>
				</div>
			</div>
		</article>
	);
}

/** The life event in the citizen's words ("Register your new address"), not the form name. */
function lifeEventTitle(w: Walkthrough): string {
	return w.steps.find((s) => s.kind === "intro")?.title ?? w.serviceName;
}

function Row({ s, w, t, actions, citizenName }: { s: Station; w: Walkthrough; t: UIText; actions: WalkthroughActions; citizenName?: string }) {
	const { step, field } = s;
	const locked = Boolean(w.result) || w.status === "blocked";
	const asking = s.current && !locked && (step.kind === "ask" || step.kind === "appointment") && !(step.kind === "appointment" && step.done);
	const formFields = w.fields.filter((f) => w.steps.some((x) => x.fieldId === f.id));
	const submitBlocked = formFields.some((f) => f.problem || (f.required && !f.value));

	let body;
	if (step.kind === "check" || step.kind === "blocked") {
		body = (
			<>
				<p className="lz-text">{step.title}</p>
				{s.state !== "pending" && step.checks && step.checks.length > 0 && (
					<ul className="lz-checks">
						{step.checks.map((c) => (
							<li key={c.text} className={`is-${c.status}`}>
								<Icon name={c.status === "ok" ? "check" : "alert"} size={16} /> {c.text}
							</li>
						))}
					</ul>
				)}
				{step.kind === "blocked" && (
					<div className="lz-actions">
						<button type="button" className="lz-btn is-primary" onClick={actions.askHuman}>
							<Icon name="headset" size={20} /> {t.humanLong}
						</button>
						<button type="button" className="lz-btn" onClick={actions.close}>
							{t.lzBackToDesk}
						</button>
					</div>
				)}
			</>
		);
	} else if (step.kind === "review") {
		body = (
			<>
				<p className="lz-text">{t.lzSignText}</p>
				{s.current && submitBlocked && <p className="lz-problem">{t.lzFixFirst}</p>}
				{s.current && w.error && (
					<p className="lz-problem" role="alert">
						{w.error}
					</p>
				)}
			</>
		);
	} else if (asking && step.kind === "ask" && field) {
		body = (
			<div className="lz-ask" tabIndex={-1} data-focus>
				<p className="lz-q">
					<span className="lz-marker">{step.title}</span>
				</p>
				{step.plainExplanation && <p className="lz-help">{step.plainExplanation}</p>}
				{step.officialTerm && step.officialTerm !== step.title && (
					<p className="lz-official">
						{t.onTheForm} <strong>{step.officialTerm}</strong>
					</p>
				)}
				{field.problem && (
					<p className="lz-problem" role="alert">
						<Icon name="alert" size={18} /> {field.problem}
					</p>
				)}
				<div className="lz-answer">
					<AskInput key={step.id} field={field} step={step} t={t} actions={actions} language={w.language} />
				</div>
			</div>
		);
	} else if (asking && step.kind === "appointment") {
		body = (
			<div className="lz-ask" tabIndex={-1} data-focus>
				<p className="lz-q">
					<span className="lz-marker">{step.title}</span>
				</p>
				<div className="lz-answer">
					<SlotPicker w={w} step={step} t={t} actions={actions} />
				</div>
			</div>
		);
	} else {
		const value =
			step.kind === "appointment" ? (w.selectedSlot ? `${formatSlot(w.selectedSlot.slotTime, w.language)}, ${w.selectedSlot.office}` : undefined) : field?.displayValue || field?.value;
		body =
			s.state === "pending" && step.kind !== "ask" ? (
				<span className="lz-blank" aria-label="…" />
			) : value ? (
				<p className={`lz-value ${s.current && s.state !== "done" ? "is-typing" : ""}`}>
					{value}
					{s.state === "done" && field && !locked && (
						<button type="button" className="lz-link" onClick={() => actions.editField(field.id)}>
							{t.lzChange}
						</button>
					)}
				</p>
			) : (
				<p className="lz-text is-muted">{step.title}</p>
			);
	}

	let cell = null;
	if (s.state === "done" && s.stamp) cell = <Stamp spec={s.stamp} />;
	else if (asking) cell = <span className="lz-yours">{t.lzYourTurn}</span>;
	else if (step.kind === "review")
		cell = (
			<HoldSeal
				initials={initials(citizenName) || "OK"}
				label={t.lzHoldToSign}
				hint={t.lzHoldHint}
				busy={w.status === "submitting"}
				busyLabel={t.lzSigning}
				disabled={!s.current || submitBlocked || locked}
				onConfirm={actions.submit}
			/>
		);

	return (
		<li className={`lz-row is-${s.state} kind-${step.kind} ${s.current ? "is-current" : ""} ${asking ? "is-asking" : ""}`} aria-current={s.current ? "step" : undefined}>
			<span className="lz-route" aria-hidden="true">
				<i className="lz-dot" />
			</span>
			<div className="lz-office">
				<b>{s.label}</b>
				{s.sub && <small>{s.sub}</small>}
			</div>
			<div className="lz-what">{body}</div>
			<div className="lz-cell">{cell}</div>
		</li>
	);
}

function Confirmation({ w, t, actions, citizenName, queueNext, total, showSeal = true }: Props & { total: number }) {
	const result = w.result!;
	const minutes = TIME_SAVED_MINUTES[w.serviceId];
	const locale = w.language === "de" ? "de-AT" : "en-GB";
	const submitted = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(result.submittedAt));
	const stamps = buildStations(w, t, citizenName);
	const seal = stamps.find((s) => s.step.kind === "review")?.stamp;
	// The structured output: every form field as it was submitted.
	const entries = w.fields.filter((f) => f.displayValue || f.value);

	return (
		<article className="lz-view lz-done-view" aria-labelledby="lz-confirm-title">
			<div className="lz-doc-wrap">
				<div className="lz-slip lz-doc">
					<Band />
					<div className="lz-doc-in">
						<div className="lz-doc-head">
							<Lockup endorse={false} size={22} />
							<span className="lz-mono">
								{slipNumber(w)} · {t.lzClosed} {submitted}
							</span>
						</div>
						<h1 className="lz-doc-title" id="lz-confirm-title">
							{t.lzConfirmation}
						</h1>
						<p className="lz-doc-sub">{lifeEventTitle(w)}</p>
						{w.sourceUrl && (
							<p className="lz-source">
								<a href={w.sourceUrl} target="_blank" rel="noreferrer">
									<Icon name={w.factsVerified ? "checkCircle" : "alert"} size={16} /> {w.factsVerified ? t.lzSourceChecked : t.lzSourceOpen}
								</a>
							</p>
						)}
						<dl className="lz-doc-dl">
							<div>
								<dt>{t.referenceNumber}</dt>
								<dd className="lz-mono-strong">{result.referenceNumber}</dd>
							</div>
							{citizenName && (
								<div>
									<dt>{t.lzYou}</dt>
									<dd>{citizenName}</dd>
								</div>
							)}
							<div>
								<dt>{t.lzAuthority}</dt>
								<dd>{result.authority}</dd>
							</div>
							<div>
								<dt>{t.lzSubmittedAt}</dt>
								<dd>{submitted}</dd>
							</div>
							{result.appointment && (
								<div>
									<dt>{t.lzAppointment}</dt>
									<dd>
										{formatSlot(result.appointment.slotTime, w.language)}, {result.appointment.office}
									</dd>
								</div>
							)}
							<div>
								<dt>{t.lzStations}</dt>
								<dd>{tpl(t.lzStamped, { done: total, total })}</dd>
							</div>
						</dl>
						<div className="lz-doc-seal">
							{showSeal && <Emblem motif={motifFor(w.serviceId)} done={total} total={total} serial={`Nr. ${slipNumber(w)}`} size="md" label={tpl(t.lzSealLabel, { done: total, total })} />}
							{seal && <Stamp spec={seal} delay={0.35} />}
						</div>
						{showSeal && (
							<p className="lz-peak-earned">
								{t.lzPeakSummit} <b>{t.lzPeakEarned}</b>
							</p>
						)}
						{showSeal && minutes && (
							<p className="lz-doc-kept">
								<b>{tpl(t.lzKept, { time: formatMinutes(minutes, w.language) })}</b> {t.lzKeptHow}
							</p>
						)}
						<h2 className="lz-doc-h2">{t.nextSteps}</h2>
						<ol className="lz-next">
							{result.nextSteps.map((s) => (
								<li key={s}>{s}</li>
							))}
						</ol>
						{entries.length > 0 && (
							<>
								<h2 className="lz-doc-h2">{t.lzEntries}</h2>
								<dl className="lz-doc-dl is-entries">
									{entries.map((f) => (
										<div key={f.id}>
											<dt>{f.label}</dt>
											<dd>{f.displayValue || f.value}</dd>
										</div>
									))}
								</dl>
							</>
						)}
						<div className="lz-actions">
							{queueNext && (
								<button type="button" className="lz-btn is-primary" onClick={actions.startNext}>
									{tpl(t.lzNextSlip, { name: queueNext })} <Icon name="arrowRight" size={20} />
								</button>
							)}
							<button type="button" className={`lz-btn ${queueNext ? "" : "is-primary"}`} onClick={actions.close}>
								{t.lzBackToDesk}
							</button>
							<button type="button" className="lz-btn" onClick={() => window.print()}>
								<Icon name="download" size={20} /> {t.lzSavePdf}
							</button>
						</div>
					</div>
				</div>
			</div>
		</article>
	);
}

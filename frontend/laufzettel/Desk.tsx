/**
 * The start page: the citizen's desk ("Pult"), built around ONE errand.
 *
 *   Notice     the most important open routing slip as an official notice: who sends it, the date,
 *              the legal deadline and the days left, what happened (e.g. the landlord confirmed the
 *              move), the route of the slip (rows the offices fill, questions for you, your seal) and
 *              one button to start. Fair nudging: the deadline and the time you keep, nothing more.
 *   Mailbox    letters that need the citizen (e.g. a parking fine), with their deadline
 *   Say it     one line, microphone first: tell the state what happened, in your own words (dialect is fine)
 *   Record     private: finished errands as emblems, records as stamps, plus the time kept
 *
 * Not a chat: the assistant's reply to a free request appears as one caption line, nothing piles up.
 */
import { useState } from "react";
import type { Letter } from "../../src/shared/mail";
import type { Suggestion } from "../../src/shared/walkthrough";
import { TIME_SAVED_MINUTES, formatMinutes, type Overview, type Stamp as RecordStamp } from "../../src/shared/stamps";
import type { Language } from "../../src/shared/types";
import { Band, Stamp } from "../brand/Brand";
import { Emblem, motifFor } from "../brand/Emblem";
import { MicButton } from "../components";
import { Icon } from "../icons";
import { tpl, type UIText } from "../i18n";
import type { useRecorder } from "../voice";
import { longDate } from "./Postfach";

type Props = {
	t: UIText;
	lang: Language;
	name: string;
	overview: (Overview & { suggestions: Suggestion[] }) | null;
	/** Letters in the mailbox that still need the citizen. */
	letters: Letter[];
	busy: boolean;
	reply: string;
	recorder: ReturnType<typeof useRecorder>;
	onSend: (text: string) => void;
	onStart: (serviceId: string) => void;
	onOpenLetter: (id: string) => void;
	onHuman: () => void;
	showSeal?: boolean;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

/** The three errands of the Gipfelstempel pass, one emblem each (motifs.ts). */
const PEAKS = ["change-of-residence", "passport-renewal", "childcare-subsidy"];

export function Desk({ t, lang, name, overview, letters, busy, reply, recorder, onSend, onStart, onOpenLetter, onHuman, showSeal = true }: Props) {
	const suggestions = overview?.suggestions ?? [];
	const [first, ...more] = suggestions;
	const stamps = overview?.stamps ?? [];
	const finished = stamps.filter((s) => s.source === "submitted");
	const records = stamps.filter((s) => s.source === "record");
	const firstName = name.split(" ")[0] ?? "";

	return (
		<section className="lz-desk">
			{first ? (
				<Notice s={first} t={t} lang={lang} name={name} showSeal={showSeal} onStart={onStart} onHuman={onHuman} />
			) : (
				<header className="lz-desk-hero">
					<p className="lz-kicker">
						<i aria-hidden="true" />
						{name} · {t.lzDeskKicker}
					</p>
					<h1 className="lz-title">{tpl(t.lzHello, { name: firstName })}</h1>
					<p className="lz-lede">{t.lzDeskNone}</p>
				</header>
			)}

			{more.length > 0 && (
				<ul className="lz-more">
					{more.map((s) => (
						<li key={s.serviceId}>
							<button type="button" className="lz-more-item" onClick={() => onStart(s.serviceId)}>
								{showSeal && <Emblem motif={motifFor(s.serviceId)} done={0} total={s.preview?.rows ?? 6} size="xs" label="" />}
								<span className="lz-more-text">
									<strong>{s.title}</strong>
									<span>{s.reason}</span>
								</span>
								<Icon name="arrowRight" size={20} />
							</button>
						</li>
					))}
				</ul>
			)}

			{letters.length > 0 && (
				<section className="lz-desk-mail" aria-labelledby="lz-desk-mail-title">
					<h2 className="lz-section" id="lz-desk-mail-title">
						<Icon name="mail" size={22} /> {t.lzMailbox}
					</h2>
					<ul>
						{letters.map((l) => (
							<li key={l.id}>
								<button type="button" className="lz-mail-item" onClick={() => onOpenLetter(l.id)}>
									<span className="lz-mail-tag">{t.lzLetterNeedsYou}</span>
									<span className="lz-mail-text">
										<strong>{l.title}</strong>
										<span>
											{l.from} · {tpl(t.lzLetterDue, { date: longDate(l.due, lang) })}
										</span>
									</span>
									<Icon name="arrowRight" size={20} />
								</button>
							</li>
						))}
					</ul>
				</section>
			)}

			{overview && showSeal && (
				<section className="lz-peaks" aria-labelledby="lz-peaks-title">
					<div className="lz-peaks-head">
						<div>
							<h2 className="lz-section" id="lz-peaks-title">
								{t.lzPeakTitle}
							</h2>
							<p className="lz-peaks-line">{t.lzPeakLine}</p>
						</div>
						{overview.timeSavedMin > 0 && (
							<p className="lz-kept-line">
								<span>{t.lzKeptTotal}</span>
								<b>{formatMinutes(overview.timeSavedMin, lang)}</b>
							</p>
						)}
					</div>
					<ul className="lz-peak-slots">
						{PEAKS.map((serviceId) => {
							const won = finished.find((f) => f.serviceId === serviceId);
							const area = t.lzPeakAreas[serviceId] ?? serviceId;
							return (
								<li key={serviceId} className={`lz-peak ${won ? "is-earned" : "is-open"}`}>
									<Emblem motif={motifFor(serviceId)} done={won ? 1 : 0} total={1} size="sm" serial={won?.date} label={won ? `${t.lzPeakEarned}: ${area}, ${won.date}` : `${area}: ${t.lzPeakOpen}`} />
									<span className="lz-peak-name">{area}</span>
									<small>{won ? won.date : t.lzPeakOpen}</small>
								</li>
							);
						})}
					</ul>
				</section>
			)}

			<div className="lz-ask-desk">
				<SayIt t={t} busy={busy} recorder={recorder} onSend={onSend} />
				{reply && (
					<p className="lz-reply" aria-live="polite">
						<span className="lz-talk is-on" aria-hidden="true">
							<i />
							<i />
							<i />
						</span>
						{reply}
					</p>
				)}
			</div>

			{overview && records.length > 0 && (
				<section className="lz-collection" aria-labelledby="lz-collection-title">
					<div className="lz-collection-text">
						<h2 className="lz-section" id="lz-collection-title">
							{t.lzOnFile}
						</h2>
					</div>
					<div className="lz-collection-items">
						<div className="lz-records">
							<div className="lz-sheet-row">
								{records.map((s, i) => (
									<Stamp key={s.id} spec={toSpec(s, t, i)} delay={0.1 * i} />
								))}
							</div>
						</div>
					</div>
				</section>
			)}

			<p className="lz-legal">{t.footer}</p>
		</section>
	);
}

/** The open routing slip as an official notice. */
function Notice({ s, t, lang, name, showSeal, onStart, onHuman }: { s: Suggestion; t: UIText; lang: Language; name: string; showSeal: boolean; onStart: (id: string) => void; onHuman: () => void }) {
	const p = s.preview;
	const minutes = TIME_SAVED_MINUTES[s.serviceId];
	const today = todayIso();
	const daysLeft = s.due ? Math.round((Date.parse(`${s.due}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000) : null;
	const left = daysLeft === null ? null : daysLeft <= 0 ? t.lzDueToday : daysLeft === 1 ? t.lzDayLeft : tpl(t.lzDaysLeft, { n: daysLeft });

	return (
		<article className={`lz-notice ${s.urgency === "high" ? "is-urgent" : ""}`} aria-labelledby="lz-notice-title">
			<Band className="lz-notice-band" />
			<header className="lz-notice-head">
				<span className="lz-notice-flag" aria-hidden="true">
					<i />
					<i />
					<i />
				</span>
				<span className="lz-notice-from">{t.lzNoticeHead}</span>
				<span className="lz-notice-date">{tpl(t.lzNoticeDate, { date: longDate(today, lang) })}</span>
			</header>

			<div className="lz-notice-body">
				<div className="lz-notice-text">
					<p className="lz-kicker">
						<i aria-hidden="true" />
						{name} · {t.lzDeskKicker}
					</p>
					<h1 className="lz-notice-title" id="lz-notice-title">
						{s.title}
					</h1>
					<p className="lz-notice-reason">{s.reason}</p>

					{s.due && (
						<p className="lz-notice-due">
							<span>{tpl(t.lzDueBy, { date: longDate(s.due, lang) })}</span>
							{left && <b>{left}</b>}
						</p>
					)}

					{p && <Route p={p} t={t} />}

					<div className="lz-notice-actions">
						<button type="button" className="lz-btn is-primary lz-open-go" onClick={() => onStart(s.serviceId)}>
							{t.lzStartSlip} <Icon name="arrowRight" size={20} />
						</button>
						<button type="button" className="lz-btn is-ghost" onClick={onHuman}>
							<Icon name="headset" size={20} /> {t.human}
						</button>
					</div>
					{showSeal && minutes ? <p className="lz-notice-keep">{tpl(t.lzCardKeep, { time: formatMinutes(minutes, lang) })}</p> : null}
				</div>
				{showSeal && (
					<figure className="lz-notice-emblem">
						<Emblem motif={motifFor(s.serviceId)} done={0} total={p?.rows ?? 6} size="md" label="" />
						<figcaption>{t.lzPeakNext}</figcaption>
					</figure>
				)}
			</div>
		</article>
	);
}

/** The slip ahead, as a route: blue = the offices fill it in, yellow = a question for you, red = your seal. */
function Route({ p, t }: { p: NonNullable<Suggestion["preview"]>; t: UIText }) {
	const stops: ("office" | "you" | "seal")[] = [...Array<"office">(p.byOffices).fill("office"), ...Array<"you">(p.questions).fill("you"), "seal"];
	return (
		<div className="lz-route-preview">
			<ol className="lz-route-line" aria-hidden="true">
				{stops.map((kind, i) => (
					<li key={i} className={`is-${kind}`} />
				))}
			</ol>
			<p className="lz-route-legend">
				<span className="is-office">{tpl(t.lzRouteOffices, { n: p.byOffices })}</span>
				{p.questions > 0 && <span className="is-you">{p.questions === 1 ? t.lzRouteQuestionsOne : tpl(t.lzRouteQuestionsMany, { n: p.questions })}</span>}
				<span className="is-seal">{t.lzRouteSeal}</span>
			</p>
		</div>
	);
}

/** Overview stamps (src/shared/stamps.ts) drawn in the Laufzettel style: records as tickets. */
function toSpec(s: RecordStamp, t: UIText, i: number) {
	return {
		shape: s.source === "submitted" ? ("rect" as const) : ("ticket" as const),
		top: s.lines[1],
		main: s.lines[0],
		date: s.date || t.lzOnFileShort,
		rotate: ((i * 41) % 11) - 5,
		sprig: s.serviceId ? motifFor(s.serviceId) : undefined,
	};
}

function SayIt({ t, busy, recorder, onSend }: { t: UIText; busy: boolean; recorder: ReturnType<typeof useRecorder>; onSend: (text: string) => void }) {
	const [text, setText] = useState("");
	const listening = recorder.state === "listening";
	return (
		<form
			className={`lz-say ${listening ? "is-listening" : ""}`}
			onSubmit={(e) => {
				e.preventDefault();
				if (!text.trim() || busy) return;
				onSend(text.trim());
				setText("");
			}}
		>
			<MicButton recorder={recorder} t={t} big />
			<label htmlFor="lz-say-input" className="lz-say-label">
				{t.lzSayLabel}
			</label>
			<input
				id="lz-say-input"
				value={text}
				placeholder={listening ? t.listening : recorder.state === "transcribing" ? t.transcribing : t.lzSayPlaceholder}
				autoComplete="off"
				onChange={(e) => setText(e.target.value)}
			/>
			<button type="submit" className="lz-say-send" disabled={!text.trim() || busy} aria-label={t.send}>
				<Icon name="arrowRight" size={20} />
			</button>
		</form>
	);
}

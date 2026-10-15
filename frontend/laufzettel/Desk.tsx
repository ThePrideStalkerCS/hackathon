/**
 * The start page: the citizen's desk ("Pult").
 *
 *   Hero        greeting and how many routing slips are waiting
 *   Open slip   the most important proactive suggestion as a slip on the desk, with its emblem and
 *               the promise: how many rows the offices fill, how many questions are left for you,
 *               the time you keep (estimated). Further suggestions follow as quiet lines.
 *   Say it      one line, microphone first: tell the state what happened, in your own words (dialect is fine)
 *   Collection  private: finished errands as emblems, records as stamps, plus the time kept
 *               (fair nudging: voluntary, private, positive, official errands only, explained openly)
 *
 * Not a chat: the assistant's reply to a free request appears as one caption line, nothing piles up.
 */
import { useState } from "react";
import type { Suggestion } from "../../src/shared/walkthrough";
import { TIME_SAVED_MINUTES, formatMinutes, type Overview, type Stamp as RecordStamp } from "../../src/shared/stamps";
import type { Language } from "../../src/shared/types";
import { Stamp } from "../brand/Brand";
import { Emblem, motifFor } from "../brand/Emblem";
import { MicButton } from "../components";
import { Icon } from "../icons";
import { tpl, type UIText } from "../i18n";
import type { useRecorder } from "../voice";

type Props = {
	t: UIText;
	lang: Language;
	firstName: string;
	overview: (Overview & { suggestions: Suggestion[] }) | null;
	busy: boolean;
	reply: string;
	recorder: ReturnType<typeof useRecorder>;
	onSend: (text: string) => void;
	onStart: (serviceId: string) => void;
	showSeal?: boolean;
};

export function Desk({ t, lang, firstName, overview, busy, reply, recorder, onSend, onStart, showSeal = true }: Props) {
	const suggestions = overview?.suggestions ?? [];
	const open = suggestions.length;
	const [first, ...more] = suggestions;
	const stamps = overview?.stamps ?? [];
	const finished = stamps.filter((s) => s.source === "submitted");
	const records = stamps.filter((s) => s.source === "record");

	return (
		<section className="lz-desk">
			<header className="lz-desk-hero">
				<p className="lz-kicker">
					<i aria-hidden="true" />
					{t.lzDeskKicker}
				</p>
				<h1 className="lz-title">{tpl(t.lzHello, { name: firstName })}</h1>
				<p className="lz-lede">{open === 0 ? t.lzDeskNone : open === 1 ? t.lzDeskOpenOne : tpl(t.lzDeskOpenMany, { n: open })}</p>
			</header>

			{first && (
				<section aria-labelledby="lz-open-title" className="lz-open">
					<h2 className="lz-section" id="lz-open-title">
						{t.lzOpenSlips}
					</h2>
					<OpenSlip s={first} t={t} lang={lang} showSeal={showSeal} onStart={onStart} />
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
				<p className="lz-examples">
					<span className="lz-label">{t.lzTry}</span>
					{t.examples.map((ex) => (
						<button key={ex} type="button" className="lz-example" onClick={() => onSend(ex)} disabled={busy}>
							{lang === "de" ? `„${ex}“` : `“${ex}”`}
						</button>
					))}
				</p>
			</div>

			{overview && (
				<section className="lz-collection" aria-labelledby="lz-collection-title">
					<div className="lz-collection-text">
						<h2 className="lz-section" id="lz-collection-title">
							{t.lzFinished}
						</h2>
						{showSeal &&
							(overview.timeSavedMin > 0 ? (
								<p className="lz-kept-line">
									<span>{t.lzKeptTotal}</span>
									<b>{formatMinutes(overview.timeSavedMin, lang)}</b>
									<small>{t.lzKeptHow}</small>
								</p>
							) : (
								<p className="lz-kept-line">{t.lzKeptNone}</p>
							))}
						{showSeal && (
							<p className="lz-why">
								{t.lzSealWhy} {t.lzSealHide}
							</p>
						)}
					</div>
					<div className="lz-collection-items">
						{showSeal &&
							finished.map((s) => (
								<figure key={s.id} className="lz-collected">
									<Emblem motif={motifFor(s.serviceId ?? "")} done={1} total={1} size="sm" serial={s.date} label={`${s.lines.join(" ")}, ${s.date}`} />
									<figcaption>
										{s.lines.join(" ")}
										<small>{s.date}</small>
									</figcaption>
								</figure>
							))}
						{records.length > 0 && (
							<div className="lz-records">
								<span className="lz-label">{t.lzOnFile}</span>
								<div className="lz-sheet-row">
									{records.map((s, i) => (
										<Stamp key={s.id} spec={toSpec(s, t, i)} delay={0.1 * i} />
									))}
								</div>
							</div>
						)}
						{finished.length === 0 && records.length === 0 && <p>{t.lzNoStamps}</p>}
					</div>
				</section>
			)}

			<p className="lz-legal">{t.footer}</p>
		</section>
	);
}

function OpenSlip({ s, t, lang, showSeal, onStart }: { s: Suggestion; t: UIText; lang: Language; showSeal: boolean; onStart: (serviceId: string) => void }) {
	const p = s.preview;
	const minutes = TIME_SAVED_MINUTES[s.serviceId];
	const you = !p ? null : p.questions === 0 ? t.lzCardYouNone : p.questions === 1 ? t.lzCardYouOne : tpl(t.lzCardYouMany, { n: p.questions });
	return (
		<article className={`lz-open-slip ${s.urgency === "high" ? "is-urgent" : ""}`}>
			{showSeal && (
				<div className="lz-open-emblem">
					<Emblem motif={motifFor(s.serviceId)} done={0} total={p?.rows ?? 6} size="md" label="" />
				</div>
			)}
			<div className="lz-open-text">
				<p className="lz-open-kicker">{s.urgency === "high" ? t.urgent : t.newDetected}</p>
				<h3 className="lz-open-title">{s.title}</h3>
				<p className="lz-open-reason">{s.reason}</p>
				{p && (
					<p className="lz-promise">
						{tpl(t.lzCardOffices, { done: p.byOffices, total: p.rows })} {you}
						{showSeal && minutes ? <span className="lz-promise-time"> {tpl(t.lzCardKeep, { time: formatMinutes(minutes, lang) })}</span> : null}
					</p>
				)}
				<button type="button" className="lz-btn is-primary lz-open-go" onClick={() => onStart(s.serviceId)}>
					{t.lzStartSlip} <Icon name="arrowRight" size={20} />
				</button>
			</div>
		</article>
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

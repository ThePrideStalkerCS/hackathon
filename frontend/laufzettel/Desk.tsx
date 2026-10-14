/**
 * The start page: the citizen's desk ("Pult").
 *
 *   Hero        greeting and how many routing slips are waiting
 *   Open slips  one card per proactive suggestion ("Your passport expired"), start with one tap
 *   Say it      one line, microphone first: tell the state what happened, in your own words (dialect is fine)
 *   Stamps      what is finished or on file, as stamps, plus the time kept (fair nudging: private, positive)
 *
 * Not a chat: the assistant's reply to a free request appears as one caption line, nothing piles up.
 */
import { useState } from "react";
import type { Suggestion } from "../../src/shared/walkthrough";
import { formatMinutes, type Overview, type Stamp as RecordStamp } from "../../src/shared/stamps";
import type { Language } from "../../src/shared/types";
import { Band, Stamp } from "../brand/Brand";
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
};

export function Desk({ t, lang, firstName, overview, busy, reply, recorder, onSend, onStart }: Props) {
	const suggestions = overview?.suggestions ?? [];
	const open = suggestions.length;
	const stamps = overview?.stamps ?? [];

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

			{open > 0 && (
				<section aria-labelledby="lz-open-title">
					<h2 className="lz-section" id="lz-open-title">
						{t.lzOpenSlips}
					</h2>
					<div className="lz-cards">
						{suggestions.map((s) => (
							<button key={s.serviceId} type="button" className={`lz-card ${s.urgency === "high" ? "is-urgent" : ""}`} onClick={() => onStart(s.serviceId)}>
								<Band className="lz-card-band" />
								<span className="lz-card-in">
									<span className="lz-card-kicker">{s.urgency === "high" ? t.urgent : t.newDetected}</span>
									<strong className="lz-card-title">{s.title}</strong>
									<span className="lz-card-reason">{s.reason}</span>
									<span className="lz-card-foot">
										<span className="lz-mini-route" aria-hidden="true">
											<i />
											<i />
											<i />
											<i />
										</span>
										<span className="lz-card-go">
											{t.lzStartSlip} <Icon name="arrowRight" size={18} />
										</span>
									</span>
								</span>
							</button>
						))}
					</div>
				</section>
			)}

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
			<div className="lz-examples">
				<span className="lz-label">{t.lzTry}</span>
				{t.examples.map((ex) => (
					<button key={ex} type="button" className="lz-example" onClick={() => onSend(ex)} disabled={busy}>
						{lang === "de" ? `„${ex}“` : `“${ex}”`}
					</button>
				))}
			</div>

			{overview && (
				<div className="lz-desk-foot">
					<section className="lz-panel" aria-labelledby="lz-kept-title">
						<h2 className="lz-label" id="lz-kept-title">
							{t.lzKeptTotal}
						</h2>
						{overview.timeSavedMin > 0 ? (
							<>
								<span className="lz-big">{formatMinutes(overview.timeSavedMin, lang)}</span>
								<p>{t.lzKeptHow}</p>
							</>
						) : (
							<p>{t.lzKeptNone}</p>
						)}
					</section>
					<section className="lz-panel lz-sheet" aria-labelledby="lz-stamps-title">
						<h2 className="lz-label" id="lz-stamps-title">
							{t.lzFinished} · {t.lzOnFile}
						</h2>
						{stamps.length ? (
							<div className="lz-sheet-row">
								{stamps.map((s, i) => (
									<Stamp key={s.id} spec={toSpec(s, t, i)} delay={0.1 * i} />
								))}
							</div>
						) : (
							<p>{t.lzNoStamps}</p>
						)}
					</section>
				</div>
			)}

			<p className="lz-legal">{t.footer}</p>
		</section>
	);
}

/** Overview stamps (src/shared/stamps.ts) drawn in the Laufzettel style: finished errands as rectangles, records as tickets. */
function toSpec(s: RecordStamp, t: UIText, i: number) {
	return {
		shape: s.source === "submitted" ? ("rect" as const) : ("ticket" as const),
		top: s.lines[1],
		main: s.lines[0],
		date: s.date || t.lzOnFileShort,
		rotate: ((i * 41) % 11) - 5,
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

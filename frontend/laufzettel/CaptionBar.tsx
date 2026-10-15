/**
 * Narration as subtitles: a dark caption line at the bottom of the screen, like on TV.
 * Not a chat: no history, no bubbles. It shows what is being said right now, and lets the citizen
 * pause, replay, type or press the microphone to answer in their own words.
 *
 * The three red dots are the stations of the mark; they light up one after another while speaking.
 * A long caption rolls up one line at a time while it is spoken, like TV subtitles, so no sentence
 * stays cut off at the bottom.
 */
import { useEffect, useRef, useState } from "react";
import { MicButton } from "../components";
import { Icon } from "../icons";
import type { UIText } from "../i18n";
import type { useRecorder } from "../voice";

type Props = {
	t: UIText;
	caption: string;
	speaking: boolean;
	paused: boolean;
	busy: boolean;
	recorder: ReturnType<typeof useRecorder>;
	onTogglePause: () => void;
	onReplay: () => void;
	onSend: (text: string) => void;
};

/** About one caption line of speech (roughly ten words). */
const LINE_MS = 3400;

export function CaptionBar({ t, caption, speaking, paused, busy, recorder, onTogglePause, onReplay, onSend }: Props) {
	const [typing, setTyping] = useState(false);
	const [text, setText] = useState("");
	const textRef = useRef<HTMLParagraphElement>(null);

	useEffect(() => {
		textRef.current?.scrollTo({ top: 0 });
	}, [caption]);

	useEffect(() => {
		const el = textRef.current;
		if (!el || !speaking || paused) return;
		const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const timer = setInterval(() => {
			if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) return;
			el.scrollBy({ top: parseFloat(getComputedStyle(el).lineHeight) || 24, behavior: smooth ? "smooth" : "auto" });
		}, LINE_MS);
		return () => clearInterval(timer);
	}, [caption, speaking, paused]);
	const status =
		recorder.state === "listening"
			? t.listening
			: recorder.state === "transcribing"
				? t.transcribing
				: recorder.state === "unavailable"
					? t.micUnavailable
					: paused
						? t.paused
						: caption;

	return (
		<div className="lz-captions" role="region" aria-label={t.assistant}>
			<div className="lz-captions-in">
				<button type="button" className="lz-cap-btn" onClick={onTogglePause} aria-label={paused ? t.play : t.pause} title={paused ? t.play : t.pause}>
					{paused ? (
						<Icon name="play" size={18} />
					) : (
						<span className={`lz-talk ${speaking || busy ? "is-on" : ""}`} aria-hidden="true">
							<i />
							<i />
							<i />
						</span>
					)}
				</button>

				{typing ? (
					<form
						className="lz-cap-form"
						onSubmit={(e) => {
							e.preventDefault();
							if (!text.trim() || busy) return;
							onSend(text.trim());
							setText("");
							setTyping(false);
						}}
					>
						<label htmlFor="lz-cap-text" className="visually-hidden">
							{t.typeHere}
						</label>
						<input
							id="lz-cap-text"
							autoFocus
							value={text}
							placeholder={t.typeHere}
							autoComplete="off"
							onChange={(e) => setText(e.target.value)}
							onKeyDown={(e) => e.key === "Escape" && setTyping(false)}
						/>
						<button type="submit" className="lz-cap-btn" disabled={!text.trim() || busy} aria-label={t.send}>
							<Icon name="arrowUp" size={18} />
						</button>
					</form>
				) : (
					<p className="lz-cap-text" aria-live="polite" ref={textRef}>
						{status}
					</p>
				)}

				{!typing && (
					<button type="button" className="lz-cap-btn" onClick={onReplay} aria-label={t.replay} title={t.replay}>
						<Icon name="replay" size={18} />
					</button>
				)}
				<button
					type="button"
					className="lz-cap-btn"
					onClick={() => setTyping(!typing)}
					aria-label={typing ? t.close : t.keyboard}
					title={typing ? t.close : t.keyboard}
				>
					<Icon name={typing ? "close" : "keyboard"} size={18} />
				</button>
				<MicButton recorder={recorder} t={t} />
			</div>
		</div>
	);
}

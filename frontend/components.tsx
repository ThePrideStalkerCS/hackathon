/**
 * Building blocks of the assistant layer:
 *   VoiceMark    the assistant's sign: the red-white-red stripes, moving like a sound level when it speaks
 *   Dock         voice bar at the bottom: voice mark (pause), captions, keyboard, microphone
 *   CommandBar   the big "what do you need?" field on the start page
 *   ProfileMenu  everything secondary (test person, language, text size, voice) behind one button
 *   HandoffSheet confirmation when a person takes over
 */
import type { UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import type { Language } from "../src/shared/types";
import type { HandoffResult, Persona } from "./api";
import { Icon } from "./icons";
import { TEXT, TOOL_LABELS, type UIText } from "./i18n";
import type { useRecorder } from "./voice";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPart = any;
type Recorder = ReturnType<typeof useRecorder>;

function toolNameOf(part: AnyPart): string | null {
	if (part.type === "dynamic-tool") return part.toolName;
	if (typeof part.type === "string" && part.type.startsWith("tool-")) return part.type.slice(5);
	return null;
}

/** Text of a message (reasoning and tool parts left out). */
export function messageText(message: UIMessage | undefined): string {
	if (!message) return "";
	return message.parts
		.filter((p: AnyPart) => p.type === "text")
		.map((p: AnyPart) => p.text)
		.join("")
		.trim();
}

/** Label of the tool the assistant is running right now, if any. */
export function runningToolLabel(message: UIMessage | undefined, language: Language): string | null {
	if (!message || message.role !== "assistant") return null;
	const running = [...message.parts].reverse().find((p: AnyPart) => toolNameOf(p) && p.state !== "output-available" && p.state !== "output-error");
	if (!running) return null;
	return TOOL_LABELS[toolNameOf(running)!]?.[language] ?? TEXT[language].toolWorking;
}

export type VoiceState = "idle" | "speaking" | "listening" | "thinking" | "paused";

/**
 * The assistant's sign. Deliberately not a glowing "AI orb": three stripes in the national colours
 * that move like a level meter while the assistant speaks. Official, calm, recognisable.
 */
export function VoiceMark({ state, size = "md" }: { state: VoiceState; size?: "sm" | "md" }) {
	return (
		<span className={`voicemark vm-${size} is-${state}`} aria-hidden="true">
			<i />
			<i />
			<i />
		</span>
	);
}

/** Microphone button with its own listening state. */
export function MicButton({ recorder, t, big }: { recorder: Recorder; t: UIText; big?: boolean }) {
	const listening = recorder.state === "listening";
	return (
		<button
			type="button"
			className={`mic-button ${big ? "big" : ""} ${listening ? "is-listening" : ""}`}
			onClick={listening ? recorder.stop : recorder.start}
			disabled={recorder.state === "transcribing" || recorder.state === "unavailable"}
			aria-pressed={listening}
			aria-label={listening ? t.micStop : t.mic}
			title={listening ? t.micStop : t.mic}
		>
			{listening ? <span className="stop-square" aria-hidden="true" /> : <Icon name="mic" size={big ? 26 : 22} />}
		</button>
	);
}

export function Dock(props: {
	t: UIText;
	caption: string;
	voice: VoiceState;
	paused: boolean;
	busy: boolean;
	recorder: Recorder;
	onTogglePause: () => void;
	onReplay: () => void;
	onSend: (text: string) => void;
}) {
	const { t, recorder } = props;
	const [typing, setTyping] = useState(false);
	const [text, setText] = useState("");

	const status =
		recorder.state === "listening"
			? t.listening
			: recorder.state === "transcribing"
				? t.transcribing
				: recorder.state === "unavailable"
					? t.micUnavailable
					: props.paused
						? t.paused
						: props.caption;

	return (
		<div className="dock" role="region" aria-label={t.assistant}>
			<button type="button" className="voice-button" onClick={props.onTogglePause} aria-label={props.paused ? t.play : t.pause} title={props.paused ? t.play : t.pause}>
				<VoiceMark state={props.voice} />
				<span className="voice-badge" aria-hidden="true">
					<Icon name={props.paused ? "play" : "pause"} size={12} strokeWidth={3} />
				</span>
			</button>

			{typing ? (
				<form
					className="dock-input"
					onSubmit={(e) => {
						e.preventDefault();
						if (!text.trim() || props.busy) return;
						props.onSend(text.trim());
						setText("");
						setTyping(false);
					}}
				>
					<label htmlFor="dock-text" className="visually-hidden">
						{t.typeHere}
					</label>
					<input
						id="dock-text"
						autoFocus
						value={text}
						placeholder={t.typeHere}
						autoComplete="off"
						onChange={(e) => setText(e.target.value)}
						onKeyDown={(e) => e.key === "Escape" && setTyping(false)}
					/>
					<button type="submit" className="round-button" disabled={!text.trim() || props.busy} aria-label={t.send}>
						<Icon name="arrowUp" />
					</button>
				</form>
			) : (
				<div className="captions">
					<p aria-live="polite">{status}</p>
					<button type="button" className="icon-button" onClick={props.onReplay} aria-label={t.replay} title={t.replay}>
						<Icon name="replay" size={18} />
					</button>
				</div>
			)}

			{typing ? (
				<button type="button" className="icon-button" onClick={() => setTyping(false)} aria-label={t.close} title={t.close}>
					<Icon name="close" />
				</button>
			) : (
				<button type="button" className="icon-button" onClick={() => setTyping(true)} aria-label={t.keyboard} title={t.keyboard}>
					<Icon name="keyboard" />
				</button>
			)}
			<MicButton recorder={recorder} t={t} />
		</div>
	);
}

export function CommandBar({ t, recorder, busy, onSend }: { t: UIText; recorder: Recorder; busy: boolean; onSend: (text: string) => void }) {
	const [text, setText] = useState("");
	const listening = recorder.state === "listening";
	return (
		<form
			className={`command ${listening ? "is-listening" : ""}`}
			onSubmit={(e) => {
				e.preventDefault();
				if (!text.trim() || busy) return;
				onSend(text.trim());
				setText("");
			}}
		>
			<label htmlFor="command-input" className="visually-hidden">
				{t.homeQuestion}
			</label>
			<input
				id="command-input"
				value={text}
				placeholder={listening ? t.listening : recorder.state === "transcribing" ? t.transcribing : t.placeholder}
				autoComplete="off"
				onChange={(e) => setText(e.target.value)}
			/>
			{text.trim() ? (
				<button type="submit" className="round-button big" disabled={busy} aria-label={t.send}>
					<Icon name="arrowUp" size={24} />
				</button>
			) : (
				<MicButton recorder={recorder} t={t} big />
			)}
		</form>
	);
}

export function ProfileMenu(props: {
	t: UIText;
	persona?: Persona;
	personas: Persona[];
	language: Language;
	fontScale: number;
	voiceOn: boolean;
	rate: number;
	onPersona: (id: string) => void;
	onLanguage: (lang: Language) => void;
	onFontScale: (scale: number) => void;
	onVoice: (on: boolean) => void;
	onRate: (rate: number) => void;
	onRestart: () => void;
	/** Optional: the Laufzettel identity has one light look, so the app no longer passes these. */
	theme?: "dark" | "light";
	onTheme?: (theme: "dark" | "light") => void;
}) {
	const { t } = props;
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const initials = (props.persona?.name ?? "?")
		.split(" ")
		.map((p) => p[0])
		.join("")
		.slice(0, 2);

	// Close on outside click and Escape.
	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	return (
		<div className="profile" ref={ref}>
			<button type="button" className="profile-chip" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)} aria-label={t.menu}>
				<span className="avatar">{initials}</span>
				<span className="profile-name">{props.persona?.name.split(" ")[0]}</span>
				<Icon name="chevronDown" size={18} />
			</button>

			{open && (
				<div className="menu" role="dialog" aria-label={t.menu}>
					<div className="menu-head">
						<span className="avatar big">{initials}</span>
						<div>
							<strong>{props.persona?.name}</strong>
							<small>{t.loggedIn}</small>
						</div>
					</div>

					<label className="menu-row">
						<span>{t.switchPerson}</span>
						<select value={props.persona?.id} onChange={(e) => props.onPersona(e.target.value)}>
							{props.personas.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name}
								</option>
							))}
						</select>
					</label>

					<div className="menu-row">
						<span>{t.textSize}</span>
						<div className="segmented" role="group" aria-label={t.textSize}>
							{[1, 1.2, 1.4].map((s) => (
								<button key={s} type="button" aria-pressed={props.fontScale === s} onClick={() => props.onFontScale(s)} aria-label={`${Math.round(s * 100)} %`}>
									<span style={{ fontSize: `${0.8 + (s - 1) * 1.2}em` }}>A</span>
								</button>
							))}
						</div>
					</div>

					{props.theme && props.onTheme && (
						<div className="menu-row">
							<span>{t.theme}</span>
							<div className="segmented" role="group" aria-label={t.theme}>
								{(["dark", "light"] as const).map((th) => (
									<button key={th} type="button" aria-pressed={props.theme === th} onClick={() => props.onTheme?.(th)}>
										{th === "dark" ? t.themeDark : t.themeLight}
									</button>
								))}
							</div>
						</div>
					)}

					<div className="menu-row">
						<span>{t.voice}</span>
						<button type="button" role="switch" aria-checked={props.voiceOn} aria-label={t.voice} className="switch" onClick={() => props.onVoice(!props.voiceOn)}>
							<span />
						</button>
					</div>

					<div className="menu-row">
						<span>{t.speed}</span>
						<div className="segmented" role="group" aria-label={t.speed}>
							{[0.8, 1, 1.2].map((r) => (
								<button key={r} type="button" aria-pressed={props.rate === r} onClick={() => props.onRate(r)}>
									{r}×
								</button>
							))}
						</div>
					</div>

					<button
						type="button"
						className="link menu-restart"
						onClick={() => {
							setOpen(false);
							props.onRestart();
						}}
					>
						{t.restart}
					</button>
				</div>
			)}
		</div>
	);
}

export function HandoffSheet({ result, t, onClose }: { result: HandoffResult; t: UIText; onClose: () => void }) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => ref.current?.focus(), []);
	return (
		<div className="sheet-backdrop" onClick={onClose}>
			<div className="sheet" role="dialog" aria-modal="true" aria-labelledby="handoff-title" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
				<span className="sheet-icon">
					<Icon name="headset" size={30} />
				</span>
				<h2 id="handoff-title">{t.handoffTitle}</h2>
				<p>{result.message}</p>
				<p className="sheet-phone">
					<strong>{result.phone}</strong>
					<span>{result.hours}</span>
				</p>
				<p className="sheet-ticket">
					{t.ticket}: <strong>{result.ticketId}</strong>
				</p>
				<p className="sheet-note">{t.handoffNote}</p>
				<button type="button" className="btn primary" onClick={onClose}>
					{t.close}
				</button>
			</div>
		</div>
	);
}

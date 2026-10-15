/**
 * Building blocks of the assistant layer:
 *   VoiceMark    the assistant's sign: the red-white-red stripes, moving like a sound level when it speaks
 *   MicButton    push to talk (used by the caption bar and the desk's say-it line)
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
	/** Fair nudging switch: show the seal and the time kept (stored on this device only). */
	sealOn?: boolean;
	onSeal?: (on: boolean) => void;
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

					{props.onSeal && (
						<div className="menu-row menu-row-note">
							<span>
								{t.lzSealSetting}
								<small>{t.lzSealSettingHint}</small>
							</span>
							<button type="button" role="switch" aria-checked={props.sealOn} aria-label={t.lzSealSetting} className="switch" onClick={() => props.onSeal?.(!props.sealOn)}>
								<span />
							</button>
						</div>
					)}

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

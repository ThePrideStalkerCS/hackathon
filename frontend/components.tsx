/**
 * UI building blocks: chat messages (conversation history), assistant reply bubble, handoff card,
 * ask box (text + microphone).
 */
import type { UIMessage } from "ai";
import { useState } from "react";
import type { Language } from "../src/shared/types";
import type { HandoffResult } from "./api";
import { TEXT, TOOL_LABELS, type UIText } from "./i18n";
import { useRecorder } from "./voice";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPart = any;

function toolNameOf(part: AnyPart): string | null {
	if (part.type === "dynamic-tool") return part.toolName;
	if (typeof part.type === "string" && part.type.startsWith("tool-")) return part.type.slice(5);
	return null;
}

/** Text of a message (reasoning and tool parts left out). */
export function messageText(message: UIMessage): string {
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
	const name = toolNameOf(running)!;
	return TOOL_LABELS[name]?.[language] ?? TEXT[language].toolWorking;
}

export function MessageView({ message, language }: { message: UIMessage; language: Language }) {
	const t = TEXT[language];
	const isUser = message.role === "user";
	const text = messageText(message);
	const tools = message.parts.map(toolNameOf).filter(Boolean) as string[];
	if (!text && !tools.length) return null;
	return (
		<article className={`message ${isUser ? "user" : "assistant"}`}>
			<h3 className="visually-hidden">{isUser ? t.you : t.assistant}</h3>
			{text && <p className="text">{text}</p>}
			{tools.length > 0 && (
				<p className="tool-trace">
					{tools.map((name) => TOOL_LABELS[name]?.[language] ?? name).join(" · ")}
				</p>
			)}
		</article>
	);
}

export function HandoffCard({ result, t, onClose }: { result: HandoffResult; t: UIText; onClose: () => void }) {
	return (
		<div className="card handoff" role="status">
			<h3>☎ {t.handoffTitle}</h3>
			<p>{result.message}</p>
			<p>
				<strong>{result.phone}</strong> · {result.hours}
				<br />
				{result.office}
			</p>
			<p>
				{t.ticket}: <strong>{result.ticketId}</strong>
			</p>
			<p className="fine-print">{t.handoffNote}</p>
			<button type="button" onClick={onClose}>
				{t.close}
			</button>
		</div>
	);
}

/** Text field + microphone. Used on the start screen and as "Something unclear?" in the walkthrough. */
export function AskBox(props: { t: UIText; language: Language; placeholder: string; disabled: boolean; big?: boolean; onSend: (text: string) => void }) {
	const { t, language, onSend } = props;
	const [text, setText] = useState("");
	const recorder = useRecorder(language, onSend);

	function submit() {
		const value = text.trim();
		if (!value || props.disabled) return;
		onSend(value);
		setText("");
	}

	return (
		<div className={`ask-box ${props.big ? "big" : ""}`}>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
				<button
					type="button"
					className={`mic ${recorder.state === "listening" ? "is-listening" : ""}`}
					onClick={recorder.state === "listening" ? recorder.stop : recorder.start}
					disabled={recorder.state === "transcribing" || recorder.state === "unavailable"}
					aria-pressed={recorder.state === "listening"}
				>
					<span aria-hidden="true">🎤</span> {recorder.state === "listening" ? t.micStop : t.micStart}
				</button>
				<label htmlFor={props.big ? "ask-main" : "ask-side"} className="visually-hidden">
					{props.placeholder}
				</label>
				<input
					id={props.big ? "ask-main" : "ask-side"}
					value={text}
					placeholder={props.placeholder}
					onChange={(e) => setText(e.target.value)}
					autoComplete="off"
				/>
				<button type="submit" className="primary" disabled={props.disabled || !text.trim()}>
					{t.send}
				</button>
			</form>
			{recorder.state === "listening" && <p className="mic-status" role="status">{t.micListening}</p>}
			{recorder.state === "transcribing" && <p className="mic-status" role="status">{t.micTranscribing}</p>}
			{recorder.state === "unavailable" && <p className="mic-status">{t.micUnavailable}</p>}
		</div>
	);
}

/**
 * The citizen-facing app in the Laufzettel identity (docs/DESIGN.md):
 *
 *   Start page     the desk (Desk.tsx): open routing slips from proactive suggestions, one "say it" line
 *                  (voice first), finished stamps and the time kept
 *   Walkthrough    the routing slip (Slip.tsx): one row per station, offices stamp in blue while the
 *                  narration plays as subtitles (CaptionBar.tsx), the citizen answers in the row and
 *                  signs with a red seal (hold to sign)
 *
 * State lives in the agent (Durable Object) and is synced here via useAgent. This component never
 * changes the walkthrough itself: it calls the agent's @callable methods (agent.call("answer", …)).
 *
 * Playback loop: when the current step changes, its narration is spoken (and shown as captions);
 * when it's finished and the step doesn't need the citizen, we call `advance`. Paused = nothing advances.
 */
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_STATE, type AssistantSettings, type AssistantState } from "../src/shared/types";
import type { Suggestion } from "../src/shared/walkthrough";
import type { Overview } from "../src/shared/stamps";
import { api, type HandoffResult, type Persona } from "./api";
import { HandoffSheet, messageText, ProfileMenu, runningToolLabel } from "./components";
import { InkFilter, Lockup } from "./brand/Brand";
import { CaptionBar } from "./laufzettel/CaptionBar";
import { Desk } from "./laufzettel/Desk";
import { Slip } from "./laufzettel/Slip";
import { LetterSheet, LetterToast, MailboxButton } from "./laufzettel/Postfach";
import type { Letter } from "../src/shared/mail";
import { Icon } from "./icons";
import { TEXT } from "./i18n";
import { useNarrator, useRecorder } from "./voice";
import type { WalkthroughActions } from "./walkthrough/Answers";

function getSessionId(reset = false): string {
	let id = localStorage.getItem("sessionId");
	if (!id || reset) {
		id = crypto.randomUUID();
		localStorage.setItem("sessionId", id);
	}
	return id;
}

export function App() {
	const [sessionId, setSessionId] = useState(() => getSessionId());
	const [state, setState] = useState<AssistantState>(DEFAULT_STATE);
	const [personas, setPersonas] = useState<Persona[]>([]);
	const [overview, setOverview] = useState<(Overview & { suggestions: Suggestion[] }) | null>(null);
	// The Laufzettel identity is paper and ink: one light look (index.html sets data-theme="paper").
	const [handoff, setHandoff] = useState<HandoffResult | null>(null);
	const [fontScale, setFontScale] = useState(1);
	const [playing, setPlaying] = useState(true);
	const [voiceOn, setVoiceOn] = useState(true);
	const [rate, setRate] = useState(1);
	// Fair nudging is voluntary: the seal and the time kept can be switched off. Stored only on this device.
	const [showSeal, setShowSeal] = useState(() => localStorage.getItem("lz-seal") !== "off");
	const [replayCount, setReplayCount] = useState(0);
	const [caption, setCaption] = useState("");
	// The digital Postfach: letters arrive during the errand they belong to (src/gov/data/mail.ts).
	const [letters, setLetters] = useState<Letter[]>([]);
	const [arrived, setArrived] = useState<string[]>([]);
	const [paid, setPaid] = useState<string[]>([]);
	const [openLetterId, setOpenLetterId] = useState<string | null>(null);
	const [toastId, setToastId] = useState<string | null>(null);
	const resumeAfterLetter = useRef(false);
	const t = TEXT[state.language];
	const narrator = useNarrator();

	// One agent instance per session. The server owns the state; we only receive it.
	const agent = useAgent<AssistantState>({
		agent: "CitizenAssistant",
		name: sessionId,
		onStateUpdate: (s) => setState({ ...DEFAULT_STATE, ...s }),
	});
	const { messages, sendMessage, clearHistory, status } = useAgentChat({ agent });
	const busy = status === "submitted" || status === "streaming";
	const call = useCallback(<T,>(method: string, args: unknown[] = []) => agent.call<T>(method, args), [agent]);

	const send = useCallback(
		(text: string) => {
			narrator.stop();
			setCaption(text);
			sendMessage({ text });
		},
		[narrator, sendMessage],
	);
	const recorder = useRecorder(state.language, send);

	const w = state.walkthrough;
	const step = w?.steps[w.current];
	const stepKey = w && step ? `${w.id}:${w.current}:${step.id}:${step.kind}:${step.done}` : null;
	// While the citizen has to answer or sign, the captions shrink so the question keeps the screen.
	const citizenTurn = Boolean(w && step && !w.result && w.status !== "blocked" && (step.kind === "ask" || step.kind === "review" || (step.kind === "appointment" && !step.done)));
	const persona = personas.find((p) => p.id === state.personaId);
	const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
	const toolLabel = busy ? runningToolLabel(messages.at(-1), state.language) : null;

	useEffect(() => {
		api.personas().then(setPersonas).catch(console.error);
	}, []);

	// Proactive suggestions whenever the logged-in citizen changes or a walkthrough ends.
	const walkthroughOpen = Boolean(state.walkthrough);
	useEffect(() => {
		if (walkthroughOpen) return;
		call<Overview & { suggestions: Suggestion[] }>("getOverview").then(setOverview).catch(() => setOverview(null));
	}, [call, state.personaId, state.language, sessionId, walkthroughOpen]);

	// Postfach: load the letters, and let a letter arrive while its errand runs (after the first answer).
	useEffect(() => {
		setArrived([]);
		setPaid([]);
		setOpenLetterId(null);
		setToastId(null);
	}, [state.personaId]);
	useEffect(() => {
		api.mail(state.personaId, state.language).then(setLetters).catch(() => setLetters([]));
	}, [state.personaId, state.language]);
	useEffect(() => {
		for (const l of letters) {
			if (arrived.includes(l.id)) continue;
			const due = !l.arrivesDuring || (w?.serviceId === l.arrivesDuring && (Boolean(w.result) || w.steps.some((s) => s.kind === "ask" && s.done)));
			if (!due) continue;
			setArrived((a) => [...a, l.id]);
			if (l.arrivesDuring) setToastId(l.id);
		}
	}, [letters, arrived, w]);
	const openLetter = letters.find((l) => l.id === openLetterId);
	const needsYou = letters.filter((l) => arrived.includes(l.id) && !paid.includes(l.id));

	function showLetter(id: string) {
		const letter = letters.find((l) => l.id === id);
		if (!letter) return;
		setToastId(null);
		setOpenLetterId(id);
		resumeAfterLetter.current = Boolean(w) && playing;
		if (w) setPlaying(false);
		setCaption(letter.spoken);
		void narrator.speak(letter.spoken, { lang: state.language, rate, muted: !voiceOn });
	}
	function closeLetter() {
		setOpenLetterId(null);
		narrator.stop();
		if (resumeAfterLetter.current) {
			setPlaying(true);
			setReplayCount((c) => c + 1);
		}
		resumeAfterLetter.current = false;
	}

	// The slip head sticks right under the top bar, whose height changes with wrapping and text size.
	const topRef = useRef<HTMLElement>(null);
	useEffect(() => {
		const el = topRef.current;
		if (!el) return;
		const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--lz-top-h", `${el.offsetHeight}px`));
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// Accessibility: keep <html lang> and font size in sync with the settings.
	useEffect(() => {
		document.documentElement.lang = state.language;
		document.documentElement.style.fontSize = `${fontScale * 100}%`;
		document.title = t.title;
	}, [state.language, fontScale, t.title]);

	// --- Playback loop ---------------------------------------------------------------------------
	const [spokenKey, setSpokenKey] = useState<string | null>(null);
	const stepKeyRef = useRef(stepKey);
	stepKeyRef.current = stepKey;
	const spokenKeyRef = useRef(spokenKey);
	spokenKeyRef.current = spokenKey;

	// 1. Speak (and caption) the narration of each new step.
	useEffect(() => {
		if (!stepKey || !step) return;
		let cancelled = false;
		setSpokenKey(null);
		setCaption(step.narration);
		narrator.speak(step.narration, { lang: state.language, rate, muted: !voiceOn }).then((finished) => {
			if (finished && !cancelled) setSpokenKey(stepKey);
		});
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [stepKey, replayCount]);

	// 2. When it's spoken and the step plays automatically, go on.
	useEffect(() => {
		if (!w || !step || !playing || spokenKey !== stepKey || step.waitsForCitizen) return;
		const timer = setTimeout(() => call("advance", [w.current]), 600);
		return () => clearTimeout(timer);
	}, [spokenKey, stepKey, playing, w, step, call]);

	// 3. Speak the assistant's answer when it has finished streaming, then resume the narration if it was cut off.
	const prevStatus = useRef(status);
	useEffect(() => {
		const was = prevStatus.current;
		prevStatus.current = status;
		if (!(was === "streaming" || was === "submitted") || status !== "ready" || !lastAssistant) return;
		const text = messageText(lastAssistant);
		if (!text) return;
		setCaption(text);
		if (!voiceOn) return;
		const keyBefore = stepKeyRef.current;
		narrator.speak(text, { lang: state.language, rate, muted: false }).then(() => {
			if (stepKeyRef.current && spokenKeyRef.current !== stepKeyRef.current && stepKeyRef.current === keyBefore) setReplayCount((c) => c + 1);
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [status]);

	function togglePause() {
		if (playing) narrator.stop();
		else setReplayCount((c) => c + 1);
		setPlaying(!playing);
	}

	// Invisible shortcuts for keyboard users: Space = pause/continue, ← = previous step.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!w || (e.target as HTMLElement).closest("input, textarea, select, button, [contenteditable]")) return;
			if (e.key === " ") {
				e.preventDefault();
				togglePause();
			} else if (e.key === "ArrowLeft") void call("back");
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	// --- Actions -----------------------------------------------------------------------------------
	const actions: WalkthroughActions = useMemo(
		() => ({
			answer: (fieldId, value) => void call("answer", [fieldId, value]),
			editField: (fieldId) => void call("editField", [fieldId]),
			chooseSlot: (slotId) => void call("chooseSlot", [slotId]),
			advance: () => w && void call("advance", [w.current]),
			submit: () => void call("submit"),
			close: () => {
				narrator.stop();
				void call("closeWalkthrough");
			},
			startNext: () => void call("startNext"),
			askHuman: () => void askHuman(),
		}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[call, w?.current],
	);

	async function askHuman() {
		const result = await call<HandoffResult>("requestHuman", ["Citizen pressed the 'talk to a person' button"]);
		setHandoff(result);
	}

	function updateSettings(patch: Partial<AssistantSettings>) {
		if (patch.personaId && patch.personaId !== state.personaId) {
			clearHistory();
			setHandoff(null);
			setCaption("");
			narrator.stop();
		}
		void call("updateSettings", [patch]);
	}

	/** "Start over" in the profile menu: a fresh session and fresh demo data, so the story can be shown again. */
	async function restart() {
		narrator.stop();
		clearHistory();
		setHandoff(null);
		setCaption("");
		setArrived([]);
		setPaid([]);
		await fetch("/api/gov/admin/reset", { method: "POST" }).catch(() => undefined);
		setSessionId(getSessionId(true));
	}

	return (
		<>
			<InkFilter />
			<a className="skip-link" href="#main">
				{t.skip}
			</a>

			<header className="lz-top" ref={topRef}>
				<div className="lz-top-in">
					<button type="button" className="lz-home" onClick={w ? actions.close : () => window.scrollTo(0, 0)} aria-label={t.toStart} title={t.toStart}>
						<Lockup />
					</button>

					<div className="lz-top-tools">
						<button type="button" className="lz-top-link" onClick={askHuman} title={t.humanLong} aria-label={t.humanLong}>
							<Icon name="headset" size={20} />
							<span className="lz-top-full">{t.human}</span>
							<span className="lz-top-short">{t.humanShort}</span>
						</button>
						<MailboxButton t={t} unread={needsYou.length} onOpen={() => needsYou[0] && showLetter(needsYou[0].id)} />
						<div className="lz-lang" role="group" aria-label={t.language}>
							{(["en", "de"] as const).map((l) => (
								<button key={l} type="button" lang={l} aria-pressed={state.language === l} onClick={() => updateSettings({ language: l })}>
									<span className="lz-top-full">{l === "en" ? "English" : "Deutsch"}</span>
									<span className="lz-top-short">{l.toUpperCase()}</span>
								</button>
							))}
						</div>
						<ProfileMenu
							t={t}
							persona={persona}
							personas={personas}
							language={state.language}
							fontScale={fontScale}
							voiceOn={voiceOn}
							rate={rate}
							onPersona={(id) => updateSettings({ personaId: id })}
							onLanguage={(language) => updateSettings({ language })}
							onFontScale={setFontScale}
							onVoice={(on) => {
								narrator.stop();
								setVoiceOn(on);
								setReplayCount((c) => c + 1);
							}}
							onRate={setRate}
							sealOn={showSeal}
							onSeal={(on) => {
								localStorage.setItem("lz-seal", on ? "on" : "off");
								setShowSeal(on);
							}}
							onRestart={restart}
						/>
					</div>
				</div>
			</header>

			<main id="main" className={w ? "lz-main is-slip" : "lz-main"}>
				{w ? (
					<Slip w={w} t={t} actions={actions} citizenName={persona?.name} queueNext={state.queue[0]?.name} showSeal={showSeal} sound={voiceOn} />
				) : (
					<Desk
						t={t}
						lang={state.language}
						name={persona?.name ?? ""}
						overview={overview}
						letters={needsYou}
						onOpenLetter={showLetter}
						onHuman={() => void askHuman()}
						busy={busy}
						reply={busy ? (toolLabel ?? t.thinking) : messageText(lastAssistant)}
						recorder={recorder}
						onSend={send}
						onStart={(serviceId) => void call("startWalkthrough", [serviceId])}
						showSeal={showSeal}
					/>
				)}
			</main>

			{w && (
				<CaptionBar
					t={t}
					caption={openLetter ? openLetter.spoken : busy ? (toolLabel ?? t.thinking) : caption}
					speaking={narrator.speaking}
					paused={!playing && !openLetter}
					busy={busy}
					compact={citizenTurn}
					recorder={recorder}
					onTogglePause={togglePause}
					onReplay={() => {
						if (!playing) setPlaying(true);
						setReplayCount((c) => c + 1);
					}}
					onSend={send}
				/>
			)}

			{toastId && !openLetterId && letters.find((l) => l.id === toastId) && (
				<LetterToast t={t} letter={letters.find((l) => l.id === toastId)!} onOpen={() => showLetter(toastId)} onLater={() => setToastId(null)} />
			)}
			{openLetter && (
				<LetterSheet
					t={t}
					lang={state.language}
					letter={openLetter}
					paid={paid.includes(openLetter.id)}
					onPay={() => setPaid((p) => [...p, openLetter.id])}
					onClose={closeLetter}
					onHuman={() => void askHuman()}
				/>
			)}
			{handoff && <HandoffSheet result={handoff} t={t} onClose={() => setHandoff(null)} />}
		</>
	);
}

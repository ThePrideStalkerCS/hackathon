/**
 * The citizen-facing app in the Laufzettel identity (docs/redesign/LAUFZETTEL.md):
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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_STATE, type AssistantSettings, type AssistantState } from "../src/shared/types";
import type { Suggestion } from "../src/shared/walkthrough";
import type { Overview } from "../src/shared/stamps";
import { api, type HandoffResult, type Persona } from "./api";
import { HandoffSheet, messageText, ProfileMenu, runningToolLabel } from "./components";
import { InkFilter, Lockup } from "./brand/Brand";
import { CaptionBar } from "./laufzettel/CaptionBar";
import { Desk } from "./laufzettel/Desk";
import { Slip } from "./laufzettel/Slip";
import { Icon } from "./icons";
import { TEXT } from "./i18n";
import { GOALS, loadProgress, percent, saveProgress, type Goal, type Progress as GoalProgress } from "./goals/data";
import { GoalCelebration } from "./goals/GoalCelebration";
import { GoalDetail } from "./goals/GoalDetail";
import { GoalsOverview } from "./goals/GoalsOverview";
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
	const t = TEXT[state.language];
	const narrator = useNarrator();

	// Gamified goals pages (goals/). A tiny hash router: #/goals, #/goals/<id>, #/goals/<id>/done.
	const [hash, setHash] = useState(() => window.location.hash);
	const [progress, setProgress] = useState<GoalProgress>(loadProgress);
	useEffect(() => {
		const onHash = () => setHash(window.location.hash);
		window.addEventListener("hashchange", onHash);
		return () => window.removeEventListener("hashchange", onHash);
	}, []);
	const go = (h: string) => {
		if (h) window.location.hash = h;
		else history.replaceState(null, "", window.location.pathname);
		setHash(h);
		window.scrollTo(0, 0);
	};
	const [, route, goalId, goalDone] = hash.split("/");
	const goal = GOALS.find((g) => g.id === goalId);
	function toggleStep(g: Goal, stepId: string) {
		const done = progress[g.id] ?? [];
		const next = { ...progress, [g.id]: done.includes(stepId) ? done.filter((id) => id !== stepId) : [...done, stepId] };
		setProgress(saveProgress(next));
		// The bar is full: celebrate!
		if (percent(g, next[g.id]) === 100) go(`#/goals/${g.id}/done`);
	}
	const goalProps = { t, lang: state.language, progress, go };
	let goalsPage: ReactNode = null;
	if (route === "goals") {
		// The completion page only shows once the bar is really full.
		if (goal && goalDone === "done" && percent(goal, progress[goal.id] ?? []) === 100) goalsPage = <GoalCelebration goal={goal} {...goalProps} />;
		else if (goal) goalsPage = <GoalDetail goal={goal} {...goalProps} onToggle={(id) => toggleStep(goal, id)} />;
		else goalsPage = <GoalsOverview {...goalProps} onReset={() => setProgress(saveProgress(null))} />;
	}

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

	function restart() {
		narrator.stop();
		clearHistory();
		setHandoff(null);
		setCaption("");
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
					<button type="button" className="lz-home" onClick={w ? actions.close : () => go("")} aria-label={t.toStart} title={t.toStart}>
						<Lockup />
					</button>

					<div className="lz-top-tools">
						<button type="button" className="lz-top-link" onClick={askHuman} title={t.humanLong} aria-label={t.humanLong}>
							<Icon name="headset" size={20} />
							<span className="lz-top-full">{t.human}</span>
							<span className="lz-top-short">{t.humanShort}</span>
						</button>
						<button
							type="button"
							className="lz-top-link"
							aria-pressed={route === "goals"}
							aria-label={t.goalsButton}
							title={t.goalsButton}
							onClick={() => go(route === "goals" ? "" : "#/goals")}
						>
							<Icon name="checkCircle" size={20} />
							<span className="lz-top-full">{t.goalsButton}</span>
						</button>
						<div className="lz-lang" role="group" aria-label={t.language}>
							{(["en", "de"] as const).map((l) => (
								<button key={l} type="button" lang={l} aria-pressed={state.language === l} onClick={() => updateSettings({ language: l })}>
									{l.toUpperCase()}
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

			<main id="main" className={w && !goalsPage ? "lz-main is-slip" : "lz-main"}>
				{goalsPage ? (
					goalsPage
				) : w ? (
					<Slip w={w} t={t} actions={actions} citizenName={persona?.name} queueNext={state.queue[0]?.name} showSeal={showSeal} />
				) : (
					<Desk
						t={t}
						lang={state.language}
						firstName={persona?.name.split(" ")[0] ?? ""}
						overview={overview}
						busy={busy}
						reply={busy ? (toolLabel ?? t.thinking) : messageText(lastAssistant)}
						recorder={recorder}
						onSend={send}
						onStart={(serviceId) => void call("startWalkthrough", [serviceId])}
						showSeal={showSeal}
					/>
				)}
			</main>

			{w && !goalsPage && (
				<CaptionBar
					t={t}
					caption={busy ? (toolLabel ?? t.thinking) : caption}
					speaking={narrator.speaking}
					paused={!playing}
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

			{handoff && <HandoffSheet result={handoff} t={t} onClose={() => setHandoff(null)} />}
		</>
	);
}

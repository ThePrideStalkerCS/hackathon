/**
 * The citizen-facing app. The authority's web page is the main window; the assistant is a layer
 * on top of it (see docs/CORE.md):
 *
 *   Start page     portal home: greeting, one big "what do you need?" bar (voice or text), "For you" cards
 *   Walkthrough    the form page (Portal) with the assistant's card attached to the active field,
 *                  a video-style progress bar on top and the voice dock (captions + mic) at the bottom
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
import { api, type HandoffResult, type Persona } from "./api";
import { CommandBar, Dock, HandoffSheet, messageText, ProfileMenu, runningToolLabel, VoiceMark, type VoiceState } from "./components";
import { Icon, SERVICE_ICON } from "./icons";
import { TEXT, tpl } from "./i18n";
import { GOALS, loadProgress, percent, saveProgress, type Goal, type Progress as GoalProgress } from "./goals/data";
import { GoalCelebration } from "./goals/GoalCelebration";
import { GoalDetail } from "./goals/GoalDetail";
import { GoalsOverview } from "./goals/GoalsOverview";
import { useNarrator, useRecorder } from "./voice";
import { Coach, needsCoach, type WalkthroughActions } from "./walkthrough/Coach";
import { Portal } from "./walkthrough/Portal";
import { Progress } from "./walkthrough/Progress";

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
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
	const [handoff, setHandoff] = useState<HandoffResult | null>(null);
	const [fontScale, setFontScale] = useState(1);
	const [playing, setPlaying] = useState(true);
	const [voiceOn, setVoiceOn] = useState(true);
	const [rate, setRate] = useState(1);
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
		call<Suggestion[]>("getSuggestions").then(setSuggestions).catch(() => setSuggestions([]));
	}, [call, state.personaId, state.language, sessionId, walkthroughOpen]);

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

	const voice: VoiceState =
		recorder.state === "listening" ? "listening" : busy || recorder.state === "transcribing" ? "thinking" : !playing ? "paused" : narrator.speaking ? "speaking" : "idle";

	return (
		<>
			<a className="skip-link" href="#main">
				{t.skip}
			</a>

			<header className="topbar">
				<div className="topbar-row">
					<button type="button" className="brand" onClick={w ? actions.close : undefined} aria-label={t.toStart} title={t.toStart}>
						<span className="brand-mark" aria-hidden="true" />
						<span className="brand-name">{t.brand}</span>
					</button>

					{w ? (
						<div className="address" aria-hidden="true">
							<Icon name="lock" size={15} />
							<span className="address-url">{w.portalUrl}</span>
							<span className="address-sim">{t.simulation}</span>
						</div>
					) : (
						<span className="address-sim standalone">{t.simulation}</span>
					)}

					<div className="topbar-actions">
						<button
							type="button"
							className="human-button nav-goals"
							aria-pressed={route === "goals"}
							aria-label={t.goalsButton}
							title={t.goalsButton}
							onClick={() => go(route === "goals" ? "" : "#/goals")}
						>
							<Icon name="checkCircle" size={20} />
							<span>{t.goalsButton}</span>
						</button>
						<button type="button" className="human-button" onClick={askHuman} title={t.humanLong} aria-label={t.humanLong}>
							<Icon name="headset" size={20} />
							<span>{t.human}</span>
						</button>
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
							onRestart={restart}
						/>
					</div>
				</div>
				{w && !goalsPage && <Progress w={w} t={t} onGoTo={(i) => void call("goTo", [i])} />}
			</header>

			<main id="main" className={w && !goalsPage ? "main walkthrough" : "main home"}>
				{goalsPage ? (
					goalsPage
				) : w ? (
					<Portal
						w={w}
						t={t}
						coach={needsCoach(step) ? <Coach w={w} t={t} actions={actions} queueNext={state.queue[0]?.name} /> : null}
						onEditField={actions.editField}
						onSubmit={actions.submit}
					/>
				) : (
					<section className="home">
						<p className="eyebrow">
							<VoiceMark state={voice} size="sm" /> {t.eyebrow}
						</p>
						<h1>{tpl(t.greeting, { name: persona?.name.split(" ")[0] ?? "" })}</h1>
						<p className="home-question">{t.homeQuestion}</p>

						<CommandBar t={t} recorder={recorder} busy={busy} onSend={send} />
						<p className="home-hint">{t.homeHint}</p>

						{(busy || messageText(lastAssistant)) && (
							<div className="answer" aria-live="polite">
								<VoiceMark state={busy ? "thinking" : "idle"} size="sm" />
								<p>{busy ? (toolLabel ?? t.thinking) : messageText(lastAssistant)}</p>
							</div>
						)}

						{suggestions.length > 0 && (
							<section className="for-you" aria-labelledby="for-you-title">
								<h2 id="for-you-title" className="section-title">
									{t.forYou}
								</h2>
								<div className="tasks">
									{suggestions.map((s) => (
										<button key={s.serviceId} type="button" className={`task ${s.urgency}`} onClick={() => void call("startWalkthrough", [s.serviceId])}>
											<span className="task-icon">
												<Icon name={SERVICE_ICON[s.serviceId] ?? "home"} />
											</span>
											<span className="task-text">
												<strong>
													{s.title}
													{s.urgency === "high" && <span className="task-badge">{t.urgent}</span>}
												</strong>
												<span>{s.reason}</span>
											</span>
											<span className="task-go">
												{t.startTask} <Icon name="arrowRight" size={18} />
											</span>
										</button>
									))}
								</div>
							</section>
						)}

						<section className="examples" aria-labelledby="examples-title">
							<h2 id="examples-title" className="section-title">
								{t.examplesTitle}
							</h2>
							<div className="example-list">
								{t.examples.map((ex) => (
									<button key={ex} type="button" className="example" onClick={() => send(ex)} disabled={busy}>
										„{ex}“
									</button>
								))}
							</div>
						</section>

						<p className="home-footer">{t.footer}</p>
					</section>
				)}
			</main>

			{w && !goalsPage && (
				<Dock
					t={t}
					caption={busy ? (toolLabel ?? t.thinking) : caption}
					voice={voice}
					paused={!playing}
					busy={busy}
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

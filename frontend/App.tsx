/**
 * The citizen-facing app: a guided walkthrough instead of a chat (see docs/CORE.md).
 *
 *   Start screen   greeting, proactive suggestions from the citizen's data, "say what you need"
 *   Walkthrough    portal (left) + explanation window (right) + video-style timeline (bottom)
 *
 * State lives in the agent (Durable Object) and is synced here via useAgent. This component never
 * changes the walkthrough itself: it calls the agent's @callable methods (agent.call("answer", …)).
 *
 * The playback loop: when the current step changes, the narration is spoken; when it is finished
 * and the step doesn't need the citizen, we call `advance`. Paused = nothing advances.
 */
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_STATE, type AssistantSettings, type AssistantState, type Language } from "../src/shared/types";
import type { Suggestion } from "../src/shared/walkthrough";
import { api, type HandoffResult, type Persona } from "./api";
import { AskBox, HandoffCard, MessageView, messageText, runningToolLabel } from "./components";
import { TEXT, tpl } from "./i18n";
import { useNarrator } from "./voice";
import { Explainer, type WalkthroughActions } from "./walkthrough/Explainer";
import { Portal } from "./walkthrough/Portal";
import { Timeline } from "./walkthrough/Timeline";

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

	const w = state.walkthrough;
	const step = w?.steps[w.current];
	const stepKey = w && step ? `${w.id}:${w.current}:${step.id}:${step.kind}:${step.done}` : null;
	const persona = personas.find((p) => p.id === state.personaId);
	const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
	const toolLabel = busy ? runningToolLabel(messages.at(-1), state.language) : null;

	useEffect(() => {
		api.personas().then(setPersonas).catch(console.error);
	}, []);

	// Proactive suggestions whenever the logged-in citizen changes.
	useEffect(() => {
		call<Suggestion[]>("getSuggestions").then(setSuggestions).catch(() => setSuggestions([]));
	}, [call, state.personaId, state.language, sessionId]);

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

	// 1. Speak the narration of each new step.
	useEffect(() => {
		if (!stepKey || !step) return;
		let cancelled = false;
		setSpokenKey(null);
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
		if (!text || !voiceOn) return;
		const keyBefore = stepKeyRef.current;
		narrator.speak(text, { lang: state.language, rate, muted: false }).then(() => {
			if (stepKeyRef.current && spokenKeyRef.current !== stepKeyRef.current && stepKeyRef.current === keyBefore) setReplayCount((c) => c + 1);
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [status]);

	// --- Actions -----------------------------------------------------------------------------------
	const actions: WalkthroughActions = useMemo(
		() => ({
			answer: (fieldId, value) => void call("answer", [fieldId, value]),
			editField: (fieldId) => void call("editField", [fieldId]),
			chooseSlot: (slotId) => void call("chooseSlot", [slotId]),
			advance: () => w && void call("advance", [w.current]),
			submit: () => void call("submit"),
			replay: () => setReplayCount((c) => c + 1),
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

	function send(text: string) {
		narrator.stop();
		sendMessage({ text });
	}

	function updateSettings(patch: Partial<AssistantSettings>) {
		if (patch.personaId && patch.personaId !== state.personaId) {
			clearHistory();
			setHandoff(null);
			narrator.stop();
		}
		void call("updateSettings", [patch]);
	}

	function newConversation() {
		narrator.stop();
		clearHistory();
		setHandoff(null);
		setSessionId(getSessionId(true));
	}

	return (
		<>
			<a className="skip-link" href="#main">
				{t.skip}
			</a>

			<header className="topbar">
				<div className="brand">
					<span className="logo" aria-hidden="true">
						◆
					</span>
					<div>
						<h1>{t.title}</h1>
						<p className="subtitle">{t.subtitle}</p>
					</div>
				</div>

				<div className="controls" role="group" aria-label="Settings">
					<label>
						{t.loginLabel}
						<select value={state.personaId} onChange={(e) => updateSettings({ personaId: e.target.value })}>
							{personas.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name} – {p.scenarioHint}
								</option>
							))}
						</select>
					</label>

					<fieldset className="segmented">
						<legend>{t.language}</legend>
						{(["de", "en"] as Language[]).map((lang) => (
							<button key={lang} type="button" aria-pressed={state.language === lang} onClick={() => updateSettings({ language: lang })}>
								{lang === "de" ? "Deutsch" : "English"}
							</button>
						))}
					</fieldset>

					<fieldset className="segmented">
						<legend>{t.textSize}</legend>
						{[1, 1.25, 1.5].map((scale) => (
							<button key={scale} type="button" aria-pressed={fontScale === scale} onClick={() => setFontScale(scale)} aria-label={`${t.textSize} ${scale * 100}%`}>
								<span style={{ fontSize: `${scale}em` }}>A</span>
							</button>
						))}
					</fieldset>

					<button type="button" onClick={newConversation}>
						{t.newChat}
					</button>
					<button type="button" className="human-button" onClick={askHuman}>
						☎ {t.human}
					</button>
				</div>
			</header>

			<p className="notice">{t.mockNotice}</p>

			<main id="main" className={w ? "stage walkthrough" : "stage home"}>
				{w ? (
					<>
						<div className="stage-left">
							<Portal w={w} t={t} onEditField={actions.editField} />
							<Timeline
								w={w}
								t={t}
								playing={playing}
								rate={rate}
								voiceOn={voiceOn}
								onTogglePlay={() => {
									if (playing) narrator.stop();
									else setReplayCount((c) => c + 1);
									setPlaying(!playing);
								}}
								onBack={() => void call("back")}
								onNext={actions.advance}
								onGoTo={(i) => void call("goTo", [i])}
								onRate={setRate}
								onToggleVoice={() => {
									narrator.stop();
									setVoiceOn(!voiceOn);
									setReplayCount((c) => c + 1);
								}}
							/>
						</div>

						<aside className="explainer" aria-label={t.assistant}>
							{handoff && <HandoffCard result={handoff} t={t} onClose={() => setHandoff(null)} />}
							<Explainer w={w} t={t} actions={actions} queueNext={state.queue[0]?.name} />
							<Reply text={lastAssistant ? messageText(lastAssistant) : ""} busy={busy} toolLabel={toolLabel} t={t} />
							<AskBox t={t} language={state.language} placeholder={t.askPlaceholder} disabled={busy} onSend={send} />
							<History messages={messages} language={state.language} t={t} />
						</aside>
					</>
				) : (
					<section className="home-panel">
						{handoff && <HandoffCard result={handoff} t={t} onClose={() => setHandoff(null)} />}
						<h2>{tpl(t.greeting, { name: persona?.name.split(" ")[0] ?? "" })}</h2>
						<p className="lead">{t.homeQuestion}</p>
						<AskBox t={t} language={state.language} placeholder={t.placeholder} disabled={busy} onSend={send} big />
						<Reply text={lastAssistant ? messageText(lastAssistant) : ""} busy={busy} toolLabel={toolLabel} t={t} />

						{suggestions.length > 0 && (
							<section className="suggestions" aria-labelledby="sugg-title">
								<h3 id="sugg-title">{t.suggestionsTitle}</h3>
								<div className="suggestion-grid">
									{suggestions.map((s) => (
										<article key={s.serviceId} className={`suggestion ${s.urgency}`}>
											<h4>{s.title}</h4>
											<p>{s.reason}</p>
											<button type="button" className="primary" onClick={() => void call("startWalkthrough", [s.serviceId])}>
												▶ {t.showMeHow}
											</button>
										</article>
									))}
								</div>
							</section>
						)}

						<div className="examples">
							<h3>{t.examplesTitle}</h3>
							{t.examples.map((ex) => (
								<button key={ex} type="button" className="chip" onClick={() => send(ex)} disabled={busy}>
									„{ex}“
								</button>
							))}
						</div>
						<History messages={messages} language={state.language} t={t} />
					</section>
				)}
			</main>
		</>
	);
}

/** The assistant's latest answer, shown as a speech bubble (it is also spoken). */
function Reply({ text, busy, toolLabel, t }: { text: string; busy: boolean; toolLabel: string | null; t: (typeof TEXT)["de"] }) {
	if (!text && !busy) return null;
	return (
		<div className="reply" aria-live="polite" aria-busy={busy}>
			<span className="reply-avatar" aria-hidden="true">
				◆
			</span>
			<p>{busy ? `⏳ ${toolLabel ?? t.thinking}` : text}</p>
		</div>
	);
}

function History({ messages, language, t }: { messages: Parameters<typeof MessageView>[0]["message"][]; language: Language; t: (typeof TEXT)["de"] }) {
	if (!messages.length) return null;
	return (
		<details className="history">
			<summary>
				{t.history} ({messages.length})
			</summary>
			<div className="messages">
				{messages.map((m) => (
					<MessageView key={m.id} message={m} language={language} />
				))}
			</div>
		</details>
	);
}

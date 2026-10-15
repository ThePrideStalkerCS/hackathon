/**
 * Voice for the walkthrough.
 *
 *   useNarrator()  speaks narration and answers: ElevenLabs via /api/voice/tts, falls back to the
 *                  browser's speechSynthesis, and to "silent reading time" when muted.
 *   useRecorder()  turns speech into text: records audio and sends it to /api/voice/stt
 *                  (ElevenLabs Scribe), falls back to the browser's SpeechRecognition.
 *
 * 👉 EXTEND HERE: karaoke subtitles (word timestamps), streaming TTS, a voice picker.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { languageRuns } from "../src/shared/pronounce";
import type { Language } from "../src/shared/types";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Roughly how long a sentence takes to read (used when the voice is off). */
export function readingTimeMs(text: string): number {
	const words = text.trim().split(/\s+/).length;
	return Math.max(2500, words * 330);
}

let elevenLabsStatus: Promise<boolean> | null = null;
function elevenLabsAvailable(): Promise<boolean> {
	elevenLabsStatus ??= fetch("/api/voice/status")
		.then((r) => r.json() as Promise<{ elevenlabs: boolean }>)
		.then((d) => d.elevenlabs)
		.catch(() => false);
	return elevenLabsStatus;
}

export type SpeakOptions = { lang: Language; rate: number; muted: boolean };

export function useNarrator() {
	const token = useRef(0);
	const audio = useRef<HTMLAudioElement | null>(null);
	const finish = useRef<(() => void) | null>(null);
	const cache = useRef(new Map<string, string>());
	const utterance = useRef<SpeechSynthesisUtterance | null>(null);
	const [speaking, setSpeaking] = useState(false);

	/** Stops whatever is playing. A pending speak() resolves with `false`. */
	const stop = useCallback(() => {
		token.current++;
		audio.current?.pause();
		if ("speechSynthesis" in window) window.speechSynthesis.cancel();
		finish.current?.();
		finish.current = null;
		setSpeaking(false);
	}, []);

	/** Speaks a text. Resolves `true` when it was spoken to the end, `false` when interrupted. */
	const speak = useCallback(
		async (text: string, opts: SpeakOptions): Promise<boolean> => {
			stop();
			const mine = ++token.current;
			const stillMine = () => mine === token.current;
			if (!text.trim()) return true;

			const waitReadingTime = async () => {
				const until = Date.now() + readingTimeMs(text) / opts.rate;
				while (Date.now() < until) {
					if (!stillMine()) return;
					await sleep(100);
				}
			};

			if (opts.muted) {
				await waitReadingTime();
				return stillMine();
			}

			setSpeaking(true);
			try {
				if (await elevenLabsAvailable()) {
					try {
						const url = await ttsUrl(text, opts.lang, cache.current);
						if (!stillMine()) return false;
						await playAudio(url, opts.rate);
					} catch (err) {
						// ElevenLabs configured but failing (wrong key, no credits, offline): use the browser voice.
						console.warn("[narrator] ElevenLabs failed, using the browser voice", err);
						if (!stillMine()) return false;
						await speakWithBrowser(text, opts);
					}
				} else {
					await speakWithBrowser(text, opts);
				}
			} catch (err) {
				// Autoplay blocked, network error, …: the subtitles are still there, give time to read them.
				console.warn("[narrator] falling back to reading time", err);
				await waitReadingTime();
			} finally {
				if (stillMine()) setSpeaking(false);
			}
			return stillMine();
		},
		[stop],
	);

	function playAudio(url: string, rate: number) {
		return withWatchdog(
			new Promise<void>((resolve, reject) => {
				audio.current ??= new Audio();
				const el = audio.current;
				el.src = url;
				el.playbackRate = rate;
				el.onended = () => resolve();
				el.onerror = () => reject(new Error("audio error"));
				finish.current = resolve;
				el.play().catch(reject);
			}),
			60_000,
		);
	}

	function speakWithBrowser(text: string, opts: SpeakOptions) {
		// Watchdog: Chrome sometimes never fires `end` (no audio device, background tab, …).
		// Without it the walkthrough would freeze on this step.
		const maxMs = (readingTimeMs(text) / opts.rate) * 1.8 + 2000;
		// German terms in English narration get a German voice (src/shared/pronounce.ts): one utterance per run.
		const runs = languageRuns(text, opts.lang);
		const keep: SpeechSynthesisUtterance[] = []; // Chrome drops `end` events of garbage-collected utterances
		return withWatchdog(
			new Promise<void>((resolve, reject) => {
				if (!("speechSynthesis" in window)) return reject(new Error("no speechSynthesis"));
				const voices = window.speechSynthesis.getVoices();
				finish.current = resolve;
				runs.forEach((run, i) => {
					const u = new SpeechSynthesisUtterance(run.text);
					u.lang = run.lang === "de" ? "de-AT" : "en-GB";
					u.voice = voices.find((v) => v.lang === u.lang) ?? voices.find((v) => v.lang.startsWith(run.lang)) ?? null;
					u.rate = opts.rate;
					keep.push(u);
					u.onerror = (e) => (e.error === "interrupted" || e.error === "canceled" ? resolve() : reject(new Error(e.error)));
					if (i === runs.length - 1) {
						u.onend = () => resolve();
						utterance.current = u; // keep a reference: a garbage-collected utterance never fires `end` in Chrome
					}
					window.speechSynthesis.speak(u);
				});
			}),
			maxMs,
		).finally(() => {
			keep.length = 0;
			window.speechSynthesis.cancel();
		});
	}

	useEffect(() => stop, [stop]);

	return { speak, stop, speaking };
}

/** Resolves after `ms` at the latest, even if the wrapped promise never settles. */
function withWatchdog(promise: Promise<void>, ms: number): Promise<void> {
	return Promise.race([promise, sleep(ms)]);
}

async function ttsUrl(text: string, lang: Language, cache: Map<string, string>): Promise<string> {
	const key = `${lang}:${text}`;
	const hit = cache.get(key);
	if (hit) return hit;
	const res = await fetch("/api/voice/tts", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ text: text.slice(0, 800), language: lang }),
	});
	if (!res.ok) throw new Error(`tts ${res.status}`);
	const url = URL.createObjectURL(await res.blob());
	cache.set(key, url);
	return url;
}

// ---------------------------------------------------------------------------------------------
// Speech input
// ---------------------------------------------------------------------------------------------

type RecorderState = "idle" | "listening" | "transcribing" | "unavailable";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

export function useRecorder(lang: Language, onText: (text: string) => void) {
	const [state, setState] = useState<RecorderState>("idle");
	const media = useRef<MediaRecorder | null>(null);
	const recognition = useRef<AnyRecognition>(null);
	const chunks = useRef<Blob[]>([]);

	const start = useCallback(async () => {
		if (await elevenLabsAvailable()) {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
				const rec = new MediaRecorder(stream);
				chunks.current = [];
				rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
				rec.onstop = async () => {
					stream.getTracks().forEach((t) => t.stop());
					setState("transcribing");
					try {
						const form = new FormData();
						form.append("file", new Blob(chunks.current, { type: rec.mimeType }), "speech.webm");
						const res = await fetch("/api/voice/stt", { method: "POST", body: form });
						const data = (await res.json()) as { text?: string };
						if (data.text) onText(data.text);
					} finally {
						setState("idle");
					}
				};
				media.current = rec;
				rec.start();
				setState("listening");
				return;
			} catch (err) {
				console.warn("[recorder] microphone not available", err);
			}
		}

		// Fallback: the browser's own speech recognition (Chrome, Edge, Safari).
		const SR = (window as AnyRecognition).SpeechRecognition ?? (window as AnyRecognition).webkitSpeechRecognition;
		if (!SR) return setState("unavailable");
		const r = new SR();
		r.lang = lang === "de" ? "de-AT" : "en-GB";
		r.interimResults = false;
		r.onresult = (e: AnyRecognition) => {
			const text = Array.from(e.results as ArrayLike<AnyRecognition>)
				.map((res: AnyRecognition) => res[0].transcript)
				.join(" ");
			if (text.trim()) onText(text.trim());
		};
		r.onend = () => setState("idle");
		r.onerror = () => setState("idle");
		recognition.current = r;
		r.start();
		setState("listening");
	}, [lang, onText]);

	const stop = useCallback(() => {
		if (media.current?.state === "recording") media.current.stop();
		recognition.current?.stop();
	}, []);

	return { state, start, stop };
}

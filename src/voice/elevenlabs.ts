/**
 * Voice via ElevenLabs: text-to-speech for the narration, speech-to-text for spoken answers.
 *
 * The API key stays on the server (secret ELEVENLABS_API_KEY). Without a key, both endpoints
 * answer 501 and the frontend falls back to the browser's built-in speech (Web Speech API).
 *
 * Setup:
 *   local:      cp .dev.vars.example .dev.vars   and paste your key
 *   deployed:   npx wrangler secret put ELEVENLABS_API_KEY
 *
 * Docs: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
 *       https://elevenlabs.io/docs/api-reference/speech-to-text/convert
 *
 * 👉 EXTEND HERE: pick voices that suit the target groups (calm, clear, Austrian German),
 *    streaming TTS for lower latency, word timestamps for karaoke-style subtitles.
 */
import { Hono } from "hono";
import { z } from "zod";
import { realSecret } from "../config";
import { languageRuns } from "../shared/pronounce";

/** Secrets/vars for voice. Optional so the app runs without them. */
type VoiceEnv = { ELEVENLABS_API_KEY?: string; ELEVENLABS_VOICE_ID?: string };

/** Low-latency multilingual model (supports German + English). */
const TTS_MODEL = "eleven_flash_v2_5";
/** Default voice ("Sarah", a premade multilingual voice). Override with ELEVENLABS_VOICE_ID. */
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
const STT_MODEL = "scribe_v2";
/** Protects the credits: narration texts are short. */
const MAX_TTS_CHARS = 800;

export const voiceRoutes = new Hono<{ Bindings: Env }>();

voiceRoutes.get("/status", (c) => {
	const env = c.env as Env & VoiceEnv;
	return c.json({ elevenlabs: Boolean(realSecret(env.ELEVENLABS_API_KEY)) });
});

/** POST /api/voice/tts { text, language, speed? } -> audio/mpeg */
voiceRoutes.post("/tts", async (c) => {
	const env = c.env as Env & VoiceEnv;
	const apiKey = realSecret(env.ELEVENLABS_API_KEY);
	if (!apiKey) return c.json({ error: "tts_not_configured" }, 501);

	const input = z
		.object({ text: z.string().min(1).max(MAX_TTS_CHARS), language: z.enum(["de", "en"]), speed: z.number().min(0.7).max(1.2).default(1) })
		.safeParse(await c.req.json().catch(() => ({})));
	if (!input.success) return c.json({ error: input.error.message }, 400);
	const { text, language, speed } = input.data;
	const voiceId = realSecret(env.ELEVENLABS_VOICE_ID) ?? DEFAULT_VOICE_ID;

	// Same narration = same audio: cache it (saves credits and makes replays instant).
	const cacheKey = new Request(`https://tts-cache.internal/${voiceId}/${language}/${speed}/${await sha256(text)}`);
	const cache = (caches as unknown as { default: Cache }).default;
	const cached = await cache.match(cacheKey);
	if (cached) return cached;

	// German terms in English narration ("Meldezettel") are spoken in German: one request per language
	// run, with the neighbouring text as context so the voice keeps its flow, then joined (MP3 frames
	// play back to back). A text without German terms stays one request.
	const runs = languageRuns(text, language);
	const parts = await Promise.all(
		runs.map(async (run, i) => {
			const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
				method: "POST",
				headers: { "xi-api-key": apiKey, "content-type": "application/json", accept: "audio/mpeg" },
				body: JSON.stringify({
					text: run.text,
					model_id: TTS_MODEL,
					language_code: run.lang,
					voice_settings: { stability: 0.6, similarity_boost: 0.75, speed },
					...(runs.length > 1 ? { previous_text: runs[i - 1]?.text ?? undefined, next_text: runs[i + 1]?.text ?? undefined } : {}),
				}),
			});
			if (!res.ok) {
				console.error("[tts] ElevenLabs error", res.status, await res.text().catch(() => ""));
				return null;
			}
			return new Uint8Array(await res.arrayBuffer());
		}),
	);
	if (parts.some((p) => !p)) return c.json({ error: "tts_failed" }, 502);
	const audio = new Uint8Array(parts.reduce((n, p) => n + p!.length, 0));
	let offset = 0;
	for (const p of parts) {
		audio.set(p!, offset);
		offset += p!.length;
	}

	const response = new Response(audio, {
		headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=86400" },
	});
	c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
	return response;
});

/** POST /api/voice/stt (multipart: file, language?) -> { text } */
voiceRoutes.post("/stt", async (c) => {
	const env = c.env as Env & VoiceEnv;
	const apiKey = realSecret(env.ELEVENLABS_API_KEY);
	if (!apiKey) return c.json({ error: "stt_not_configured" }, 501);

	const form = await c.req.formData().catch(() => null);
	const file = form?.get("file");
	if (!file || typeof file === "string") return c.json({ error: "file missing" }, 400);
	if (file.size > 10 * 1024 * 1024) return c.json({ error: "file too large" }, 400);

	const upstream = new FormData();
	upstream.append("file", file, "speech.webm");
	upstream.append("model_id", STT_MODEL);
	// No language_code on purpose: auto-detect handles dialect and citizens switching language.
	upstream.append("tag_audio_events", "false");

	const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
		method: "POST",
		headers: { "xi-api-key": apiKey },
		body: upstream,
	});
	if (!res.ok) {
		console.error("[stt] ElevenLabs error", res.status, await res.text().catch(() => ""));
		return c.json({ error: "stt_failed" }, 502);
	}
	const data = (await res.json()) as { text?: string; language_code?: string };
	return c.json({ text: (data.text ?? "").trim(), language: data.language_code ?? null });
});

async function sha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

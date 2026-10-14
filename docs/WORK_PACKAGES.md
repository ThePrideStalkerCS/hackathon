# Work packages

The core (guided walkthrough, see [CORE.md](CORE.md)) works end to end for all three services:
dialect input → walkthrough opens → profile data typed in → questions answered by click, text or
voice → review → submit → reference number (+ appointment). Proactive suggestions, human handoff
with context, ElevenLabs voice (with browser fallback), 16 unit tests, 9 eval scenarios
(last run 9/9; earlier runs 7/9, the failures were model wording, see WP-3).

Everything below builds on it. Each package is independent unless "Depends on" says otherwise.
Put your name next to a package when you take it. **Before starting, read [CORE.md](CORE.md) (invariants!).**

| WP | Title | Suggested role | Priority |
|---|---|---|---|
| 1 | Visual design, accessibility, adaptive layout | UX/UI designer | must |
| 2 | Voice: ElevenLabs setup, voices, voice-first mode | dev | must |
| 3 | AI quality: model choice, prompt, evals | AI dev | must |
| 4 | Verified facts + RAG for follow-up questions | AI dev / anyone | must (20 % of the score is accuracy) |
| 5 | More services + fallback for unknown requests | dev | should (unannounced test cases) |
| 6 | Proactive life events and follow-up errands | dev | should |
| 7 | Case-worker view + co-browsing | dev | should (strong 2030 story) |
| 8 | Trusted helper (family member joins) | dev | could |
| 9 | Strategy paper, technical docs, demo video | team lead / strategy | must (deliverables) |
| 10 | Robustness, deploy, polish | dev | must |

---

## WP-1 Visual design, accessibility, adaptive layout

**Goal:** the walkthrough feels like a calm, trustworthy video tutorial on every screen.

- **Done:** official 2030 redesign (page as main window, hint card at the active field, voice dock with the red-white-red voice mark, red video-style progress bar, all settings in one profile menu, mobile layout). Principles in CORE.md "Design principles".
- Next: polish with the tokens in `frontend/styles.css` (`:root`), a real name, the voice mark reacting to the actual audio level, and a review of every question in `src/walkthrough/guides.ts` with real users (is it clear without the explanation?).
- **Adaptive layout without guessing by age:** ask once at the start ("How would you like to use this? Big text / Read aloud / Simple view"), default from `digitalLiteracy` in the profile, always changeable. A "simple view" could show only the coach card and the dock, bigger. (Inferring the layout from age alone is a stereotype the jury may call out.)
- Pictograms per step, clearer ghost cursor, step transition animation (respect `prefers-reduced-motion`).
- Accessibility check: keyboard only, screen reader (VoiceOver), contrast, 200 % zoom. Document results in `docs/TECHNICAL.md` §6.

Files: `frontend/styles.css`, `frontend/walkthrough/*.tsx`, `frontend/App.tsx`, `frontend/i18n.ts` (keep DE + EN in sync).
Don't: change the walkthrough logic in the frontend. New actions = new `@callable()` in `src/agent/citizen-assistant.ts`.

## WP-2 Voice

**Goal:** natural Austrian-German narration and reliable dialect understanding.

- Claim the ElevenLabs coupon (ElevenLabs Discord → #coupon-codes → "Start Redemption" → event "AustrianStartups Summit Hackathon"), `cp .dev.vars.example .dev.vars`, add the key. Deployed: `npx wrangler secret put ELEVENLABS_API_KEY`.
- Pick voices (DE + EN, calm and clear): `ELEVENLABS_VOICE_ID`, maybe one per language in `src/voice/elevenlabs.ts`.
- Test speech-to-text with dialect (Josef persona: "Mei Pass is abgloffen").
- **Voice-first mode:** after an `ask` step's narration, open the microphone automatically (with a visible indicator), so someone who can't type can do the whole flow by voice.
- Karaoke subtitles: ElevenLabs `/text-to-speech/{voice}/with-timestamps` → highlight the spoken word.
- Credits: TTS responses are cached (Cache API) and limited to 800 characters. Keep it that way.

Files: `src/voice/elevenlabs.ts`, `frontend/voice.ts`, `frontend/App.tsx` (playback loop).

## WP-3 AI quality

**Goal:** correct intent, plain language, the formal "Sie", never a false claim.

- Run `pnpm evals` 3× and note the pass rate. Then compare models in `src/config.ts` (`MODEL_ID`): e.g. `@cf/openai/gpt-oss-120b`, `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, `@cf/qwen/qwen3-30b-a3b-fp8`, or Claude/GPT through AI Gateway (AWS credits). Keep a table of results in `docs/TECHNICAL.md`. AGENTS.md says to keep the default unless the team decides, so decide together.
- Known issues with `glm-4.7-flash`: occasional "du", wrong reply language, paraphrasing fixed sentences, claiming it filled a field without calling the tool (now covered for dates/yes-no/choices by `extractAnswer`).
- More scenarios in `evals/scenarios.json`: typos, half sentences, combined requests, out of scope, outage (`MOCK_FAILURE_RATE=0.3`), prompt injection, answering mid-walkthrough (the eval endpoint is single-turn; consider a multi-turn mode).
- Optional: LLM-as-judge check for plain language (sentence length, no jargon).

Files: `src/agent/system-prompt.ts`, `src/agent/router.ts`, `src/agent/tools.ts`, `src/config.ts`, `evals/`.

## WP-4 Verified facts + RAG

**Goal:** every fact the citizen hears is verified and has a source.

- For each service, open the official page on oesterreich.gv.at, correct `src/knowledge/index.ts`, set the exact `sourceUrl` and `verified: true`.
- Check the facts inside `src/walkthrough/guides.ts` (e.g. "within 3 days", KBG models) against the same pages.
- Optional RAG: Cloudflare AI Search over the official pages for free follow-up questions, returning a citation. Show the source as a chip in the coach card.
- Show a confidence hint when the answer is not from a verified source.

## WP-5 More services + fallback for unknown requests

**Goal:** the jury's unannounced cases don't hit a wall.

- Add 2–3 services with the recipe in CORE.md ("How to add a service"), e.g. Familienbeihilfe, Strafregisterbescheinigung, Wahlkarte, Hundeanmeldung.
- **Info walkthrough fallback:** for anything else, build a read-only walkthrough (intro → what you need → where to go → offer a person) from a verified knowledge entry, clearly marked "information only, no form".

Depends on: WP-4 for the facts.

## WP-6 Proactive life events

**Goal:** the state comes to the citizen ("Vision 2030").

- Extend `src/walkthrough/proactive.ts` (deterministic rules, one explainable sentence each).
- Follow-up errands after a submission: after a change of residence → "update your vehicle registration", after a birth → Familienbeihilfe + KBG as a queue. Show them on the `done` step ("Up next").
- A "your open items" list on the start screen (drafts in progress, booked appointments).

## WP-7 Case-worker view + co-browsing

**Goal:** a human takes over without the citizen repeating anything.

- New page (e.g. `/caseworker`) listing `GET /api/gov/handoffs` with the summary.
- **Co-browsing:** the ticket contains the `sessionId`. A case worker can connect to the same agent (`useAgent({ name: sessionId })`) and sees the same portal live. Add a read-only flag / role so they can't submit for the citizen without consent.
- Bonus: the case worker can send a message that appears in the citizen's dock.

## WP-8 Trusted helper

Same mechanism as WP-7: a share link lets a daughter or son join the walkthrough, see it and help (read-only or with answer rights). Very relevant for digital immigrants. Needs consent UI.

## WP-9 Strategy paper, technical docs, demo

- Strategy paper: vision, personas (use the 6 test personas), value proposition for citizens **and** administration (fewer incomplete applications thanks to server validation, fewer calls thanks to proactive hints, handoffs that arrive with context).
- `docs/TECHNICAL.md`: fill in the remaining placeholders (the architecture and AI parts are prepared).
- Demo video (1–2 min): Josef (dialect, voice, expired passport, proactive card) → Lena (dialect move, answers by voice) → handoff. Record with ElevenLabs voice on.
- "Logs and test results": `pnpm evals` report + AI Gateway logs screenshot.

## WP-10 Robustness, deploy, polish

- `pnpm run deploy`, set the secret, smoke test the deployed URL (`BASE_URL=… pnpm evals`).
- Outage UX: set `MOCK_FAILURE_RATE` to `0.3` and click through. Submit errors already show a retry message; check the start of a walkthrough and the answers too.
- Switching language mid-walkthrough: rebuild the walkthrough in the new language (keep the answers).
- Loading states while the model thinks (it can take 10–20 s with reasoning).

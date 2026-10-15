# Core: the guided walkthrough ("tutorial mode")

> Read this before changing anything in `src/walkthrough/`, `src/agent/` or `frontend/walkthrough/`.
> Written for humans and for coding agents (Claude Code, Cursor, Codex, …).

## The idea in one paragraph

Not a chatbot. The citizen says (or types) what they need, in their own words, dialect included.
The assistant opens the official form as a **Laufzettel** (routing slip) and walks it **while the
citizen watches**, like a YouTube tutorial: each row is a station, the offices fill in what their
registers already know and stamp it, and a voice explains what is happening (with subtitles in the
**caption bar**). When the citizen has to answer something, the question appears in that row: one
question behind the yellow marker, the official term ("Amtsdeutsch") explained in plain words, big
answer buttons. The sticky slip head shows how much is stamped and how little is left. Only the
citizen can submit, by holding the red seal on the last row. A person can take over at any time and
sees exactly where the citizen stopped.

## Design principles (frontend)

The full identity, the engine mapping and the build status are in
[redesign/LAUFZETTEL.md](redesign/LAUFZETTEL.md). The short version:

1. **The slip is the main window.** The form is shown as a routing slip on warm paper; the assistant is a voice and a caption line, not a side panel or a chat.
2. **Paper, ink, stamps.** Warm paper, soft forms, Fraunces for titles and Atkinson Hyperlegible for reading; light only. Blue = office stamps ("an office did this"), red = the route, the mark and the citizen's own emblem and seal, yellow marker only behind the one question the citizen has to answer. No glass, no gradients, no orb, no sparkles, no chat bubbles, no "simulation" or "demo" labels in what the citizen sees.
3. **Name who did it.** Each row carries the stamp of whoever filled it (register, office, landlord), and the narration names the same source.
4. **The citizen acts only where needed** (ask, appointment, review, blocked). Everything else plays by itself and is narrated in the captions; on phones the captions keep to two lines while the citizen acts.
5. **Hold to sign.** The citizen holds the red seal until it is pressed (keyboard: hold Space or Enter). A deliberate act; the AI can never do it.
6. **Fair nudging, carried by the slip.** The open slip says how much the offices fill in and how little is left; the emblem's wreath inks one leaf per stamped station; time kept is an estimate, labelled as such. Rules: voluntary (profile menu, "Show seal and time kept"), private (no ranking, no comparison), only positive, only official errands, openly explained. Code: `src/shared/stamps.ts`, `src/walkthrough/overview.ts`, `frontend/brand/Emblem.tsx`, `frontend/laufzettel/`.
7. **One question, plain words.** Ask the way a person would, explain each option, name the official term last ("Im Formular heißt das: …"). Never explain a term with itself.
8. **Voice first, never voice only.** Everything spoken is in the captions; everything answerable by voice is also clickable.

Logo: we deliberately use a text wordmark, not the Federal Chancellery's logo or the federal coat of arms (protected by the Wappengesetz). If the Chancellery provides its logo for the demo, swap it into `Lockup` in `frontend/brand/Brand.tsx`.

## Architecture

```
Browser (React)                                     Worker (Cloudflare)
┌──────────────────────────────────────┐            ┌─────────────────────────────────────────────┐
│ App.tsx  layout + playback loop      │  WebSocket │ CitizenAssistant (Durable Object, 1/session)│
│  ├ laufzettel/Slip.tsx  the slip     │◄──state────│  state = { personaId, language,             │
│  ├ laufzettel/Desk.tsx  start page   │            │            walkthrough, queue }             │
│  ├ walkthrough/Coach  answer widgets │──callable─►│  @callable advance/answer/submit/…          │
│  ├ laufzettel/CaptionBar  captions   │──chat─────►│  onChatMessage:                             │
│  └ voice.ts      TTS / STT           │            │    1. extractAnswer (deterministic)         │
└──────────┬───────────────────────────┘            │    2. routeIntent  (keywords → force tool)  │
           │ /api/voice/tts|stt                      │    3. LLM (Workers AI) + tools              │
           ▼                                         └───────┬─────────────────────────┬───────────┘
   ElevenLabs (key stays on server)                          │                         │
   fallback: Web Speech API                     src/walkthrough/ (engine,      src/gov/ (mock backend,
                                                guides, controller)            D1, validation)
```

**Single source of truth:** the walkthrough lives in the agent's state (Durable Object storage). The
browser only renders it and calls methods. Reload the page: it's still there. Open a second tab: same
state. (That's also the base for a case worker or a family member joining the session, see WP-8.)

## The walkthrough

Built by `buildWalkthrough()` in `src/walkthrough/engine.ts` from three things:

1. the **service definition** (`src/gov/data/services.ts`): form fields, eligibility, prefill
2. the **citizen's data** (`getCitizenProfile`) + eligibility result + appointment slots
3. the **guide** (`src/walkthrough/guides.ts`): hand-written plain-language texts per field

Step order, always the same:

| # | kind | chapter | waits for citizen? | what happens |
|---|---|---|---|---|
| 1 | `intro` | understand | no | what we do and why, "you only answer N questions" |
| 2 | `check` | check | no | eligibility as ✓ / ! / ✕ list (or `blocked` → stop, offer a person) |
| 3…n | `autofill` | fill | no | value known (profile, draft or derived by a guide's `suggest`): cursor types it in |
| 3…n | `ask` | fill | **yes** | value unknown: question + plain explanation + input widget |
| n+1 | `appointment` | fill | **yes** | only if the service needs one; booked on submit, not before |
| n+2 | `review` | review | **yes** | summary table + "Yes, submit like this" (the only submit path) |
| n+3 | `done` | done | – | reference number, appointment, next steps, next queued service |

Status (`playing | waiting | review | submitting | submitted | blocked`) is derived from the current step.

### Who changes what

| Action | Path | Notes |
|---|---|---|
| Step finished playing | browser → `advance(fromIndex)` | idempotent: ignored unless `fromIndex === current` |
| Citizen answers in the UI | browser → `answer(fieldId, value)` | validated with the backend's rules, saved to the draft |
| Citizen answers by voice/text | `onChatMessage` → `extractAnswer` (dates, yes/no, choices) **or** LLM tool `fill_form_field` (free text) | |
| Change a value | `editField(fieldId)` | turns the step back into a question; review must be confirmed again |
| Pick appointment | `chooseSlot(slotId)` | nothing booked yet |
| Submit | browser → `submit()` | **only** from the review step; backend validates again; books the slot; handles outage / slot taken |
| Talk to a person | browser → `requestHuman()` or LLM tool `request_human_help` | ticket summary includes the walkthrough position and filled fields |
| Start | LLM tool `start_guided_walkthrough(serviceIds)` or `startWalkthrough(serviceId)` from a proactive card | several ids = combined request; the rest goes into `queue` |

## The AI's job (and what it is NOT allowed to do)

The LLM **understands** and **explains**. The engine **shows**. The citizen **decides**.

- `src/agent/router.ts`: keyword router before the LLM. Clear request + service keyword → the first
  model step is *forced* to be `start_guided_walkthrough`. Also detects the message language.
- `extractAnswer()` in `engine.ts`: if the walkthrough waits for a date / yes-no / choice and the
  message contains it, it is entered **without the LLM**, and short answers get a fixed confirmation.
- Tools (`src/agent/tools.ts`): `get_my_profile`, `find_services`, `get_service_info`,
  `check_eligibility`, `start_guided_walkthrough`, `fill_form_field`, `request_human_help`.
- **There is no submit or booking tool.** The model can't take an administrative action, however it
  is prompted. Keep it that way.
- The system prompt (`src/agent/system-prompt.ts`) gets the current walkthrough step, so "what does
  that mean?" is answered in context.

## Invariants: don't break these

1. **The AI never submits or books.** Only the `submit` callable does, and only from the `review` step.
2. **State is server-controlled.** `validateStateChange` rejects client `setState`. New UI actions = new `@callable()` methods.
3. **`citizenId` comes from the session** (`this.st.personaId`), never from a tool input.
4. **Narration texts are hand-written** (`guides.ts`), not generated. Facts in them must match `src/knowledge/` and be verified.
5. **The engine is pure.** No I/O in `engine.ts`; I/O lives in `controller.ts`. Every engine change gets a test in `test/walkthrough.spec.ts`.
6. **Deterministic before LLM.** If something can be decided by rules (routing, dates, yes/no), do it before the model.
7. **Voice is optional.** Everything spoken is also on screen (subtitles). Without an ElevenLabs key the browser voice is used; when muted, steps advance after a reading time.
8. Agent method names must not collide with the Agents SDK base class (`start`, `getQueue`, … exist already).

## How to add a service (e.g. "Hund anmelden")

1. `src/gov/data/services.ts`: add a `ServiceDefinition` (fields, prefill, eligibility, nextSteps).
2. `src/knowledge/index.ts`: facts + source URL (verified!).
3. `src/walkthrough/guides.ts`: add a guide (title, portal title, intro, per-field question/explain/autofill).
4. `src/agent/router.ts`: add strong keywords.
5. `src/walkthrough/guides.ts` → `CHECK_REWRITES`: plain-language versions of the new eligibility texts.
6. Optional: a proactive rule in `src/walkthrough/proactive.ts`.
7. Test: `pnpm test` (add a case), `pnpm evals` (add a scenario).

## How to run and check

```bash
pnpm dev                    # http://localhost:5173
pnpm test                   # engine + backend tests (no AI)
pnpm evals                  # AI scenarios against the running dev server
npx tsc --noEmit && npx tsc --noEmit -p frontend/tsconfig.json
```

Voice: `cp .dev.vars.example .dev.vars`, paste the ElevenLabs key, restart `pnpm dev`.
No Cloudflare login (or it expired)? `pnpm dev:offline` runs everything except the AI chat.
`GET /api/voice/status` tells you whether ElevenLabs is active.

## Known limitations (as of this commit)

- `glm-4.7-flash` (the default model) sometimes slips into "du", paraphrases fixed sentences or
  answers in the wrong language. The router, `extractAnswer` and fixed replies cover the main path;
  free-text answers and explanations still depend on the model. See WP-3.
- Switching the UI language mid-walkthrough does not translate the running walkthrough (it is built in one language).
- Clearing an optional field after it was saved doesn't clear it in the backend draft (the mock's `updateApplication` only merges).
- The portal is a simulation, not the real oesterreich.gv.at (no ID Austria login, no submission APIs).
- Facts in `src/knowledge/` and `guides.ts` are **not verified** yet (`factsVerified: false` is shown to the citizen).

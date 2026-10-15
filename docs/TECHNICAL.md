# Technical Documentation: Laufzettel (oesterreich.gv.at 2030)

Deliverable "short technical documentation" of the challenge (docs/redesign/challenge-brief.md, section 8).
Concept and demo script: [docs/redesign/LAUFZETTEL.md](redesign/LAUFZETTEL.md). Strategy: [STRATEGY.md](STRATEGY.md).

## 1. Overview

- **Problem:** Moving, a new passport or childcare benefit means forms in Amtsdeutsch, data the state already has, several offices and deadlines nobody tells you about. The citizen is the courier between offices. The current assistant (chatbot "ida") answers questions; it does not carry the errand.
- **Solution:** The **Laufzettel**, a routing slip that walks by itself. The state starts the errand (e.g. the landlord confirmed the move), the offices fill in what they know and stamp it, the citizen watches, answers only what nobody else can know (by voice, dialect included, or a tap) and signs with their own seal. Everything is narrated in short official sentences with subtitles. Letters that arrive meanwhile (e.g. a parking fine) are explained in plain words. Not a chat window.
- **Target groups:** everyone, explicitly people with low digital literacy (Josef, 78, dialect, hard of hearing), non-native speakers (Amira, English), young movers (Lena), parents (Thomas). See [STRATEGY.md](STRATEGY.md).
- **Demo:** `pnpm dev`, persona Lena Huber (default). Two-minute script: LAUFZETTEL.md, "The core demo".

## 2. Architecture

```
Browser (React, Vite)        Desk (official notice) · Laufzettel (rows + stamps + seal) · caption bar · mailbox
   │  WebSocket (Agents SDK): state sync + @callable methods + chat stream
   ▼
CitizenAssistant (Durable Object, one per session)
   │  state: persona, language, walkthrough, queue
   ├── walkthrough engine (src/walkthrough, pure) ──► gov service layer (src/gov) ──► D1
   ├── router + answer extraction (deterministic, before the LLM)
   └── Workers AI via AI Gateway (tools: profile, services, eligibility, start walkthrough, fill field, human help)

/api/gov/*     mock e-government REST API (Hono): citizens, services, eligibility, appointments,
               applications, handoffs, third-party confirmations, the citizen's mailbox
/api/voice/*   ElevenLabs TTS/STT (key server-side, cached); German terms in English narration are
               synthesised as separate German runs · fallback: browser Web Speech API
```

| Component | Technology | Purpose |
|---|---|---|
| Frontend | React + Vite, Workers Static Assets | Desk, routing slip, caption bar, mailbox, hold-to-sign |
| API | Hono on Cloudflare Workers | Mock e-government REST API |
| Agent | Agents SDK `AIChatAgent` (Durable Object + SQLite) | Session state, callables, tool calling |
| Model | `@cf/zai-org/glm-4.7-flash` via AI Gateway | Reliable tool calls on Workers AI; Llama 4 Scout wrote tool calls as text |
| Data | D1 (SQLite) | Synthetic citizens, applications, appointments, handoffs |
| Walkthrough engine | TypeScript, pure functions, unit tested | Builds and advances the slip from service definition + citizen data + hand-written guide |
| Voice | ElevenLabs (TTS `eleven_flash_v2_5`, STT `scribe_v2`), Cache API | Narration and spoken input; browser fallback without key |

## 3. Data & APIs

- **Data sources:** synthetic personas (`src/gov/data/personas.ts`), third-party confirmations (`confirmations.ts`, the landlord), offices (`offices.ts`), letters (`mail.ts`). Service facts in `src/knowledge/` with source URL and a `verified` flag; the parking-fine facts in `mail.ts` were checked against court decisions on § 50 VStG and are marked for a final check on wien.gv.at.
- **APIs:** README "The mock API", plus `GET /api/gov/citizens/:id/mail?lang=` (letters, arrival during an errand). `POST /api/gov/admin/reset` resets the demo data.
- **Personal data:** all data is fictional. In production: login with ID Austria, data pulled from registers only for the errand in progress (data minimisation), no profile building, every value shows its source on the slip, the seal and time kept stay on the device.

## 4. AI design

- **Division of labour:** the LLM *understands* (intent, dialect, free-text answers) and *explains* (follow-up questions). The deterministic engine *shows* the process. The citizen *decides* and *signs*.
- **Voice of the texts:** the office speaks, not a chatbot: short statements of fact ("Requirements checked. All met."), no "I", no exclamation marks, one sentence per step. Hand-written narration in `src/walkthrough/guides.ts` (DE + EN); the system prompt enforces the same tone for free answers.
- **Tools:** `get_my_profile`, `find_services`, `get_service_info`, `check_eligibility`, `start_guided_walkthrough` (one or several services: combined requests), `fill_form_field`, `request_human_help`. No submit, book or pay tool by design.
- **Deterministic layers before the model:** keyword router (`src/agent/router.ts`), dialect-aware language detection, dates / yes-no / choices extracted without the model (`extractAnswer`).
- **Plain language:** every row shows the official term on the form and what it means; letters show the original next to plain words (what happened, deadline, if you do nothing, if you think it is wrong).
- **Languages:** DE + EN everywhere, switchable mid-errand (answers are kept). German official words inside English narration keep German pronunciation (`src/shared/pronounce.ts`).

## 5. Error handling & guardrails

| Risk | Mitigation |
|---|---|
| Hallucinated requirements or facts | Requirements from eligibility rules and hand-written guides; facts from `src/knowledge/` with source; unverified facts flagged; the prompt forbids inventing |
| Unwanted submission or payment | No submit/book/pay tool for the AI; only the citizen's hold-to-sign (about one second, keyboard: hold Space) submits; server-side validation again |
| Unclear where a value comes from | Every row names its source (register, landlord, you); stamps per office; estimates labelled as estimates |
| Model claims an action it didn't do | Deterministic answer extraction; "never claim submitted" rule, tested in evals |
| Backend outage / slot taken | Answers saved, retry + human contact; 409 on a taken slot sends the citizen back to the appointment row |
| Prompt injection / other people's data | Tools scoped to the session's citizen; client cannot change agent state (`validateStateChange`); eval scenario |
| Citizen overwhelmed | One question at a time, big targets, pause / replay / slower speech, "Talk to a person" in the top bar, on the notice and in letters; the handoff carries the current step |
| Speech fails | Subtitles for everything; watchdog against a frozen browser voice; reading-time fallback |

## 6. Testing

- **Evals:** `pnpm evals`, results in `test-results/report.md`: 9/9 (dialect move, passport, baby in English, combined move + childcare, injection, no false "submitted", out of scope).
- **Unit tests:** `pnpm test`: 33 (engine: steps, landlord confirmation, combined requests, validation, extraction; voice: German language runs).
- **UI:** scripted headless Chrome runs of the full Lena flow (EN desktop, DE 390 px, keyboard hold-to-sign), computed-style snapshots of 14 screens to guard refactors (LAUFZETTEL.md, "How to verify").
- **Logs:** AI Gateway (prompts and responses), Workers Observability.

## 7. Limitations

- Service rules, offices, fees and letters are simplified mocks; the parking-fine facts need a final check on wien.gv.at.
- Payment in the mailbox is simulated; the Parkpickerl is mentioned, not built as its own slip.
- Dialect understanding depends on the model and STT; clear requests are routed deterministically.
- Joined voice runs (German terms inside English) can sound slightly segmented.
- Only three services are fully guided (change of residence, passport, childcare benefit).

## 8. Setup

README "Quick start". Secrets: `ELEVENLABS_API_KEY` (optional, `.dev.vars` or `wrangler secret put`), `GOOGLE_MAPS_API_KEY` (optional, address suggestions). Offline without Cloudflare login: `pnpm dev:offline` (no AI chat).

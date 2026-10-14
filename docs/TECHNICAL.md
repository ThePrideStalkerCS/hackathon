# Technical Documentation – <Your Team / Product Name>

> Skeleton for the required technical documentation deliverable. Replace the placeholders.
> The parts that describe the template are pre-filled. Update them to match what you changed.

## 1. Overview

- **Problem:** <one paragraph>
- **Solution:** A guided walkthrough instead of a chatbot. The citizen describes the need in their own words (voice or text, dialect included). The assistant opens the official form in a simulated portal and fills it in step by step while the citizen watches (ghost cursor, narration, official term next to a plain-language explanation). The citizen only answers what the system can't know from their data and submits with a button. See [CORE.md](CORE.md).
- **Target groups:** <e.g. older citizens, non-native speakers, …>
- **Demo URL:** <https://….workers.dev>

## 2. Architecture

```
Browser (React, Vite)                       Portal view · explanation window · timeline · mic
   │  WebSocket (Agents SDK): state sync + @callable methods + chat stream
   ▼
CitizenAssistant (Durable Object, one per session)
   │  state: persona, language, walkthrough, queue
   ├── walkthrough engine (src/walkthrough) ──► Gov service layer ──► D1
   ├── router + answer extraction (deterministic, before the LLM)
   └── Workers AI via AI Gateway (tools: profile, services, eligibility, start walkthrough, fill field, human help)

/api/voice/* ──► ElevenLabs TTS/STT (key server-side, cached) · fallback: browser Web Speech API
```

| Component | Technology | Purpose |
|---|---|---|
| Frontend | React + Vite, Workers Static Assets | <…> |
| API | Hono on Cloudflare Workers | Mock e-government REST API |
| Agent | Agents SDK `AIChatAgent` (Durable Object + SQLite) | Conversation state, tool calling |
| Model | `<MODEL_ID>` via AI Gateway | <why this model> |
| Data | D1 (SQLite) | Synthetic citizens, applications, appointments, handoffs |
| Walkthrough engine | TypeScript, pure functions | Builds and advances the step-by-step tutorial from service definition + citizen data + hand-written guide |
| Voice | ElevenLabs (TTS `eleven_flash_v2_5`, STT `scribe_v2`), Cache API | Narration and spoken input; browser fallback without key |

## 3. Data & APIs

- **Data sources:** synthetic personas (`src/gov/data/personas.ts`); service facts from <pages on oesterreich.gv.at, verified on DATE>.
- **APIs:** see README "The mock API". <Describe new endpoints.>
- **Personal data:** all data is fictional. <How would you handle real data: ID Austria, data minimisation, retention?>

## 4. AI design

- **Division of labour:** the LLM *understands* (intent, dialect, free-text answers) and *explains* (follow-up questions). The deterministic engine *shows* the process. The citizen *decides* (submit button).
- **System prompt:** `src/agent/system-prompt.ts`. Narrator role, max ~40 words (it is spoken), formal "Sie", no invented facts, current walkthrough step as context, no claims of actions that didn't happen.
- **Tools:** `get_my_profile`, `find_services`, `get_service_info`, `check_eligibility`, `start_guided_walkthrough` (one or several services → combined requests), `fill_form_field` (answers given in words), `request_human_help`. No submit/book tool by design.
- **Deterministic layers before the model:** keyword router forces the walkthrough for clear requests (`src/agent/router.ts`); dates, yes/no and choices are extracted from the message without the model (`extractAnswer`), short answers get a fixed confirmation.
- **Grounding:** narration texts are hand-written per field (`src/walkthrough/guides.ts`); facts come from `src/knowledge/` with source URL; unverified facts are labelled in the UI.
- **Languages / plain language:** DE + EN, reply language detected per message; every official term is shown next to a plain-language explanation; subtitles for everything spoken.

## 5. Error handling & guardrails

| Risk | Mitigation |
|---|---|
| Hallucinated requirements | Requirements come from the eligibility rules and hand-written guides, not from the model; the prompt forbids listing requirements in text |
| Unwanted submission | No submit/book tool for the AI; only the citizen's button on the review step submits; server-side validation again on submit |
| Model claims an action it didn't do | Answers for dates / yes-no / choices are entered deterministically; prompt rule "never claim a fill without ok: true"; the portal always shows the real state |
| Backend outage | Answers are kept locally and saved again on submit; outage message with retry + human contact; handoff never simulates failures |
| Appointment taken in the meantime | Submit catches 409, reloads free slots and sends the citizen back to the appointment step |
| Prompt injection | Tools scoped to the logged-in persona (citizenId from session); client can't change agent state (`validateStateChange`) |
| Citizen overwhelmed | One question at a time, big buttons, pause / back / slower speed, "Talk to a person" always visible, handoff carries the walkthrough position |
| Speech fails | Subtitles for everything; watchdog so a stuck browser voice never freezes the walkthrough; reading-time fallback when muted |
| <…> | <…> |

## 6. Testing

- **Evals:** `pnpm evals`. Results are in `test-results/report.md` (<X/Y passed>).
- **Unit tests:** `pnpm test` (backend + walkthrough engine: step building, idempotent advance, validation, edit from review, blocked eligibility, submit, date/yes-no/choice extraction)
- **Accessibility testing:** <screen reader, keyboard-only, contrast checks, …>
- **Logs:** AI Gateway (prompts and responses), Workers Observability

## 7. Limitations

- Service rules are simplified mocks. <…>
- <Model limitations, e.g. dialect understanding>
- <What's not built yet>

## 8. Setup

See README "Quick start". <Add any new secrets or bindings.>

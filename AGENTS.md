# Notes for coding agents (and humans)

Challenge 3 hackathon project: an assistant for Austrian government services that works like a
**guided video tutorial, not a chatbot**. The citizen watches the official form being filled in step
by step (simulated portal + ghost cursor + narration), answers only what the system can't know, and
submits with a button.

**Read [docs/CORE.md](docs/CORE.md) before changing the walkthrough, the agent or the UI.**
Open tasks are in [docs/WORK_PACKAGES.md](docs/WORK_PACKAGES.md). Ask the team about design decisions
(tone, model, new services) instead of silently picking a solution.

## Invariants of the core (details in docs/CORE.md)

1. **The AI never submits or books.** There is no tool for it. Only the `submit` callable (citizen's button on the review step) does.
2. **Agent state is server-controlled.** The frontend never calls `agent.setState`; it calls `@callable()` methods (`agent.call("answer", [...])`).
3. **The walkthrough engine (`src/walkthrough/engine.ts`) is pure.** I/O goes into `controller.ts`. Add a test in `test/walkthrough.spec.ts` for every engine change.
4. **Narration and explanations are hand-written** in `src/walkthrough/guides.ts` (DE + EN), not generated.
5. **Deterministic before LLM:** keyword router (`src/agent/router.ts`) and `extractAnswer()` run before the model.
6. Agent method names must not collide with the Agents SDK (`start`, `getQueue`, … already exist on `Agent`).

## Project map

- `src/index.ts`: Hono app. `/api/gov/*` mock backend, `/api/evals/chat`, `/agents/*` (Agents SDK routing).
- `src/config.ts`: model (`MODEL_ID`) and AI Gateway settings.
- `src/agent/citizen-assistant.ts`: `AIChatAgent` Durable Object. State = `AssistantState` (persona, language, walkthrough, queue), synced to the frontend. `@callable()` methods drive the walkthrough.
- `src/agent/system-prompt.ts`: system prompt (narrator role, plain language, current walkthrough step).
- `src/agent/router.ts`: keyword router + language detection before the LLM.
- `src/agent/tools.ts`: AI tools (`buildTools`), shared by the chat and the evals.
- `src/agent/run-assistant.ts`: non-streaming run of the same agent, used by `/api/evals/chat`.
- `src/walkthrough/`: the core. `engine.ts` (pure step logic), `controller.ts` (backend I/O, submit), `guides.ts` (plain-language texts), `proactive.ts` (suggestions from the profile).
- `src/shared/walkthrough.ts`: walkthrough types shared with the frontend.
- `src/voice/elevenlabs.ts`: `/api/voice/tts|stt|status` (ElevenLabs, key in `.dev.vars` / wrangler secret).
- `src/gov/service.ts`: business logic, used by both the Hono routes and the tools. Add new backend features here first.
- `src/gov/db.ts`: D1 schema + lazy seeding. After changing the schema or personas, call `POST /api/gov/admin/reset`.
- `src/gov/data/`: personas, services (forms, eligibility rules), human contact.
- `src/knowledge/index.ts`: service facts with source URLs.
- `frontend/`: React (Vite). `App.tsx` (layout + playback loop), `walkthrough/` (Portal, Explainer, Timeline), `voice.ts` (TTS/STT with browser fallback), `components.tsx`. Texts are in `frontend/i18n.ts` (German + English, keep both in sync).
- `evals/`: scenarios (`scenarios.json`) + runner (`run.ts`).

## Rules for new code

- **New tools:** follow the `get_my_profile` pattern. Call functions from `src/gov/service.ts` directly (not the HTTP API).
- **`citizenId` always comes from the session** (`settings.personaId`), never from a tool's input schema. Otherwise the model can be talked into reading other citizens' data.
- **Write tools** (anything that submits, books or changes data) must be added to `EVAL_STUBBED_TOOLS` in `src/agent/tools.ts`, so `pnpm evals` never executes them. (`start_guided_walkthrough` and `fill_form_field` are safe in evals: they use an in-memory host.)
- **Never invent legal facts** (fees, deadlines, documents). Facts live in `src/knowledge/` with a source URL. Mark unverified facts as such.
- **All data is fictional.** Don't add real personal data.
- Keep code simple and commented: teams have mixed skill levels.
- Mark extension points with `// 👉 EXTEND HERE`.

## Don't break the setup

These caused real bugs while building the template:

- **Don't upgrade dependencies** (`pnpm update`, `@latest`, changing versions in `package.json`) unless the team asks. All versions are pinned on purpose.
- **`workers-ai-provider@4.0.0` is patched** (`patches/`, registered in `pnpm-workspace.yaml`). Without the patch, Workers AI streams every chunk twice: doubled text in the chat and broken tool calls. If you upgrade it, check whether the bug is fixed upstream and then remove the patch, otherwise `pnpm install` fails.
- **Keep the default model** (`@cf/zai-org/glm-4.7-flash` in `src/config.ts`) unless asked. `@cf/meta/llama-4-scout-17b-16e-instruct` often writes tool calls as plain text (`[get_my_profile()]`) instead of calling them.
- **After changing bindings in `wrangler.jsonc`, run `pnpm cf-typegen`** and commit `worker-configuration.d.ts`. Otherwise you get errors like `Property 'GOV_DB' does not exist on type 'Env'`.
- **`@ai-sdk/react` must stay installed.** It's an optional peer of `agents` / `@cloudflare/ai-chat`, and the frontend crashes without it.
- **If the browser shows stale code after dependency changes**, delete `node_modules/.vite` and restart `pnpm dev`.
- **`agents()` must stay in `vite.config.ts` and `vitest.config.mts`.** It compiles the `@callable()` decorators; without it the callables silently don't exist.
- **Cloudflare account:** `account_id` in `wrangler.jsonc` is the team account (Martin's, has the Workers AI credits). Your `wrangler login` needs access to it.

## How to check your work

1. `npx tsc --noEmit` (Worker) and `npx tsc --noEmit -p frontend/tsconfig.json` (frontend)
2. `pnpm test` (backend unit tests, no AI)
3. `pnpm evals` (needs `pnpm dev` running): after every change to the prompt, the tools or the model.
   Model answers vary, so run them more than once before trusting a result.
4. For every new feature or bug fix in the assistant's behaviour, add a scenario to `evals/scenarios.json`.
5. The evals use the non-streaming path. Streaming bugs only show up in the browser chat, so test it there too.

| Command | Purpose |
|---|---|
| `pnpm dev` | Local development (Vite + Worker), http://localhost:5173 |
| `pnpm run deploy` | Build and deploy |
| `pnpm cf-typegen` | Generate `Env` types |
| `pnpm test` | Backend unit tests |
| `pnpm evals` | AI scenario tests (`pnpm evals <id>` for single scenarios) |

## Cloudflare docs

Your knowledge of Cloudflare APIs may be outdated. Retrieve current docs before changing Workers, D1,
Workers AI, AI Gateway or Agents SDK code:

- If available, use the Cloudflare MCP servers or Cloudflare skills (see "Working with a coding agent" in README.md).
- Agents SDK: https://developers.cloudflare.com/agents/llms.txt
- Workers: https://developers.cloudflare.com/workers/
- Workers AI models: https://developers.cloudflare.com/workers-ai/models/

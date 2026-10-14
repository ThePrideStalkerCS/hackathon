# Digital Public Service Assistant 2030

> **Our approach: a guided tutorial instead of a chatbot.** The citizen says what they need (voice or
> text, dialect welcome). The assistant opens the official form in a simulated portal and fills it in
> while the citizen watches: a ghost cursor, a narrating voice, the official term next to a
> plain-language explanation. The citizen only answers what the system can't know and submits with a
> button. A person can take over at any time and sees where the citizen stopped.
>
> - How it works: [docs/CORE.md](docs/CORE.md)
> - Who does what next: [docs/WORK_PACKAGES.md](docs/WORK_PACKAGES.md)
> - Voice: `cp .dev.vars.example .dev.vars` and add the ElevenLabs key (optional, falls back to browser speech)
>
> The rest of this README describes the original starter template.

---

# Starter Template

**Austrian Startup Summit 2026 Hackathon · Challenge 3 (Federal Chancellery)**

**What you get is mainly the backend:** a mock e-government API with fictional citizens (personas), services,
forms, eligibility rules, appointments and applications. On top of that sits **one chat agent with one tool**
(`get_my_profile`), a minimal system prompt, a plain chat UI and an eval runner.

> **There is no working end-to-end flow yet:** The agent can look up the
> logged-in citizen's profile, nothing more. Which tools it needs, how they chain together, how the
> citizen confirms, and what the UI looks like is the challenge. Look for `👉 EXTEND HERE` comments.

*All citizen data is fictional. Service rules are simplified mocks.*

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Nlea/austrian-startup-summit-hackathon)

---

## What's inside

| Part | What it does | Where |
|---|---|---|
| **Mock e-government backend** | The main part. Fictional citizens, 3 services, forms, eligibility, appointments, applications, human handoff. REST API built with **Hono**, plus the same logic as plain functions for your tools | `src/gov/` |
| **Chat agent** | Streams answers, remembers the conversation, **one example tool** (`get_my_profile`), **minimal system prompt** | `src/agent/` |
| **Knowledge** | Facts about each service with source URLs (⚠️ verify before your demo!) | `src/knowledge/` |
| **Frontend** | Plain chat UI: simulated ID Austria login, DE/EN, text size, tool status | `frontend/` |
| **Evals** | Runner + 3 example scenarios → test report. Writing the real test set is up to you | `evals/` |

**Cloudflare products used:** Workers, Agents SDK (Durable Objects + SQLite), Workers AI, AI Gateway, D1, Static Assets, Workers Observability.

```
Browser (React)
   │  WebSocket                     REST (Hono)
   ▼                                   ▼
CitizenAssistant agent ──tools──► Mock gov service ──► D1 (citizens, applications, …)
(Durable Object, chat history)        ▲
   │                                  │
   └──► Workers AI (via AI Gateway)   └── src/knowledge (facts + sources)
```

---

## Quick start

You need Node.js 20+, pnpm (`npm i -g pnpm`) and a Cloudflare account.

```bash
git clone https://github.com/Nlea/austrian-startup-summit-hackathon.git
cd austrian-startup-summit-hackathon
pnpm install
npx wrangler login
pnpm dev              # http://localhost:5173
```

Workers AI calls run against your Cloudflare account, even in local dev (that's why you need to log in).

**Error "More than one account available but unable to select one"?** Your login has access to several
Cloudflare accounts. Pick one by setting its account id (Dashboard → Account home → ⋯ → Copy account ID):

```bash
export CLOUDFLARE_ACCOUNT_ID=<your-account-id>
```

**Changed `wrangler.jsonc`?** After adding or renaming a binding (D1, KV, R2, AI, vars, …), regenerate the TypeScript types, otherwise you get errors like `Property 'GOV_DB' does not exist on type 'Env'`:

```bash
pnpm cf-typegen       # rewrites worker-configuration.d.ts – commit the result
```

**Deploy:**

```bash
pnpm run deploy       # builds the frontend and deploys everything
```

The D1 database is created automatically on the first deploy, and the tables fill themselves with test data on the first request. No migrations are needed.

---

## Try it

Pick a persona in the "Logged in as" menu. Each one is a fictional citizen with their own data
(address, documents, household, residence status), built to test a specific scenario once you've added the tools:

| Persona | Good for testing |
|---|---|
| Lena Huber | Change of residence (the main flow) |
| Josef Gruber | Expired passport, low digital literacy, dialect |
| Amira Haddad | Non-EU residence permit, childcare benefit, combined requests, English |
| Thomas Berger | Childcare benefit (newborn) |
| Sofia Rossi | Change of residence in English (EU citizen) |
| David Novak | Incomplete data (no current address) |

Example: as Josef, ask *"Ist mein Reisepass noch gültig?"*. The agent calls `get_my_profile` and sees that the passport expired in 2025.
Anything beyond that (finding the right service, filling in the form, submitting) needs tools you add.

---

## The mock API (Hono)

Base URL: `/api/gov`. Every endpoint accepts `?lang=de|en` and `?simulate=slow|error`.
The agent tools don't call these over HTTP. They call the same functions directly from `src/gov/service.ts`
(the list is at the top of `src/agent/tools.ts`).

| Method | Path | |
|---|---|---|
| GET | `/citizens` · `/citizens/:id` | Personas, full profile (documents with expiry status) |
| GET | `/services` · `/services/search?q=` · `/services/:id` | Services, keyword search, facts + form fields |
| GET | `/services/:id/eligibility?citizenId=` | Eligibility check |
| GET | `/services/:id/appointments` | Free slots (passport) |
| POST | `/appointments/:slotId/book` | `{citizenId}` |
| POST | `/applications` | `{citizenId, serviceId, data?}` → draft, pre-filled |
| PATCH | `/applications/:id` | `{data}` |
| POST | `/applications/:id/submit` | Validates server-side, returns a reference number |
| POST/GET | `/handoffs` | Human handoff tickets |
| POST | `/admin/reset` | Reset the database to the seed data |

```bash
curl "http://localhost:5173/api/gov/services/search?q=umzug"
curl "http://localhost:5173/api/gov/citizens/josef-gruber"
curl -X POST "http://localhost:5173/api/gov/admin/reset"
```

Other endpoint: `POST /api/evals/chat` (used by the evals).

**Testing robustness:** set `MOCK_FAILURE_RATE` (e.g. `"0.2"`) or `MOCK_LATENCY_MS` in `wrangler.jsonc`, and check that your assistant handles outages gracefully.

---

## Evals → your "logs and test results" deliverable

```bash
pnpm dev                                   # terminal 1
pnpm evals                                 # terminal 2
BASE_URL=https://your-worker.workers.dev pnpm evals
pnpm evals english                         # run only some scenarios
```

This writes `test-results/report.md` and `results.json`. Only 3 example scenarios ship with the template. Add your own to `evals/scenarios.json`: the announced cases, noisy and combined requests, guardrails. The jury will try unannounced ones.

Unit tests for the mock backend (no AI): `pnpm test`.

**Logs:** every model call is logged in **AI Gateway** (Dashboard → AI → AI Gateway → `default`), including prompt, response, tokens and latency, and is tagged with session and persona. Worker logs are in **Workers & Pages → your worker → Logs**.

---

## Switching models

Change `MODEL_ID` in `src/config.ts`, then re-run `pnpm evals` to compare. Check German quality and tool calling in particular: the default `glm-4.7-flash` handles multi-step tool calls well, while Llama 4 Scout often writes tool calls as plain text instead.

---

## What's built

- **The mock backend**, including server-side validation: it rejects incomplete applications, whatever the AI says.
- **Data isolation:** the example tool takes the citizen id from the session, never from the model.
- **Safe evals:** tools listed in `EVAL_STUBBED_TOOLS` (`src/agent/tools.ts`) never execute during `pnpm evals`.
- **Handoff API:** `POST /api/gov/handoffs` creates a ticket for a human case worker, and `HandoffCard` in the frontend can display it. Nothing uses it yet.

## Up to you:

- **The tools:** which ones, how they're described, how they chain from "understand" to "submit".
- **The UI for results:** right now tool results show up as raw JSON. Confirmation steps, success cards, reference numbers, downloads are yours to build.
- **Confirmation:** how does the citizen check and confirm before anything is submitted or booked?
- **Human fallback:** how and when does a citizen reach a person? A button, the AI handing over, both?
- **Error handling:** what does the citizen hear when the backend is slow or down? (Try `MOCK_FAILURE_RATE`.)
- **The system prompt:** tone, dialect, sources and confidence, out-of-scope answers, prompt-injection rules.
- **The test scenarios.**
- all other cool extension ideas


## Working with a coding agent

`AGENTS.md` tells your coding agent (Claude Code, Cursor, OpenCode, Codex, Copilot, …) how this project
works and which traps to avoid (pinned dependencies, a patched package, the default model). Most agents
read it automatically; for Claude Code, `CLAUDE.md` imports it. If yours doesn't, point it to the file.

Give your agent up-to-date Cloudflare knowledge, since its training data may be outdated:

- **Cloudflare skills** (Workers, Agents SDK, Durable Objects, Wrangler, …) bundled with the Cloudflare MCP servers:
  ```bash
  npx skills add https://github.com/cloudflare/skills
  ```
  In Claude Code: `/plugin marketplace add cloudflare/skills`. Cursor: install from the Cursor Marketplace.
- **Cloudflare MCP server** (Cloudflare API + documentation), add it to your agent's MCP settings:
  ```json
  { "mcpServers": { "cloudflare-api": { "url": "https://mcp.cloudflare.com/mcp" } } }
  ```
  You log in with OAuth on first use and choose which permissions the agent gets.

Step-by-step guides for each agent: https://developers.cloudflare.com/agent-setup/

Tip: ask your agent to run `pnpm evals` after every change to the prompt or the tools.

## Project structure

```
src/
  index.ts                 Hono app: routes /api/*, /agents/*
  config.ts                Model + AI Gateway settings
  agent/                   Chat agent, system prompt, tools (one example), eval runner
  gov/                     Mock backend: routes (Hono), service logic, D1, personas, services
  knowledge/               Service facts + sources (verify!)
  shared/types.ts          Types shared with the frontend
frontend/                  React app (Vite)
evals/                     Test scenarios + runner
test/                      Backend unit tests (vitest)
docs/TECHNICAL.md          Skeleton for your technical documentation
```

## Useful docs

- Agents SDK: https://developers.cloudflare.com/agents/
- Hono on Workers: https://hono.dev/docs/getting-started/cloudflare-workers
- Workers AI models: https://developers.cloudflare.com/workers-ai/models/
- D1: https://developers.cloudflare.com/d1/
- AI Gateway: https://developers.cloudflare.com/ai-gateway/

# Laufzettel · oesterreich.gv.at 2030

**"The offices walk. You don't."** / *"Die Ämter laufen. Sie nicht."*

Our entry for the challenge **"Digital Assistants: Evolution to 2030 (Public Sector)"** of the Federal
Chancellery (Austrian Startup Summit 2026 Hackathon, Challenge 3).

## The core idea

Today the citizen is the courier between offices: forms in Amtsdeutsch, data the state already has,
deadlines nobody mentions. The assistant of 2030 is **not a chatbot**. It is the **Laufzettel**, the old
Austrian routing slip, and in 2030 it walks by itself:

1. **Proactive, not reactive.** The state notices a life event (here: the landlord confirms a move) and
   puts an official notice on the citizen's desk: what to do, the legal deadline, the days left.
2. **The offices fill in what they know.** Row by row the registers and the landlord stamp the slip,
   narrated in one short official sentence per step, with subtitles. German official terms keep their
   German pronunciation inside English speech.
3. **The citizen only answers what nobody else knows.** Two questions, by voice (dialect welcome), tap
   or keyboard. Every official term comes with plain words.
4. **Only the citizen signs.** Hold the red seal to submit. The AI has no submit, book or pay tool.
5. **Gipfelstempel: nudging and gamification.** Austrians collect summit stamps when they hike. Here
   every finished errand is a summit: its engraved emblem fills up while the offices stamp, lands with a
   soft thump, and is collected in a personal pass together with the time you kept. Make it cool, make
   it fun, and fair: voluntary, private, only positive, only official errands.

Letters are explained too: during the demo a parking fine arrives in the mailbox, shown as the German
original next to plain words (what happened, deadline, what if you do nothing, what if you disagree)
and linked to the move (with the new Hauptwohnsitz you can get a Parkpickerl).

## The two-minute demo

Persona **Lena Huber** (default), English, German one click away (top right).

1. **Desk:** the official notice "Register your new address", deadline with days left, the route
   (6 rows by the offices, 2 questions, your seal). Press **Start this slip**.
2. **Slip:** watch the stamps land and listen. Answer "Main residence".
3. **Mailbox:** a parking fine arrives. Open it, read the plain words, pay (simulated) or "Later".
4. **Sign:** answer the last question, hold the seal. The confirmation shows the reference number,
   everything that was submitted, the Gipfelstempel and the time kept. **Save as PDF** prints it.
5. **Back at the desk:** the earned Gipfelstempel, the new residence on file, the unpaid fine waiting.

Other personas (profile menu, top right): Josef Gruber (78, dialect, passport), Thomas Berger
(childcare benefit), Amira Haddad (residence permit, English), David Novak (no address on file).
Try typing on the desk, e.g. *"I bin grad nach Wien zogn"* or *"How much does a new passport cost?"*.

## Run it locally (for tutors and the jury)

You need **Node.js 20+** and **pnpm** (`npm i -g pnpm`).

```bash
git clone https://github.com/ThePrideStalkerCS/hackathon.git
```

```bash
cd hackathon && pnpm install
```

**Option A, no account needed (recommended for a quick look):** the whole walkthrough works (desk,
slip, stamps, mailbox, signing, confirmation, both languages). Only free text on the desk needs the AI.

```bash
pnpm dev:offline
```

**Option B, with the AI (Workers AI on Cloudflare):** log in with a Cloudflare account that has Workers
AI. `wrangler.jsonc` names our team account; use your own by setting its id first.

```bash
npx wrangler login
```

```bash
export CLOUDFLARE_ACCOUNT_ID=<your-account-id>
```

```bash
pnpm dev
```

Then open **http://localhost:5173**. The demo data resets with
`curl -X POST http://localhost:5173/api/gov/admin/reset` (or "Start over" in the profile menu).

**Voice:** without a key the browser's built-in voice reads the narration. For the ElevenLabs voice,
copy `.dev.vars.example` to `.dev.vars` and add `ELEVENLABS_API_KEY` (never commit that file; it is
git-ignored). On a deployed worker the key is a secret: `npx wrangler secret put ELEVENLABS_API_KEY`.

**Blank page after an install?** Stop the server, delete `node_modules/.vite`, start again.

## How it answers the brief

| The brief asks for | Where it is |
|---|---|
| Colloquial and dialect input | say-it line and voice answers; a keyword router and answer extraction run before the model |
| Plain language | every row shows the official term and plain words; letters show the original next to plain words |
| Guide through multi-step forms, verify prerequisites | the slip: requirements row, rows from registers and the landlord, questions, seal |
| Structured administrative output | confirmation with reference number, authority, date, all submitted data, PDF |
| Proactive assistance | notice from the landlord's confirmation with the legal deadline; letters arrive on their own |
| German and English, accessibility | switch in the top bar; captions for all speech, keyboard only (hold Space to sign), large targets, text size, reduced motion, phone layout |
| Human contact point | "Talk to a person" in the top bar, on the notice and in letters; the handoff carries the current step |
| Guardrails | no submit or pay tool for the AI, server-side validation, facts with source links, tools scoped to the logged-in citizen |
| Pre-announced cases | change of residence, passport renewal, childcare benefit; combined requests queue a second slip |

## Documentation

| Deliverable | File |
|---|---|
| Strategy (vision, personas, value proposition, framework) | [docs/STRATEGY.md](docs/STRATEGY.md) |
| Technical documentation (architecture, data and APIs, AI design, guardrails, limitations, setup) | [docs/TECHNICAL.md](docs/TECHNICAL.md) |
| Design and demo script | [docs/DESIGN.md](docs/DESIGN.md), brand book [docs/brand-book.html](docs/brand-book.html) |
| Engine invariants | [docs/CORE.md](docs/CORE.md) |
| Test results | [docs/TEST-RESULTS.md](docs/TEST-RESULTS.md) |
| Pitch (2 minutes, PowerPoint) | [docs/pitch/Laufzettel-Pitch.pptx](docs/pitch/Laufzettel-Pitch.pptx) |

## Tests

```bash
pnpm test
```

```bash
pnpm evals
```

`pnpm test` runs the unit tests (walkthrough engine, router, voice runs; no AI). `pnpm evals` needs
`pnpm dev` running and writes `test-results/report.md` (dialect, combined requests, prompt injection,
no false "submitted", out of scope).

## Architecture in one picture

```
Browser (React, Vite)        Desk (official notice) · Laufzettel (rows, stamps, seal) · captions · mailbox
   │  WebSocket (Agents SDK): state sync + @callable methods + chat stream
   ▼
CitizenAssistant (Durable Object, one per session)
   ├── walkthrough engine (src/walkthrough, pure, unit tested) ──► gov service layer (src/gov) ──► D1
   ├── router + answer extraction (deterministic, before the LLM)
   └── Workers AI @cf/zai-org/glm-4.7-flash via AI Gateway (tools, no submit tool)

/api/gov/*     mock e-government REST API (Hono)
/api/voice/*   ElevenLabs TTS/STT, key server-side; browser speech as fallback
```

Cloudflare: Workers, Agents SDK (Durable Objects + SQLite), Workers AI, AI Gateway, D1, Static Assets.
Deploy with `pnpm run deploy`.

### The mock API

Base URL `/api/gov`, every endpoint accepts `?lang=de|en` and `?simulate=slow|error`.

| Method | Path | |
|---|---|---|
| GET | `/citizens` · `/citizens/:id` | personas, full profile |
| GET | `/citizens/:id/mail` | the citizen's letters (the parking fine) |
| GET | `/services` · `/services/search?q=` · `/services/:id` | services, search, facts and form fields |
| GET | `/services/:id/eligibility?citizenId=` | eligibility check |
| GET | `/services/:id/appointments` | free slots (passport) |
| POST | `/appointments/:slotId/book` | book a slot (only on the citizen's signature) |
| POST · PATCH | `/applications` · `/applications/:id` | draft application, prefilled |
| POST | `/applications/:id/submit` | validates server-side, returns the reference number |
| POST · GET | `/handoffs` | human handoff tickets |
| POST | `/admin/reset` | reset the demo data |

### Project structure

```
src/
  agent/        Durable Object agent, system prompt, router, tools, eval runner
  walkthrough/  engine (pure), controller (I/O), hand-written guides, proactive suggestions
  gov/          mock backend: routes, service logic, D1, personas, services, letters
  knowledge/    service facts with source URLs (verified on oesterreich.gv.at)
  voice/        ElevenLabs TTS/STT
  shared/       types and helpers shared with the frontend
frontend/       React app: laufzettel/ (Desk, Slip, CaptionBar, HoldSeal, Postfach), brand/
evals/          AI scenarios + runner
test/           unit tests (vitest)
docs/           strategy, technical documentation, design, test results, pitch
```

*All people and data are fictional. Service rules are simplified. The online passport photo is a 2030
concept. Paying in the mailbox is simulated.*

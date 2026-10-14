# Redesign brief: rethink the citizen experience

> **Update 15 Oct 2026: the direction is decided.** Paul chose the **Laufzettel** (routing slip) concept and its
> corporate identity. Build it as described in [LAUFZETTEL.md](LAUFZETTEL.md); the brief below is the background.

You are taking over the **redesign and rethinking of the user experience** of our hackathon project.
The engine underneath works and is tested. The experience on top does not win yet. Your job is to make
it the most memorable, credible and inclusive government experience in the room, without it looking
like a chatbot, a prototype, or generic "AI design".

**Be bold.** We do not want another polished variation of what exists. We want a genuinely new
interaction idea that makes a jury say "that is how the state should work in 2030".

---

## Read first, in this order

1. [challenge-brief.md](challenge-brief.md): the official challenge ([PDF original](challenge-brief.pdf)). Read all of it, especially the jury criteria.
2. This file.
3. [../CORE.md](../CORE.md): how the engine works and the invariants you must not break.
4. [../../AGENTS.md](../../AGENTS.md): setup rules and traps.
5. [previous-iterations/](previous-iterations/): what we already tried and rejected (open the HTML files in a browser).

---

## The challenge in one minute

- Federal Chancellery challenge "Digital Assistants: Evolution to 2030 (Public Sector)".
- Show how a 2030 assistant understands **colloquial input** (dialect, typos, half sentences), translates **Amtsdeutsch into plain language**, and **guides citizens through public service workflows**, for everyone, regardless of age, language or digital literacy.
- Jury weights: **end-to-end journey and UX 35 %**, **innovation, conversational design and accessibility 25 %**, accuracy 20 %, uncertainty and guardrails 10 %, robustness and polish 10 %. Sixty percent of the score is experience and innovation. That is your part.
- Announced test cases: **passport renewal, change of residence, childcare benefit**. Unannounced: combined requests, noisy input, incomplete data, non-standard residency.
- Must: German and English, accessibility for all, a human contact point.
- The challenge explicitly asks for "innovative interaction patterns and novel approaches that radically simplify administrative workflows".

---

## What already works (keep it, build on it)

| Part | Where | What it gives you |
|---|---|---|
| Walkthrough engine | `src/walkthrough/engine.ts`, `controller.ts`, `guides.ts` | Turns a service + the citizen's data into steps: intro, prerequisite check, autofill or question per field, appointment, review, done. Pure, deterministic, unit tested. |
| Agent + live state | `src/agent/citizen-assistant.ts` | One Durable Object per session. The walkthrough lives in the agent state and syncs to the browser. The browser acts only through `@callable()` methods: `advance`, `back`, `goTo`, `answer`, `editField`, `chooseSlot`, `submit`, `startWalkthrough`, `startNext`, `closeWalkthrough`, `requestHuman`, `updateSettings`, `getOverview`, `getSuggestions`. |
| Understanding input | `src/agent/router.ts`, `engine.extractAnswer`, LLM tools | Dialect-aware routing and language detection, dates / yes-no / choices taken from free speech without the LLM, LLM for everything else. |
| Voice | `src/voice/elevenlabs.ts`, `frontend/voice.ts` | ElevenLabs TTS + STT through the Worker, browser speech as fallback, watchdog so playback never freezes. |
| Proactive + rewards data | `src/walkthrough/proactive.ts`, `overview.ts`, `src/shared/stamps.ts` | "Your passport expired" suggestions, life areas, time saved per errand (labelled estimates), stamps per finished errand. |
| Human handoff | `requestHuman` | Ticket with the exact step and everything filled so far. |
| Languages | `frontend/i18n.ts`, guides | English is the default. DE/EN switch in the top bar; switching mid-walkthrough rebuilds the walkthrough and keeps the answers. |
| Deliberate submit | `frontend/walkthrough/HoldToConfirm.tsx` | Hold to submit. The AI has no submit tool. |
| Tests | `test/`, `evals/` | 24 unit tests, 9 AI scenarios. |

The **visual layer is yours to replace completely**: `frontend/styles.css`, `frontend/App.tsx` layout,
`frontend/components.tsx`, `frontend/reward.tsx`, `frontend/walkthrough/*.tsx`, `frontend/icons.tsx`.
Keep the data flow (agent state in, callables out).

---

## What we tried, and why it failed

Learn from this. Each step fixed the previous complaint and created a new one.

| # | Version | Feedback |
|---|---|---|
| 1 | Starter template: a chat window | "Standard chatbot." |
| 2 | Simulated portal + explanation side panel + video timeline, 2015 government look | "Looks like 2015", too many buttons. |
| 3 | Portal as main window, violet glowing orb, glass dock with captions | "Looks like AI." |
| 4 | Sober official look: ink on white, red-white-red | Jury: **"ernüchternd"** (underwhelming). |
| 5 | "Glasraum": dark frosted glass, light effects, life-areas ring, paper "Stempelpass" with ink stamps, hold-to-submit (current code on this branch) | "Too fancy and AI basic." The stamp pass felt bolted on. The bottom dock and the big input still felt like a chatbot. |
| 6 | Mockups A/B/C ([02-without-chat-window.html](previous-iterations/02-without-chat-window.html)): **A narrated page** (subtitles like TV + push-to-talk + answers inside the form), B search box, C margin notes | **A was closest**, but still "AI bullshit". |

The lesson: **decoration does not solve it.** Neither "plain and official" nor "futuristic and shiny"
is the answer. What is missing is a real interaction idea with a crafted, specific identity.

---

## Non-negotiables

1. **No chatbot window.** No chat bubbles, no conversation history panel, no "ask me anything" box as the centrepiece, no floating assistant avatar or orb.
2. **The citizen's task is the main surface.** The official process and its result are in front, not the assistant.
3. **English for the showcase, German switchable everywhere.** Everything, including narration, follows the switch. Built so more languages can be added (Turkish, BCS, Ukrainian, Arabic with RTL are realistic next ones).
4. **Must not look like a prototype.** No "simulation", "mock", "demo" or "beta" labels in the main UI. Real content, no placeholders, no unfinished corners. One small factual footer line ("Concept demo … fictional data") stays, so a deployed page cannot be mistaken for an official one.
5. **Official and trustworthy.** Brand: "oesterreich.gv.at 2030" wordmark with red-white-red. Do **not** use the real Federal Chancellery logo or the federal coat of arms (legally protected, Wappengesetz) unless the team gives you the asset and permission.
6. **Inclusive for real.** It must work for Josef (78, low digital literacy, hard of hearing, Upper Austrian dialect): voice in and out, captions for everything spoken, large targets (44 px+), keyboard only, screen reader, strong contrast, text size, reduced motion.
7. **A human is always one step away**, and the person sees where the citizen stopped.
8. **Only the citizen submits.** Keep hold-to-submit or design a better deliberate confirmation. Never give the AI a submit or booking tool.
9. **Fair nudging.** We reward finishing tedious errands ("zach"). Rules: voluntary, private (no ranking of people, no comparison), only positive (never a penalty), only official errands (never everyday behaviour), openly explained. Rewards belong **inside the official flow** (time saved, a seal or stamp on the confirmation), not in a separate game.
10. **The three announced cases work end to end in English** in the demo, plus at least one combined request.

---

## "AI bullshit": what to avoid

These signals made earlier versions look generated. Most of them are in the current code; remove them.

- Glowing orbs, gradient blobs, aurora backgrounds, glassmorphism, neon glow, light trails.
- Violet/blue gradients, sparkle icons, "magic" wording.
- Chat bubbles, typing dots as the main feedback, an assistant avatar or mascot.
- Generic SaaS layout: centred hero, giant input field, three cards below.
- Pills and rounded cards with soft shadows everywhere, everything the same radius.
- "Startup" typefaces (Inter, Space Grotesk, Sora, Manrope, …) used without intent.
- An assistant that talks too much ("Sure! I'll now show you step by step …").
- Motion without meaning.

Specific beats generic. The real world of Austrian administration is full of material nobody has used
in a digital product: the **Laufzettel**, the **Amtsstempel**, the **Meldezettel**, **Parteienverkehr**,
the **Amtstafel**, the **Bezirk**, the ticket number on the wall of the Magistrat, the counter window.
Use the real world, reinterpret it for 2030.

---

## The innovation mandate

Deliver **one signature interaction** that a jury member remembers after ten seconds and can describe
in one sentence to a colleague. It must make the 2030 idea obvious: **the state already knows, the
citizen confirms instead of filling in, the process explains itself, the state comes to the citizen.**

Starting points. Explore them, combine them, or beat them:

- **Narrated page** (team favourite so far): the official process plays like a video while the citizen watches; subtitles instead of chat; push-to-talk; answers inside the form. Make it feel like a crafted film, not like a UI with captions.
- **Zero form, confirm only:** the application assembles itself from the registers, every value shows where it came from; the citizen only decides what nobody can know.
- **Life events, not services:** the citizen starts from "you moved" or "Emma was born", not from a list of authorities.
- **Live third parties:** the landlord confirms the registration with one tap on their phone; show it live on a second screen in the demo.
- **Both sides of the counter:** a Magistrat view where clean cases go through automatically and exceptions reach a person who can join the citizen's session live. The challenge asks for impact on the administration too.
- **The phone line:** the same walkthrough as a real voice call for people without a smartphone.
- **The camera:** hold up the expired passport or an official letter, it is understood and explained.
- **District coalitions** (idea from 42 school): everyone belongs to their Bezirk; finished errands count for the district's shared goal; aggregates only, no ranking of people. See the mockup in [02-without-chat-window.html](previous-iterations/02-without-chat-window.html).

Design the **2-minute demo story** together with the concept. The demo video is a deliverable.

---

## How to work

1. **Run it first.** `pnpm dev` (needs `npx wrangler login`) or `pnpm dev:offline` (no Cloudflare login, everything except the AI chat). Click through all three cases as Josef, Lena and Thomas, in English and German, on desktop and phone width.
2. **Propose before you build.** Bring 2–3 concepts at sketch level: one key screen each, the signature interaction in one sentence, the 2-minute demo story. Get a decision from Paul. Do not polish before the direction is agreed.
3. **Build on the engine.** Replace the visual layer, keep the callables and the agent state. If you need new engine behaviour (for example a landlord confirmation), add it to the engine with a test in `test/walkthrough.spec.ts`.
4. **Verify like a user.** `npx tsc --noEmit`, `npx tsc --noEmit -p frontend/tsconfig.json`, `pnpm test`, `pnpm evals` (needs login), then click through in a real browser: desktop and phone, EN and DE, keyboard only, with the voice on.
5. **Document.** Update the design principles in `docs/CORE.md` and the demo story in `docs/TECHNICAL.md`.

### Practical notes

- **Start from branch `feature/glass-design`.** It has English as default, the language switch, the rewards data (`getOverview`), hold-to-submit and `pnpm dev:offline`. Its visual style ("Glasraum") is exactly what you should replace.
- **Demo personas** (pick one in the profile menu):

  | Persona | Use it for |
  |---|---|
  | Lena Huber | Moving from Graz to Vienna (main case), colloquial German |
  | Josef Gruber, 78 | Expired passport, low digital literacy, dialect, hard of hearing |
  | Thomas Berger | Newborn daughter Emma, childcare benefit |
  | Amira Haddad | Non-EU residence permit, childcare benefit, combined requests, English |
  | Sofia Rossi | EU citizen moving within Vienna, English |
  | David Novak | No registered address, incomplete data |

- **Reset demo data:** `curl -X POST http://localhost:5173/api/gov/admin/reset`
- **Voice:** the ElevenLabs key lives in `.dev.vars` (git-ignored, never commit it). Without it the browser voice is used.
- **Do not upgrade dependencies** and keep the default model unless the team agrees (see AGENTS.md).
- **Commits:** no AI attribution lines. No "Co-Authored-By" for an AI, no "Generated with". The team's names only.

---

## Done when

- [ ] A jury member can describe the signature interaction in one sentence.
- [ ] Nothing on screen reads as a chat window, a prototype, or generic AI design.
- [ ] Passport renewal, change of residence and childcare benefit work end to end in English, plus one combined request.
- [ ] Every screen works in German after one tap on the language switch.
- [ ] Josef can do his passport with voice only; keyboard-only and screen reader work.
- [ ] A person is reachable from every screen.
- [ ] Rewards (time saved, seal or stamp) are part of the official confirmation and follow the five nudging rules.
- [ ] Type checks, unit tests and evals pass.
- [ ] A 2-minute demo story is written down in `docs/TECHNICAL.md`.

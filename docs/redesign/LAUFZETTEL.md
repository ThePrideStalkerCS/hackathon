# Laufzettel: the chosen design (build status and handoff)

**Decision (15 Oct 2026, Paul):** the experience is rebuilt as the **Laufzettel**, the Austrian routing
slip that you used to carry from office to office. In 2030 it walks by itself: the offices stamp it in
the background, the citizen watches the stamps land and only answers what nobody else can know, then
signs with their own seal.

> **Signature sentence for the jury:** "The offices walk. You don't." / "Die Ämter laufen. Sie nicht."

This file is the single source of truth for the redesign. **If you are the next agent, read this file
first, then continue at the first unchecked box in [Build checklist](#build-checklist).** Update the
checkboxes as you go, so the agent after you knows where to start.

## Reference material

| What | Where |
|---|---|
| Brand book (logo, colours, type, stamps, patterns, voice, motion, applied screens). Open in a browser. | [laufzettel-ci.html](laufzettel-ci.html) |
| Same brand book as a private claude.ai artifact (Paul's account) | https://claude.ai/artifact/6TaYVK7qPWH7LYjcJqZJ4v |
| The three start-page proposals Paul chose from (Brief, Laufzettel, Aufruf) | [previous-iterations/03-brief-laufzettel-aufruf.html](previous-iterations/03-brief-laufzettel-aufruf.html) |
| Full brief, history of rejected designs, non-negotiables | [README.md](README.md) |
| Engine invariants (do not break) | [../CORE.md](../CORE.md) |

`signature-concepts-live.html` in this folder is an older exploration from someone else. It was **not** chosen.

## The identity in one page

- **Mark ("Wegmarke"):** the flag read as a route. Red, white, red in thirds; the white band carries a red
  line with three stations: two filled (done), one open (waiting). Only red and white. Never rotated,
  no gradient, no shadow. No federal coat of arms, no Chancellery logo (Wappengesetz).
- **Lockup:** mark + "Laufzettel" (Archivo, width 125, weight 900) + endorsement "oesterreich.gv.at 2030" (mono).
- **Colours have meaning** (this is the core rule, keep it strict):
  | Token | Hex | Only for |
  |---|---|---|
  | `--rot` Staatsrot | `#C8102E` | the mark, the route line, the citizen's own seal |
  | `--tinte` Tinte | `#12152A` | text, rules, buttons |
  | `--papier` Papier | `#FFFFFF` | the slip and every document |
  | `--pult` Pult | `#EEF0F4` | the desk behind the paper (page background) |
  | `--stempel` Stempelblau | `#2A44B0` | **stamps only**: "an office has done this" |
  | `--marker` Marker | `#FFE45C` | **only behind text**: "this needs you". At most once per screen |
- **Type:** Archivo (Google Fonts, variable width 62 to 125). Width 125 for titles, 100 for text (never
  under 17 px), 62 to 75 uppercase for stamps and labels. Martian Mono for reference numbers and dates.
- **Stamps:** blue, one fixed shape per kind of office (round = register/Meldeamt, rectangle = Magistrat,
  octagon = check/Finanzamt, oval = social insurance, ticket = third parties like the landlord). Red round
  stamp with initials = the citizen's own seal, only after they signed.
- **The seal (reward):** a guilloche rosette (security print like on passports). One ring per station;
  each stamp turns a ring red. Complete, it is printed on the confirmation together with "time you kept".
- **Patterns:** guilloche band at the head of documents, perforated left edge on the slip, yellow marker
  swipe behind the one question that needs the citizen, red route line (solid = done, dashed = ahead).
- **Motion:** only three, each reports an event: stamp press (420 ms), marker swipe (700 ms), seal ring.
  `prefers-reduced-motion` shows the end state immediately.
- **Voice of the texts:** plain language, one thought per sentence, always say what happens next, name
  the office. "Sie" in German, "you" in English. No exclamation marks.
- **Light only.** The identity is paper and ink; the old dark "Glasraum" theme is gone.

## How the engine maps onto the slip

Nothing in the engine changes. The slip is a different *view* of the same `Walkthrough`
(`src/shared/walkthrough.ts`). The mapping lives in `frontend/laufzettel/stations.ts`.

| Walkthrough step | Station (row) on the slip | Stamp when done |
|---|---|---|
| `intro` | not a row; its narration plays as the first caption | none |
| `check` | "Requirements" row with the check results | octagon "CHECKED" |
| `autofill` (source `profile`) | field row, value shown, "from the register" | round "FILLED", ring text = register |
| `autofill` (source `assistant`/`draft`) | field row, value shown | ticket "PREFILLED" |
| `ask` | field row, the question with the **marker**, inline answer (Coach widgets) | rectangle "RECEIVED" |
| `appointment` | row with the slot picker | oval "RESERVED" |
| `review` | last row "You": hold-to-sign seal (`HoldToConfirm` logic, only the citizen submits) | red seal with initials "SIGNED" |
| `done` | the slip turns into the **confirmation document** with the full seal | |
| `blocked` | row with dashed red frame "Stopped here" and the human handoff | none |

- Seal count = stations with `done`; total = number of stations.
- The current step's row is highlighted; rows after it are "pending" (dashed route line).
- Playback is unchanged (App.tsx playback loop): autofill steps play by themselves, so the citizen
  watches the stamps land one by one while the caption bar narrates.
- Combined requests (`state.queue`) appear on the confirmation as "Next slip".

## File map of the new UI

| File | What it is |
|---|---|
| `frontend/brand/brand.css` | tokens + all Laufzettel styles (loaded after the old `styles.css`) |
| `frontend/brand/print.ts` | pure canvas drawing: seal rosette, guilloche band |
| `frontend/brand/Brand.tsx` | `Mark`, `Lockup`, `Stamp` (SVG), `Seal`, `Band`, `InkFilter` |
| `frontend/laufzettel/stations.ts` | walkthrough → stations mapping (pure) |
| `frontend/laufzettel/Slip.tsx` | the Laufzettel view of a running walkthrough + confirmation |
| `frontend/laufzettel/Desk.tsx` | the start page ("your desk"): open slips from suggestions, say-it line, finished slips, time kept |
| `frontend/laufzettel/CaptionBar.tsx` | narration subtitles + talk dots + pause/replay + keyboard + mic |

Old visual layer, still in the repo but no longer used by the main flow once the checklist is done:
`frontend/walkthrough/Portal.tsx`, `Progress.tsx`, `frontend/reward.tsx` (AmtsRing, StampPass), the glass
parts of `styles.css`. Delete them only after the new flow is verified (last box of the checklist).
`Coach.tsx` stays: its `AskInput` and `SlotPicker` are reused inside the slip rows.
Elizaveta's goals pages (`frontend/goals/*`, `#/goals`) still use the old styles; restyle them in the
Laufzettel look or fold them into the desk (open question for the team).

## Build checklist

Keep this list honest: tick only what is done **and** checked in the browser.

- [x] 1. Fonts (Archivo + Martian Mono) in `index.html`, light only (`data-theme="paper"`), `brand.css` with tokens
- [x] 2. Brand components (`Mark`, `Lockup`, `Stamp`, `Seal`, `Band`, `InkFilter`) + canvas drawing (`print.ts`)
- [x] 3. Top bar: lockup, "Talk to a person", goals link, EN/DE, profile menu (theme switch removed from the app, still optional in `ProfileMenu`)
- [x] 4. `stations.ts` mapping + `Slip.tsx` running walkthrough (rows, stamps, marker, inline answers via Coach's `AskInput`/`SlotPicker`)
- [x] 5. Hold-to-sign row (`HoldSeal.tsx`) → `submit`; confirmation document with full seal, red citizen stamp, reference number, time kept, next steps, next slip button
- [x] 6. `CaptionBar` replaces the dock (captions, talk dots, pause, replay, keyboard, mic)
- [x] 7. `Desk.tsx` start page: greeting, open slips (suggestions), say-it line, examples, stamps on file, time kept
- [x] 8. i18n: all new texts in EN and DE (`lz*` and `stamp*` keys in `frontend/i18n.ts`)
- [ ] 9. Verify in the browser: **done on 15 Oct:** passport (Josef) end to end on desktop incl. hold-to-sign and confirmation; childcare (Thomas) in German at phone width (390 px, no horizontal scroll) up to the first question. **Still to do:** change of residence (Lena, needs the AI chat, so run `pnpm dev` with a valid `npx wrangler login`), childcare to the end, keyboard only, screen reader
- [x] 10. Type checks (Worker + frontend) clean, `pnpm test` 24/24 green (15 Oct)
- [ ] 11. Remove the unused old layer and update `docs/CORE.md` design principles. No longer imported by the app: `frontend/walkthrough/Portal.tsx`, `Progress.tsx`, `HoldToConfirm.tsx`, `frontend/reward.tsx`, and in `components.tsx` `Dock` + `CommandBar`. `VoiceMark` is still used by `Coach.tsx` (card header, unused in the slip) and `goals/shared.tsx`. `reward.tsx` and `HoldToConfirm.tsx` are not committed yet: commit or delete deliberately. Then strip the glass rules from `styles.css` (keep what Coach widgets, ProfileMenu, HandoffSheet, AddressInput and goals need)
- [ ] 12. Optional: Bezirk coalition card (aggregates only, voluntary), landlord confirmation as a live third party, lock-screen style notification

### Known issues found while verifying (fix in this order)

1. **Appointment office does not match the citizen:** Josef lives in Linz but the mock slots are "Passbehörde Wien – Bezirksamt Mitte". Slots come from the mock backend (`src/gov/`); pick offices by the citizen's postcode.
2. **Narration has exclamation marks** ("Done! Your application has been submitted."). The brand voice has none; fix the texts in `src/walkthrough/guides.ts` / the engine phrases.
3. **Lena's case starts only through the free-text line** (no proactive suggestion), so it needs the AI. Consider a proactive "You moved?" suggestion from the landlord confirmation or the ZMR, which would also be the stronger 2030 story.
4. The goals pages (`#/goals`, Elizaveta) still use the old look.
5. A check line says "Hinweis: Diese Prüfung ist im Prototyp vereinfacht" (childcare). The brief forbids prototype labels in the main UI; reword it in the engine/service rules.
6. Nothing of this is committed yet (branch `feature/glass-design`, many uncommitted files). Ask Paul before committing or pushing; the repo is public. No AI attribution lines in commits.

### How to verify without clicking by hand

A headless Chrome driver was used: start Chrome with `--remote-debugging-port`, then send DevTools commands over the WebSocket (click with `Runtime.evaluate`, capture with `Page.captureScreenshot`). In headless Chrome the audio cannot play without a user gesture; the narrator falls back to reading time, so playback still advances.
If the page stays blank and `document.readyState` is stuck at `interactive`, the Vite dependency cache is stale: stop the dev server, `rm -rf node_modules/.vite`, start again.

## Rules that still apply

- Only the citizen submits (hold-to-sign). The AI has no submit or booking tool.
- No chat window, no bubbles, no orb, no glass, no gradients, no sparkles.
- English is the showcase language; every text also in German.
- A person is reachable from every screen ("Talk to a person" in the top bar and on blocked rows).
- Fair nudging: voluntary, private, only positive, only official errands, explained openly.
- Commits carry only the team's names: no "Co-Authored-By" for an AI, no "Generated with" lines.
- Facts (deadlines, plates, amounts) must be verified on oesterreich.gv.at before the demo.

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
| Brand book v1 (logo, colours, type, stamps, patterns, voice, motion, applied screens). Open in a browser. **Identity v2 below overrides it** where they differ (type, forms, stamps, seal). | [laufzettel-ci.html](laufzettel-ci.html) |
| Same brand book as a private claude.ai artifact (Paul's account) | https://claude.ai/artifact/6TaYVK7qPWH7LYjcJqZJ4v |
| The three start-page proposals Paul chose from (Brief, Laufzettel, Aufruf) | [previous-iterations/03-brief-laufzettel-aufruf.html](previous-iterations/03-brief-laufzettel-aufruf.html) |
| Full brief, history of rejected designs, non-negotiables | [README.md](README.md) |
| Engine invariants (do not break) | [../CORE.md](../CORE.md) |

`signature-concepts-live.html` in this folder is an older exploration from someone else. It was **not** chosen.

## Identity v2: warm paper (15 Oct, Paul's course correction)

v1 read as too basic, angular and machine-made. v2 keeps the idea (paper, ink, stamps, one seal) and
changes the hand: organic forms, warmth, character, calm whitespace. Paul's v2 direction wins over the
brand book wherever the brand book caused the angular look.

- **Paper, not a dashboard.** Warm paper (`--papier #fffdf7`) on a warm desk (`--pult #f1ebdf`), a faint
  paper grain, slips with 28 px rounded corners and a soft paper shadow. No grid of identical cards: the
  desk has **one** open slip (big), further suggestions as quiet lines, then the private collection.
- **Type with personality.** Fraunces (soft axis on) for titles, the stamp words and numbers that matter;
  Atkinson Hyperlegible Next for all running text (never under 17 px in the slip); Atkinson Hyperlegible
  Mono only for slip and reference numbers. Labels in sentence case. Mono uppercase labels are gone.
- **Colours keep their meaning** (unchanged rule, slightly warmer values):

  | Token | Hex | Only for |
  |---|---|---|
  | `--rot` Staatsrot | `#C8102E` | the mark, the route line, the citizen's emblem and seal |
  | `--tinte` Tinte | `#1f2333` | text, buttons |
  | `--papier` Papier | `#fffdf7` | the slip and every document |
  | `--pult` Pult | `#f1ebdf` | the desk behind the paper |
  | `--stempel` Stempelblau | `#2A44B0` | **office stamps only**: "an office has done this" |
  | `--marker` Marker | `#FFE45C` | **only behind the one question** that needs the citizen. At most once per screen |

- **Mark and lockup** unchanged (flag read as a route, no coat of arms); the word "Laufzettel" is set in Fraunces.
- **Phones: the question gets the screen.** Top bar on one row (below 480 px the mark alone is the
  home button; "Talk to a person" keeps a short visible word, "A person" / "Beratung"); the sticky slip
  head is one line; the captions keep to two lines while the citizen answers or signs; the current row
  starts below the sticky heads when it is taller than the room left. On the desk card the emblem sits
  small beside the title and the text runs full width.
- **Motion:** stamp press, marker swipe, wreath leaf inking, emblem press when complete. Nothing else
  moves. `prefers-reduced-motion` shows the end state.
- **Voice:** plain language, one thought per sentence, say what happens next, name who did it (the
  register, the office, the landlord, never "I'm entering it"). "Sie" in German. No exclamation marks.
- **Light only.**

## Emblems and stamps: the design system

Two kinds of marks, never mixed: **red** belongs to the citizen (their emblem and seal), **blue** to the
offices (stamps). Both look pressed by hand, both carry the motif of the life event, so all marks on
one slip belong together.

### The emblem (the citizen's seal for one errand)

`frontend/brand/Emblem.tsx`, drawings in `motifs.ts`, engraving geometry in `engrave.ts`.
Close-ups: `media/laufzettel/stamp-move.png`, `stamp-passport.png`, `stamp-child.png`; all sizes in
`emblems-all-sizes.png`.

| Life event (service) | Motif | Why |
|---|---|---|
| Move (`change-of-residence`) | **Stone pine (Zirbe)** with its dense upright crown on a rocky ridge, mountains behind; at 48 px a **young Zirbe**, still conical: three tiers to a point on a free-standing trunk | puts down roots in a new place, survives on rock |
| Passport (`passport-renewal`) | **Peaks with an ibex** on the shoulder, the **Danube** running towards you (at 48 px a thin winding line) | going out into the world, coming home |
| Child (`childcare-subsidy`) | **Edelweiss** with a bud, white against an engraved sky | a small new life, cared for |

No birds, no federal coat of arms, no protected logo. Add a motif in `motifs.ts` (`DRAW`, `motifFor`, a sprig).

Anatomy, from outside in:

1. **Hand-pressed edge:** an uneven circle (a few slow waves on the radius), one strong line.
2. **Wreath:** one leaf per station of the slip, two branches growing up from the bottom. A leaf is
   inked when its station is stamped, so the wreath fills as the offices walk. This is the only
   progress the emblem shows: no points, no levels.
3. **Slip number** small at the bottom, in the gap of the wreath. No microtext ring.
4. **Vignette:** the motif as an engraving inside a thin circle.

How the motifs are drawn (banknote engraving, not clip art):

- a strong silhouette first, then hatching **that follows the form** (lines bow over a rounded crown,
  run down the fall line on a rock face) and **swells from thin on the lit side to thick in shadow**;
- light always from the upper left; a few **solid ink shadows** (under each needle pad, in the gaps of
  the crown, in rock cracks); full-strength ink, no pale tints;
- burin lines are filled shapes (`swell`), not strokes, so they taper like a real cut;
- white forms (edelweiss bracts, snow) need ink around them: an engraved sky or a hatched face behind;
- the 48 px slip head gets a **solid silhouette** of the same scene (hatching would turn to mush).
  Check it for faces and figures: a round crown over a mountain line read as a head and shoulders,
  and a broad white river under the sun read as a mouth. Pointed, tiered, rooted shapes are safe;
- judged at 250 px (hero), 200 px (desk card, confirmation), 68 px (desk card on a phone) and 48 px
  (slip head). Close-ups of the small cut: `media/laufzettel/emblem-48px-*.png`.
- An emblem without a label is decorative (`aria-hidden`); give it a label where it is the only
  carrier of the progress (hero, sticky head once the hero has scrolled away, collection).

Where it appears: the slip hero (one big emblem; the small one in the sticky head fades in only once
the big one has scrolled away), the open slip on the desk (0 leaves inked), the confirmation (complete,
with the citizen's red seal pressed over its edge) and the private collection on the desk.

### Office stamps (blue)

`Stamp` in `frontend/brand/Brand.tsx`, specs from `frontend/laufzettel/stations.ts`. Specimen:
`media/laufzettel/office-stamps.png`.

- One shape per kind of office, all **hand-pressed** (superellipse outlines whose edge moves a little,
  plus the SVG ink filter for uneven ink):

  | Kind | Shape | Word |
  |---|---|---|
  | requirements check | soft rosette (scalloped circle), dotted inner ring | "Checked" / "Geprüft" |
  | central register (value from a register) | circle with the register's name around the edge | "Filled" / "Eingetragen" |
  | office prefilled a suggestion | pillow (soft rectangle), dotted inner line | "Prefilled" / "Vorbefüllt" |
  | third party confirmed (landlord) | pillow, dotted inner line, "Landlord · K. Steiner" | "Confirmed" / "Bestätigt" |
  | answer received from the citizen | rounded rectangle, solid inner line | "Received" / "Erhalten" |
  | appointment | ellipse, office name on top | "Reserved" / "Reserviert" |

- **Calm type:** the word in Fraunces 600, sentence case; office and date in Atkinson. No condensed
  black uppercase.
- **A sprig of the motif** on every office stamp: a pine twig with a cone, little peaks with the sun,
  a small edelweiss.
- Slightly rotated, a different angle per row, like stamps set by hand.

### The citizen's seal (red)

The last row of the slip is "You": hold the red seal with your initials for about a second to sign
(`HoldSeal.tsx`, mouse, touch, or hold Space/Enter). Only this submits. On the confirmation the red
round seal (initials in Fraunces italic, name, "Signed", reference number around the edge) is pressed
over the complete emblem.

## Fair nudging: how the slip carries it

The nudge is the slip itself: you see how little is left for you and how much the offices already did.

| Where | What the citizen sees |
|---|---|
| Desk, open slip | the reason in plain words ("Your landlord Karl Steiner confirmed that you moved…"), then "The offices fill in 6 of 9 rows. You answer 2 questions, then you sign. About 45 min you keep (estimate)." |
| Every slip screen | the sticky slip head: small emblem + "3 of 9 stamped · 2 answers left, then you sign · about 45 min you keep (estimate)"; on a phone one line, "3 of 9 · 2 left · about 45 min kept" (screen readers still get the full sentence) |
| Slip hero | "The seal only shows your progress. Only you see it. No points, no ranking." |
| Each row | the stamp of whoever did it, the narration names the same source |
| Confirmation | complete emblem, red seal, "time you kept" (labelled as an estimate) |
| Desk, collection | finished emblems and stamps on file, time kept in total: private, on this device |

Rules: **voluntary** (profile menu → "Show seal and time kept", stored on the device only; off hides
the emblems, the collection and the time line), **private** (nothing is compared with other people),
**only positive** (no streaks, no loss, no countdown pressure), **only official errands**, **explained
openly** (the line above, estimates labelled as estimates).

## How the engine maps onto the slip

Nothing in the engine's flow changes for the view. The slip is a different *view* of the same
`Walkthrough` (`src/shared/walkthrough.ts`). The mapping lives in `frontend/laufzettel/stations.ts`.

| Walkthrough step | Station (row) on the slip | Stamp when done |
|---|---|---|
| `intro` | not a row; the life event is the hero title, the narration plays as the first caption | none |
| `check` | "Requirements" row with the check results | rosette "Checked" |
| `autofill` (source `profile`) | field row, value shown, "From the register" | circle "Filled", register around the edge |
| `autofill` (source `confirmed`) | field row, "Confirmed by Karl Steiner" | pillow "Confirmed", "Landlord · K. Steiner" |
| `autofill` (source `assistant`/`draft`) | field row, value shown, "Suggested from your data" | pillow "Prefilled" |
| `ask` | field row, the question with the **marker**, inline answer (Coach widgets) | rectangle "Received" |
| `appointment` | row with the slot picker (offices in the citizen's region first) | ellipse "Reserved" |
| `review` | last row "You": hold-to-sign seal (only the citizen submits) | red seal with initials |
| `done` | the slip turns into the **confirmation document** with the complete emblem | |
| `blocked` | row "Stopped here" and the human handoff | none |

- Seal count = stations with `done`; total = number of stations.
- Playback is unchanged (App.tsx playback loop): autofill steps play by themselves, so the citizen
  watches the stamps land one by one while the caption bar narrates.
- Combined requests (`state.queue`) appear on the confirmation as "Next slip".
- Third-party confirmations (`src/gov/data/confirmations.ts`): Lena's landlord has confirmed the move.
  The proactive rule turns that into the open slip on her desk; the engine marks those fields as
  `confirmed` (the citizen's own answer always wins over them).

## File map of the new UI

| File | What it is |
|---|---|
| `frontend/brand/brand.css` | tokens + all Laufzettel styles (v1 layer, then the "v2 · warm paper" layer at the end) |
| `frontend/brand/Brand.tsx` | `Mark`, `Lockup`, `Stamp` (hand-pressed SVG + sprig), `Seal` (v1 rosette, unused now), `Band`, `InkFilter` |
| `frontend/brand/Emblem.tsx` | the citizen's emblem (edge, wreath, serial, vignette) |
| `frontend/brand/motifs.ts` | the engraved motifs, their 48 px silhouettes and the stamp sprigs (pure, cached) |
| `frontend/brand/engrave.ts` | engraving geometry: swelling lines, form-following hatching, organic outlines |
| `frontend/brand/print.ts` | canvas drawing: guilloche band (and the v1 seal rosette) |
| `frontend/laufzettel/stations.ts` | walkthrough → stations mapping (pure) |
| `frontend/laufzettel/Slip.tsx` | the Laufzettel view of a running walkthrough + confirmation |
| `frontend/laufzettel/Desk.tsx` | the start page ("your desk"): one open slip, further suggestions, say-it line, private collection |
| `frontend/laufzettel/CaptionBar.tsx` | narration subtitles (rolling; `compact` = two lines on phones while the citizen acts), talk dots, pause/replay, keyboard, mic |
| `frontend/laufzettel/HoldSeal.tsx` | hold to sign |
| `src/gov/data/confirmations.ts` | third-party confirmations (landlord) of the mock backend |
| `src/gov/data/offices.ts` | mock appointment offices with their region, `nearbyFirst` |

Old visual layer, still in the repo but no longer used by the main flow:
`frontend/walkthrough/Portal.tsx`, `Progress.tsx`, `frontend/reward.tsx` (AmtsRing, StampPass), the glass
parts of `styles.css`. `Coach.tsx` stays: its `AskInput` and `SlotPicker` are reused inside the slip rows.
Elizaveta's goals pages (`frontend/goals/*`, `#/goals`) still use the old styles.

## Build checklist

Keep this list honest: tick only what is done **and** checked in the browser.

- [x] 1. Fonts in `index.html` (v2: Fraunces, Atkinson Hyperlegible Next + Mono; Archivo kept for the v1 rules), light only, `brand.css` with tokens
- [x] 2. Brand components (`Mark`, `Lockup`, `Stamp`, `Band`, `InkFilter`) + canvas drawing (`print.ts`)
- [x] 3. Top bar: lockup, "Talk to a person", goals link, EN/DE, profile menu (with the seal switch)
- [x] 4. `stations.ts` mapping + `Slip.tsx` running walkthrough (rows, stamps, marker, inline answers via Coach's `AskInput`/`SlotPicker`)
- [x] 5. Hold-to-sign row (`HoldSeal.tsx`) → `submit`; confirmation document with complete emblem, red seal, reference number, time kept, next steps, next slip button
- [x] 6. `CaptionBar` replaces the dock (captions roll up while spoken, talk dots, pause, replay, keyboard, mic)
- [x] 7. `Desk.tsx` start page: greeting, one open slip, further suggestions, say-it line, private collection
- [x] 8. i18n: all new texts in EN and DE (`lz*` and `stamp*` keys in `frontend/i18n.ts`)
- [x] 9. Verified in the browser (15 Oct, 01:30 to 02:10 Vienna, own sessions, mock backend reset after each): Lena EN + DE desktop and EN at 390 px end to end incl. hold-to-sign and confirmation; Josef (passport, appointment) and Thomas (childcare, IBAN) EN end to end; Amira desk; keyboard only (Tab to the slip, focus lands on each question, hold Space on the seal signs). Screenshots in `media/laufzettel/`
- [x] 10. Type checks (Worker + frontend) clean, `pnpm test` 30/30 green, `pnpm evals` see the morning report
- [ ] 11. Remove the unused old layer and update `docs/CORE.md` design principles. No longer imported by the app: `frontend/walkthrough/Portal.tsx`, `Progress.tsx`, `HoldToConfirm.tsx`, `frontend/reward.tsx`, the v1 `Seal` + `drawSeal`, and in `components.tsx` `Dock` + `CommandBar`. `VoiceMark` is still used by `Coach.tsx` and `goals/shared.tsx`. Then strip the glass rules from `styles.css` (keep what Coach widgets, ProfileMenu, HandoffSheet, AddressInput and goals need) and fold the v1 rules of `brand.css` into the v2 layer
- [x] 12. Landlord confirmation as a live third party + proactive "Register your new address" slip on Lena's desk (engine test in `test/walkthrough.spec.ts`)
- [x] 13. Identity v2: warm paper, soft forms, Fraunces + Atkinson, sticky slip head with the nudge line, one open slip on the desk
- [x] 14. Engraved emblems per life event (pine, peaks, edelweiss) with 48 px silhouettes; wreath progress; serial at the bottom
- [x] 15. Hand-pressed office stamps with calm type and the motif sprig; calm hero (life event title, form name once, one big emblem)
- [x] 16. Seal and time kept can be switched off (profile menu, stored on the device)
- [ ] 17. Optional: Bezirk coalition card (aggregates only, voluntary), lock-screen style notification for the proactive slip
- [x] 18. Phones (design check 3): desk card stacked with a small emblem beside the title, top bar on one row with a short visible word for "Talk to a person", one-line slip head, two caption lines while the citizen acts, question title never under the sticky head. Checked at 390 px (EN, DE) and 360 px (DE), no horizontal overflow
- [x] 19. 48 px cuts that cannot read as a person: a conical young Zirbe, the passport river as a thin line, the edelweiss with bud and ground; the edelweiss full cut with an engraved sky. Decorative emblems hidden from screen readers

### Known issues (fix in this order)

1. The goals pages (`#/goals`, Elizaveta) still use the old look. Restyle in the Laufzettel look or fold into the desk (open question for the team).
2. Old layer still in the repo (checklist item 11).
3. Phones: the caption bar still takes about 125 px (two lines plus the button row). A "minimise captions" control, or the buttons beside the text on wider phones, would win another 50 px.
4. The German slip head wraps to two short lines at 360 px, and at 390 px on the signing step ("8 von 9 · Unterschrift · etwa 45 Min. / behalten"). Fine on those short rows, but a shorter German phrase would keep it on one. English stays on one line at 390 px on every step.
5. Below 480 px the word "Laufzettel" leaves the top bar (the mark stays as the home button), so a phone shows the name only on the desk and the confirmation.
6. Fixed on 15 Oct: appointment office by the citizen's postcode (Josef now gets Linz-Land first); exclamation marks and prototype labels in what the citizen hears; Lena's proactive slip; narration naming the register or landlord; caption text cut off mid-sentence (captions roll); the 2-column desk card on phones; the 48 px pine that read as a head and shoulders; the faint edelweiss.
7. Everything is committed locally on `feature/glass-design`, nothing pushed (the repo is public). No AI attribution lines in commits.

### How to verify without clicking by hand

A headless Chrome driver was used: start Chrome with `--remote-debugging-port`, then send DevTools commands over the WebSocket (click with `Runtime.evaluate`, capture with `Page.captureScreenshot`, press and hold with `Input.dispatchMouseEvent`). In headless Chrome the audio cannot play without a user gesture; the narrator falls back to reading time, so playback still advances. Signing submits into the shared mock backend: reset it afterwards with `POST /api/gov/admin/reset`.
If the page stays blank and `document.readyState` is stuck at `interactive`, the Vite dependency cache is stale: stop the dev server, `rm -rf node_modules/.vite`, start again.

## Rules that still apply

- Only the citizen submits (hold-to-sign). The AI has no submit or booking tool.
- No chat window, no bubbles, no orb, no glass, no gradients, no sparkles.
- English is the showcase language; every text also in German.
- A person is reachable from every screen ("Talk to a person" in the top bar and on blocked rows).
- Fair nudging: voluntary, private, only positive, only official errands, explained openly.
- Commits carry only the team's names: no "Co-Authored-By" for an AI, no "Generated with" lines.
- Facts (deadlines, plates, amounts) must be verified on oesterreich.gv.at before the demo.

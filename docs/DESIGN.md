# Laufzettel: design and demo script

The experience is the **Laufzettel**, the Austrian routing
slip that you used to carry from office to office. In 2030 it walks by itself: the offices stamp it in
the background, the citizen watches the stamps land and only answers what nobody else can know, then
signs with their own seal.

> **Signature sentence for the jury:** "The offices walk. You don't." / "Die Ämter laufen. Sie nicht."
>
> **Core idea: nudging and gamification, named the _Gipfelstempel_.** Austrians collect
> summit stamps when they hike; here every errand you finish is a summit and its emblem the summit stamp,
> collected in a personal pass (home, travel, family). Make it visible, make it fun, make it pay off,
> and move from reactive to proactive. Fair rules: voluntary, private, only positive, official errands only.
> Pitch (PowerPoint, 2 minutes, speaker notes with timings): [pitch/Laufzettel-Pitch.pptx](pitch/Laufzettel-Pitch.pptx).

This file describes the experience: the demo script, the identity, the nudging rules and how the
screens map onto the walkthrough engine. Architecture, AI design and guardrails are in
[TECHNICAL.md](TECHNICAL.md), vision and personas in [STRATEGY.md](STRATEGY.md).

## The core demo: one walkthrough

Everything is tuned to one story that is presented: **Lena registers her new address in Vienna**
(change of residence, the Meldezettel). The other personas still work, but nothing is built for them.

**The two-minute script** (English, the DE switch shown once):

1. **Desk.** An official notice, not a dashboard: flag and "A routing slip for you", the date, Lena's
   name. "Register your new address": the landlord Karl Steiner already confirmed the move in his
   own app. Deadline 3 days after moving in (Meldegesetz) with the days left. The route shows what is
   ahead: 6 rows the offices fill, 2 questions, her seal. One button: "Start this slip". A person is one
   click away. Optional: say the request in dialect instead ("I bin grad nach Wien zogn").
2. **Slip.** The offices stamp row after row while the captions speak one short sentence each.
   German official words (Meldezettel, Hauptwohnsitz, Florianigasse) are spoken in German inside the
   English voice. Lena answers "main residence" (marker, big buttons, or by voice).
3. **The letter.** Right after her first answer a parking fine arrives in her new **mailbox** (toast,
   badge). She opens it: the German original (Organstrafverfügung) next to plain words: what
   happened, €36 by 28 October, if nothing is paid it lapses and a more expensive one follows, no
   appeal against the ticket itself, and the link to the move: with the new Hauptwohnsitz she can get
   a Parkpickerl for the district. She pays with one tap (mock) or chooses "Later". The slip waits.
4. **Sign.** One more question (deregister Graz), then she holds her red seal: submitted. The
   confirmation carries the full emblem, the reference number and "Time you kept: 45 min" (estimate).
5. **Back at the desk.** The finished emblem and the time kept; if the fine is unpaid it waits under
   "Mailbox · Needs you · Pay by 28 October".

**Challenge fit** (the brief's tasks and evaluation criteria):

| The brief asks for | Where the core demo shows it |
|---|---|
| Colloquial input (dialect, half sentences) | say-it line on the desk, voice answers in the slip (router + `extractAnswer` before the LLM) |
| Amtsdeutsch into plain language | every row (official term on the form + plain explanation), the parking fine (original next to plain words) |
| Guide through a workflow, verify prerequisites | the slip: requirements row, rows filled from registers and the landlord, two questions, seal |
| Proactive, the state comes to the citizen | landlord confirmation → notice with the legal deadline; the letter arrives on its own |
| Structured administrative output | confirmation with reference number, authority, date, stations |
| German and English | EN/DE switch everywhere; German terms keep German pronunciation in English |
| Accessibility for all | captions for everything spoken, voice in and out, keyboard (hold Space to sign), 44 px+ targets, text size, reduced motion, phone layout |
| Human contact point | "Talk to a person" in the top bar, on the notice and in the letter; the handoff carries the step |
| Uncertainty and guardrails | the AI never submits or pays; deadlines and fines come with a source and are marked for checking |
| Impact on the administration | the offices fill 6 of 9 rows; no counter visit; fewer reminders because deadlines are met |

**Voice rules for this demo:** one short sentence per step, no "I'll now show you", no exclamation
marks, numbers and dates as people say them. German terms are split into their own language run
(`src/shared/pronounce.ts`, list `GERMAN_TERMS` + street names); ElevenLabs gets one request per run
with the neighbouring text as context, the browser voice one utterance per run.

## Reference material

| What | Where |
|---|---|
| Brand book v1 (logo, colours, type, stamps, patterns, voice, motion, applied screens). Open in a browser. **Identity v2 below overrides it** where they differ (type, forms, stamps, seal). | [brand-book.html](brand-book.html) |
| Pitch (PowerPoint, 2 minutes, speaker notes with timings) | [pitch/Laufzettel-Pitch.pptx](pitch/Laufzettel-Pitch.pptx) |
| Engine invariants (do not break) | [CORE.md](CORE.md) |

## Identity v2: warm paper

v1 read as too basic, angular and machine-made. v2 keeps the idea (paper, ink, stamps, one seal) and
changes the hand: organic forms, warmth, character, calm whitespace. v2 wins over the
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
| Move (`change-of-residence`) | **Stone pine (Zirbe)** on a rocky ridge, mountains behind: a conifer whose crown is laid in tiers of flat needle layers narrowing to a point (a round crown read as a broad-leaved tree); at 48 px three tiers to a point on a free-standing trunk | puts down roots in a new place, survives on rock |
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
- below about 96 px (the 48 px slip head, the 68 px desk card on a phone) the emblem shows a **solid
  silhouette** of the same scene (hatching would turn to mush: the edelweiss read as a pale pink disc
  at 68 px). `brand.css` picks the cut by the emblem's rendered width with a container query, so an
  emblem shrunk by CSS switches by itself.
  Check it for faces and figures: a round crown over a mountain line read as a head and shoulders,
  and a broad white river under the sun read as a mouth. Pointed, tiered, rooted shapes are safe;
- judged at 250 px (hero), 200 px (desk card, confirmation), 68 px (desk card on a phone) and 48 px
  (slip head). Close-ups of the small cut: `media/laufzettel/emblem-48px-*.png`,
  `media/laufzettel/emblems-68px-phone-desk.png`.
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
| Desk, the notice | the reason in plain words ("Your landlord Karl Steiner confirmed that you moved…"), the legal deadline with the days left (a fact from the Meldegesetz, shown calmly), the route (6 by the offices, 2 questions, your seal), "About 45 min you keep (estimate)." |
| Every slip screen | the sticky slip head: small emblem + "3 of 9 stamped · 2 answers left, then you sign · about 45 min you keep (estimate)"; on a phone one line, "3 of 9 · 2 left · about 45 min kept" (screen readers still get the full sentence) |
| Each row | the stamp of whoever did it, the narration names the same source |
| Confirmation | complete emblem, red seal, "time you kept" (labelled as an estimate) |
| Desk, collection | finished emblems and stamps on file, time kept in total: private, on this device |
| The letter | "Pay €36 by 28 October": the real legal deadline, marked once; after paying "Paid. It stays at €36." |

Rules: **voluntary** (profile menu → "Show seal and time kept", stored on the device only; off hides
the emblems, the collection and the time line), **private** (nothing is compared with other people),
**only positive** (no streaks, no loss, no countdown pressure), **only official errands**, **explained
openly** (estimates labelled as estimates; the switch is in the profile menu). Deadlines and costs of a fine are legal facts,
not our pressure.

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
| `ask` | field row, the question with the **marker**, inline answer (`AskInput` from `walkthrough/Answers.tsx`) | rectangle "Received" |
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
| `frontend/brand/Brand.tsx` | `Mark`, `Lockup`, `Stamp` (hand-pressed SVG + sprig), `Band`, `InkFilter` |
| `frontend/brand/Emblem.tsx` | the citizen's emblem (edge, wreath, serial, vignette) |
| `frontend/brand/motifs.ts` | the engraved motifs, their 48 px silhouettes and the stamp sprigs (pure, cached) |
| `frontend/brand/engrave.ts` | engraving geometry: swelling lines, form-following hatching, organic outlines |
| `frontend/brand/print.ts` | canvas drawing: guilloche band |
| `frontend/laufzettel/stations.ts` | walkthrough → stations mapping (pure) |
| `frontend/laufzettel/Slip.tsx` | the Laufzettel view of a running walkthrough + confirmation |
| `frontend/laufzettel/Desk.tsx` | the start page ("your desk"): the official notice for the open slip (deadline, route, start), letters that need the citizen, say-it line, private collection |
| `frontend/laufzettel/Postfach.tsx` | the mailbox: top-bar button with badge, arrival toast, the letter (original + plain words, pay, talk to a person) |
| `frontend/walkthrough/Answers.tsx` | the answer widgets inside a slip row (`AskInput`, `SlotPicker`) and `WalkthroughActions` |
| `src/gov/data/mail.ts` + `src/shared/mail.ts` | the letters of the mock backend (`GET /api/gov/citizens/:id/mail`), arrival during an errand |
| `src/shared/pronounce.ts` | language runs: German terms inside English narration (tests in `test/pronounce.spec.ts`) |
| `frontend/laufzettel/CaptionBar.tsx` | narration subtitles (rolling; `compact` = two lines on phones while the citizen acts), talk dots, pause/replay, keyboard, mic |
| `frontend/laufzettel/HoldSeal.tsx` | hold to sign |
| `src/gov/data/confirmations.ts` | third-party confirmations (landlord) of the mock backend |
| `src/gov/data/offices.ts` | mock appointment offices with their region, `nearbyFirst` |

The old v1 layer (Portal, Progress, HoldToConfirm, reward.tsx, Dock, CommandBar, the guilloche Seal)
and the separate goals pages were removed for the submission, so the demo stays on one errand.
`styles.css` keeps only rules a live component can match (verified with computed-style snapshots of
13 screens before and after).

## Status

Built and checked end to end in the browser (headless Chrome, mock backend reset after each run):

- Lena, change of residence: EN and DE, desktop and 390 px; parking fine paid and left for later;
  hold-to-sign with mouse and keyboard (hold Space); the desk afterwards with the Gipfelstempel pass.
- Josef, passport: photo from the phone or a photo booth (no paper photo), delivery address from the
  register, appointment at the passport office near Linz. David without an address on file is asked for it.
- Thomas and Amira, childcare benefit: EN and DE; Amira's residence permit goes to a person.
- A combined request typed on the desk ("We just moved and we had a baby") queues the second slip.
- Keyboard only, 4 landmarks, focus on each question, text at 140 % at 390 px, no horizontal overflow.

Type checks and 33 unit tests are green, the AI evals pass 9 of 9: see [TEST-RESULTS.md](TEST-RESULTS.md).

### Known limitations

1. The parking-fine facts (Organstrafverfügung, €36, two weeks, Anonymverfügung, Parkpickerl needs the
   Hauptwohnsitz) come from court decisions on § 50 VStG and are marked `verified: false` in
   `src/gov/data/mail.ts`; a final check on wien.gv.at is open. The letter shows its source.
2. Paying in the mailbox is simulated. The Parkpickerl is named, not built as its own slip.
3. The online passport photo (phone or booth upload) is a 2030 concept, not today's process.
4. English narration with German terms is synthesised in runs and can sound slightly segmented.
5. On phones the caption bar takes about 125 px; the German slip head wraps to two lines at 360 px.
6. Only three services are fully guided (change of residence, passport, childcare benefit).

### How to verify without clicking by hand

A headless Chrome driver was used: start Chrome with `--remote-debugging-port`, then send DevTools commands over the WebSocket (click with `Runtime.evaluate`, capture with `Page.captureScreenshot`, press and hold with `Input.dispatchMouseEvent`). In headless Chrome the audio cannot play without a user gesture; the narrator falls back to reading time, so playback still advances. Signing submits into the shared mock backend: reset it afterwards with `POST /api/gov/admin/reset`.
If the page stays blank and `document.readyState` is stuck at `interactive`, the Vite dependency cache is stale: stop the dev server, `rm -rf node_modules/.vite`, start again.

## Design rules

- Only the citizen submits (hold-to-sign). The AI has no submit or booking tool.
- No chat window, no bubbles, no orb, no glass, no gradients, no sparkles.
- English is the showcase language; every text also in German.
- A person is reachable from every screen ("Talk to a person" in the top bar and on blocked rows).
- Fair nudging: voluntary, private, only positive, only official errands, explained openly.
- Facts (deadlines, fees, documents) come from `src/knowledge/` with a source URL; unverified facts are marked.

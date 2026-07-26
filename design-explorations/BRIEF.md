# Dance Trainer — Visual Identity Exploration Brief

**Read this whole file before designing.** Every designer works from the same product truth and the
same fixture content, so the 15 prototypes can be compared side by side.

---

## 1. What the product actually is

A **skill tracker for partner dancing** (Modern Jive). One user: the person who built it. They open
it daily, most often **on a phone, standing up, mid-practice, in a dance studio**.

The scheduling model is a **Leitner box, not SM2.** This matters more than anything else:

- The app is a Kanban board. Each **column carries a fixed interval** (`due_offset_days`).
- Filing a card into a column stamps its due date to `today + that interval`.
- A nightly sweep pulls every card whose date has arrived into the designated **due column**.
- **The user picks the destination column themselves** after practising. The interval is a
  deliberate human decision, not an algorithm's output.
- So: **moving right = "I know this better, show it to me less often."** The board is a *mastery
  ladder laid out horizontally.* There is no ease factor, no interval calculation, no repetition
  count. Never design an indicator for those.

There is a second surface, the **Practice Companion**: a phone-first, currently near-black view used
mid-session — a focus card showing the current skill's full note, a queue of what's left, and a
review step where you choose which column each practised card goes into.

## 2. Who it's for

One dancer, technically literate, using this as an instrument they trust daily. Not a consumer
audience. Not a marketing surface. Nobody is being sold anything. Success is: open it, know
instantly what's due, log a session in a few taps, and have a durable record of how a skill
progressed over months.

## 3. Hard constraints — these are not up for redesign

1. **Legibility over long sessions beats stylistic boldness.** Opened daily on a phone. Contrast
   failures and eye strain are usability bugs, not nitpicks. A near-black global theme was tried
   and abandoned for exactly this reason — it read as the right attitude but proved fatiguing.
   (The dark *practice* view survives because it's used in short glances.)
2. **Status must be readable without reading.** The due / overdue / on-track state of a skill has to
   register at a glance from a metre away, and must never be carried by colour alone — pair it with
   position, shape, weight, or a text label.
3. **Mobile-first.** Phone is the primary device. Desktop is secondary.
4. **Real content is dense and messy.** Notes contain markdown, bullets, headings, German, and
   pasted video URLs. Card names run long. Design for the fixture below, not for three tidy words.
5. **No new backend data.** You may only surface what already exists: card name, ancestor chain,
   note, due date, labels, column, column interval, part count, practice count/last-practised date.

## 4. What has already been tried and rejected — do not re-propose

- Dance-school / class-booking marketing warmth: lifestyle photography, pill buttons, soft rounding.
- Nostalgic ballroom: aubergine + brass + italic serif + punched dance-card motif. Rejected as
  "too old and conservative" for a tool meant to feel young and modern.
- Generic consumer-SaaS card grids with heavy rounding and gradient accents.
- A global near-black theme (see constraint 1).
- SM2 / ease-factor scheduling and any UI implying it.

## 5. The incumbent look you are competing against

The current app is warm-paper light: board `#e6e0d4`, columns `#f0ebe1`, white cards, hairline
`#d8cfbf` borders, one ember accent `#e06d0a`, a green/amber/red status trio, 4px radii, Space
Grotesk + Work Sans + Space Mono. Its stated thesis is "a box of index cards on a table under warm
light."

**You are NOT bound by it.** The user has explicitly asked to see other directions. Treat the
incumbent as *evidence about the problem*, not as a style to preserve. You may keep, extend, or
completely replace it — but if you replace it, replace it with conviction, not with a tint change.

The incumbent's honest diagnosis, for your information: the accent is spent on decoration (every
column header carries a 2px accent rule, so nothing reads as accented); the card face leads with a
saturated taxonomy chip instead of the skill name; raw URLs eat the note preview; and **the Leitner
ladder — the single most distinctive thing about this product — is completely invisible**, rendered
as seven identical panels.

---

## 6. FIXTURE — build every prototype from exactly this content

Real data from the user's test board. Use it verbatim, including the German and the long names.

### Columns, left to right

| Column | Interval | Count | Notes |
|---|---|---|---|
| `ZIELE (COC)` | — (no interval) | 5 | Long-term goals. No due dates. |
| `INBOX` | — | 7 | Where new/split cards land. |
| `TODAY` | due column | 12 | Everything swept here is due or overdue. |
| `WÖCHENTLICH` | +7d | 8 | |
| `2 WÖCHENTLICH` | +14d | 5 | |
| `3 WÖCHENTLICH` | +21d | 4 | |
| `MONATLICH` | +30d | 5 | |

### Cards

**ZIELE (COC)** — no labels, no due dates:
- `Connection Weiter mit allem private Feedback - Play und Moves fluidisieren`
- `Präsentation weiterentwickeln. Spezifische Bewegungen und Instant feedback mit Spiegel`
- `Paraden Competition ready machen.`
- `Transitions. Move übergänge. Wie haben die sich entwickelt?`
- `Dynamics weiterentwickeln` — note: `• ganz gut` / `• DT Intros funktionieren in FS und Comps`

**INBOX** — no due dates:
- `Dance and Videofeedback - Lee training cycle`
- `Privates J&A M&C notes hier einfügen`
- `Caine connection`
- `Quick-add smoke test`
- `Family Test Spare`
- `Toe position` — ancestor chain `Family Test Root › Prep`, note `Toe detail line.`
- `dro`

**TODAY** — all overdue:
- `Drops` — note: a pasted URL `https://team.jive.berlin/s/anYHTeT958GzQc4`, then heading
  `General Cues` — **53d late**
- `Blindfold` — label `Drill` — **50d late**
- `Paraden` — label `Skill Block` — **27d late**
- `Inside turn followups` — label `Skill Block`, note is a pasted URL
  `https://team.jive.berlin/s/kFxmJwDbPb6ewpc` — **20d late**
- `Gaze & Facing Cues` — label `Skill Block`, note: `• Neigen dazu jetzt zu oft in die audience zu
  gucken. Mehr auch zum Partner` / `• Look at Judges ~50% of the time` / `• Kilian: Head back` —
  **16d late**
- `OFS` — label `Skill Block`, note: `One foot spins, Spot Turns, Pirouette turns` then heading
  `Variants` — **13d late**

**WÖCHENTLICH** — all `in 6d`:
- `Exits` — label `Skill Block`, ancestor `OFS`, note is two pasted URLs
- `Seducers` — label `Skill Block`, note `Styling:` + URL + `Exits:`
- `Pinguin` — label `Move`, note `focus on keeping right inner foot stable`
- `Take more space during Dancing` — label `60s practise`, note `Scrolls, Open Scroll, humpa scroll` /
  `Eternity, carousels`
- `Pidgeon` — label `Move`, note is a pasted URL

**2 WÖCHENTLICH** — all `in 13d`:
- `Hip Posting - J in die Connection rein gehen` — label `Learning`
- `Scrolls` — label `Move`, note `Frame sehr short. Linken Schritt früher machen und mit Judith
  schneller mitdrehen. Rechts außen rum und nach dem Rumtreten`
- `Levlosa collects` — label `Move`, note is a URL then `Arm nahe am Körper erst nach unten, dann
  zum follower führen`
- `Leader Turnout` — ancestor `Scrolls`, note: `• Achten wieder im Slot zu landen` / `• drehen wenn
  vor Judith` — **has 1 part**
- `Hammers` — label `Move Complex`, note: `• Arm nach unten für initiierung der Bewegung, dann kurve
  für den Throw` / `• Schoulder sway hammer: K`

**3 WÖCHENTLICH** — all `in 20d`:
- `Rides` — labels `Skill Block` + `Move Complex`, note is two pasted URLs
- `Step-over Scroll (Humpa-Scroll)` — label `Move`, note is two pasted URLs
- `DT-Intros` — label `Skill Block`, note heading `General` then `• Arme kurz und Stabil` /
  `• Alle Intros funktionieren mit …`
- `Second Arm` — label `60s practise`, note: `• An die Hüfte anlegen` / `• Hinter den Rücken
  einklappen` / `• Faust nach unten gerichtet` / `• Arm dynamisch zur Seite`

**MONATLICH**:
- `Tuck turn pulse` — label `Move`, note is a URL — `in 6d`
- `Walks` — label `Move`, note `Hop Walks` + URL — `in 6d`
- `First Move Lunge / Lunges Allgemein / Legwork -> Mehr in den Knien tanzen` — label `60s practise`,
  note is a URL — `in 7d`
- `Shoulder & Posture Cues` — labels `60s practise` + `Im Hinterkopf`, note: `• Schultern auf einer
  Höhe lassen während ich mich drehe` / `• Shultern öffnen, mehr Platz im Körper. Ich sehe oft` —
  `in 29d`
- `Copy&Elevate` — label `Drill` — `in 7d`

### Label vocabulary in use
`Skill Block`, `Move`, `Move Complex`, `Drill`, `Learning`, `60s practise`, `Im Hinterkopf`

Note that **most cards carry a label** — the label is close to a constant, not a discriminator.

---

## 7. What you must deliver

Write everything into your own folder: `design-explorations/<your-slug>/`

### a) `PITCHES.md`

Three pitches. For each:

- **Name** — a real name, not "Option A".
- **Thesis** — one sentence. What world is this, and why does *this product* deserve it?
- **The move** — the 2–3 concrete decisions that carry the identity. Be specific: name the colours,
  the type, the geometry, the one signature detail.
- **How the Leitner ladder becomes visible** — mandatory. Every pitch must answer this.
- **How status reads without colour** — mandatory (constraint 2).
- **What it costs** — honest. What gets harder, what breaks, what you'd have to give up.
- **Phone story** — one sentence on how it survives at 390px.

Then a short closing section: **which of your three you'd actually ship, and why.**

### b) Three prototypes: `1-<slug>.html`, `2-<slug>.html`, `3-<slug>.html`

Each is **one self-contained HTML file** (inline CSS, inline SVG, no build step). Google Fonts
`<link>` tags are allowed. No other external assets — no image URLs, no CDN scripts.

Each prototype must contain, in this order, so all 15 files are scannable in the same way:

1. **A banner strip at the very top**: pitch name, your designer lens, and the one-line thesis.
   Keep it visually separate from the design itself (a plain bar is fine) so it doesn't pollute the
   look being judged.
2. **The board, at desktop width** — all seven columns from the fixture, real card content,
   horizontally scrollable. This is the money shot. Show at least the first 5 columns fully
   populated.
3. **The phone board**, drawn inside a 390px-wide frame, showing the `TODAY` column.
4. **The card detail view** — `Gaze & Facing Cues` open, with its column, due date, labels, note,
   and family section.
5. **The practice focus card**, phone width — `Drops` with its note and a way to file it into a
   column afterwards.

Static HTML/CSS is fine; light JS for a hover or a tab is fine but not required. **Do not** build a
working app. This is a look, shown on real content.

Make it *look finished*. A prototype that reads as a wireframe loses to one that reads as a product,
even if the wireframe's idea is better — so spend the effort on craft.

### c) Distinctness

Your three pitches must be **three different worlds**, not one world at three saturations. If two of
your pitches would survive being described in the same sentence, one of them is wasted.

---

## 8. How you'll be judged

1. **Identity** — could you recognise this app from a 200px thumbnail? Does it look like anything
   else? Generic loses.
2. **Product truth** — does it make the Leitner ladder legible, and does it hold up on the real,
   messy fixture content?
3. **Daily-use survivability** — would this still be pleasant to read on a phone, in a studio, on
   day 200? Beautiful-but-fatiguing loses.
4. **Craft** — spacing, type, hierarchy, restraint. Detail decides.

Be bold. A safe pitch that nobody argues about is a failed pitch. But bold means *committed and
specific*, not *loud*.

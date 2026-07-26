# THE ARCHIVE — three pitches

**Lens.** This app is a personal *body of knowledge* that happens to be scheduled. Its identity should
come from the print traditions that organise knowledge — the card catalogue, the dictionary column,
the measured plate — not from the traditions of consumer software. The content is genuinely textual:
long German note bodies, headings, nested bullets, ancestor chains. Nobody has treated these notes as
writing. And an index of skills organised by review interval is a *catalogue*, which has four hundred
years of solved typographic problems behind it.

**The self-imposed test.** Colour must be a luxury, not a crutch. In all three pitches the status
system is carried by weight, case, rule, indent, hatch and position first; colour is added last and
only where it buys something. Two of the three would survive being printed in one ink.

**What I refused.** No aubergine, no brass, no italic serif display, no punched dance-card motif.
Editorial is not the same as historical — Swiss, Dutch and contemporary editorial design are all
modern, and that is the register all three sit in.

---

## 1 — KARTEI
### `1-kartei.html`

**Thesis.** A black-and-white card catalogue where every skill is a ruled entry in a drawer, the
interval is its shelfmark, and letter-case tells you what is due — so the one colour on the board is a
fluorescent marker spent only where it has to scream.

**The move.**

- **No card objects at all.** There is no white rectangle, no radius, no shadow, no border on any
  card. An entry is a block of type separated from the next by a 1px hairline. What used to be a
  "card" is now a *record*: name, siglum, note, figure. The board is stock, rules and ink —
  `#0E0E0F` on `#FFFFFF` drawers over an `#EDEDE9` desk, hairlines `#CBCBC4`, everything at 0px
  radius.
- **Type: Archivo (400–900) + IBM Plex Mono.** Archivo does the hierarchical work — 900 for the
  interval numerals, 800 for the drawer names, 700/600/500 stepping down the entries. Plex Mono is
  reserved strictly for *data*: counts, day figures, sigla, URLs. If it is a number or a code it is
  monospaced; if it is language it is Archivo. That single rule is most of the design.
- **The signature detail: labels become sigla.** The brief is right that the label is a constant, not
  a discriminator, so it stops being a coloured chip and becomes a two-character catalogue siglum in
  a hairline box — `SB` `MV` `MC` `DR` `LN` `60` `IH` — with a key at the foot of the board. It reads
  as classification, costs 22px, and never competes with the skill name again.
- One accent, `#E9FF4F` highlighter yellow. It appears exactly twice on the board: as the ground
  behind the `TODAY` drawer header, and knocked in behind the day-figure of any card more than 30
  days late. Nothing else is ever coloured.

**How the Leitner ladder becomes visible.** The board physically tapers. `TODAY` is 352px wide and
shows gutter bar, name, two lines of note, siglum and figure; `WÖCHENTLICH` is 300px with one line of
note; by `MONATLICH` the column is 200px of name-only index lines at 12.8px. **Mastery is compression** —
the better you know something, the less of it you are shown, and the columns get visibly thinner and
denser as you move right. Reinforced by three cheaper signals: a stepped rule under each header (5px
at TODAY down to 1px at MONATLICH), a black drawer tab carrying a roman shelfmark `I–V`, and a rail
above the board that draws the whole interval structure as one line. `ZIELE` and `INBOX` are drawn on
the desk ground with dashed rules and no tab — they are not on the ladder and should not pretend to be.

**How status reads without colour.** **Case carries it.** Every due card is set in uppercase Archivo
700; everything scheduled is sentence case. From a metre away the `TODAY` column is a block of capitals
and nothing else on the board is. Degree of lateness is a *revision bar* in the left margin — the
printer's change bar — whose weight runs 9px at 53 days late down to 3px at 13, so the margin becomes
a small histogram of neglect. The figure `−53` in mono is the third, literal channel. Remove all
colour and the status system is completely intact.

**What it costs.** Uppercase is a real constraint: it survives `DROPS` and `GAZE & FACING CUES` but
would be ugly on a 90-character due card, so the rule needs a length cap and a graceful fall back to
weight-only. The fluoro yellow is a taste bet — it is either the freshest thing on the board or the
first thing the user asks to tone down, and there is no middle. And a design with no card objects
loses drag-and-drop's most obvious affordance; the drag ghost has to be invented rather than inherited.

**Phone story.** At 390px the drawer header becomes a full-bleed fluoro band with a 34px count, and
the six due entries stack as ruled records with their change bars along the left edge; the ladder is a
7-segment strip pinned above the practice button, so the whole board structure still fits in 90px.

*Most beautiful thing at 390px:* the ragged left margin of change bars in `TODAY`, descending 9-8-5-4-3-3.

---

## 2 — KOLUMNE
### `2-kolumne.html`

**Thesis.** A dictionary spread — each skill is a headword, its note is the definition set in numbered
senses, and a critical apparatus of daggers in the margin says what is overdue — because the one thing
this app has that no other tracker has is *months of the user's own writing*, and nothing here has ever
been set as writing.

**The move.**

- **The note stops being a preview and becomes a definition.** Every bullet in the fixture is rendered
  as a numbered sense: `Gaze & Facing Cues · 1. Neigen dazu jetzt zu oft in die audience zu gucken…
  2. Look at Judges ~50 % of the time 3. Kilian: Head back`. Headings become sense divisions.
  **Every pasted URL becomes a footnote** — a red superscript on the headword, resolved in a hairline
  footnote block at the foot of the column. The URLs stop eating the note; they become apparatus, which
  is exactly what they are.
- **Type: Newsreader for all language, Instrument Serif for display, DM Mono for figures.** Newsreader
  is a contemporary text serif, not an antique one; Instrument Serif at 46–62px is the current
  editorial register, not a ballroom one. Labels are set as part-of-speech abbreviations in italic —
  *sb.*, *mv.*, *mv. cpl.*, *dr.*, *ln.*, *60s.*, *ihk.* — so the near-constant label recedes into
  grammar. Paper `#F4F3EF`, ink `#14120F`, one vermillion `#DA3A1C`.
- **The signature detail: the apparatus travels with the card, not the column.** `‡` = more than 30
  days overdue, `†` = overdue, `·` = due within 7 days, no mark = on schedule. This is why `Tuck turn
  pulse` and `Copy&Elevate` carry a `·` while sitting in `MONATLICH` — a monthly card can still be due
  on Thursday, and no other pitch in this set says that out loud.

**How the Leitner ladder becomes visible.** A **staircase of indents**. Column heads stay flush left,
but the entry block steps 12px further right in every column — 0 / 12 / 24 / 36 / 48 — each step marked
by a faint vertical rule, so the eye reads a descending stair across the board exactly like a nested
index. Headword weight and size step down with it (700/17.5px at `TODAY` → 400/13.5px at `MONATLICH`),
and the rule under each header decrescendos 5→1px. Each ladder column carries a folio numeral set in
Instrument Serif at 46px; the two unscheduled columns carry an em dash instead, and a dotted rule.

**How status reads without colour.** The apparatus marks are shapes, not colours — `‡` and `†` are
legible in one ink. Behind them, headword weight: `TODAY` is the only column set at 700, so the due
column is visibly the darkest block of type on the board. The day figure (`53 T`, `16 T`, `6 T`) is
the literal third channel. The vermillion is doing emphasis, not encoding.

**What it costs.** This is the most fragile of the three. Numbered senses are a promise the markdown
has to keep — a note that is one long paragraph, or a heading with nothing under it (`Drops`, in the
real fixture) gets an honest but slightly sad empty line. Serif at 13.5px in a 210px measure with long
German compounds is right at the edge of comfortable, and `Hip Posting – J in die Connection rein
gehen` proves it. And the indent staircase is the subtlest ladder of the three: it is beautiful in a
screenshot and easy to miss at a glance in a studio.

**Phone story.** At 390px the day's most overdue entry is promoted to a **lead entry** — `Drops` set
in Instrument Serif at 48px with its apparatus line above it — and the remaining eleven run beneath as
a normal dictionary column, which is the correct hierarchy for a mid-session glance anyway.

*Most beautiful thing at 390px:* that lead entry. `‡ 53 TAGE ÜBERFÄLLIG` in 10.5px mono red, then
**Drops** at 48px, then its definition in italic grey. It looks like a page, not a screen.

---

## 3 — TAFEL
### `3-tafel.html`

**Thesis.** An engineering plate — the board *is* a measured time axis, the Leitner intervals are
labelled stations on it, and every overdue skill is dimensioned against the datum of today with a
hatched bar, so lateness screams without a single milligram of red.

**The move.**

- **The board sits on a drawing sheet.** 1px ink border with corner ticks, and a real **title block**
  across the top: `TAFEL Test board · VERFAHREN Leitner · 7 Fächer · DATUM 2026-07-27 · KARTEN 46 · 12
  fällig · MASSSTAB Stationen, n. maßstäblich`. Every fact the header used to hide is on the record,
  in the format a drawing uses.
- **An axis above the columns, drawn in SVG.** A datum line at `0 · HEUTE`, blue station ticks at `+7`,
  `+14`, `+21`, `+30` sitting over their columns, a dimension chain between them (`+7 T`, `+7 T`, `+7 T`,
  `+9 T` — and yes, the last gap really is 9 days, which the current app never tells you), a hatched
  `ÜBERFÄLLIG` zone left of the datum, and a **drafting break symbol** separating `ZIELE`/`INBOX`,
  which are off the scale entirely and are drawn on a faintly hatched ground to say so.
- **The signature detail: every overdue card is dimensioned.** A hatched bar terminating on a 3px
  datum rule, its length proportional to days late, with the figure knocked out of the hatch in the
  middle of the bar — `53 T`, `50 T`, `27 T`, `20 T`, `16 T`, `13 T`. Six bars stacked against one
  vertical datum. Nothing else on the screen is hatched.
- Type: Archivo Narrow for all furniture and headings (ISO drafting lettering, condensed, uppercase,
  tracked), Public Sans for note bodies where German needs the width, Roboto Mono for every dimension.
  Ink `#17181C` on `#FCFCFA`; **one blue, `#1B44E0`, and it is only ever annotation** — stations,
  dimension figures, `REF nn` link callouts. The blue never marks a status. Pasted URLs become
  numbered `REF` callouts, boxed in blue, resolved by number.

**How the Leitner ladder becomes visible.** It is not represented, it is the layout. The columns hang
off the stations of a time axis; the interval is a measured distance between two ticks, drawn with
extension lines and figures. `MONATLICH` is not "the seventh panel", it is the station 30 days from
the datum. The filing UI inherits this directly: in the practice view you file a card by **pointing at
a station on the axis**, not by picking from a list, which is the truest possible expression of "the
user chooses the interval by hand".

**How status reads without colour.** Entirely. Position relative to the datum, hatch, bar length and
the mono figure — this is the pitch that fully passes my own test. Print it in one ink and nothing is
lost; the blue can be deleted and the status system does not notice.

**What it costs.** The most annotation furniture of the three, and furniture is the thing that becomes
noise on day 200 — `REF 04` and `STATION III` are charming in week one and could read as clutter in
month six. Condensed uppercase is wrong for long German card names, so `First Move Lunge / Lunges
Allgemein / Legwork → Mehr in den Knien tanzen` has to fall back to Public Sans, which means the design
lives on two voices and has to police the boundary. The axis is also the hardest thing here to build:
it needs real layout maths, and it breaks the moment the user adds an eighth column or changes an
interval — the ticks have to be generated, not drawn.

**Phone story.** The axis survives as a 358px SVG strip pinned above the `TODAY` header — hatched
overdue zone, datum, four stations — and the dimension bars grow to a 2.8px/day scale so `Drops` runs
150px wide across the card and is unmissable from arm's length.

*Most beautiful thing at 390px:* the datum. One 3px vertical rule with six hatched bars crashing into
it from the left, and every bar's figure knocked out of its own hatching.

---

## Which I'd ship

**KARTEI.**

`TAFEL` is the strongest *idea* in this set and it wins on identity and on product truth — the axis is
the only design here where the Leitner ladder isn't illustrated, it's structural, and its status system
needs no colour at all. If the judging were on the thumbnail and the thesis, I'd send `TAFEL`. But this
tool gets opened every day for years by someone standing in a studio, and criterion 3 is
daily-use survivability. `TAFEL` asks the user to read a drawing every morning. Drawings are wonderful
to look at and tiring to live inside, and its annotation furniture is exactly the kind of thing that
delights for a month and irritates for a decade. `KOLUMNE` is the one I'd most like to *read*, and its
treatment of the notes — numbered senses, URLs demoted to footnotes, labels as parts of speech — is the
single best piece of thinking in this folder. But its ladder is the weakest of the three, and a serif at
13.5px in a 210px column of German compounds is a legibility bet I'm not willing to make against
constraint 1.

`KARTEI` is the one that is still pleasant on day 200. It is quiet, it is achromatic, its hierarchy is
carried by weight and rule rather than by decoration, and its two boldest moves — **case as status**
and **compression as mastery** — cost nothing to render, degrade gracefully, and are legible from
across a room. It is also the cheapest to build: no axis maths, no footnote resolution, no measured
geometry. Everything in it is `font-weight`, `text-transform`, `border-bottom` and a column width.

**The one graft.** I'd take `TAFEL`'s dimension bar into `KARTEI`'s `TODAY` column, replacing the plain
change bar with a hatched bar that terminates on a shared datum rule. It is the single most legible
overdue signal any of the three produced, it survives the achromatic constraint, and it is the one
element worth the extra build cost. Everything else in `KARTEI` stays as drawn.

**And the two things I'd steal from `KOLUMNE` regardless of which world wins:** URLs become numbered
references resolved elsewhere — never inline in a preview — and labels stop being coloured chips.
Those two fixes are independent of the visual identity, and both of them are diagnosed problems in the
incumbent today.

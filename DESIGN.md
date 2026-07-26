---
name: Dance Trainer
description: A Leitner-box skill tracker for dance practice, built as a Kanban board on warm paper.
colors:
  board-ground: "#e6e0d4"
  panel-surface: "#f0ebe1"
  card-surface: "#ffffff"
  border: "#d8cfbf"
  primary-ink: "#2a2420"
  secondary-ink: "#6a6156"
  accent-fill: "#e06d0a"
  accent-hover: "#f2842a"
  accent-ink: "#a04c00"
  ink-on-accent: "#1f1404"
  status-on-track: "#3e9b6e"
  status-on-track-hover: "#4fb07f"
  status-due: "#c98a16"
  status-overdue: "#cb4242"
  practice-ground: "#14100c"
  practice-surface: "#1d1712"
  practice-border: "#4a3320"
  practice-primary-ink: "#f5ede2"
  practice-secondary-ink: "#b7a693"
  practice-accent-fill: "#ff8a3d"
  practice-accent-hover: "#ffb073"
  practice-status-on-track: "#5bc794"
  practice-status-due: "#e0a83d"
  practice-status-overdue: "#e8695f"
  practice-focus: "#ff8a3d"
  label-rose: "#c1495a"
  label-brass: "#c68b3d"
  label-sage: "#7d9a7a"
  label-denim: "#5c7a99"
  label-plum: "#7a5577"
  label-ochre: "#b98a2e"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Work Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Work Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  data:
    fontFamily: "Space Mono, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
  eyebrow:
    fontFamily: "Space Mono, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  lg: "8px"
  dot: "50%"
  track: "999px"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent-fill}"
    textColor: "{colors.ink-on-accent}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.ink-on-accent}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.secondary-ink}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  button-ghost-hover:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.primary-ink}"
  button-dashed-add:
    backgroundColor: "transparent"
    textColor: "{colors.secondary-ink}"
    rounded: "{rounded.sm}"
    padding: "10px"
  input-field:
    backgroundColor: "{colors.board-ground}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    typography: "{typography.body}"
  card-task:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  panel-column:
    backgroundColor: "{colors.panel-surface}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.lg}"
    padding: "10px"
  modal-shell:
    backgroundColor: "{colors.panel-surface}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  chip-label:
    rounded: "{rounded.sm}"
    padding: "2px 8px"
    typography: "{typography.data}"
  toast:
    backgroundColor: "{colors.primary-ink}"
    textColor: "{colors.card-surface}"
    rounded: "{rounded.sm}"
    padding: "10px 6px 10px 11px"
---

# Design System: Dance Trainer

## Overview

**Creative North Star: "The Drill Card"**

Every skill in this app is one index card in a physical box. You practise it, then you sort it
into a slot that decides when you'll see it again — that is literally the Leitner scheduling
model, and it is also the whole visual thesis. The interface is a box of cards on a table under
warm light. Cards are flat, white, and small enough to fan through. The board they sit on is
warm greige paper, not a screen. Nothing is glossy, nothing floats, nothing animates for
pleasure. The single most important thing on any card is legible at a glance from a metre away,
because the user is standing up mid-practice, not sitting down to read.

That physical metaphor keeps two forces in check. The domain (Modern Jive, partner dancing)
pulls toward dance-school warmth — lifestyle photography, pill buttons, soft rounding — and the
category (a training tool with intervals and streaks) pulls the other way, toward a dark
terminal aesthetic with monospace everywhere. The drill card refuses both. It is warm because
paper is warm, not because dancing is warm. It is technical because a filing system is
technical, not because tools should look like terminals. Monospace appears on measured values
only — dates, counts, invite codes — the way a handwritten card would have a date in the corner.

Depth is tonal, not dramatic. Lightness climbs in three fixed steps — board → column → card —
so the stack reads as physical layering rather than as drop shadows. The one memorable detail is
the coloured rail down a card's left edge, which is the same gesture as a coloured tab on a real
filing card: it says *when*, and it is readable before you read anything.

**Key Characteristics:**
- Three-step tonal climb (ground → surface → white) carries all hierarchy; shadows only separate.
- Semantic status trio (on-track / due / overdue) is the only colour system for training state.
- Monospace is reserved for measured values, never used for prose or labels-as-decoration.
- Modest 4px radii throughout; pill shapes appear exactly twice, both as tracks, never as buttons.
- One accent, used for the primary action and the current selection only.
- A second, fully dark palette is scoped to the mid-practice companion view — same app, different room.

## Colors

Warm-neutral paper stack, one ember accent, and a three-colour semantic status system; every
value was contrast-measured against the tinted (not white) backgrounds it actually lands on.

### Primary
- **Accent Fill** (`#e06d0a`): Ember. Fills the single primary action per surface (Save, Add
  card, Sign in), the active segment of the board/list toggle, drop-target borders and the drag
  insertion line. Also the 1px border on secondary actions that need to read as clickable.
  **Fill and border only — never text.**
- **Accent Ink** (`#a04c00`): The deepened ember used everywhere ember has to be *ink*: the
  app-wide focus ring, link chips, field-label eyebrows. Exists because the fill value fails
  contrast as text.
- **Accent Hover** (`#f2842a`): Hover state of a filled accent button. Nothing else.
- **Ink on Accent** (`#1f1404`): Near-black ink on the ember button. Dark-on-orange rather than
  white-on-orange keeps the technical punch and clears contrast.

### Secondary
- **On Track** (`#3e9b6e`): A card whose due date is in the future. Left rail, status dot, and
  the confirming variant of a toast.
- **Due** (`#c98a16`): Due today. Left rail and status dot.
- **Overdue** (`#cb4242`): Past due. Left rail, status dot, and the one place the *label text*
  is also coloured and bolded. Doubles as the destructive-action colour (Delete).

### Tertiary
Six label fills for user-assigned card labels: **Rose** (`#c1495a`), **Brass** (`#c68b3d`),
**Sage** (`#7d9a7a`), **Denim** (`#5c7a99`), **Plum** (`#7a5577`), **Ochre** (`#b98a2e`). Each
carries its own ink value, not a shared one — white clears 4.5:1 on rose, denim, and plum, and
fails on brass, sage, and ochre, which take primary ink instead. Sage's fill was lightened from
a darker green because no ink colour cleared the original.

### Neutral
- **Board Ground** (`#e6e0d4`): The board itself, and the recessed inside of input fields.
- **Panel Surface** (`#f0ebe1`): Columns, topbar, modals, panels, list rows.
- **Card Surface** (`#ffffff`): Cards — and, reused as the hover highlight on any row or ghost
  button, because "lift toward white" is the same gesture as "raise off the stack".
- **Border** (`#d8cfbf`): Hairline. 1px everywhere except deliberate dashed affordances.
- **Primary Ink** (`#2a2420`): Warm near-black. All body and title text. Also the toast surface.
- **Secondary Ink** (`#6a6156`): Metadata, placeholder, inactive, and the card's note preview.

### The Practice Companion palette (scoped, not global)
Ten `--pc-*` tokens scoped to `.practice-view` give the mid-practice companion a fully dark
scheme: ground `#14100c`, surface `#1d1712`, border `#4a3320`, ink `#f5ede2` / `#b7a693`, a
brighter ember `#ff8a3d` / `#ffb073`, a lifted status trio `#5bc794` / `#e0a83d` / `#e8695f`, and
`--pc-focus` `#ff8a3d` for the focus ring. The ember hue carries across so it still reads as the
same app. It is a deliberate exception, justified by use: short glances under variable studio
light, not long reading.

The border token is a hairline, never a control edge: `#4a3320` is **1.53:1** on the surface —
visible enough to be decoration, not enough to say "you can press this". Anything a finger acts
on (a checkbox, a dashed create row, a drag grip) takes Secondary Ink instead. This has been got
wrong twice, on the grip and then on the add drawer's checkbox.

### Named Rules

**The Three-Token Ember Rule.** Ember has three tokens and only one of them is legible as ink.
Fill and borders take Accent Fill; hover fills take Accent Hover; anything that paints ember as
text or as the focus ring takes Accent Ink. Before writing ember anywhere, ask whether it is
being painted *as ink* — if yes, there is only one right answer.

**The Measured-Background Rule.** Contrast is checked against the tinted surface the element
actually lands on, never against white. The three grounds are `#e6e0d4`, `#f0ebe1`, and
`#ffffff`, and a value can pass on one and fail on another — Accent Ink is 4.53 / 5.01 / 5.95
across them, which is exactly why it exists.

**The One Accent Rule.** Ember marks the primary action, the current selection, and the active
drop target. It never decorates. A surface with two ember-filled buttons has one too many.

## Typography

**Display Font:** Space Grotesk (500, 700) — headlines, page titles, and card titles
**Body Font:** Work Sans (400, 500, 600) — all UI text, labels, buttons, prose
**Data Font:** Space Mono (400, 700) — dates, counts, column names in results, invite codes

**Character:** A technical geometric sans against a humanist workhorse sans — paired on the
contrast axis, not on similarity. Space Grotesk's flattened terminals and tight apertures do the
"instrument" work; Work Sans stays quiet and readable at 13–14px on a phone. Space Mono is not
decoration: it is the tell that a value was *measured*, and it appears nowhere else.

### Hierarchy
- **Display** (Space Grotesk 700, 26px, 1.2, -0.01em): Auth screen and board-select page titles.
- **Headline** (Space Grotesk 700, 22px, 1.25, -0.01em): Card modal title, practice focus card
  title, Session Review's head title. The practice pair sat one step down at 20px until the note
  heading ramp widened; see The Card Title Wins Rule.
- **Lineage** (Space Grotesk 600, 13px, 1.25, `--pc-ink-dim`): The parent chain rendered as the
  headline's *first line* on the practice focus card and Session Review. Its list-surface
  counterpart is Data at 10px — see The Lineage Is Identity Rule.
- **Title** (Space Grotesk 600, 15px, 1.3): The card title on the board face. This is the
  largest thing on a card, by rule.
- **Body** (Work Sans 400, 14px, ~1.5): Note text in the modal and practice card, list rows,
  search results, inputs. 13px in denser secondary contexts.
- **Label** (Work Sans 600, 12–13px): Buttons, column headers, form labels.
- **Data** (Space Mono 400/700, 11–12px): Relative due labels (`today`, `3d late`, `in 4d`),
  practice counts, column name in a search result, invite codes. 700 only on overdue.
- **Eyebrow** (Space Mono, 11px, uppercase, 0.05em): Rare — one-off section markers such as the
  dev-login block. Not a per-section scaffold.
- **Micro** (11px body / 9–10px in the family tree): The dense end of the scale, used only where
  many small records share one view — the card face's ancestor line at 11px, and inside the card
  modal's family tree, where label chips drop to 10px and the mono "you" marker to 9px. Below
  11px is for the tree alone; it is an overview of many cards at once, not a reading surface.

### Named Rules

**The Card Title Wins Rule.** On the board face, nothing renders larger than the 15px card
title — including markdown headings inside the note preview. The note component's
`--note-heading-scale` is set to `0` there for exactly this reason: it flattens h1–h6 onto the
12px base so headings stay marked by weight and ink but never out-size the title. The modal and
the practice surfaces keep the full scale and satisfy the rule by title size instead: at a 14px
base the ramp puts h1 at 21px, so a 22px title clears it and the practice pair's former 20px did
not — which is why they were raised rather than the note being flattened. Any surface that hosts
a note at 14px is now committed to a 22px title.

**The Lineage Is Identity Rule.** A card stores its leaf name only, so `Hammers › Posture` and
`Drops › Posture` are the same string. Wherever a card is named, its parent chain is named with
it, in one of two registers: as the title's **first line** (Lineage, 13px display 600, trailing
`›`, negative margin so it hugs the title) on single-card surfaces, or as a **10px mono sub-line**
above the name in lists. List lineages head-truncate (`direction: rtl`) because the nearest parent
is the informative end, and render no trailing `›` — a bidi-neutral separator gets reordered to
the wrong side of an RTL run. The board face is the one surface still unresolved; see
`Dance_trainer_logseq/pages/Open Work.md`.

**The Measured-Value Rule.** If a number was counted, dated, or generated, it is Space Mono. If
it is prose, a label, or a heading, it is not. There is no third case.

**The Fixed-Scale Rule.** Type sizes are fixed px, never `clamp()`. This is product UI viewed at
consistent DPI; a fluid heading that shrinks inside a 280px column looks worse, not better. The
one global size override is the iOS 16px input-font floor under 640px, which exists to stop
Safari zooming on focus.

## Layout

The board is a horizontally-scrolled row of fixed-width columns; each column is a vertically
scrolled card list with a sticky header and a composer pinned at the bottom. Everything else
(auth, board select, card modal, practice companion) is a single centred column: 360px for auth,
720px for the card modal, full-bleed on phone.

Spacing runs on an 8px rhythm with 4/6/12/16/24 as the working steps — `8px` is the default gap
between siblings, `4–6px` for tightly-coupled pairs (dot + label, chip rows), `24px` for modal
and auth-card padding, `48px 16px` for the space above a centred sheet. Control padding is
`10px 12px` for inputs and cards, `8px 14px` for a filled button, `6px 10px` for an outlined one.

Responsive behaviour is structural, not fluid. There is effectively one breakpoint — **640px** —
where the card modal goes full-bleed, quick-drop buckets reflow, and inputs jump to the 16px iOS
floor; plus a single 760px adjustment. Nothing between those points reflows by percentage.
Touch targets hold at a 44px minimum (40px for a few icon-only board controls), and the practice companion respects
`env(safe-area-inset-*)` on both edges because it is used one-handed with the phone in a pocket
rotation.

A `z-index` ladder is in use and should be extended, not bypassed: drag affordances 20 → sticky
column chrome 60 → search panel 95 → modal backdrop 100 → toasts 1000.

## Elevation & Depth

**Tonal first, shadow second.** Depth is carried by the three-step lightness climb — board
ground → panel surface → card white. A card looks raised because it is lighter than the column,
and the column looks raised because it is lighter than the board. Shadows do not create the
hierarchy; they only soften the seam. Both shadows are warm-tinted, because a black drop shadow
on warm paper reads as dirt.

Hover follows the same logic: a row or ghost button "lifts" by moving one step *toward white*,
not by gaining a shadow.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px rgba(70, 55, 40, 0.1), 0 2px 5px rgba(70, 55, 40, 0.07)`):
  Ambient separation for a card resting on its column. Barely visible on its own — correct.
- **Modal** (`box-shadow: 0 16px 40px rgba(50, 38, 25, 0.24)`): Anything genuinely floating over
  the board — modal, search panel, overflow menu, toast, quick-drop bar.

### Named Rules

**The Tonal-Climb Rule.** New surfaces pick a step on the existing ladder rather than inventing
a shadow. If something needs to feel raised, move it toward white; only add elevation if it
genuinely floats over content the user can still see.

## Shapes

Modest, filing-cabinet geometry. **4px** (`--radius-sm`) is the default and carries roughly two
thirds of all rounded corners: cards, buttons, inputs, chips, menu items, list rows. **8px**
(`--radius-lg`) is reserved for containers that hold other rounded things — columns, modals,
panels, the auth card. Circles (50%) are for status dots only. Pills (999px) appear exactly
twice, both as *tracks* rather than buttons: the board/list segmented toggle and the practice
"done" receipt. Nothing else is pill-shaped.

Borders are 1px hairlines in the border neutral. Deviations are all semantic, never decorative:
**2px dashed border** = a drop target or an "add here" affordance; **2px solid ember** = the
active drag surface; **1px ember** = a secondary action that should read as clickable; **3–4px
inset** = the status rail (see Components).

## Components

### Buttons
- **Shape:** Slightly softened corners (4px). Never pills.
- **Primary (filled):** Ember fill, near-black ink on it, no border, `8px 14px` padding, Work
  Sans 600 at 13px. Hover moves to the lighter ember. One per surface.
- **Outline:** Transparent fill, 1px ember border, primary ink, `6px 10px`. The workhorse for
  toolbar and modal actions.
- **Ghost:** Transparent, no border, secondary ink; hover fills toward white and darkens the ink
  to primary. Used for icon buttons, close/overflow, and cancel.
- **Dashed add:** Full-width, 2px dashed hairline border, secondary ink, left-aligned text.
  Hover swaps the border to ember and the ink to primary. This is the "add a card" affordance
  and reads as an empty slot rather than a button.
- **Disabled:** `opacity: 0.6` and `cursor: default`. No colour change.
- **Focus:** Global — 2px Accent Ink outline at 2px offset. One re-toning, not a second style:
  `.practice-view :focus-visible` swaps only the colour to `--pc-focus`, because Accent Ink is
  3.04–3.21:1 on the practice palette's near-black grounds — over the non-text floor, but darker
  than the ember border a selected row already carries, so a focused row read as *less* selected
  than the active one. The one genuine exception is the Done FAB, whose own fill is `--pc-ember`:
  a ring in the same value would vanish into it, so it uses `--pc-ember-light`. A ring that lands
  on an accent fill needs the lighter tone; everything else takes the scoped default.

### Chips
- **Label chips:** Solid fill from the six label colours, ink from the matching per-fill ink
  value, 4px radius, `2px 8px`, 11px. No border.
- **Link chips (inside notes):** Accent Ink text on a 10% ember tint, clipped at
  `--note-chip-max` (40vw) with ellipsis so a pasted URL can't blow out the layout.
- **Family-tree chips:** The same label-chip vocabulary one step down — 10px, `1px 5px` — on the
  mini cards in the card modal's family tree. The current card is marked with an ember border
  plus a 2px 30%-ember ring and a 9px mono `you` tag. It deliberately does **not** reuse the
  inset left rail: that box-shadow is the status rail's signature and a second meaning would
  muddy it.

### Sheets — a decision layer above a modal
- A `.sheet` + `.sheet-backdrop` pair at `z-index: 101`, max 420px, sitting **above** the card
  modal for single-decision flows (pick a parent, pick a part, pick a header to split, confirm a
  merge). One sheet serves all four rather than each action growing its own panel. Escape unwinds
  one layer at a time: sheet, then the `⋯` menu, then the modal.
- **Dashed-ember action buttons** (`+ Split`, `+ Add existing card as part`) reuse the label `+`
  affordance: dashed border means *adds structure*, as against a solid button which commits.

### Head truncation — two techniques, not interchangeable
- **`direction: rtl` + `text-align: left`** for a single text run whose tail is the informative
  end: note link chips, and the card face's ancestor line. It reorders bidi-neutrals, so never
  render a trailing separator inside one.
- **`flex-direction: row-reverse` over a reversed list** for a multi-element row that must clip
  at its root end while still reading left-to-right — the card modal's ancestor breadcrumb. The
  `rtl` trick cannot do this: it would reorder the elements themselves.

### Cards / Containers
- **Corner:** 4px for cards, 8px for the columns and modals that contain them.
- **Background:** White card on panel surface on board ground.
- **Shadow:** Card shadow only; see Elevation.
- **Border:** 1px hairline. Hover mixes 45% ember into the border colour — the border warms,
  it does not thicken.
- **Padding:** `10px 12px`; internal rhythm 6–8px.
- **Drag:** `opacity: 0.4` on the source card. Text selection and the iOS long-press callout are
  suppressed so a long press starts a drag instead of selecting.

### Inputs / Fields
- **Style:** Recessed — board-ground fill (darker than the surface around them), 1px hairline
  border, 4px radius, `10px 12px`. Inputs sink into the surface; they do not sit on it.
- **Focus:** Border shifts to ember. The global focus ring covers keyboard focus.
- **Composer textarea:** Opens already ember-bordered on a white fill, signalling "this is live"
  before you type.

### Navigation
- **Topbar:** Panel surface, hairline bottom border, sticky. Board title in display type,
  actions right-aligned as outline and ghost buttons.
- **Segmented toggle (board/list):** A pill track; the active segment takes an ember fill with
  near-black ink, inactive segments are transparent with secondary ink. 150ms colour transition.
- **Column header:** Sticky inside the column, card count in Space Mono.

### Toast
Primary-ink surface (inverted against the whole light app) with white text, modal shadow, 4px
radius, bottom-centre, `min(360px, 100vw - 32px)`. Status is carried by a 3px left rail —
overdue red by default, on-track green for success — deliberately mirroring the card status
rail rather than tinting the whole background.

### Signature: the card status rail
The load-bearing detail of the whole system. A card with a due date gets a 4px coloured band on
its left edge, drawn as `box-shadow: inset 4px 0 0 <status>` layered *in front of* the card
shadow — inset rather than `border-left`, so it never shifts the card's content or fights the
1px border. Green = scheduled, amber = due today, red = overdue. Undated cards stay plain, which
is itself information.

It pairs with a fixed bottom meta strip: an 8px status dot in the matching colour plus a compact
Space Mono relative label (`today`, `3d late`, `in 4d`). The strip is always in the same place so
the eye learns where to look. Overdue is the only state that also colours and bolds the label
text — the one thing allowed to shout.

The same rail language is reused deliberately on the toast. It is a motif, and its meaning is
always *status*.

## Do's and Don'ts

### Do:
- **Do** run every new colour through the Three-Token Ember Rule and the Measured-Background
  Rule before committing it. Add a token in `tokens.css` rather than a hex in a component.
- **Do** reach for the status trio when surfacing new training state, and extend the rail /
  dot / mono-label vocabulary rather than inventing a parallel indicator system.
- **Do** keep type in fixed px on the existing scale (11 / 12 / 13 / 14 / 15 · 18 / 20 / 22 / 26).
- **Do** give every transition a `prefers-reduced-motion: reduce` counterpart. The codebase has
  nine of them and no exceptions; keep it that way.
- **Do** hold transitions to 120–220ms and use the incumbent easings —
  `cubic-bezier(0.25, 1, 0.5, 1)` for state changes, `cubic-bezier(0.16, 1, 0.3, 1)` for entrances.
- **Do** theme card notes by setting `--note-*` custom properties on the host, never by editing
  `MarkdownNote.vue` — it is the single component behind all three note surfaces and takes no
  palette props.
- **Do** place new stacking contexts on the existing z-index ladder (20 / 60 / 95 / 100 / 1000).

### Don't:
- **Don't** paint Accent Fill as text. It is 2.78:1 on the panel surface and 3.30:1 on white —
  below even the 3:1 non-text floor on the board. This has been got wrong twice.
- **Don't** collapse the six label ink values back to one. No single value clears all six fills.
- **Don't** add pill-shaped buttons or radii above 8px. Both read as consumer SaaS and undo the
  filing-card geometry.
- **Don't** use a coloured `border-left` wider than 1px as a generic card or callout accent. The
  4px status rail and the toast's 3px rail are the *only* sanctioned instances, and both mean
  the same specific thing: status. A third one dilutes the signature into a decoration.
- **Don't** introduce a second display face or use Space Grotesk for body copy, buttons, or
  labels — it is for headlines and card titles only.
- **Don't** use Space Mono for anything that wasn't measured. Mono-as-texture is the fastest way
  to turn this into the generic dark-terminal tool the design deliberately isn't.
- **Don't** apply the `--pc-*` practice palette outside `.practice-view`, or push global tokens
  into it. They are two rooms, kept separate on purpose.
- **Don't** add ornament without a data reason. A "level meter" glyph was removed for precisely
  this — it can return when per-skill levels actually exist in the schema.
- **Don't** design indicators for ease factors, intervals, or repetition counts. Scheduling is a
  Leitner box: a card's state is its column plus a due date. There is no SM2 here.

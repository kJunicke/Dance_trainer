---
name: dance-trainer-design-system
description: The current design conventions for the Dance Trainer app (Dance_trainer_vue) — the warm-light "training dashboard" palette, type pairing, radii, and the card status-rail signature — plus the design-process lessons learned so far. Load this when doing any design or styling work in Dance_trainer_vue: invoking /frontend-design for this repo, styling a new view or component, adding a due-date/status/level indicator, or handling requests like "make this match the rest of the app," "style this page," "this looks generic," or "improve the UX here." It tells you the conventions to build on so new work stays consistent — the design is still evolving, so treat this as the working baseline to extend, not a frozen spec.
---

# Dance Trainer design system

Working conventions for the visual design of `Dance_trainer_vue`, the Vue 3 + Supabase Kanban app for tracking Modern Jive practice. **The design is not finished.** This exists so new work starts consistent with what's already there instead of re-deriving everything — but it's a baseline to extend and improve, not a lockdown. When something here is clearly wrong for a new problem, or you see a better move, propose it (with reasoning); just don't drift away from the conventions silently or by accident. The one hard rule is negative: don't re-propose the directions the user has already rejected (see History) without flagging that history first.

## Source of truth

The values below are a snapshot for orientation. **The code is authoritative** — check it before relying on a value, since the design keeps moving:
- `Dance_trainer_vue/src/assets/tokens.css` — every color/font/radius/shadow token
- `Dance_trainer_vue/src/components/TaskCard.vue` — the fullest example of the tokens in use, plus the status-rail signature
- `Dance_trainer_vue/src/lib/dates.ts` — `dueStatus`/`dueLabel`, which drive the card status colors
- `Dance_trainer_vue/src/lib/labelColors.ts` — the six label fills and their per-fill text colors
- `Dance_trainer_vue/index.html` — Google Fonts loading

The *reasoning* behind the current values (contrast measurements, what was tried and rejected) lives in the Logseq wiki — start at `Dance_trainer_logseq/pages/contents.md`.

## The through-line: "training console," not "dance-school marketing site"

The one thing to hold constant as the design evolves: the domain (Modern Jive / partner dancing) pulls toward a warm, lifestyle-marketing, dance-hall aesthetic — **resist that pull.** This is the user's personal training log, not a class-booking site, so styling should read as technical and disciplined (a practice/data tool): monospace for data (dates, counts, codes), a semantic status-color system for training state, hairline borders + soft elevation, modest radii over pill shapes. "Training console" is the *attitude*, independent of specific colors. When weighing a new element, ask: *does this read as a practice console, or as a flyer for a dance class?*

The theme is currently **light** (warm paper). It replaced an earlier near-black dark theme that the user found fatiguing to read over long sessions on both phone and desktop (see History) — so legibility and low eye-strain are load-bearing goals, not just aesthetics.

## Tokens (snapshot — verify against `tokens.css`)

Lightness climbs `bg → surface → surface-light` so columns lift off the board and white cards pop off the columns.

| Role | Token | Value |
|---|---|---|
| Board background | `--color-bg` | `#e6e0d4` (warm greige) |
| Column / topbar / input / modal surface | `--color-surface` | `#f0ebe1` |
| Card surface + hover highlight | `--color-surface-light` | `#ffffff` |
| Borders (hairline) | `--color-border` | `#d8cfbf` |
| Primary text | `--color-ink` | `#2a2420` (near-black, warm) |
| Secondary text | `--color-ink-dim` | `#6a6156` (5.11 on surface, 4.62 on bg) |
| Accent **fills and borders** | `--color-ember` | `#e06d0a` |
| Accent **as text**, and the focus ring | `--color-ember-text` | `#a04c00` (5.01 / 5.95 / 4.53) |
| Accent hover fill | `--color-ember-light` | `#f2842a` |
| Status: on track / scheduled | `--color-good` | `#3e9b6e` |
| Status: due today | `--color-due` | `#c98a16` |
| Status: overdue | `--color-overdue` | `#cb4242` |

Use these tokens rather than raw hex in components, so a future palette change stays a one-file edit. If a new element needs a color the system doesn't have, prefer adding a token over hardcoding.

**Contrast trap to remember — this one has been got wrong twice.** The ember accent has *three* tokens and only one of them is legible as text. `--color-ember-light` is a hover fill; `--color-ember` is fills and borders only — as text it is 2.78 on surface and 3.30 on white, i.e. below even the 3.0 non-text floor. Anything that paints ember *as ink* — field-label eyebrows, link chips, the focus ring — uses `--color-ember-text`. The first fix for this replaced ember-light with ember and was recorded as solved; it had only picked the less-bad of two failing options, which is why the token exists now.

Label chips get their text color **per label color**, from `LABEL_TEXT_COLORS` in `src/lib/labelColors.ts` — no single value clears all six fills (white passes on rose/denim/plum, fails on brass/ochre/sage, which take ink instead), and `sage` needed its fill lightened to `#7d9a7a` on top of that. Don't collapse those back to one color.

**A card note's markdown typography is a theming contract, not a token set.** `src/components/MarkdownNote.vue` is the single component all three description surfaces (board card, card modal, practice focus card) render through; it takes no palette props. A host themes it by setting `--note-*` custom properties on the class it puts on `<MarkdownNote>` (a single-root component inherits the host class onto its real root, so scoped host styles still reach it): `--note-font-size`, `--note-ink`, `--note-ink-dim`, `--note-accent` / `--note-accent-bg` (link chip), `--note-hover-bg`, `--note-editor-bg` / `--note-editor-border`, `--note-chip-max`, `--note-block-gap`. Add a new note-facing color or size by setting one of these on the host, not by editing `MarkdownNote.vue` itself. The global heading-size override that used to live in `tokens.css` (keyed off `.task-description`/`.desc-preview`/`.note-preview`) is gone — heading rules now live once inside `MarkdownNote.vue`, still em-relative since the three hosts read at different base sizes (12 / 14 / 14px).

Before changing any color, read the contrast pass in `Dance_trainer_logseq/pages/archive/UX Batches 2026-07.md` (Batch 6) — every value above was measured there, and the reasoning for the ones that were *rejected* is recorded too.

The good/due/overdue trio **is wired into cards** via the due date (`dueStatus`/`dueLabel` in `src/lib/dates.ts` → the status rail below). If richer training state is ever surfaced, these three colors are its home — extend this system rather than inventing a second one. Note the scheduling model is a **Leitner box**: a card's state is the column it sits in plus a due date, and there are no levels, ease factors or SM2 anywhere. The 5-status / SM2 / focus-XP model in `pages/archive/PROJECT_HANDOFF.md` was designed and then explicitly declined — don't design indicators for it.

**Type**: `Space Grotesk` (600–700) for display/headlines *and card titles* — a technical geometric sans, deliberately not the rounder Poppins/friendly-marketing feel. `Work Sans` for body/UI text. `Space Mono` for anything data-shaped: dates, invite codes, counts.

**Radii**: `--radius-sm` 4px, `--radius-lg` 8px — modest, console-like. Avoid pill shapes / heavy rounding; they read as generic consumer SaaS.

**Shadows**: warm-tinted and soft (`--shadow-card`, `--shadow-modal`) — a light UI needs subtle elevation, not heavy black drops.

## Signature: the card status rail

The current memorable, load-bearing detail is the `TaskCard`'s **traffic-light left rail** — see `TaskCard.vue` and `dueStatus`/`dueLabel`. A card with a due date gets a 4px inset left edge colored by urgency (green `scheduled` / amber `due` today / red `overdue`), plus a bottom "meta strip" (matching status dot + a compact relative label like `today`, `3d late`, `in 4d` in `Space Mono`). This is what makes the board *scannable* — "what needs practice today" jumps out. When adding card-level information, extend this strip/rail language rather than bolting on a separate visual system, and keep incidental decoration minimal.

**Removed signature — don't silently re-add:** an earlier dark-theme pass carried a CSS "level meter" glyph (equalizer bars, top-right of each card). It's gone from `TaskCard.vue`. It was a nice "musicality + skill level" idea and could return once real per-skill *levels* exist in the data model — fine to revisit then, but don't reintroduce it as pure ornament without data behind it.

## Process lessons so far

1. **When the user gives a reference site, pull real computed values, don't eyeball screenshots.** Use the browser tools' `javascript_tool` to run `getComputedStyle` on headline/body/accent elements and read the actual `font-family` and hex values (that's how "Poppins, amber-500 `#F59E0B`, stone-950 `#0C0A09`" was confirmed for jive.berlin). Precise values let you deliberately shift *away* from them instead of accidentally landing too close or too far.

2. **"Do something similar" means same spirit, not the same palette or type.** Keep a reference's energy (one bold accent, geometric type) but shift the hex and typeface so it isn't a copy — the ember accent `#E06D0A` descends from jive.berlin's amber `#F59E0B`, and `Space Grotesk` stands in for its `Poppins`. Pick a distinct signature too; don't reuse the reference's own icon/graphic language.

3. **Test a small motif in a real screenshot at real size before committing.** The ballroom notch+thread looked fine as a concept but read as a stray typo mark at actual card size — caught only by rendering and zooming, not by reasoning in the abstract. Render and zoom before locking in a small detail.

4. **Verify legibility on the real thing.** The whole reason for the light pivot was that the dark theme was hard to read over long sessions. When you touch the palette, screenshot the actual board (with real content, at desktop *and* phone widths) and check that text and card edges are comfortably readable — don't trust that a token change "should" be fine.

5. **A whole-identity change is the user's call; per-element work inside the agreed system isn't.** Per this repo's `CLAUDE.md`, present a direction/palette shift as a short plan (brainstorm + self-critique, à la `/frontend-design`) and get a go-ahead before rebuilding everything — an up-front plan has repeatedly saved a wasted full pass. Once a direction is agreed, styling individual components within it doesn't need re-confirmation.

## History (directions already tried)

- **Pass 1 — "Ballroom dance card" (rejected).** Warm aubergine/parquet/brass palette, italic serif (Fraunces), a punched-notch + brass-thread card corner evoking the historical dance-card artifact. User rejected it as "too old and conservative" for a tool that should feel "young and modern." Don't resurrect the antique/nostalgic dance-hall direction without flagging this.
- **Pass 2 — "Training console," dark (superseded).** Near-black `#151311` background, ember-orange accent, Space Grotesk, an equalizer "level meter" card signature. Right attitude, but the dark scheme proved fatiguing for long reading sessions on both devices.
- **Pass 3 — "Training dashboard," light (current).** Kept the console attitude, type system, and ember/status palette family; flipped to the warm-light scheme above and added the scannable status rail. This is the working baseline — still open to refinement.

## When invoked alongside `/frontend-design`

Treat the tokens and conventions here as the current baseline, not a blank canvas: default to the existing palette, type, radii, and the status-rail card language, and keep new screens/components consistent with them. Reserve the full brainstorm→critique cycle for what's genuinely new (a new page's layout, a new data visualization, a signature detail for a feature that doesn't fit the card pattern) — and when you do propose something new, say how it relates to or extends these conventions rather than replacing them wholesale.

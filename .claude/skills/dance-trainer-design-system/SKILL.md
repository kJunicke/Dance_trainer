---
name: dance-trainer-design-system
description: The already-decided visual identity for the Dance Trainer app (Dance_trainer_vue) — color tokens, type pairing, radii, and the card "level meter" signature — plus the design-process lessons learned building it. Load this BEFORE proposing any palette, typeface, or component styling for Dance_trainer_vue, including when invoking /frontend-design for this repo, styling a new view or component, adding a due-date/status/level indicator, or responding to requests like "make this match the rest of the app," "style this page," or "this looks generic." The identity has already been through two design rounds with the user (a rejected direction and an approved one) — don't rediscover it from scratch or re-propose the rejected direction.
---

# Dance Trainer design system

This is a living reference for the visual identity of `Dance_trainer_vue`, the Vue 3 + Supabase Kanban app for tracking Modern Jive practice. It exists so future design work in this repo starts from where the last session left off instead of re-running the whole exploration.

## Source of truth

The values below are a snapshot for quick reference. **The actual source of truth is the code** — always check it before using a value, since it may have drifted since this was written:
- `Dance_trainer_vue/src/assets/tokens.css` — every color/font/radius/shadow token
- `Dance_trainer_vue/src/components/TaskCard.vue` — the fullest example of the tokens in use, plus the signature motif
- `Dance_trainer_vue/index.html` — Google Fonts loading

## Design direction: "training console," not "dance school marketing site"

The domain (Modern Jive / partner dancing) has an obvious pull toward a warm, lifestyle-marketing, dance-hall aesthetic. **Resist that pull.** This app is the user's personal training log, not a class-booking site — every styling decision should read as technical and disciplined (a practice/data tool) rather than decorative or nostalgic (a dance-school brochure). Concretely: monospace for anything data-like (dates, counts, codes), a semantic status-color system for training state, hairline borders over soft shadows, modest radii over pill shapes.

This distinction was hard-won: the first design pass (see History below) was rejected specifically for feeling like a "dance school brochure" rather than a training tool. When in doubt about a new element, ask: *does this read as a practice console, or as a flyer for a dance class?*

## Tokens (snapshot — verify against `tokens.css`)

| Role | Token | Value |
|---|---|---|
| Page background | `--color-bg` | `#151311` (near-black, warm undertone) |
| Card/column surface | `--color-surface` | `#1e1a17` |
| Hover/elevated surface | `--color-surface-light` | `#292420` |
| Borders | `--color-border` | `#3a332c` |
| Primary text | `--color-ink` | `#f4efe9` |
| Secondary text | `--color-ink-dim` | `#b5aea5` |
| Primary accent (CTAs, focus, active) | `--color-ember` | `#f2760c` |
| Accent hover | `--color-ember-light` | `#ff9640` |
| Status: on track | `--color-good` | `#4fa876` |
| Status: due | `--color-due` | `#e0b23d` |
| Status: overdue | `--color-overdue` | `#d14b4b` |

The good/due/overdue trio is **reserved but not yet wired into the domain model** — the skill-tracking rebuild (backlog/acquisition/maintenance/focus/archived statuses, SM2 due dates, per [PROJECT_HANDOFF.md](../../../Dance_trainer_logseq/pages/PROJECT_HANDOFF.md)) hasn't landed yet. When that work happens, these three colors are the intended home for "is this move due / overdue / on track" indicators — don't invent a second status-color system.

**Type**: `Space Grotesk` (bold/700) for display/headlines — a technical geometric sans, deliberately not the rounder Poppins/friendly-marketing feel. `Work Sans` for body/UI text. `Space Mono` for anything data-shaped: dates, invite codes, counts.

**Radii**: `--radius-sm` 4px, `--radius-lg` 8px — modest, console-like. Avoid pill shapes or heavy rounding; they read as generic consumer SaaS, not a training tool.

**Shadows**: black-based (`--shadow-card`, `--shadow-modal`), not neutral grey — grey shadows look wrong against a dark UI.

## Signature motif: the level meter

Each `TaskCard` carries a small CSS-only equalizer/level-meter glyph (4 vertical bars of varying height, in `--color-ember`, top-right of the card) — see `.meter` in `TaskCard.vue`. It reads as musicality + skill-level progress at a glance, and is the one deliberately memorable detail in an otherwise restrained system. Don't add more decorative flourishes elsewhere; the point of a signature element is that there's only one.

**Rejected alternative — do not resurrect:** an earlier pass used a "ballroom dance card" concept: a punched notch + brass thread in the corner of each card, evoking the historical dance-card artifact (a printed card + pencil-on-ribbon used to book dance partners). It paired with a warm aubergine/parquet/brass palette and an italic serif (Fraunces). The user rejected the whole direction as "too old and conservative" for a tool that should feel "young and modern." If a future request nudges toward warm/antique/nostalgic dance imagery, flag the history before going there again.

## Process lessons from building this

1. **When the user gives a reference site, pull real computed values, don't eyeball screenshots.** Use the browser tools' `javascript_tool` to run `getComputedStyle` on headline/body/accent elements and read off the actual `font-family` and color values (e.g. this is how "Poppins, amber-500 `#F59E0B`, stone-950 `#0C0A09`" was confirmed for jive.berlin). Precise values make it possible to deliberately shift away from them, rather than approximating and accidentally landing on something too close or too far.

2. **"Do something similar" means same spirit, not the same palette or type.** When adapting a reference site's direction, keep the energy (e.g. dark + one bold accent) but shift the actual hex values and typeface so the result isn't a copy — e.g. `#F2760C` instead of the reference's `#F59E0B`, `Space Grotesk` instead of `Poppins`. Always pick a distinct signature motif too; don't reuse the reference's own icon/graphic language.

3. **Test a signature motif in a real screenshot at real size before committing to it — don't reason about it in the abstract.** The ballroom notch+thread looked plausible as a concept, but at actual card size (in a zoomed screenshot) it read as a stray typo mark, not a deliberate detail. That was only caught by looking at a rendered screenshot and zooming in, not by describing it in words. Always render and zoom before locking in a small decorative detail.

4. **A full visual-identity change is a decision the user makes, not one to implement unilaterally.** Per this repo's `CLAUDE.md` (division of labor), present the token system / direction as a plan (brainstorm + self-critique, per the `frontend-design` skill's own process) and get a clear go-ahead before rebuilding every component — this happened twice in one session (once per design direction) and both times the up-front plan saved a wasted full implementation pass. Once a direction is confirmed, per-component styling within that system doesn't need re-confirmation.

## When invoked alongside `/frontend-design`

If `/frontend-design` is invoked for something in this repo, treat the tokens and direction above as already-answered brainstorm output — don't restart the palette/typeface exploration. Only run the brainstorm→critique cycle for whatever is actually new (a new page's layout, a new signature detail for a feature that doesn't fit the existing pattern, etc.), and check it against the existing tokens/type/radii rather than proposing fresh ones.

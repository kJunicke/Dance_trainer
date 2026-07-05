# Product

## Register

product

## Users

Primarily the app's own creator/maintainer, tracking personal Modern Jive practice — a solo user
who is also the primary tester. Multi-user support (Supabase Auth + RLS) exists structurally so
other dancers could use it, but they are not the design target today; don't over-build for a
hypothetical wider audience.

The job to be done: log what's been practiced, see what's due for review today via spaced
repetition, and document progress over time (level-ups, practice notes, quick captures) without
the tool getting in the way of an actual practice session.

## Product Purpose

A skill tracker for dance training that documents progress on individual skills and tells the
user what needs practice today via spaced repetition (a 5-status learning system: backlog →
acquisition → maintenance/focus → archived, with SM2-based scheduling). Built on a Kanban board
metaphor. Success looks like: opening the board and immediately knowing what's due, logging a
practice session in a few taps, and having a durable record of how a skill progressed over months.

## Brand Personality

**Technical, disciplined, unfussy** — a practice console, not a dance-school marketing site. The
domain (partner dancing) pulls toward warm lifestyle/dance-hall aesthetics; the product
deliberately resists that pull in favor of a data-tool feel: monospace for data (dates, counts),
a semantic status-color system for training state, hairline borders, modest radii. It should feel
like an instrument the user trusts daily, not a flyer.

## Anti-references

- Dance-school / class-booking marketing sites — overly warm, lifestyle-photography, pill-shaped
  buttons, soft "friendly" rounding.
- Nostalgic/antique ballroom aesthetics (aubergine + brass + italic serif + punched dance-card
  motif) — tried and explicitly rejected as "too old and conservative" for a tool meant to feel
  young and modern.
- Generic consumer SaaS card grids with heavy rounding and gradient accents.
- A near-black dark theme was also tried and superseded — it read as the right technical attitude
  but proved fatiguing over long reading sessions on both phone and desktop. The current theme is
  warm-light paper; legibility over long sessions is a hard constraint, not just an aesthetic
  choice.

## Design Principles

1. **Training console, not dance-hall flyer** — when in doubt, ask "does this read as a practice
   tool, or as marketing for a class?" and pull toward the former.
2. **Status is scannable at a glance** — the due/overdue/on-track state of a skill should be
   readable from across the room (or a quick glance at a phone), not require reading text.
3. **Legibility over long sessions wins over stylistic boldness** — this is opened daily, often on
   a phone mid-practice; eye strain and contrast failures are real usability bugs here, not nitpicks.
4. **Extend the existing system before inventing a new one** — new indicators (levels, focus state,
   etc.) should extend the status-rail/color-token language already established, not bolt on a
   parallel visual system.
5. **Data-tool honesty over decoration** — monospace for data, minimal ornament, no ornamentation
   without an underlying data reason (e.g. the old "level meter" glyph was removed until real
   per-skill levels existed to justify it).

## Accessibility & Inclusion

No formal WCAG target set. Follow general good practice: solid contrast (verify against the
warm-light background, which is an easier contrast trap than pure white), reduced-motion support,
and don't rely on color alone for the good/due/overdue status trio — pair it with position
(the status rail), an icon/dot, or text label as already done via `dueLabel`.

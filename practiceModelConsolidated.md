# Consolidated Practice Model for the Dance Trainer

*One rule set assembled from the five research briefs, with their contradictions resolved or explicitly left open. This file cites the briefs, not the papers; follow the section pointers for evidence.*

---

## The five briefs and how to read them

| File | Level | Question it answers |
|---|---|---|
| `motorLearningForDance.md` (parent) | Inside a rep | How to cue, feed back, calibrate difficulty, coach under pressure |
| `withinSessionPracticeStructure.md` | Inside a session | Reps per figure, when to switch, interleaving, fatigue |
| `sessionCompositionAndPeriodization.md` | Building a session and a week | Order, count, new:review, competition cycle, load, autonomy |
| `spacedRepetitionForMotorLearning.md` | Between sessions | Days between practices, interval shape, decay, SM-2/FSRS fit |
| `selfAssessmentSignal.md` | The feedback loop | What to ask the dancer so the scheduler has a trustworthy input |

Evidence labels are the parent's (PRIMARY / RCT-BACKED / META-BACKED / THEORY-DERIVED / CONTESTED / SPECULATIVE). Each rule below carries the label of its weakest link. Every concrete number in this file is a **SPECULATIVE engineering default** unless labelled otherwise.

---

## The one-paragraph answer to the original question

"Practise often at the edge of ability" and "leave time between practices" are not in conflict, because they turn different dials. Difficulty is set *within* a session (parent §4, challenge point). Spacing is set *between* sessions, and the motor evidence says spacing across days costs nothing in acquisition and buys retention; consecutive-day practice *is* spaced practice (spacing §0, §1b). The only thing that actually opposes spacing is cramming a week's reps into one block, and that loses on both acquisition and retention. The "expand the gap on success" logic of flashcard systems has no motor evidence and near-zero verbal evidence; motor skills also forget an order of magnitude more slowly than facts, so a fixed ladder of intervals with a cap is closer to the evidence than an SM-2 port (spacing §2, §3, §7d). Inside a session, "don't grind one thing for an hour" is right, but because of diminishing returns and reactive inhibition, not because interleaving is powerful; the applied interleaving effect is around 0.2 SD and about zero for under-18s (within-session §0).

---

## Unified card state model

The briefs use three overlapping vocabularies. The app should have **one per-card maturity state** and **one per-board phase**.

**Per-card maturity** (replaces spacing's Acquiring/Consolidating/Maintaining, within-session's New/Stabilising/Established/Competition-locked, and session composition's cognitive/associative/autonomous stage):

| State | Definition (observable) | Spacing brief | Within-session brief | Composition brief |
|---|---|---|---|---|
| **New** | Cannot yet be performed from memory | Acquiring | New | cognitive-stage |
| **Stabilising** | From memory, but error-prone or not clean at tempo | Consolidating | Stabilising | associative-stage |
| **Established** | Clean on a cold attempt across sleep, twice | Maintaining | Established | autonomous-stage |
| **Locked** flag | Established *and* part of a competition routine | (Maintaining, routine coupling) | Competition-locked | routine slot / freeze window |

Transitions are driven by the cold-attempt outcome (below). New → Stabilising: first clean from-memory attempt. Stabilising → Established: clean cold attempt at the start of two separate sessions. Lapse: one state back, never to New from Established (spacing §7a, "relearning is fast").

**Per-card kind**: *discrete* (a named figure, an amalgamation, a phrase) vs *continuous* (frame, sway, footwork quality, posture). Discrete cards decay faster and sit on the short end of every interval; continuous cards on the long end (spacing §3, §7a). **META-BACKED distinction, SPECULATIVE mapping.**

**Per-board phase**: Build / Adapt / Perform, changing the session *template* not the card pool (composition §7.3). A competition date turns on the Perform freeze window (default 7 days) automatically.

**Per-card relations**: `conflicts-with` (confusable siblings: mirror variants, same figure different timing) and `family` (figures that maintain each other; a routine and its member figures). Composition §7.2 and spacing §7d.

---

## Rules by level

### Level 0: Inside a rep (from `motorLearningForDance.md`)

These are coaching rules, not scheduling rules. They constrain how the app words prompts and shows feedback; lettered so the numbered scheduling rules stay stable.

- **A. Judge by retention, never by how the rep looked.** Every UI copy and every state transition in this file follows from this; the app must never present a clean end-of-visit as "learned". *(parent TL;DR 1; PRIMARY/THEORY-DERIVED.)*
- **B. Predict before you check.** Any feedback the app shows (video, demo, partner note) comes *after* the dancer has committed to an estimate of their own error. Rule 24's prospective tap is the minimal version of this. *(parent §2; RCT-BACKED, simple task.)*
- **C. Difficulty is per dancer and per card, not a success percentage.** Raise nominal difficulty (tempo, size, less prep, harder entry) to hold functional difficulty near the challenge point; keep errors small enough to be believed as "mine". The variation axes in rule 20 are this dial. *(parent §4; THEORY-DERIVED.)*
- **D. Cue toward effect and image, not body part, but hold it loosely.** Card notes and prompts default to external cues; the app does not enforce it, because the corrected effect is small and unresolved. *(parent §1; CONTESTED.)*
- **E. Marking is a first-class practice mode**, not a lesser one. Rule 8 makes it the default for routine slots. *(parent §9, Warburton 2013; RCT-BACKED.)*
- **F. Competition skills are built implicitly and left alone under pressure.** No explicit technical corrections on Locked cards; analogy cues over rule lists. This is the mechanism behind the freeze window in rule 12. *(parent §5; RCT-BACKED for the effect.)*
- **G. Mental practice and observation are legitimate exposures for a card that cannot be danced today** (injury, no floor, travel), at lower weight than a physical visit. Whether they should push `due_date` is an open question. *(parent §8; META-BACKED for mental practice, SPECULATIVE as an app rule.)*
- **H. Match method to stage.** The per-card maturity state above is the parent's Fitts & Posner mapping; the state, not the dancer's overall level, selects the rules. *(parent §6; THEORY-DERIVED.)*

### Level 1: Between sessions (from `spacedRepetitionForMotorLearning.md`)

1. **Minimum gap is one night.** A second practice of the same card on the same day counts as no new exposure; `due_date ≥ last_practiced_on + 1`. *RCT-BACKED (lab/surgical), SPECULATIVE in dance.*
2. **Fixed ladder of intervals, columns are rungs.** Suggested rungs 1–2 d / 3 d / 7 d / 14 d / 30 d. The current per-column `due_offset_days` already expresses this and matches the evidence better than a continuous formula. *RCT-BACKED direction, SPECULATIVE rungs.*
3. **New cards stay on the bottom rung until Stabilising**; do not expand on success while New. *THEORY-DERIVED.*
4. **Cap the top rung at about 30 days for discrete cards**; continuous cards may exceed it. Monthly refreshers beat quarterly in the only long-horizon dose-response study. *RCT-BACKED (CPR) / SPECULATIVE cap.*
5. **Movement between rungs is proposed by the app from the cold-attempt outcome and confirmed by the dancer.** Clean → up one rung. Clean after a stumble → hold. Broke down or needed the demo → down one rung. Never more than one rung per session. *SPECULATIVE.*
6. **A routine run-through is a partial exposure for its family members**: push `due_date` out, do not change the rung. *SPECULATIVE.*
7. **Do not build** a fitted forgetting curve or a desired-retention slider. *META-BACKED reasoning.*

### Level 2: Building a session (from `sessionCompositionAndPeriodization.md`)

8. **Slot order:** opener (1–2 Established cards, unscored) → New/technical cards → Stabilising and variable work → routines last, marked by default. *THEORY-DERIVED; fatigue-and-learning is CONTESTED but the downside is asymmetric.*
9. **At most 1 New card per session for novices, 2 for experienced dancers.** No cap on total cards; the session's time budget and load cap are the limit. *SPECULATIVE.*
10. **At most one member of a conflict set in the New slot; its established sibling only in the routine slot and never adjacent.** *PRIMARY mechanism, SPECULATIVE mapping.*
11. **New:review by time ≈ 20:80 in Build, 10:90 in Adapt, 0:100 in Perform.** *SPECULATIVE; no intake-rate evidence exists.*
12. **Freeze window before a competition:** no New cards, no changes to Locked cards, every competition routine run whole at least once per session, video feedback near zero. *PRIMARY mechanisms, SPECULATIVE window.*
13. **Two to four consequence-laden pressure run-throughs in the last two weeks.** Pressure comes from consequences, not harder tasks. *META-BACKED effect, SPECULATIVE dose.*
14. **Load:** log session-RPE × minutes, warn on week-on-week growth above 10–15 % and on any spike before a competition, protect one rest day per week, show no acute:chronic ratio. *PRIMARY/META for the pattern, SPECULATIVE thresholds.*
15. **Propose, then let the dancer reorder, drop, swap or add in one gesture.** Justified by fit-to-the-day, not by a learning gain. Hard rules (conflict sets, freeze, load) survive edits with explicit override. Edits are preference data. *META-BACKED null on learning.*

### Level 3: Inside a session (from `withinSessionPracticeStructure.md`)

16. **Stopping rule per visit is behavioural:** repeat until the error is corrected and execution is stable, then stop. *PRIMARY.* Default implementation: *k* consecutive clean reps, hard cap of about 8–10 reps, or two consecutive worse-than-before reps. *SPECULATIVE.*
17. **Contingent switching:** never switch after a failed rep; switch after *k* clean reps. *k* is the interleaving dial: 3 for New, 2 for Stabilising, 1 for Established. Under-18 users one row more conservative. *RCT-BACKED for the rule, SPECULATIVE for the values.*
18. **Reps inside a visit may be tight; the rest belongs between visits.** *RCT-BACKED (single lab study).*
19. **One visit per card per session.** Optional end-of-session cold check of the cards practised, one rep each in random order, logged separately. *SPECULATIVE.*
20. **Variation axes are tempo and entry figure.** Target variant until stable, then one or two spread variants, end on the target. Locked cards: target variant only. *PRIMARY for especial skills and tempo variation, SPECULATIVE structure.*
21. **Stop technical work before muscular fatigue.** Soft prompt after about 25–30 minutes of technical work, labelled as a default in the UI. *PRIMARY for the fatigue effect, SPECULATIVE timer.*
22. **Do not claim** that interleaving makes a big difference, that any rep count is optimal, or that a clean end of visit means the figure is learned.

### Level 4: The signal (from `selfAssessmentSignal.md`)

23. **The scheduler consumes exactly one rating per card per session: the outcome of the cold attempt.** No demo, no warm-up reps of that figure. *RCT-BACKED mechanism, SPECULATIVE protocol.*
24. **Prospective tap first:** "Will the first run at target tempo be clean? Yes / No." Then the attempt. Prediction versus outcome yields a per-user, per-figure calibration score. *RCT-BACKED for prediction-before-feedback.*
25. **Four behaviourally anchored outcomes on the checkable layer** (count, feet, entry/exit, tempo held): Clean first try · Clean after a stumble · Broke down · Had to check the demo. *THEORY-DERIVED; the point count is not evidence-based.*
26. **A demo view before the attempt voids "Clean" for scheduling.** Log demo viewed before/after as its own flag. *RCT-BACKED.*
27. **Log objective proxies:** highest clean tempo, attempts to first clean rep, time since last practice, first-of-session flag. Optional partner or coach rating on the same anchors, flagged external. *RCT-BACKED that tempo-at-criterion is retention-sensitive.*
28. **Weight the subjective part by calibration; novices start low.** Do not let a rating drop after a difficulty increase trigger easier scheduling. *META-BACKED direction, SPECULATIVE scheme.*
29. **Avoid:** per-rep ratings in drills, numeric scores or stars on a figure, cross-dancer comparison, fabricated social feedback, demo-by-default, global "how good was that" questions, and self-efficacy or "confident for competition" as a scheduling input.

---

## Contradictions between the briefs, and how they are resolved here

**C1. Two rating scales.** The spacing brief proposes a 5-point scale (spacing §7b); the self-assessment brief a prospective yes/no plus 4 anchored outcomes (self-assessment §6.1). **Resolution:** use the self-assessment brief's format, which is built on the bias evidence. Map to rungs: Clean → up, Clean after a stumble → hold, Broke down / needed demo → down. The spacing brief's fifth point ("automatic, at tempo, with variation") becomes the highest-clean-tempo proxy and the Established → Locked flag, not a scale point.

**C2. Per-rep rating versus once-per-session rating.** The within-session brief runs its clean-streak counter on a self-estimate per rep (within-session §6.1); the self-assessment brief says never rate after every rep of a drill (self-assessment §5, §6.4). **Resolution:** separate the two signals. The streak counter is a transient tally that exists only to end the visit and is never stored or fed to the scheduler; the UI should make it as light as possible, ideally a single "stable now, next" tap rather than a grade per rep. Only the cold attempt is stored. This is an engineering resolution, not an evidenced one; **SPECULATIVE**.

**C3. Cold attempt versus warm-up decrement.** The composition brief says ignore the first 2–3 attempts after any pause when scoring (composition §7.1 rule 5); the self-assessment brief says the *first* attempt, cold, is the only trustworthy one (self-assessment §6.1). **Resolution:** the two measure different things. The cold attempt measures *retrieval* on the checkable layer, and its fail boundary ("broke down" / "needed the demo") is robust to warm-up decrement, which degrades timing and quality, not recall. Warm-up decrement applies to any *quality* judgment, which the scheduler does not use. Order of operations: general opener with other Established cards (unscored, body is warm) → cold attempt of the card in question as its first rep → visit. **Left open:** whether a "clean after a stumble" on a cold attempt is retention or decrement cannot be separated by the app; it is treated as hold, which is the safe reading either way.

**C4. Cold check at the end of this session versus cold attempt at the start of the next.** The within-session brief proposes an end-of-session cold check that "feeds the between-session scheduler" (within-session §6.3); the self-assessment brief excludes end-of-session judgments from scheduling. **Resolution:** the start-of-next-session cold attempt is the scheduler's input, because it crosses sleep and is the closest thing to a retention test. The end-of-session cold check is optional, logged, and used only to decide whether to re-open a visit today. If both exist, the scheduler ignores the end-of-session one.

**C5. Interval shape.** The user's hypothesis and the app's natural SM-2 instinct both assume expanding intervals; the spacing brief finds no motor evidence for expansion and the composition brief's Perform phase wants *shorter* intervals for Locked cards near competition. **Resolution:** the ladder is fixed and coarse, phase can override it downward (freeze window: every Locked card is due every session), and no card is ever auto-expanded beyond the next rung.

**C6. "New cards first" versus "opener first".** Within-session §6.6 says new cards first; composition §7.1 says opener first. Compatible: opener is body warm-up on unscored Established cards, then New. Adopted as rule 8.

**C7. Self-selected order.** The within-session brief leans on Keetch & Lee / Wu & Magill as mild positives; the composition brief cites the 2022 meta-analysis collapsing the effect to zero in pre-registered studies. **Resolution:** offer the choice, justify it as usability, claim no learning benefit. Both briefs already say this; the difference is emphasis.

---

## What the current app can and cannot express

**Expressed today** (per `boardFormat.ts`, `dates.ts`, `boardStore.ts`): a fixed-interval ladder via `due_offset_days` per column, `last_practiced_on`, `due_date`, and sessions built from due cards. This is the right skeleton and should be kept.

**Not expressible today, in order of leverage:**

1. **One-night minimum and same-day collapse** (rule 1). A guard in the store, no schema change.
2. **Cold-attempt capture** (rules 23–27): prospective yes/no, 4-point outcome, demo-before flag, target tempo, attempts to first clean. This is the single feature every other rule depends on.
3. **Per-card maturity state and kind** (state model above). Today maturity is implied by column; that breaks as soon as phase overrides the interval.
4. **Proposed rung movement** (rule 5) from the cold-attempt outcome, confirmed by the dancer.
5. **Session builder with slots** (rules 8–11) instead of a flat due list, plus one-gesture editing (rule 15).
6. **Board phase and competition date** with the freeze window (rules 12–13).
7. **Conflict sets and families** (rules 6, 10).
8. **Visit stopping rule and contingent switching** (rules 16–17), with the transient streak tap.
9. **Load logging** (rule 14).

**Do not build:** a fitted forgetting curve, a desired-retention slider, an acute:chronic ratio, per-rep grades, stars or scores on figures, or any cross-dancer comparison.

---

## Open questions the research cannot settle

- What a card should be: figure, element, or routine chunk. The briefs assume "a named figure" but the family/routine coupling suggests routines need to be first-class. To be decided against real boards.
- The exact rung values, the 30-day cap, the *k* values, the rep cap, and the 7-day freeze are all defaults to expose and log, not findings.
- Whether a "clean after a stumble" cold attempt should ever advance a rung after enough consecutive holds.
- Adherence and habit design are out of scope of all five briefs.

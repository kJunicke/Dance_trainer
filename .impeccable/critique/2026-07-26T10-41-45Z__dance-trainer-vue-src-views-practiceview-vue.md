---
target: the practice view
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-07-26T10-41-45Z
slug: dance-trainer-vue-src-views-practiceview-vue
---
Method: dual-agent (A: ac91d81cc4f691df3 · B: ac3cc65deaefab4e3)

Target: the practice companion view — `views/PracticeView.vue` + `components/Practice*.vue` + `stores/practiceSessionStore.ts` (2199 lines, of which `PracticeQuickAdd.vue` and the swipe-to-remove work are uncommitted).

Viewport note: `resize_window` is a no-op under the tiling WM. Assessment A worked around it with a same-origin 390×844 iframe and got a **real** phone viewport, so its wrapping/line-length/touch-target findings are genuine. Assessment B measured at 1920 and correctly discarded its own `line-length` hits as artifacts. Where the two disagree on anything width-dependent, A wins.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | `PRACTICE QUEUE (2)` sums pending + to-sort; swipe-remove fires silently; board name `display:none` at ≤640px |
| 2 | Match System / Real World | 3 | "To sort" / `52d late` are excellent; Review shows column names but never the intervals they encode |
| 3 | User Control and Freedom | 1 | No undo anywhere; Review's ✕ scrolls off with a long note; no `Escape` handler; no exit from practice mode |
| 4 | Consistency and Standards | 2 | Three focus styles where DESIGN.md asserts one; pill FAB + pill tabs against an explicit ban; three names for "add" |
| 5 | Error Prevention | 1 | `Create "dro"` offered after 3 chars; `Library und Backlog` styled identically to a ladder rung; taps swallowed during 180ms FLIP |
| 6 | Recognition Rather Than Recall | 2 | Card title and status scroll out of the focus card; history line sits ~750px above the buttons that consume it |
| 7 | Flexibility and Efficiency | 3 | Genuinely strong gesture set and session persistence; docked for silent no-op Enter and Done FAB last in tab order |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained and disciplined; docked for the 253px permanently-empty Added panel and the empty focus card |
| 9 | Error Recovery | 1 | Failed `addCard` returns silently; no error state exists in this surface at all |
| 10 | Help and Documentation | 2 | Swipe-to-remove has no affordance; "Tap to undo" lives only in a `title` attribute, invisible on touch |
| **Total** | | **20/40** | **Acceptable — significant improvements needed** |

## Design Specificity Verdict

**Split, and the split falls in the wrong place.** The companion screen is authored for this product. Session Review — the one screen where the Leitner thesis actually lives — is a generic list-app form.

**Authored for this product:** the empty state reports the board's situation and then deliberately stops rather than auto-seeding; the session store contains no `Date` at all, so a pocket-killed phone resumes mid-session with no midnight expiry; `.row-dot` is a 3px bar rather than a circle because a rose label dot was pixel-identical to an overdue status dot; the Done receipt floats *above* the FAB because the thumb that pressed it is covering the button.

**Category-interchangeable:** Session Review's bucket grid renders an ordered Leitner ladder (`Wöchentlich / 2 Wöchentlich / 3 Wöchentlich / Monatlich / 2 Monatlich`) as an unordered ragged `flex-wrap`, with no intervals shown, no indication of the card's current rung, and `Library und Backlog` — a parking column that leaves the card unscheduled — styled identically to a rung. The focus card is `meta / title / history / MarkdownNote`; with a real note the title is out-massed ~10:1 and scrolls out of view, and with no note it's a 400px void. The Done FAB is a literal Material FAB (999px pill, modal shadow, `scale(0.96)`) on a system whose stated geometry is "4px, nothing floats, pills appear exactly twice as tracks".

**Deterministic scan:** `detect.mjs` returned **0 findings, exit 0** across all six practice files. Verified as a real pass, not a silent skip: `.vue` is a supported extension, `--no-config` gives the same result, and the detector does fire elsewhere in this codebase (one `side-tab` hit on `ToastStack.vue:54`, which DESIGN.md already sanctions as one of exactly two status rails). The static slop-detector has nothing to say here — every issue below is compositional or measured, which is the honest read on a codebase this deliberate.

**Browser overlay** (4 states injected, overlay server on :8400, stopped cleanly; Vite left running): recurring `undersized-ui-text` on `a.md-link-chip` at 10px, traced to the **shared** `MarkdownNote.vue:705` — not practice-specific. Plus one advisory `gpt-thin-border-wide-shadow` on the quick-add panel and one `cramped-padding` in a Session Review markdown block.

## Overall Impression

This is careful, opinionated work with a real point of view — and it stops one screen short. Four-fifths of the surface shows physical reasoning about a specific body in a specific room. Then Session Review, the only irreversible write in the app and the moment the Leitner box becomes visible, got a `flex-wrap` of buttons. The single biggest opportunity is to design that screen at the standard of the rest.

The second theme is an inverted risk gradient: the reversible action (remove from queue) is painted overdue-red and shouts; the irreversible one (writing the schedule, explicitly no-undo) is eight quiet identical outline buttons.

## What's Working

**The empty state refuses to help too much.** It reports "12 cards due, 12 overdue" and then stops. The code comment states why: picking what to drill is the user's call. Auto-seeding was proposed by a prior critique and rejected. Correct, because the real constraint is physical — you drill what your body is about to do, and no urgency sort knows that.

**The session model matches the failure mode of the room.** `practiceSessionStore.ts` has no `Date`, keys on `practice-session:{boardId}`, and mirrors view mode the same way. A phone that sleeps in a pocket and gets background-killed resumes into the same queue in the same order, with no midnight expiry silently discarding a done-but-unsorted card.

**One gesture, three outcomes, cleanly resolved.** `PracticeSessionList.vue:118-148` disambiguates swipe / drag / focus from the first 10px of movement; the grip skips the 350ms long-press because waiting would contradict the affordance it advertises; `touch-action: pan-y` keeps the list scrolling. The `.dragging` comment documents a genuine TransitionGroup FLIP trap.

## Priority Issues

### [P0] Session Review buries the decision behind the reference material
`PracticeSessionReview.vue:85-107` renders the full `PracticeFocusCard` — entire markdown note included — between the question and the buttons that answer it. `.review` is the scroll container, so the header, progress counter, card title, status, history line **and the ✕** all scroll away. Measured on a real card: `scrollHeight 987 / clientHeight 844`; at the buttons, nothing identifying the card remains on screen.

**Why it matters:** this is the only irreversible write in the app and there is deliberately no undo. The user chooses an interval for a card they can no longer see, using history evidence that has scrolled off, with no way to abort. One-handed, mid-practice, that's a coin flip.

**Fix:** three fixed zones. Sticky `.review-head` carrying `1 of N`, title, status chip, history line and ✕. Note collapsed to `max-height: 6em` behind a `show note` toggle — it's reference, not the subject. Bucket grid in a fixed bottom tray inside `env(safe-area-inset-bottom)`. Add an `Escape` handler alongside `useBackButtonClose`.

**Suggested command:** `/impeccable shape`

### [P1] The bucket grid throws away the Leitner ladder
`PracticeSessionReview.vue:40-52, 89-99` renders every column as an identical `.bucket-btn` in no meaningful order. The `due_offset_days` each encodes — the entire scheduling meaning — is never shown. The card's current rung is never shown. `Library und Backlog` leaves the card unscheduled and sits one thumb-width from `2 Monatlich`, styled the same.

**Why it matters:** this is where the product's model becomes visible or doesn't. The judgement being made is relative and ordered ("it went well, move it up"); the UI presents an unordered set of proper nouns. It also makes the most product-specific screen the most generic-looking one.

**Fix, entirely within the existing system:** sort buckets by `due_offset_days` ascending; print the interval under each name in Space Mono (`Wöchentlich` / `7d`) — a measured value, so it passes The Measured-Value Rule; mark the card's current column with the existing ember selection treatment so up/down is spatial; move `due_offset_days === null` columns below a hairline into a labelled Park group. No new colour system, no ease factors, no intervals invented — this only surfaces a field that already exists.

**Suggested command:** `/impeccable shape`

### [P1] Touch targets — the largest and most mechanical cluster
Both assessments measured this independently and agree exactly. In the drawer state, **28 of 32 interactive elements are under 44px**. Named: `.bar-btn` "+ Add" / "Review (n)" at **28px**; `.md-add` **29px**; `.more-link` **31px**; `.mode-btn` Board/Practice **32px**; `.close-btn` **32–36px**; `.search-btn`, `.list-header`, and 13 drawer column `.tab`s at **40px**; `a.md-link-chip` at **19px**, seven of them stacked. Passing: `.list-row` 44, `.done-fab` 48, `.search-input` 44.

All are height-axis and fixed-px, so they're viewport-independent — B's failed resize doesn't weaken this. DESIGN.md commits to a 44px minimum with a 40px exception for icon-only board controls; most of these are neither.

**Why it matters:** the stated target is one-handed use mid-practice with a moving hand. A 19px link chip to open a reference video is not hittable in that posture.

**Suggested command:** `/impeccable adapt`

### [P1] Contrast — three failures the text-sweep missed, all non-text or opacity-derived
Assessment B swept every rendered **text** element in the dark palette and found **zero failures** (tightest: 5.59:1 on the overdue label). That result stands. Assessment A then measured the things a text sweep doesn't see, and found three:

- `.checkbox` (`PracticeAddDrawer.vue:402`) is `1px solid var(--pc-border)` = **1.53:1**. That is the exact number the codebase already calls out and fixed for the grip at `PracticeSessionList.vue:441-442` ("visible enough to be decoration, not enough to be a control"). This is the primary control of the add-drawer screen. Also `border-radius: 5px`, off the 4/8 scale.
- `.list-row.done` (`PracticeSessionList.vue:509-511`) is `--pc-ink-dim` at `opacity: 0.5` → **2.86:1** at 14px, on rows whose only job is tap-to-undo. Opacity multiplies through every child including the ✓.
- The global focus ring `--color-ember-text` `#a04c00` (`App.vue:35-38`) measures **3.04–3.21:1** on the `--pc-*` surfaces. **Both assessments flagged this independently**, and both noted the code comment reasons only about the light board ("4.53 there and 5.95 on a white card") — the dark palette was never among the surfaces measured. Three components silently override it with a brighter ember (`PracticeView.vue:263`, `PracticeQuickAdd.vue:248`, `PracticeAddDrawer.vue:284`), an implicit admission it's too dark, while queue rows, drawer rows, tabs, checkboxes and Review's buckets keep the dark one. Net effect: focusing a queue row makes it look *less* selected than the active row.

**Fix:** add `--pc-focus: #ff8a3d` to the `.practice-view` scope, add one rule `.practice-view :focus-visible { outline-color: var(--pc-focus) }`, delete all three component overrides. Give `.checkbox` a `--pc-ink-dim` border. Replace `.list-row.done`'s `opacity: 0.5` with an explicit dimmed colour clearing 4.5:1.

**Suggested command:** `/impeccable polish`

### [P2] Quick-add's keyboard path dead-ends, and the create row fires on typos
`onEnter` (`PracticeQuickAdd.vue:105-109`) takes `results[highlight]` with `highlight` starting at 0 over a list that deliberately includes already-queued cards, and `add()` returns immediately if `isInSession`. Typing `dro` then Enter produces **nothing** — no receipt, no message, query unchanged. Separately `canCreate` (`:52-56`) is true as soon as one character has no exact match, so `+ Create "dro" in Inbox` appears after three keystrokes; one arrow-down plus Enter writes a junk card to the board. And `createCard()` (`:96-98`) returns silently when `addCard` yields `null`, so a failed create is indistinguishable from no tap.

**Fix:** clamp `highlight` to the first non-queued row; if Enter still lands on a queued row, set `justAdded` to "{name} is already queued" rather than returning silently. Gate `canCreate` on `q.length >= 3` and require the create row to be explicitly highlighted rather than inheriting Enter by fallthrough. Surface the `null` return.

**Suggested command:** `/impeccable harden`

## Persona Red Flags

**Casey (distracted mobile — the stated design target)**: the empty state's only CTA renders at ~y=166 in a top-anchored column, the worst point on an 844px screen for a thumb. `+ Add` is 56×28. Link chips are 156×19, seven stacked. Swipe-to-remove has no peek, no hint, and the swipe pushes the card name off the left edge — "Drops" reduced to "ps" — so you confirm against a blank row, then it fires silently. Taps during the 180ms FLIP are swallowed (`.row-leave-active` is `position: absolute` with no `pointer-events: none`); three taps on the same spot produced one add, twice. In practice mode there is no back button and no board name, so reopening the phone mid-session you can't tell which board you're in or leave it.

**Sam (keyboard / screen reader)**: the Done FAB is **last** in tab order — after seven link chips, the add block, the list header and every queue row — purely from template order. Queue rows carry no state semantics: verified, `PracticeSessionList.vue` contains exactly one aria attribute in the entire file (`aria-hidden` on the grip). No `aria-current`, no `aria-pressed`; a screen reader hears "Drops, button" / "Blindfold, button" with nothing marking the focused drill. `.row-dot` is colour-only with no label — and the codebase already knows why that's wrong, since the drawer renders `dueLabel()` text next to its dot for exactly this reason. The grip is `aria-hidden` with no keyboard reorder path, so reordering the queue is keyboard-impossible. `.search-btn` carries only `:title` (verified, `BoardView.vue:575`) — `title` does compute an accessible name, so B's "clean" read was technically right, but it's a weak name that never surfaces on touch.

**Riley (stress tester)**: `.row-title` is `nowrap` + `text-overflow: ellipsis` with no `title` attribute, so two long sibling drills truncate to identical rows — the focus card handles this correctly with `overflow-wrap: anywhere`, the list doesn't. `.row-slot` has no `overflow: hidden`, so a translated row slides past the list padding and off the viewport. The FAB is `position: fixed` at `bottom: var(--session-list-height) + 12px` — the middle of the scroll region — so note content passes behind an opaque pill, while `.practice-body`'s bottom padding reserves space at the end of the document instead.

**Project-specific — "Kilian between songs"** (derived from PRODUCT.md): the solo maintainer-dancer, only user, primary tester, 90 seconds between run-throughs. He built the schema, so he knows `Wöchentlich` means 7 days — **which is exactly why nobody noticed the ladder was never rendered**. The interval knowledge lives in his head, not on screen, and Review shipped as a column picker because to its author it reads as one. His specific breaks: the board is German and the UI is English, so every sentence code-switches (`Practiced — where should it go?` above `Wöchentlich`; `Keep in Today` beside `Library und Backlog`). `12 cards due, 12 overdue` is parseable only by someone who knows `readyCounts.due` includes overdue. And the one thing he can't get from his own head — "this was weekly and it went well, so where now?" — is the history line, rendering 750px above the buttons that consume it.

## Minor Observations

- `PRACTICE QUEUE (2)` sums pending + done; with one of each it reads as "2 left to drill". Split it: `1 to go · 1 to sort`.
- `.receipt-enter-active` / `.receipt-leave-active` (`PracticeView.vue:245-251`) have **no** `prefers-reduced-motion` counterpart — verified, and both assessments independently found this to be the *only* gap in the surface. The two blocks in that file cover `.done-fab` and `.focus-swap-*` only. DESIGN.md: "nine of them and no exceptions."
- `.done-header` "TO SORT (n)" is `--pc-good` green. Green in this system means scheduled / on track; these cards are specifically not scheduled yet. The colour says the opposite of the label.
- The quick-add backdrop is `rgba(0,0,0,0.55)` over `#14100c` — on near-black that's a barely perceptible dim, and the modal doesn't read as modal. Needs a blur or a much heavier scrim on this palette.
- `.tabs` has `scrollbar-width: none` with the 4th tab cut mid-word and no edge fade; nothing indicates more columns exist.
- `.create-row`'s dashed border is `--pc-border` at 1.53:1 — the "this one writes to the board" distinction is nearly invisible.
- `.added-section` is `height: clamp(200px, 30vh, 270px)` unconditionally — 253px reserved on a 390px screen, holding one italic line when empty, leaving 397px for the browse list. Suggest `clamp(96px, 14vh, 270px)`: two reserved slots stop the layout jump, five hold the screen hostage.
- A native scrollbar renders inside `.practice-body`, ~12px of gutter on a mobile-first surface.
- `Review complete` / `Queue sorted` / `Nothing to sort yet.` — three headings for adjacent states in `PracticeSessionReview.vue:80, 116, 120`.
- **Retracted:** A reported the header showing `v0.8.1 (dev)` against HANDOFF.md's claimed 0.9.0 bump. Verified false — `package.json` is `0.9.0` and `BoardSelectView.vue:12` reads `__APP_VERSION__`, injected by `vite.config.ts:24` at server start. The dev server predates the bump; the build is correct.

## Questions to Consider

1. If Session Review is where the Leitner box actually happens, why is it the least-designed screen in the app? Every other surface got a considered gesture and a documented rejected alternative. Would a stranger reading that screen be able to tell it's a ladder at all?
2. The user picks the interval "so it's a deliberate decision rather than an algorithm's output" — but the screen never shows the intervals. What is deliberate about a choice made from proper nouns? Would printing `7d / 14d / 21d / 30d / 60d` and marking the current rung make it more deliberate, or does the distinction from SM2 collapse the moment the numbers are visible?
3. What if the focus card led with the note instead of pretending to be a card? The queue row below already carries the card's identity permanently, and the title scrolls away anyway.
4. The one reversible action is painted red and shouts; the one irreversible action is quiet and undifferentiated. If you swapped the emphasis, would anything be lost that you'd miss?

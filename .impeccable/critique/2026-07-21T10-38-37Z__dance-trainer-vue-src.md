---
target: Board view + Practice Companion + Card modal (user experience)
total_score: 17
p0_count: 2
p1_count: 2
timestamp: 2026-07-21T10-38-37Z
slug: dance-trainer-vue-src
---
Method: dual-agent (A: ae2f2adf5c30eeb0b design review · B: a160105b39fe688a5 detector + browser evidence)
Target: Board view + Practice Companion + Card modal. Brief: "user experience".

# Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Toast system + spinner exist, but no success confirmation anywhere; Review moves are silent |
| 2 | Match System / Real World | 2 | Column names encode the schedule (WOECHENTLICH = +7d) and nothing says so; "Keep in Due" leaks `is_due_column` |
| 3 | User Control and Freedom | 2 | Confirms and Escape exist; undo exists nowhere. Review's column moves are one tap, permanent, unannounced |
| 4 | Consistency and Standards | 2 | Markdown heading rules on 1 of 3 surfaces; two identical 7px dots on one row mean urgency vs. label colour |
| 5 | Error Prevention | 2 | Blur-autosave and the import confirm are good; no guard when no due/quick column is configured |
| 6 | Recognition Rather Than Recall | 1 | Six identical link chips; no card shows when it was last practiced or what interval it's on |
| 7 | Flexibility and Efficiency | 2 | Board has search + quick-move + rapid composer; the mobile surface has no search, no bulk, no "add all due" |
| 8 | Aesthetic and Minimalist Design | 2 | Topbar carries 8 controls including a raw invite UUID; card faces dominated by raw share URLs |
| 9 | Error Recovery | 1 | Raw Postgres strings in a 4s toast, no action, no `aria-live` |
| 10 | Help and Documentation | 1 | All guidance lives in `title=` attributes - invisible on the touch device this is built for |
| **Total** | | **17/40** | **Poor band** |

Caveat: heuristics 6, 9, 10 are scored against a general-audience bar; a single-expert-user tool legitimately underinvests there. Damage that actually reaches this user daily is concentrated in 1, 3, 9. Scored on impact-to-actual-user this is a mid-20s app. Rubric total stands as written.

# Anti-Patterns Verdict

Does this look AI-generated? No - and the deterministic scan backs it up.

LLM assessment: token system is a real argument (three ascending surface lightnesses; scoped dark `--pc-*` palette justified by short-glance vs long-read). Two bans land: `.field-label` (CardModal.vue:455) is a 12px mono uppercase tracked ember eyebrow, four stacked down one dialog, louder than its values; and text overflows its container - 6 anchors overflow their card by up to 163px. The 4px status rail (TaskCard.vue:181) is >1px but genuinely semantic and named in PRODUCT.md - it stands.

Real failure mode is hierarchy inversion on all three surfaces: `<h1>` inside a card description renders at 24px against a 15px `.task-title`.

Deterministic scan: detect.mjs over src/views + src/components returned ZERO findings, exit 0 - verified genuine with a synthetic control file (Inter + bounce easing both flagged), so `.vue` parsing works. Only CLI hits are in index.html: `overused-font` (Space Grotesk, true positive by rule definition) and `single-font` (FALSE POSITIVE - one `<link>` loads three families).

Visual overlays: injection succeeded on all three surfaces; `[Human]` tab labeled; live server started and stopped cleanly. Console: `text-overflow` on `.board-name`, `low-contrast 3.8:1` on `button.label-chip.active`, `skipped-heading` x3, `cream-palette` x1. False positives: `ai-color-palette`/`layout-transition` (fire on Vue DevTools panel), `body-text-viewport-edge` x81 (elements inside the horizontally-scrolled Kanban container; scrollWidth === clientWidth). `cream-palette` is true on the metric but it is `--color-bg` #e6e0d4, the deliberate warm-paper theme.

# Overall Impression

Engineering is ahead of information design; the gap is the story. Long-press-vs-tap disambiguation, edge auto-scroll with velocity ramping, drop resolution by vertical midpoint, deferred blur-save - real craft. Meanwhile the app knows which column is due, what interval each applies, when each card was last touched, and that ten cards are 44-56 days overdue, and displays none of it.

Biggest opportunity: the Practice Companion's empty state - daily mobile entry point, opens to "No cards in today's session yet" top-left of a black screen, while PRODUCT.md's stated job is "opening the board and immediately knowing what's due."

# What's Working

- One-thing-at-a-time spine of the Practice Companion: focus card -> session list -> sequential Review. No card chrome (card-in-a-card explicitly refused, PracticeFocusCard.vue:79), focus falls through to `pendingCards[0]` so there is no advance bookkeeping, list collapses to 34vh.
- Dark palette contrast is excellent: `--pc-ink-dim` on `--pc-bg` = 8.01:1, `--pc-ember` = 8.07:1. Better than anything in the light theme.
- Clean deterministic scan across ~5,100 lines of hand-written SFCs, verified against a control.

# Priority Issues

## [P0] Board has zero keyboard entry points and ~124 decoy ones
TaskCard.vue:128, TaskCard.vue:231, KanbanColumn.vue:230
Measured live: 77 task cards, 0 focusable. 13 column titles, 0 focusable. Board contains 134 focusable elements, nearly all `<a>` - the markdown links made `pointer-events: none` in commit cb3b3a3, which stayed in the tab order.
Why: tabbing the board lands on ~100 invisible inert links showing clipped URL fragments, never reaching a card. Destroys screen-reader link-list nav. Direct side-effect of the cb3b3a3 fix.
Fix: make `.task-card` a `<button>` (or role/tabindex + Enter/Space), same for `.column-title`; strip `href` in the board-face renderer since those links are already inert.
Command: /impeccable audit (or harden)

## [P0] Practice Companion opens blank, and "today's session" has no concept of today
PracticeView.vue:64, PracticeAddDrawer.vue:20, boardStore.ts:88-95, practiceSessionStore.ts
(a) Empty state says nothing while ten cards are 44-56 days overdue. (b) Building a session means a drawer whose first tab is the leftmost column (dueColumn fallback when no `is_due_column` set - a 32-card backlog), every row an identical red dot, no due text, no urgency sort, no search, list shifts ~38px under the finger per tap. (c) practiceSessionStore.ts has NO Date and NO expiry - key is `practice-session:{boardId}`. Three surfaces say "today's session"; state is "whatever I last did, forever."
Fix: empty state carries the answer ("14 due - 10 overdue" + primary "Start with today's due cards" seeding in one tap); dueLabel() text per drawer row, sorted by urgency; hold row positions during add; stamp session with a date, expire at local midnight.
Command: /impeccable onboard for the empty state, then /impeccable shape for the session-date model

## [P1] Session Review commits irreversible moves silently, and misreports what it did
PracticeSessionReview.vue:44, :74, :97
resolve() moves the card and pops the queue with no undo, no toast, no statement of destination; buckets are visually identical, differing only in label width. `quickTargets` is an uncapped v-for - 8+ options possible. When no column has `is_quick_target`, the screen asks "where should it go?" and offers one answer with no explanation and no configure path. Completion line reports "1 card sorted into columns" after an explicit no-op (counts the queue, not the moves). This is the emotional peak and it confirms nothing.
Fix: toast with Undo on each resolve(); cap visible buckets at 4 behind existing "Choose another column..." disclosure; empty state when quickTargets.length === 0; count only real moves.
Command: /impeccable clarify for copy, /impeccable harden for undo + empty state

## [P1] Muted text and the focus ring fail contrast against the warm backgrounds
tokens.css:9, tokens.css:13, App.vue:32-35 - both assessments computed independently and agree:

| Pair | Ratio | Needs | Where |
|---|---|---|---|
| `--color-ember` on `--color-surface` | 2.78 | 4.5 | four field-label eyebrows; THE GLOBAL FOCUS RING |
| `--color-due` on white | 2.95 | 4.5 | amber status dot |
| `--color-ember` on white | 3.30 | 4.5 | `.md-link-chip` at 10px |
| `#fff` on label-chip green | 3.43 / 3.77 | 4.5 | 18 label chips |
| `--color-ink-dim` on `--color-bg` | 3.55 | 4.5 | `+ Add Column`, mode buttons |
| `--color-ink-dim` on `--color-surface` | 3.92 | 4.5 | card counts, `+ Add Card` x13, desc-preview base |
| `--color-border` on `--color-bg` | 1.18 | 3.0 | every hairline in the light theme |

Card Notes.md:13 rationale is half-right and lands wrong: it picked `--color-ember` over `--color-ember-light` calling the latter a trap, but ember itself is 3.30:1 as 10px text - the less-bad of two failing options, recorded as solved. App.vue:32 makes ember the app's only focus indicator at 2.78:1, below even the 3:1 non-text floor. (Assessment B initially reported missing focus rings, then caught its own error: programmatic .focus() does not trigger :focus-visible. Real Tab confirms 133/134 show the ring. Rings exist; contrast does not.)
Fix: darken `--color-ink-dim` toward #6a6156 (~4.6:1 on surface); add `--color-ember-text` ~#a04c00 for ember-as-text and the focus ring, keep `--color-ember` for fills; push `--color-border` toward #c9bda8.
Command: /impeccable colorize

## [P2] Markdown headings outshout card titles; six link chips are mutually indistinguishable
TaskCard.vue:211, PracticeFocusCard.vue:143
`<h1>` in `.task-description` renders at 24px against a 15px title, inside a 4.5em-capped preview. CardModal.vue:698-717 has the fix; neither other surface got it. Every `.md-link-chip` clips at `max-width: 40vw` = 156px against a 281px string, so six Nextcloud links render as six identical `https://team.jive.berli` pills filling 60% of the focus card. Card Notes.md:30 records this as blocked on an Edge Function for og:title - that over-scopes it; showing the distinguishing TAIL is pure CSS.
Fix: lift the modal's h1/h2/h3 rules into one shared block for all three surfaces; add `overflow-wrap: anywhere`; truncate chips from the head, not the tail.
Command: /impeccable typeset

# Persona Red Flags

Sam (keyboard + screen reader) - BLOCKED, not degraded. 77 cards and 13 column titles unreachable; ~124 decoy links own the tab order; ToastStack.vue:8 has no aria-live so every error is announced to nobody; no focus trap in any of the four modals; `.desc-preview` and `.note-preview` - the primary text-entry affordance - are click-to-edit divs.

Casey (one-handed, phone, mid-practice) - `+ Add` and `Review (n)` sit in the topbar top-right while the same view's `.done-fab` comment reasons explicitly about thumb reach; the design contradicts itself. FAB floats over note text with no reserved gutter - last ~48px of every note sits under an opaque orange pill. Done receipt is 200ms on the element the thumb covers. `.grip` measures 1.51:1 - invisible, AND not the real handle (whole row is long-pressable), so it signals something false while being unreadable. `.board-name` is the only shrinkable topbar element; at 390px with a Review button it collapses to "Tes...". 13 gear buttons measure 32x32, under the 44px floor.

Alex (impatient expert = the actual user) - builds every session by hand: no "add all due", no urgency sort, no search on mobile though the board has one. Topbar permanently displays a raw invite UUID plus Copy/Export/Import - collaboration chrome eating prime space on a single-user tool, daily. THERE IS NO SM2: verified in the parent context - zero hits for `sm2|ease_factor|repetition|interval` across src/. Real mechanism is per-column `due_offset_days` + `sweepDueCards()`, a Leitner box. Arguably the better design here, but PRODUCT.md and CLAUDE.md both promise SM2 and nothing in the UI explains the model that does exist.

# Minor Observations

- Stuck-overlay state bug (reproduced live): BoardView.vue:635 renders PracticeAddDrawer and PracticeSessionReview regardless of viewMode, and the mode switch does not clear showAddDrawer/showReview - Review panel stayed full-screen over a rendered Kanban board.
- PracticeSessionReview.vue:62 `.review-backdrop` (z-index 200) is fully covered by `.review` (z-index 201, inset: 0). Its @click="close" can never fire - dead code reading as a dismiss affordance.
- Practice surfaces have no desktop treatment - position: fixed; inset: 0 with top-left content; at 1440px a full-viewport black rectangle with a 40px badge in the corner.
- Empty columns say nothing. "Nothing due today" is arguably the most valuable message this app can display; it renders as blank space.
- `.desc-preview` base colour is `--color-ink-dim` with only p/ul/ol/h1-3 overridden to `--color-ink` - blockquotes, tables, bare text nodes, `<pre>` silently inherit 3.92:1. Invert: base ink, override the exceptions.
- Three date formats coexist on one screen (`56d late`, `in 4d`, `2. Aug.`, plus `04.06.2026` in the modal).
- Toasts carry raw Supabase error strings, no action, no dismiss, 4s. No success toast anywhere in the app.
- `.add-drawer .card-list` is the only scroll container without scrollbar-width: thin + token colours - a default light scrollbar on a dark surface.
- 22 `<h1>` elements per board page (21 from user markdown), producing h1->h3 jumps (detector's skipped-heading x3).

Coverage caveats: resize_window does not work in this environment (tiling WM ignores it), so all mobile measurement used a same-origin 390px iframe - media queries and layout evaluate faithfully, but REAL TOUCH BEHAVIOUR WAS NOT VERIFIED: long-press-to-drag, haptics, env(safe-area-inset-*), iOS 16px zoom guard, PWA resume. No Delete control was ever clicked (window.confirm freezes CDP), so no destructive-flow copy was reviewed.

# Questions to Consider

1. If the app already knows what's due, why does the user have to tell it? Is the add-drawer the primary path by design, or did it become the default because the empty state never got a better one?
2. What is a "session" if the data has no date? Stamp and expire at midnight, or stop claiming a day boundary the model does not enforce?
3. PRODUCT.md promises SM2; the code ships fixed per-column intervals. Which is wrong? Leitner-by-column may genuinely be better here - if so, say it in the docs and show the offsets on the columns.
4. Two of three surfaces make Delete the most visually prominent control. Deliberate findability, or an artifact of it being the only control that ever got a colour?
5. If you had one celebration budget per session, is it better spent on the 30th rep, or on the moment you learn you just cleared 12 overdue skills?

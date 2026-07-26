# Handoff — practice-view quick add (search + create) and swipe-to-remove

Session date: 2026-07-26. Branch `main`, nothing committed yet — all work below is uncommitted working-tree changes.

## The request

Three things, in the practice companion view (`views/PracticeView.vue` + `components/Practice*.vue`):

1. A **search button in the practice header**, like the board's, that lets you add cards to the practice queue *without* opening `PracticeAddDrawer`.
2. From that search, **create a new card** too — which pulls in the deferred **inbox column** feature (`Open Work.md:21`), so a quick-created card lands in a configurable inbox column.
3. **Swipe a practice-queue row to reveal a delete button.**

## Decisions taken this session (confirmed with the user, not yet journalled)

- Swipe action = **remove from the practice queue only** (`session.removeCard`). It does *not* delete the card from the board/DB. Explicitly chosen over a real delete.
- Quick add covers **both** adding existing cards and creating new ones, and the user asked to build the inbox column now rather than defer it further.
- Implemented on **pending rows only** (not the "To sort" done group) — done rows still tap-to-undo, and pulling one out of the queue would skip Session Review. Not user-confirmed; flag it if it comes up.

## Already implemented (working tree)

- `supabase/migrations/20260726102352_column_inbox.sql` — adds `columns.is_inbox_column bool not null default false`. No unique index (unlike `is_due_column`); single-inbox is enforced in the store.
- `stores/boardStore.ts` — `Column.is_inbox_column`; `inboxColumn` computed (null when unset, deliberately no fallback column); `setColumnInbox(columnId, value)` which unsets the previous inbox first, optimistic + revert; import/export plumbing; **`addCard()` now returns `Promise<Card | null>`** (the real row, needed because the optimistic temp id is negative and would be persisted into the session's localStorage). Both new members are exported from the store.
- `lib/boardFormat.ts`, `lib/trelloFormat.ts` — `isInboxColumn` round-trips in the native export; Trello imports default it to `false`.
- `components/ColumnSettingsModal.vue` — an "Inbox" checkbox section after "Quick move".

## Update — the rest was implemented in the same session

Everything under "Remaining work" below is now built; `npm run type-check` and `npm run lint` are clean. What's actually left:

- **The migration is already applied** to the live project (`eyaizrngrlybdexeaiso`), by hand via MCP at the user's request, so the app can be tested before the push. That's why the file says `add column if not exists` — the GitHub auto-deploy on push must be a no-op rather than a duplicate-column failure. Column-level grants for `anon`/`authenticated` were verified as inherited from the table.
- **No browser verification yet** — "Test board" only.
- **Not committed.** Docs and the version bump (0.8.1 → 0.9.0) are done, so the tree is commit-ready.

Docs updated: `pages/Practice Companion View.md` (quick-add as a fourth surface, swipe-to-remove), `pages/Tables.md` (`is_inbox_column`, export fidelity), `pages/Open Work.md` (inbox TODO closed), `journals/2026_07_26.md` (three `[decision]` lines). `contents.md` needed no change — its code map already routes `components/Practice*.vue` to the practice page.

## Work as specced (all implemented)

1. **`components/PracticeQuickAdd.vue` (new).** Full-screen overlay in the practice palette, modelled on `PracticeAddDrawer.vue` but much smaller:
   - Auto-focused search input; matches across **all** board cards by name, sorted most-overdue-first, undated last (`byUrgency` in `PracticeAddDrawer.vue:45`).
   - Tap a result → `session.addCard(id)`, clear the query, keep focus (same idiom as the drawer's `addHighlighted`, `PracticeAddDrawer.vue:94`). Show a one-line "✓ {name} queued" receipt since the query clears. `↑`/`↓` move a highlight, `Enter` adds it, `Esc` clears then closes; `useBackButtonClose` for the Android back button.
   - Cards already in the session: render dimmed with a ✓ rather than hiding them, or the thing you just typed disappears.
   - Create row, shown when the query is non-empty and no result matches it exactly: `+ Create "{query}" in {store.inboxColumn.name}` → `await store.addCard(inbox.id, query)` then `session.addCard(card.id)`. With **no inbox column set**, show a hint instead of the row ("Mark a column as Inbox in its settings") — never silently pick a column.
2. **`views/BoardView.vue` wiring.** The header search button is currently `v-if="viewMode === 'board'"` (`BoardView.vue:499`). Show it in practice mode too, but route it to a `showPracticeQuickAdd` flag rendering the new component — do *not* extend the existing `search-panel`, whose result click opens `CardModal`. Keep the new logic in the component; `BoardView.vue` is already ~1000 lines.
3. **`components/PracticeSessionList.vue` swipe-to-remove.** Pending rows only. Wrap each row so a Remove button sits behind it; translate the row with the finger, clamped to about `[-88, 0]`, snapping open past ~44px on pointerup, one row open at a time. Emit `remove` → `PracticeView.vue` calls `session.removeCard`. Notes:
   - Rows already own a long-press-to-drag gesture (`onRowPointerDown`, 350ms, cancelled by >10px movement) — horizontal movement already kills that timer, so the two coexist, but reuse `suppressNextClick` so ending a swipe doesn't focus the card.
   - Set `touch-action: pan-y` on `.list-row` so horizontal pans reach the pointer handlers while the list still scrolls vertically.
   - **Do not** put `transform` or `transition: none` on a rule that outranks `.row-move` — see the comment at `PracticeSessionList.vue:305`; it silently disables the FLIP reorder animation.
4. **Verification.** No test suite. `npm run type-check` and `npm run lint` from `Dance_trainer_vue/`, then manual check in the browser — **"Test board" only**, never JuKi practise / NeKi. A dev server is usually already running; don't start or kill one.
5. **Docs + version, before committing** (per `CLAUDE.md`):
   - `pages/Practice Companion View.md` — new quick-add surface, its relationship to the add drawer, the inbox column, swipe-to-remove.
   - `pages/Tables.md` — the `is_inbox_column` column field.
   - `pages/Open Work.md` — remove/close the inbox-column TODO at line 21.
   - `pages/contents.md` — code-map line for the new component.
   - `journals/2026_07_26.md` — one `[decision]` line for "swipe removes from queue, not delete card", linked to the page holding the reasoning (the page must carry it too, not just the journal).
   - Bump the version string in `views/BoardSelectView.vue`.
   - The migration deploys automatically when `main` is pushed.

## Suggested skills

- `DESIGN.md` (repo root) — read before styling `PracticeQuickAdd.vue` or the swipe affordance.
- `/run` — to drive the app and verify in the browser.
- `/simplify` and `/code-review` — on the finished diff.
- `logseq-lint` — only if the user explicitly asks; never as part of a normal commit pass.

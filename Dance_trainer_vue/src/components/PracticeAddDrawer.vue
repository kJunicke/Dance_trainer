<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Card } from '@/stores/boardStore'
import { useBoardStore } from '@/stores/boardStore'
import { usePracticeSessionStore } from '@/stores/practiceSessionStore'
import { useBackButtonClose } from '@/lib/useBackButtonClose'
import { dueStatus, dueLabel } from '@/lib/dates'

const emit = defineEmits<{
  close: []
}>()

const store = useBoardStore()
const session = usePracticeSessionStore()

useBackButtonClose(() => emit('close'))

// Due column first (the common, everyday pull), then the board's quick-target
// columns (its own "fast access" flag), then the rest in normal board order.
const orderedColumns = computed(() => {
  const due = store.dueColumn
  const quickTargets = store.quickTargetColumns.filter((c) => c.id !== due?.id)
  const quickIds = new Set(quickTargets.map((c) => c.id))
  const rest = store.columns
    .filter((c) => c.id !== due?.id && !quickIds.has(c.id))
    .slice()
    .sort((a, b) => a.position - b.position)
  return [...(due ? [due] : []), ...quickTargets, ...rest]
})

const activeTabId = ref<number | null>(orderedColumns.value[0]?.id ?? null)

// Already-added cards stay pinned at the top regardless of which column tab
// is selected, so switching tabs to browse never hides what's already queued.
const addedCards = computed(() =>
  session.entries
    .map((e) => store.cards.find((c) => c.id === e.cardId))
    .filter((c): c is Card => !!c),
)

// Most-overdue first, undated last. cardsByColumn sorts by board position, and
// sweepDueCards only lifts *newly* swept cards to the top — so left alone the
// list reads as "most recently swept, then however you've dragged things",
// which is no order at all when you're picking what needs work.
function byUrgency(a: Card, b: Card): number {
  if (a.due_date === b.due_date) return 0
  if (!a.due_date) return 1
  if (!b.due_date) return -1
  return a.due_date.localeCompare(b.due_date)
}

// The tab's own list only shows what isn't already pinned above — otherwise
// the same card would appear twice on screen at once.
const notAddedInTab = computed(() => {
  if (activeTabId.value === null) return []
  return store
    .cardsByColumn(activeTabId.value)
    .filter((c) => !session.isInSession(c.id))
    .slice()
    .sort(byUrgency)
})

// --- Search. Building a queue means 3–5 specific skills you already have in
// mind, and hunting them column by column is the slow path. A query searches
// the whole board and replaces the tabs while it's active.
const query = ref('')
const searchInputEl = ref<HTMLInputElement | null>(null)
const highlightIndex = ref(0)

const searching = computed(() => query.value.trim().length > 0)

const searchResults = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  return store.cards
    .filter((c) => !session.isInSession(c.id) && c.name.toLowerCase().includes(q))
    .slice()
    .sort(byUrgency)
})

const browseList = computed(() => (searching.value ? searchResults.value : notAddedInTab.value))

// Every keystroke reshuffles the results, so the highlight can't survive one.
watch(query, () => { highlightIndex.value = 0 })

function moveHighlight(delta: number) {
  const max = searchResults.value.length - 1
  if (max < 0) return
  highlightIndex.value = Math.min(max, Math.max(0, highlightIndex.value + delta))
}

// Adds and clears without dropping focus, so the next skill name can be typed
// straight away — the whole point of building a queue by name.
function addHighlighted() {
  const card = searchResults.value[highlightIndex.value]
  if (!card) return
  session.addCard(card.id)
  query.value = ''
  searchInputEl.value?.focus()
}

// Two-stage: a query is the thing Escape most obviously means to abandon, and
// only once there's nothing left to clear does it dismiss the drawer.
function onSearchEscape() {
  if (searching.value) query.value = ''
  else emit('close')
}
</script>

<template>
  <div class="drawer practice-view">
    <div class="drawer-head">
      <h2>Add to queue</h2>
      <button class="close-btn" @click="emit('close')">✕</button>
    </div>

    <!-- Always rendered, at a fixed height. It used to appear on the first add
         and grow with each one, pushing the tabs and the whole browse list down
         51px per tap — measured mid-scan, it moved rows out from under the
         finger. Adding a card now fills a slot inside the panel and moves
         nothing outside it. -->
    <div class="added-section">
      <div class="section-label">Added ({{ addedCards.length }})</div>
      <ul class="card-list added-list">
        <li v-if="addedCards.length === 0" class="empty-row">Tap a card below to add it.</li>
        <li
          v-for="card in addedCards"
          :key="card.id"
          class="card-row"
          @click="session.toggleCard(card.id)"
        >
          <span class="checkbox checked"><span>✓</span></span>
          <span v-if="dueStatus(card.due_date)" class="status-dot" :class="`status-${dueStatus(card.due_date)}`" />
          <span class="card-name">{{ card.name }}</span>
          <span v-if="dueLabel(card.due_date)" class="due-label" :class="`status-${dueStatus(card.due_date)}`">{{ dueLabel(card.due_date) }}</span>
        </li>
      </ul>
    </div>

    <input
      ref="searchInputEl"
      v-model="query"
      class="search-input"
      placeholder="Search all cards…"
      @keydown.down.prevent="moveHighlight(1)"
      @keydown.up.prevent="moveHighlight(-1)"
      @keydown.enter.prevent="addHighlighted"
      @keydown.esc="onSearchEscape"
    />

    <!-- Placed in the comfortable one-handed reach zone rather than pinned to
         the very top, since this is what gets tapped repeatedly while browsing.
         Hidden while searching: the results already span every column, so a
         highlighted tab would be claiming a filter that isn't applied. -->
    <div v-if="!searching" class="tabs">
      <button
        v-for="col in orderedColumns"
        :key="col.id"
        class="tab"
        :class="{ active: col.id === activeTabId }"
        @click="activeTabId = col.id"
      >{{ col.name }}</button>
    </div>

    <TransitionGroup tag="ul" name="row" class="card-list">
      <li v-if="browseList.length === 0" key="empty" class="empty-row">
        {{ searching ? 'No cards match.' : 'Nothing left to add from this column.' }}
      </li>
      <li
        v-for="(card, i) in browseList"
        :key="card.id"
        class="card-row"
        :class="{ highlighted: searching && i === highlightIndex }"
        @click="session.toggleCard(card.id)"
      >
        <span class="checkbox" />
        <span v-if="dueStatus(card.due_date)" class="status-dot" :class="`status-${dueStatus(card.due_date)}`" />
        <span class="card-name">{{ card.name }}</span>
        <!-- In the Due tab every status dot is red, so the dot carries no
             information and the row is just a name. The text is what actually
             separates "3d late" from "56d late". -->
        <span v-if="dueLabel(card.due_date)" class="due-label" :class="`status-${dueStatus(card.due_date)}`">{{ dueLabel(card.due_date) }}</span>
      </li>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.drawer {
  position: fixed;
  inset: 0;
  z-index: 201;
  display: flex;
  flex-direction: column;
  background: var(--pc-surface);
  padding: calc(16px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom));
  animation: fade-in 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .drawer {
    animation: none;
  }
}

.drawer-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.drawer-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--pc-ink);
}

.close-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--pc-ink-dim);
  font-size: 18px;
  cursor: pointer;
}

/* Fixed, not max-height: the panel must reserve its space from the moment the
   drawer opens, or the first add is a jump from nothing to full height. Sized
   to the label plus five 48px rows, so a typical session fits without the list
   scrolling inside it. Same clamp idiom as --session-list-height. */
.added-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: clamp(200px, 30vh, 270px);
  margin-bottom: 10px;
}

.section-label {
  flex-shrink: 0;
  padding: 2px 4px 6px;
  color: var(--pc-good);
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.added-list {
  overflow-y: auto;
  border-bottom: 1px solid var(--pc-border);
  padding-bottom: 4px;
}

.search-input {
  flex-shrink: 0;
  min-height: 44px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid var(--pc-border);
  border-radius: var(--radius-sm);
  background: var(--pc-bg);
  color: var(--pc-ink);
  /* Under 16px, iOS Safari zooms the page when the field gets focus. */
  font-size: 16px;
  font-family: var(--font-body);
}

.search-input::placeholder {
  color: var(--pc-ink-dim);
}

.search-input:focus-visible {
  outline: 2px solid var(--pc-ember);
  outline-offset: -1px;
}

.tabs {
  flex-shrink: 0;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  margin-bottom: 10px;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tab {
  flex-shrink: 0;
  padding: 8px 14px;
  min-height: 40px;
  border: 1px solid var(--pc-border);
  border-radius: 999px;
  background: transparent;
  color: var(--pc-ink-dim);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}

.tab.active {
  border-color: var(--pc-ember);
  color: var(--pc-ink);
  background: color-mix(in srgb, var(--pc-ember) 14%, transparent);
}

.card-list {
  /* Anchors the absolutely-positioned leaving row below. */
  position: relative;
  flex: 1;
  min-height: 0;
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--pc-border) transparent;
}

/* Adding a card removes its row, closing the list by a full 48px. Instant,
   that's a teleport under a finger still hovering the area — and it's the rows
   *below* the tap that move, which is exactly where you're scanning next. The
   leaving row drops out of flow and fades while the rows below slide up, so the
   distance is trackable and the finger has lifted before it lands. */
.row-move {
  transition: transform 180ms cubic-bezier(0.25, 1, 0.5, 1);
}

.row-leave-active {
  position: absolute;
  left: 0;
  right: 0;
  transition: opacity 120ms ease;
}

.row-enter-active {
  transition: opacity 120ms ease;
}

.row-enter-from,
.row-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .row-move,
  .row-leave-active,
  .row-enter-active {
    transition: none;
  }
}

.empty-row {
  padding: 16px 4px;
  color: var(--pc-ink-dim);
  font-size: 13px;
  font-style: italic;
}

.card-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--pc-border);
  cursor: pointer;
}

.card-row:last-child {
  border-bottom: none;
}

/* Keyboard position only — the pointer path never sets it, so this never
   competes with :hover for "which row am I about to act on". */
.card-row.highlighted {
  background: color-mix(in srgb, var(--pc-ember) 14%, transparent);
  border-radius: var(--radius-sm);
}

.checkbox {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--pc-border);
  border-radius: 5px;
  color: #1f1404;
  font-size: 13px;
  font-weight: 700;
}

.checkbox.checked {
  background: var(--pc-ember);
  border-color: var(--pc-ember);
}

.status-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--pc-ink-dim);
}

.status-dot.status-scheduled { background: var(--pc-good); }
.status-dot.status-due { background: var(--pc-due); }
.status-dot.status-overdue { background: var(--pc-overdue); }

.card-name {
  flex: 1;
  min-width: 0;
  color: var(--pc-ink);
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.due-label {
  flex-shrink: 0;
  color: var(--pc-ink-dim);
  font-family: var(--font-mono);
  font-size: 11px;
  white-space: nowrap;
}

.due-label.status-overdue {
  color: var(--pc-overdue);
}
</style>

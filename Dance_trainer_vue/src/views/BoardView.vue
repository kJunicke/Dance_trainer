<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import KanbanColumn from '../components/KanbanColumn.vue'
import CardModal from '../components/CardModal.vue'
import ColumnSettingsModal from '../components/ColumnSettingsModal.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import PracticeView from './PracticeView.vue'
import PracticeAddDrawer from '../components/PracticeAddDrawer.vue'
import PracticeQuickAdd from '../components/PracticeQuickAdd.vue'
import PracticeSessionReview from '../components/PracticeSessionReview.vue'
import { useBoardStore } from '../stores/boardStore'
import { useAuthStore } from '../stores/authStore'
import { usePracticeSessionStore } from '../stores/practiceSessionStore'

const store = useBoardStore()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const boardId = Number(route.params.id)
const practiceSession = usePracticeSessionStore()

// Board is the desktop-oriented Kanban; Practice is the mobile-first
// companion for building/running today's session. See
// Dance_trainer_logseq/pages/Practice Companion View.md.
// Per-board, matching the practice-session:{boardId} convention the session
// store already uses — a reload mid-practice used to drop you back on the
// Kanban board, which is the one place you weren't working.
const VIEW_MODE_PREFIX = 'practice-view-mode:'
const viewMode = ref<'board' | 'practice'>(
  localStorage.getItem(VIEW_MODE_PREFIX + boardId) === 'practice' ? 'practice' : 'board',
)
const showAddDrawer = ref(false)
const showReview = ref(false)
const showQuickAdd = ref(false)

// Both overlays belong to Practice. Switching modes with one open left it
// sitting full-screen over a rendered Kanban board.
function setViewMode(mode: 'board' | 'practice') {
  viewMode.value = mode
  localStorage.setItem(VIEW_MODE_PREFIX + boardId, mode)
  showAddDrawer.value = false
  showReview.value = false
  showQuickAdd.value = false
}

// Re-sweep when the PWA is resumed — it may have been backgrounded past midnight.
function onVisibilityChange() {
  if (document.visibilityState === 'visible') store.sweepDueCards()
}

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  await store.loadBoard(boardId)
  store.sweepDueCards()
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  stopAutoScroll()
})

async function signOut() {
  await auth.signOut()
  router.push({ name: 'login' })
}

const menuOpen = ref(false)

// --- Card search: an inline dropdown in the header that filters the current
// board's cards by name and opens the existing CardModal on a match.
const searchOpen = ref(false)
const searchQuery = ref('')
const searchInputEl = ref<HTMLInputElement | null>(null)

const columnNameById = computed(() => new Map(store.columns.map((c) => [c.id, c.name])))
function columnName(columnId: number): string {
  return columnNameById.value.get(columnId) ?? ''
}

// The family walk lives in the store (ancestorNamesByCardId), because the
// practice surfaces need the same map and a parent can sit in any column — so
// every consumer needs every card on the board, which no single view owns.

// Cards store their leaf name only, so a part is called "Prep", not
// "OFS › Prep" (see [[Card Relationships]]). Searching the stored name alone
// would mean typing the macro skill's name found the parent and none of its
// parts — the opposite of what a family is for. Matched against the composed
// chain instead, reusing the ancestor walk above rather than re-deriving it.
const composedNames = computed(() => {
  const map = new Map<number, string>()
  for (const c of store.cards) {
    map.set(c.id, [...store.ancestorNamesForCard(c.id), c.name].join(' › '))
  }
  return map
})

// Direct children only: the face says "this has parts", the modal's tree says
// how deep they go. Counted in one pass rather than per card.
const partCounts = computed(() => {
  const counts = new Map<number, number>()
  for (const c of store.cards) {
    if (c.parent_id === null) continue
    counts.set(c.parent_id, (counts.get(c.parent_id) ?? 0) + 1)
  }
  return counts
})

// The board-face family icon opens the card's own modal already scrolled to its
// Family section — a popover would be anchored to a board that scrolls
// horizontally under it. Reset on close so a later ordinary tap opens at the top.
const openCardAtFamily = ref(false)
function openCardFamily(cardId: number) {
  openCardId.value = cardId
  openCardAtFamily.value = true
}

const searchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  return store.cards
    .filter((c) => (composedNames.value.get(c.id) ?? c.name).toLowerCase().includes(q))
    .slice(0, 12)
})

// Enter used to fire on a hardcoded searchResults[0], so arrowing down and
// hitting Enter opened a card you weren't looking at.
const searchHighlight = ref(0)
watch(searchQuery, () => { searchHighlight.value = 0 })

function moveSearchHighlight(delta: number) {
  const max = searchResults.value.length - 1
  if (max < 0) return
  searchHighlight.value = Math.min(max, Math.max(0, searchHighlight.value + delta))
}

async function openSearch() {
  searchOpen.value = true
  await nextTick()
  searchInputEl.value?.focus()
}

function closeSearch() {
  searchOpen.value = false
  searchQuery.value = ''
}

function openSearchResult(cardId: number) {
  openCardId.value = cardId
  closeSearch()
}

function onSearchEnter() {
  const picked = searchResults.value[searchHighlight.value]
  if (picked) openSearchResult(picked.id)
}

const copied = ref(false)
async function copyCode() {
  if (!store.board) return
  await navigator.clipboard.writeText(store.board.invite_code)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

const importing = ref(false)
const importInput = ref<HTMLInputElement | null>(null)

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const proceed = window.confirm(
    `Import "${file.name}"? This replaces every column, card, and label on "${store.board?.name}" with the contents of this file. This cannot be undone.`,
  )
  if (!proceed) { input.value = ''; return }
  importing.value = true
  await store.importTrelloIntoBoard(boardId, file)
  importing.value = false
  input.value = ''
  menuOpen.value = false
}

const dragState = ref<{ cardId: number; sourceColumnId: number } | null>(null)

function onCardDragStart(columnId: number, cardId: number) {
  dragState.value = { cardId, sourceColumnId: columnId }
}

function onColumnDrop(targetColumnId: number) {
  if (!dragState.value) return
  const { cardId } = dragState.value
  dragState.value = null
  const position = store.cardsByColumn(targetColumnId).length
  store.moveCard(cardId, targetColumnId, position)
}

function onCardDroppedOnCard(
  targetColumnId: number,
  targetCardId: number,
  position: 'before' | 'after',
) {
  if (!dragState.value) return
  const { cardId } = dragState.value
  dragState.value = null
  const columnCards = store.cardsByColumn(targetColumnId)
  const targetIndex = columnCards.findIndex((c) => c.id === targetCardId)
  if (targetIndex === -1) {
    store.moveCard(cardId, targetColumnId, columnCards.length)
    return
  }
  const insertAt = position === 'before' ? targetIndex : targetIndex + 1
  store.moveCard(cardId, targetColumnId, insertAt)
}

// --- Column drag: reorder columns by dragging their handle. Mirrors the card
// drag above (mouse via native DnD, touch via the handle's own long-press —
// see KanbanColumn.vue), sharing the same edge auto-scroll.
const columnDragId = ref<number | null>(null)
const columnDropIndex = ref<number | null>(null)

function onColumnDragStart(columnId: number) {
  columnDragId.value = columnId
}

// Index (within store.columns, which stays sorted by position) to insert the
// dragged column at — before the column under the point if left of its
// midpoint, else after; past the last column if the point isn't over one.
function computeColumnDropIndex(x: number, y: number): number {
  const sorted = [...store.columns].sort((a, b) => a.position - b.position)
  const overEl = document.elementFromPoint(x, y)?.closest<HTMLElement>('.kanban-column')
  if (!overEl) return sorted.length
  const idx = sorted.findIndex((c) => c.id === Number(overEl.dataset.columnId))
  if (idx === -1) return sorted.length
  const rect = overEl.getBoundingClientRect()
  return x < rect.left + rect.width / 2 ? idx : idx + 1
}

// columnDropIndex is a position in the full column list (for the insertion
// marker to line up with); moveColumnTo wants a position with the dragged
// column already removed, so shift down by one if the drop is past it.
function finishColumnDrop() {
  const id = columnDragId.value
  const target = columnDropIndex.value
  columnDragId.value = null
  columnDropIndex.value = null
  if (id === null || target === null) return
  const sorted = [...store.columns].sort((a, b) => a.position - b.position)
  const draggedIndex = sorted.findIndex((c) => c.id === id)
  store.moveColumnTo(id, draggedIndex !== -1 && target > draggedIndex ? target - 1 : target)
}

function onColumnDragMove(x: number, y: number) {
  touchPoint.value = { x, y }
  columnDropIndex.value = computeColumnDropIndex(x, y)
  startAutoScroll(x)
}

function onColumnDragEndTouch(x: number, y: number) {
  stopAutoScroll()
  if (columnDragId.value === null) return
  columnDropIndex.value = computeColumnDropIndex(x, y)
  finishColumnDrop()
}

// --- Touch drag: ghost, drop-target highlight, edge auto-scroll ---
// Touch drag has no native dragover/drop events (pointer capture keeps them
// from firing on elements under the finger), so drop targets are resolved by
// hit-testing the finger position.

const touchPoint = ref<{ x: number; y: number } | null>(null)
const touchOverColumnId = ref<number | null>(null)
let autoScrollRaf = 0

// --- Quick-move drop buckets: a bar of the board's quick-move columns shown at
// the top while a card is dragged; dropping onto one moves the card there.
// The card's own source column is left out (dropping a card back where it came
// from isn't a "quick move").
const quickOverColumnId = ref<number | null>(null)
const quickDropTargets = computed(() =>
  store.quickTargetColumns.filter((c) => c.id !== dragState.value?.sourceColumnId),
)

function quickColumnIdAtPoint(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-quick-column-id]')
  return el ? Number(el.dataset.quickColumnId) : null
}

function dropToQuick(columnId: number) {
  if (!dragState.value) return
  const { cardId } = dragState.value
  dragState.value = null
  quickOverColumnId.value = null
  store.moveCard(cardId, columnId, store.cardsByColumn(columnId).length)
}

const draggingCardName = computed(() => {
  if (!dragState.value || !touchPoint.value) return null
  return store.cards.find((c) => c.id === dragState.value!.cardId)?.name ?? null
})

function columnIdAtPoint(x: number, y: number): number | null {
  const columnEl = document.elementFromPoint(x, y)?.closest<HTMLElement>('.kanban-column')
  return columnEl ? Number(columnEl.dataset.columnId) : null
}

// Touch drop position within a column: unlike native mouse dragover (which fires
// per-card as the cursor crosses it), a touch drop only gets one point at
// pointerup — landing in the gap between cards (or anywhere elementFromPoint
// doesn't resolve to a .task-card) used to fall through to "append at the end".
// Scanning the column's cards by vertical midpoint instead of requiring an exact
// hit covers the whole column height, so any y resolves to a slot.
function resolveCardDrop(
  columnId: number,
  excludeCardId: number,
  y: number,
): { cardId: number; position: 'before' | 'after' } | null {
  const columnEl = document.querySelector<HTMLElement>(`.kanban-column[data-column-id="${columnId}"]`)
  if (!columnEl) return null
  const cardEls = Array.from(columnEl.querySelectorAll<HTMLElement>('.task-card')).filter(
    (el) => Number(el.dataset.cardId) !== excludeCardId,
  )
  for (const el of cardEls) {
    const rect = el.getBoundingClientRect()
    if (y < rect.top + rect.height / 2) return { cardId: Number(el.dataset.cardId), position: 'before' }
  }
  const last = cardEls[cardEls.length - 1]
  return last ? { cardId: Number(last.dataset.cardId), position: 'after' } : null
}

// Live insertion-line target while touch-dragging, mirroring KanbanColumn's own
// dropIndicator (which only updates from native dragover, so touch needs its
// own) — gives the same visual feedback mouse users get from hovering a card.
const touchDropTarget = ref<{ columnId: number; cardId: number; position: 'before' | 'after' } | null>(null)

function onCardDragMove(x: number, y: number) {
  touchPoint.value = { x, y }
  // A bucket overlays the top strip, so a point over it isn't inside any column.
  quickOverColumnId.value = quickColumnIdAtPoint(x, y)
  const columnId = columnIdAtPoint(x, y)
  touchOverColumnId.value = columnId
  if (columnId !== null && dragState.value) {
    const target = resolveCardDrop(columnId, dragState.value.cardId, y)
    touchDropTarget.value = target ? { columnId, ...target } : null
  } else {
    touchDropTarget.value = null
  }
  startAutoScroll(x)
}

// Edge auto-scroll, shared by touch drag and native (mouse) drag so a card can
// reach off-screen columns. Speed ramps from 0 at the edge of the trigger band
// up to a max right at the screen edge — a constant crawl felt unresponsive.
// The loop retains the last pointer x, so it keeps scrolling even while the
// finger/cursor sits still at the edge (native dragover stops firing when idle).
const EDGE = 72 // px band from each side that triggers scrolling
const MAX_SCROLL_SPEED = 26 // px per frame at the very edge
let autoScrollX: number | null = null

function edgeVelocity(clientX: number, rect: DOMRect): number {
  if (clientX < rect.left + EDGE) {
    const depth = Math.min(1, (rect.left + EDGE - clientX) / EDGE)
    return -MAX_SCROLL_SPEED * depth
  }
  if (clientX > rect.right - EDGE) {
    const depth = Math.min(1, (clientX - (rect.right - EDGE)) / EDGE)
    return MAX_SCROLL_SPEED * depth
  }
  return 0
}

function startAutoScroll(x: number) {
  autoScrollX = x
  if (!autoScrollRaf) autoScrollLoop()
}

function autoScrollLoop() {
  autoScrollRaf = requestAnimationFrame(() => {
    const el = boardEl.value
    if (!el || autoScrollX === null || (!dragState.value && columnDragId.value === null)) {
      autoScrollRaf = 0
      return
    }
    const v = edgeVelocity(autoScrollX, el.getBoundingClientRect())
    if (v !== 0) {
      el.scrollLeft += v
      // Scrolling moves columns under a stationary finger, so re-resolve the
      // touch highlight here, not just on finger movement.
      if (touchPoint.value) {
        touchOverColumnId.value = columnIdAtPoint(touchPoint.value.x, touchPoint.value.y)
        if (columnDragId.value !== null) {
          columnDropIndex.value = computeColumnDropIndex(touchPoint.value.x, touchPoint.value.y)
        }
      }
    }
    autoScrollLoop()
  })
}

function stopAutoScroll() {
  if (autoScrollRaf) cancelAnimationFrame(autoScrollRaf)
  autoScrollRaf = 0
  autoScrollX = null
  touchPoint.value = null
  touchOverColumnId.value = null
  quickOverColumnId.value = null
  touchDropTarget.value = null
}

// Native (mouse) drag: dragover bubbles up from columns/cards, giving us the
// cursor x for edge scrolling; dragend fires even on a cancelled drop, so it's
// the reliable place to stop scrolling and clear drag state.
function onBoardDragOver(e: DragEvent) {
  if (dragState.value) {
    startAutoScroll(e.clientX)
  } else if (columnDragId.value !== null) {
    // Unlike a card drop (always over a column/card, which already call
    // preventDefault), a column can be dropped past the last one, over empty
    // board background — that needs its own preventDefault to be a valid target.
    e.preventDefault()
    startAutoScroll(e.clientX)
    columnDropIndex.value = computeColumnDropIndex(e.clientX, e.clientY)
  }
}

function onBoardDrop() {
  if (columnDragId.value !== null) finishColumnDrop()
}

function onBoardDragEnd() {
  // Touch drags are cleaned up on pointerup (onCardDragEndTouch /
  // onColumnDragEndTouch), not dragend — guards against a stray native
  // dragend (e.g. an aborted native touch DnD that TaskCard mostly prevents
  // now) clearing state mid touch-drag.
  if (touchPoint.value) return
  stopAutoScroll()
  dragState.value = null
  columnDragId.value = null
  columnDropIndex.value = null
}

function onCardDragEndTouch(x: number, y: number) {
  const sourceCardId = dragState.value?.cardId
  stopAutoScroll()
  if (sourceCardId === undefined) return
  const el = document.elementFromPoint(x, y)
  const quickEl = el?.closest<HTMLElement>('[data-quick-column-id]')
  if (quickEl) {
    dropToQuick(Number(quickEl.dataset.quickColumnId))
    return
  }
  const columnId = columnIdAtPoint(x, y)
  if (columnId === null) {
    dragState.value = null
    return
  }
  const target = resolveCardDrop(columnId, sourceCardId, y)
  if (target) {
    onCardDroppedOnCard(columnId, target.cardId, target.position)
  } else {
    onColumnDrop(columnId)
  }
}

const openCardId = ref<number | null>(null)
const settingsColumnId = ref<number | null>(null)

const boardEl = ref<HTMLElement | null>(null)
const isPanning = ref(false)
let pan: { pointerId: number; startX: number; startScrollLeft: number } | null = null

function onBoardWheel(e: WheelEvent) {
  const el = boardEl.value
  // Shift+wheel and trackpads already scroll horizontally natively; over a
  // column the wheel should keep scrolling that column's cards.
  if (!el || e.shiftKey || e.deltaX !== 0) return
  if ((e.target as HTMLElement).closest('.kanban-column')) return
  el.scrollLeft += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY
  e.preventDefault()
}

function onBoardPointerDown(e: PointerEvent) {
  const el = boardEl.value
  // Mouse only: touch panning is handled by native scrolling.
  if (!el || e.pointerType !== 'mouse' || e.button !== 0 || e.target !== el) return
  pan = { pointerId: e.pointerId, startX: e.clientX, startScrollLeft: el.scrollLeft }
  isPanning.value = true
  el.setPointerCapture(e.pointerId)
  e.preventDefault()
}

function onBoardPointerMove(e: PointerEvent) {
  if (!pan || e.pointerId !== pan.pointerId) return
  boardEl.value!.scrollLeft = pan.startScrollLeft - (e.clientX - pan.startX)
}

function onBoardPointerUp(e: PointerEvent) {
  if (!pan || e.pointerId !== pan.pointerId) return
  pan = null
  isPanning.value = false
}
</script>

<template>
  <div class="board-view">
    <header class="topbar" :class="{ 'practice-view': viewMode === 'practice' }">
      <button
        v-if="viewMode === 'board'"
        class="back-btn"
        title="Back to your boards"
        @click="router.push({ name: 'boards' })"
      >
        ←<span class="back-label"> Boards</span>
      </button>
      <h1 class="board-name">{{ store.board?.name }}</h1>

      <div class="mode-switch" role="tablist" aria-label="View">
        <button
          role="tab"
          :aria-selected="viewMode === 'board'"
          class="mode-btn"
          :class="{ active: viewMode === 'board' }"
          @click="setViewMode('board')"
        >Board</button>
        <button
          role="tab"
          :aria-selected="viewMode === 'practice'"
          class="mode-btn"
          :class="{ active: viewMode === 'practice' }"
          @click="setViewMode('practice')"
        >Practice</button>
      </div>

      <span v-if="viewMode === 'practice'" class="practice-actions">
        <button class="bar-btn" @click="showAddDrawer = true">+ Add</button>
        <button v-if="practiceSession.doneIds.length" class="bar-btn review-btn" @click="showReview = true">
          Review ({{ practiceSession.doneIds.length }})
        </button>
      </span>

      <!-- Same affordance in both modes, different destination: on the board a
           hit opens the card, in practice it goes straight into the queue. -->
      <button
        class="search-btn"
        :title="viewMode === 'practice' ? 'Search or create cards' : 'Search cards'"
        @click="viewMode === 'practice' ? (showQuickAdd = true) : openSearch()"
      >
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="8.5" cy="8.5" r="6" />
          <line x1="13.2" y1="13.2" x2="18" y2="18" stroke-linecap="round" />
        </svg>
      </button>

      <!-- Invite code, Copy/Export/Import, the signed-in address and Sign out all
           live in this menu. They used to sit in the bar as well, spending prime
           permanent space on a single-user tool for actions used once a month —
           and they were what squeezed .board-name down to `Tes…`. -->
      <button v-if="viewMode === 'board'" class="menu-btn" title="Board menu" @click="menuOpen = !menuOpen">⋯</button>
      <input
        ref="importInput"
        type="file"
        accept="application/json"
        class="file-input"
        @change="onImportFile"
      />
    </header>

    <div v-if="menuOpen" class="menu-backdrop" @click="menuOpen = false" />
    <nav v-if="menuOpen" class="menu">
      <div v-if="store.board" class="menu-row invite-row">
        <code>{{ store.board.invite_code }}</code>
        <button class="bar-btn" @click="copyCode">{{ copied ? 'Copied!' : 'Copy code' }}</button>
      </div>
      <button class="menu-row menu-action" @click="store.exportBoard(); menuOpen = false">
        Export board (JSON)
      </button>
      <button class="menu-row menu-action" :disabled="importing" @click="importInput?.click()">
        {{ importing ? 'Importing…' : 'Import board (JSON)' }}
      </button>
      <div class="menu-row menu-user">{{ auth.user?.user_metadata?.display_name || auth.user?.email }}</div>
      <button class="menu-row menu-action" @click="signOut">Sign out</button>
    </nav>

    <div v-if="searchOpen" class="menu-backdrop" @click="closeSearch" />
    <div v-if="searchOpen" class="search-panel">
      <input
        ref="searchInputEl"
        v-model="searchQuery"
        class="search-input"
        placeholder="Search cards…"
        @keydown.esc="closeSearch"
        @keydown.enter="onSearchEnter"
        @keydown.down.prevent="moveSearchHighlight(1)"
        @keydown.up.prevent="moveSearchHighlight(-1)"
      />
      <ul v-if="searchResults.length" class="search-results">
        <li
          v-for="(card, i) in searchResults"
          :key="card.id"
          class="search-result"
          :class="{ highlighted: i === searchHighlight }"
          @click="openSearchResult(card.id)"
        >
          <span class="search-result-name">{{ composedNames.get(card.id) ?? card.name }}</span>
          <span class="search-result-col">{{ columnName(card.column_id) }}</span>
        </li>
      </ul>
      <p v-else-if="searchQuery.trim()" class="search-empty">No cards match.</p>
      <p v-else class="search-empty">Type to search cards.</p>
    </div>

    <div v-if="store.loading" class="status"><LoadingSpinner :size="16" /> Loading…</div>
    <div v-else-if="!store.board" class="status error">Couldn't load this board.</div>
    <PracticeView
      v-else-if="viewMode === 'practice'"
      :board-id="boardId"
      @open-add="showAddDrawer = true"
    />
    <div v-else class="board-area">
      <!-- Kept mounted and toggled via class, not v-if: inserting a node during
           dragstart cancels the browser's native drag. -->
      <div class="quick-drop-bar" :class="{ active: !!dragState && quickDropTargets.length > 0 }">
        <div class="quick-drop-list">
          <div
            v-for="col in quickDropTargets"
            :key="col.id"
            class="quick-bucket"
            :class="{ over: quickOverColumnId === col.id }"
            :data-quick-column-id="col.id"
            @dragover.prevent="quickOverColumnId = col.id"
            @dragleave="quickOverColumnId = null"
            @drop.prevent.stop="dropToQuick(col.id)"
          >{{ col.name }}</div>
        </div>
      </div>
      <div
      ref="boardEl"
      class="board"
      :class="{ panning: isPanning, 'touch-dragging': touchPoint !== null }"
      @wheel="onBoardWheel"
      @pointerdown="onBoardPointerDown"
      @pointermove="onBoardPointerMove"
      @pointerup="onBoardPointerUp"
      @pointercancel="onBoardPointerUp"
      @dragover="onBoardDragOver"
      @drop="onBoardDrop"
      @dragend="onBoardDragEnd"
    >
      <template v-for="(column, index) in store.columns" :key="column.id">
        <div v-if="columnDropIndex === index" class="column-drop-line" />
        <KanbanColumn
          :id="column.id"
          :name="column.name"
          :cards="store.cardsByColumn(column.id).map((c) => ({
            ...c,
            labels: store.labelsForCard(c.id),
            ancestors: store.ancestorNamesByCardId.get(c.id),
            partCount: partCounts.get(c.id),
          }))"
          :touch-drag-over="touchOverColumnId === column.id"
          :touch-drop-indicator="
            touchDropTarget && touchDropTarget.columnId === column.id
              ? { cardId: touchDropTarget.cardId, position: touchDropTarget.position }
              : null
          "
          :column-drag-active="columnDragId !== null"
          :is-dragging="columnDragId === column.id"
          @rename="store.renameColumn(column.id, $event)"
          @add-card="(name) => store.addCard(column.id, name)"
          @card-drag-start="onCardDragStart(column.id, $event)"
          @card-drag-move="onCardDragMove"
          @card-drag-end="onCardDragEndTouch"
          @card-dropped="onColumnDrop(column.id)"
          @card-dropped-on-card="(cardId, pos) => onCardDroppedOnCard(column.id, cardId, pos)"
          @open-card="openCardId = $event"
          @open-card-family="openCardFamily"
          @open-settings="settingsColumnId = column.id"
          @column-drag-start="onColumnDragStart(column.id)"
          @column-drag-move="onColumnDragMove"
          @column-drag-end="onColumnDragEndTouch"
        />
      </template>
      <div v-if="columnDropIndex === store.columns.length" class="column-drop-line" />
      <button class="add-column-btn" title="Add a new column to this board" @click="store.addColumn()">+ Add Column</button>
      </div>
    </div>

    <div
      v-if="draggingCardName && touchPoint"
      class="drag-ghost"
      :style="{ left: touchPoint.x + 'px', top: touchPoint.y + 'px' }"
    >{{ draggingCardName }}</div>

    <CardModal
      v-if="openCardId !== null"
      :card-id="openCardId"
      :focus-family="openCardAtFamily"
      @close="openCardId = null; openCardAtFamily = false"
    />
    <ColumnSettingsModal
      v-if="settingsColumnId !== null"
      :column-id="settingsColumnId"
      @close="settingsColumnId = null"
    />
    <PracticeQuickAdd v-if="showQuickAdd" @close="showQuickAdd = false" />
    <PracticeAddDrawer v-if="showAddDrawer" @close="showAddDrawer = false" />
    <PracticeSessionReview v-if="showReview" @close="showReview = false" />
  </div>
</template>

<style scoped>
.board-view {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
}

.topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

/* The bar itself stays shared chrome, but sitting light-on-dark over the
   Practice view read as a mismatched seam — darken it to the same palette
   while in that mode. */
.topbar.practice-view {
  background: var(--pc-surface);
  border-bottom-color: var(--pc-border);
}

.topbar.practice-view .board-name {
  color: var(--pc-ink);
}

.topbar.practice-view .mode-switch {
  background: var(--pc-bg);
  border-color: var(--pc-border);
}

.topbar.practice-view .mode-btn {
  color: var(--pc-ink-dim);
}

.topbar.practice-view .mode-btn.active {
  background: var(--pc-ember);
  color: #1f1404;
}

/* 44px here but not on the board's own .bar-btn: this is the practice surface,
   used one-handed mid-session, where the shared 28px board control is well under
   the touch floor. The board keeps its denser chrome. */
.topbar.practice-view .practice-actions .bar-btn {
  min-height: 44px;
  border-color: var(--pc-ember);
  color: var(--pc-ink);
}

.topbar.practice-view .practice-actions .bar-btn:hover {
  background: color-mix(in srgb, var(--pc-ember) 16%, transparent);
}

.topbar.practice-view .practice-actions .review-btn {
  border-color: var(--pc-good);
}

/* The magnifier is board chrome that now appears in both modes — left alone it
   painted --color-ink (#2a2420) on the dark bar, about 1.1:1. */
.topbar.practice-view .search-btn {
  border-color: var(--pc-border);
  color: var(--pc-ink);
}

.topbar.practice-view .search-btn:hover {
  background: color-mix(in srgb, var(--pc-ember) 16%, transparent);
  border-color: var(--pc-ember);
}

.back-btn {
  flex-shrink: 0;
  padding: 8px 12px;
  border: 1px solid var(--color-ember);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink);
  font-size: 13px;
  cursor: pointer;
}

.back-btn:hover {
  background: var(--color-surface-light);
}

.board-name {
  min-width: 0;
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.02em;
  color: var(--color-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mode-switch {
  flex-shrink: 0;
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 999px;
}

.mode-btn {
  min-height: 32px;
  padding: 6px 14px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--color-ink-dim);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms cubic-bezier(0.25, 1, 0.5, 1), color 150ms;
}

.mode-btn.active {
  background: var(--color-ember);
  color: var(--color-text-on-ember);
}

@media (prefers-reduced-motion: reduce) {
  .mode-btn {
    transition: none;
  }
}

.invite-row code {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-ink);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 2px 6px;
  border-radius: 4px;
}

.bar-btn {
  padding: 6px 10px;
  border: 1px solid var(--color-ember);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.bar-btn:hover {
  background: var(--color-surface-light);
}

.bar-btn:disabled,
.menu-action:disabled {
  opacity: 0.5;
  cursor: default;
}

.practice-actions {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
}

.review-btn {
  border-color: var(--color-good);
}

.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.menu-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
}

.menu {
  position: absolute;
  top: 56px;
  right: 12px;
  z-index: 95;
  display: flex;
  flex-direction: column;
  min-width: 230px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
  padding: 6px;
}

.menu-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--color-ink);
}

.invite-row {
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border);
}

.menu-action {
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.menu-action:hover {
  background: var(--color-surface-light);
}

.menu-user {
  font-size: 12px;
  color: var(--color-ink-dim);
  border-top: 1px solid var(--color-border);
}

/* Carries the auto margin so search and ⋯ group together at the trailing edge
   and every remaining pixel of slack goes to .board-name. */
.search-btn {
  flex-shrink: 0;
  margin-left: auto;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink);
  cursor: pointer;
}

.search-btn:hover {
  background: var(--color-surface-light);
  border-color: var(--color-ember);
}

.search-panel {
  position: absolute;
  top: 56px;
  left: 12px;
  z-index: 95;
  display: flex;
  flex-direction: column;
  width: 280px;
  max-width: calc(100vw - 24px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
  padding: 10px;
}

.search-input {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
  font-size: 14px;
}

.search-results {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 280px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.search-result {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--color-ink);
  cursor: pointer;
}

.search-result:hover,
.search-result.highlighted {
  background: var(--color-surface-light);
}

/* The highlight is what Enter will open, so it needs to outrank a stray hover
   the pointer left behind while the hands moved to the keyboard. */
.search-result.highlighted {
  box-shadow: inset 0 0 0 1px var(--color-ember);
}

.search-result-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-result-col {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-ink-dim);
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-empty {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--color-ink-dim);
}

@media (max-width: 760px) {
  .back-label {
    display: none;
  }

  /* .board-name is the only shrinkable element in the bar, so every fixed
     item takes its width first. Reclaim what the gaps and padding were
     spending, and in Practice mode drop the name entirely — a 40px `Tes…`
     is worth less than the room it costs the session actions. */
  .topbar {
    gap: 8px;
    padding: 10px 12px;
  }

  .topbar.practice-view .board-name {
    display: none;
  }

  .back-btn {
    padding: 8px 12px;
    font-size: 15px;
  }

  /* Under 16px, iOS Safari zooms the page when the field gets focus. */
  .search-input {
    font-size: 16px;
  }
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px;
  font-size: 14px;
  color: var(--color-ink-dim);
}

.status.error {
  color: var(--color-overdue);
}

.board-area {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}

.board {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 16px;
  padding: 24px;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  align-items: flex-start;
  background: var(--color-bg);
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
  cursor: grab;
}

/* Vertical insertion marker while dragging a column, mirroring KanbanColumn's
   own horizontal .drop-line for card reordering. */
.column-drop-line {
  flex-shrink: 0;
  align-self: stretch;
  width: 4px;
  border-radius: 2px;
  background: var(--color-ember);
}

/* Quick-move drop buckets: a floating bar over the top of the board, shown only
   while a card is being dragged. */
.quick-drop-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 60;
  display: flex;
  padding: 10px 12px;
  background: var(--color-surface);
  border-bottom: 2px solid var(--color-ember);
  box-shadow: var(--shadow-modal);
  transform: translateY(-100%);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.quick-drop-bar.active {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
}

/* Four buckets per row (25% each minus the 3 gaps between them); more wrap to
   the next row rather than overflowing off-screen. */
.quick-drop-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
}

.quick-bucket {
  flex: 0 0 calc((100% - 24px) / 4);
  min-width: 0;
  box-sizing: border-box;
  padding: 12px 10px;
  border: 2px dashed var(--color-ember);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quick-bucket.over {
  background: var(--color-ember);
  color: var(--color-text-on-ember);
  border-style: solid;
}

@media (prefers-reduced-motion: reduce) {
  .quick-drop-bar {
    transition: none;
  }
}

.board.panning {
  cursor: grabbing;
}

@media (max-width: 640px) {
  .board {
    gap: 12px;
    padding: 12px;
    scroll-snap-type: x mandatory;
    scroll-padding-left: 12px;
    cursor: default;
  }

  /* Snap fights the edge auto-scroll while a card is being dragged. */
  .board.touch-dragging {
    scroll-snap-type: none;
  }
}

.drag-ghost {
  position: fixed;
  z-index: 200;
  transform: translate(-50%, -120%);
  pointer-events: none;
  max-width: 70vw;
  padding: 10px 12px;
  background: var(--color-surface-light);
  border: 1px solid var(--color-ember);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-modal);
  font-size: 14px;
  font-weight: 500;
  color: var(--color-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.add-column-btn {
  flex-shrink: 0;
  align-self: flex-start;
  padding: 10px 16px;
  border: 2px dashed var(--color-ember);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink-dim);
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}

.add-column-btn:hover {
  border-color: var(--color-ember-light);
  color: var(--color-ink);
  background: var(--color-surface);
}
</style>

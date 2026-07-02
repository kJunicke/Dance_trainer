<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import KanbanColumn from '../components/KanbanColumn.vue'
import CardModal from '../components/CardModal.vue'
import ColumnSettingsModal from '../components/ColumnSettingsModal.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import { useBoardStore } from '../stores/boardStore'
import { useAuthStore } from '../stores/authStore'

const store = useBoardStore()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const boardId = Number(route.params.id)

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

const copied = ref(false)
async function copyCode() {
  if (!store.board) return
  await navigator.clipboard.writeText(store.board.invite_code)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
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

// --- Touch drag: ghost, drop-target highlight, edge auto-scroll ---
// Touch drag has no native dragover/drop events (pointer capture keeps them
// from firing on elements under the finger), so drop targets are resolved by
// hit-testing the finger position.

const touchPoint = ref<{ x: number; y: number } | null>(null)
const touchOverColumnId = ref<number | null>(null)
let autoScrollRaf = 0

const draggingCardName = computed(() => {
  if (!dragState.value || !touchPoint.value) return null
  return store.cards.find((c) => c.id === dragState.value!.cardId)?.name ?? null
})

function columnIdAtPoint(x: number, y: number): number | null {
  const columnEl = document.elementFromPoint(x, y)?.closest<HTMLElement>('.kanban-column')
  return columnEl ? Number(columnEl.dataset.columnId) : null
}

function onCardDragMove(x: number, y: number) {
  touchPoint.value = { x, y }
  touchOverColumnId.value = columnIdAtPoint(x, y)
  if (!autoScrollRaf) autoScrollLoop()
}

// Keep the board scrolling while the finger rests near an edge, so cards can
// be dragged to columns that are off-screen (the common case on a phone).
function autoScrollLoop() {
  autoScrollRaf = requestAnimationFrame(() => {
    const el = boardEl.value
    const p = touchPoint.value
    if (!el || !p || !dragState.value) {
      autoScrollRaf = 0
      return
    }
    const EDGE = 56
    const SPEED = 10
    const rect = el.getBoundingClientRect()
    if (p.x < rect.left + EDGE) el.scrollLeft -= SPEED
    else if (p.x > rect.right - EDGE) el.scrollLeft += SPEED
    // Scrolling moves columns under a stationary finger, so re-resolve the
    // highlighted drop target here, not just on finger movement.
    touchOverColumnId.value = columnIdAtPoint(p.x, p.y)
    autoScrollLoop()
  })
}

function stopAutoScroll() {
  if (autoScrollRaf) cancelAnimationFrame(autoScrollRaf)
  autoScrollRaf = 0
  touchPoint.value = null
  touchOverColumnId.value = null
}

function onCardDragEndTouch(x: number, y: number) {
  stopAutoScroll()
  if (!dragState.value) return
  const sourceCardId = dragState.value.cardId
  const el = document.elementFromPoint(x, y)
  const columnEl = el?.closest<HTMLElement>('.kanban-column')
  if (!columnEl) {
    dragState.value = null
    return
  }
  const columnId = Number(columnEl.dataset.columnId)
  const cardEl = el?.closest<HTMLElement>('.task-card')
  if (cardEl && Number(cardEl.dataset.cardId) !== sourceCardId) {
    const targetCardId = Number(cardEl.dataset.cardId)
    const rect = cardEl.getBoundingClientRect()
    const position = y < rect.top + rect.height / 2 ? 'before' : 'after'
    onCardDroppedOnCard(columnId, targetCardId, position)
    return
  }
  onColumnDrop(columnId)
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
    <header class="topbar">
      <button class="back-btn" title="Back to your boards" @click="router.push({ name: 'boards' })">
        ←<span class="back-label"> Boards</span>
      </button>
      <h1 class="board-name">{{ store.board?.name }}</h1>

      <span v-if="store.board" class="invite">
        <code :title="'Invite code — share it to let others join this board'">{{ store.board.invite_code }}</code>
        <button
          class="bar-btn"
          title="Copy invite code to clipboard"
          @click="copyCode"
        >{{ copied ? 'Copied!' : 'Copy' }}</button>
        <button
          class="bar-btn"
          title="Download this board as a Trello-compatible JSON file"
          @click="store.exportBoard()"
        >Export</button>
      </span>
      <span class="user">{{ auth.user?.user_metadata?.display_name || auth.user?.email }}</span>
      <button class="bar-btn signout-btn" @click="signOut">Sign out</button>

      <button class="menu-btn" title="Board menu" @click="menuOpen = !menuOpen">⋯</button>
    </header>

    <div v-if="menuOpen" class="menu-backdrop" @click="menuOpen = false" />
    <nav v-if="menuOpen" class="menu">
      <div v-if="store.board" class="menu-row invite-row">
        <code>{{ store.board.invite_code }}</code>
        <button class="bar-btn" @click="copyCode">{{ copied ? 'Copied!' : 'Copy code' }}</button>
      </div>
      <button class="menu-row menu-action" @click="store.exportBoard(); menuOpen = false">
        Export board (Trello JSON)
      </button>
      <div class="menu-row menu-user">{{ auth.user?.user_metadata?.display_name || auth.user?.email }}</div>
      <button class="menu-row menu-action" @click="signOut">Sign out</button>
    </nav>

    <div v-if="store.loading" class="status"><LoadingSpinner :size="16" /> Loading…</div>
    <div v-else-if="store.error" class="status error">{{ store.error }}</div>
    <div
      v-else
      ref="boardEl"
      class="board"
      :class="{ panning: isPanning, 'touch-dragging': touchPoint !== null }"
      @wheel="onBoardWheel"
      @pointerdown="onBoardPointerDown"
      @pointermove="onBoardPointerMove"
      @pointerup="onBoardPointerUp"
      @pointercancel="onBoardPointerUp"
    >
      <KanbanColumn
        v-for="column in store.columns"
        :key="column.id"
        :id="column.id"
        :name="column.name"
        :cards="store.cardsByColumn(column.id).map((c) => ({ ...c, labels: store.labelsForCard(c.id) }))"
        :touch-drag-over="touchOverColumnId === column.id"
        @rename="store.renameColumn(column.id, $event)"
        @add-card="(name) => store.addCard(column.id, name)"
        @card-drag-start="onCardDragStart(column.id, $event)"
        @card-drag-move="onCardDragMove"
        @card-drag-end="onCardDragEndTouch"
        @card-dropped="onColumnDrop(column.id)"
        @card-dropped-on-card="(cardId, pos) => onCardDroppedOnCard(column.id, cardId, pos)"
        @open-card="openCardId = $event"
        @open-settings="settingsColumnId = column.id"
      />
      <button class="add-column-btn" title="Add a new column to this board" @click="store.addColumn()">+ Add Column</button>
    </div>

    <div
      v-if="draggingCardName && touchPoint"
      class="drag-ghost"
      :style="{ left: touchPoint.x + 'px', top: touchPoint.y + 'px' }"
    >{{ draggingCardName }}</div>

    <CardModal v-if="openCardId !== null" :card-id="openCardId" @close="openCardId = null" />
    <ColumnSettingsModal
      v-if="settingsColumnId !== null"
      :column-id="settingsColumnId"
      @close="settingsColumnId = null"
    />
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

.invite {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-ink-dim);
}

.invite code,
.invite-row code {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-ember-light);
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

.user {
  margin-left: auto;
  font-size: 14px;
  color: var(--color-ink-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu-btn {
  display: none;
  flex-shrink: 0;
  margin-left: auto;
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

@media (max-width: 760px) {
  .invite,
  .user,
  .signout-btn,
  .back-label {
    display: none;
  }

  .menu-btn {
    display: block;
  }

  .back-btn {
    padding: 8px 12px;
    font-size: 15px;
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

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
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
})

async function signOut() {
  await auth.signOut()
  router.push({ name: 'login' })
}

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
      <button class="back-btn" title="Back to your boards" @click="router.push({ name: 'boards' })">← Boards</button>
      <span v-if="store.board" class="invite">
        Invite code: <code :title="store.board.invite_code">{{ store.board.invite_code }}</code>
        <button
          class="copy-btn"
          title="Copy invite code to clipboard"
          @click="copyCode"
        >{{ copied ? 'Copied!' : 'Copy' }}</button>
        <button
          class="copy-btn"
          title="Download this board as a Trello-compatible JSON file"
          @click="store.exportBoard()"
        >Export</button>
      </span>
      <span class="user">{{ auth.user?.user_metadata?.display_name || auth.user?.email }}</span>
      <button class="signout-btn" @click="signOut">Sign out</button>
    </header>

    <div v-if="store.loading" class="status"><LoadingSpinner :size="16" /> Loading…</div>
    <div v-else-if="store.error" class="status error">{{ store.error }}</div>
    <div
      v-else
      ref="boardEl"
      class="board"
      :class="{ panning: isPanning }"
      @wheel="onBoardWheel"
      @pointerdown="onBoardPointerDown"
      @pointermove="onBoardPointerMove"
      @pointerup="onBoardPointerUp"
      @pointercancel="onBoardPointerUp"
    >
      <KanbanColumn
        v-for="column in store.columns"
        :key="column.id"
        :name="column.name"
        :cards="store.cardsByColumn(column.id).map((c) => ({ ...c, labels: store.labelsForCard(c.id) }))"
        @rename="store.renameColumn(column.id, $event)"
        @add-card="store.addCard(column.id)"
        @rename-card="(id, name) => store.renameCard(id, name)"
        @delete-card="store.deleteCard($event)"
        @delete="store.deleteColumn(column.id)"
        @card-drag-start="onCardDragStart(column.id, $event)"
        @card-dropped="onColumnDrop(column.id)"
        @card-dropped-on-card="(cardId, pos) => onCardDroppedOnCard(column.id, cardId, pos)"
        @open-card="openCardId = $event"
        @open-settings="settingsColumnId = column.id"
      />
      <button class="add-column-btn" title="Add a new column to this board" @click="store.addColumn()">+ Add Column</button>
    </div>

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
  padding: 12px 24px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.back-btn {
  padding: 6px 12px;
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

.invite {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-ink-dim);
}

.invite code {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-ember-light);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 2px 6px;
  border-radius: 4px;
}

.copy-btn {
  padding: 4px 8px;
  border: 1px solid var(--color-ember);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink);
  font-size: 12px;
  cursor: pointer;
}

.copy-btn:hover {
  background: var(--color-surface-light);
}

.user {
  margin-left: auto;
  font-size: 14px;
  color: var(--color-ink-dim);
}

.signout-btn {
  padding: 6px 12px;
  border: 1px solid var(--color-ember);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink);
  font-size: 13px;
  cursor: pointer;
}

.signout-btn:hover {
  background: var(--color-surface-light);
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

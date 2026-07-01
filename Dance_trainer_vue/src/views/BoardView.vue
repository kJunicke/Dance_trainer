<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import KanbanColumn from '../components/KanbanColumn.vue'
import CardModal from '../components/CardModal.vue'
import { useBoardStore } from '../stores/boardStore'
import { useAuthStore } from '../stores/authStore'

const store = useBoardStore()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const boardId = Number(route.params.id)
onMounted(() => store.loadBoard(boardId))

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
</script>

<template>
  <header class="topbar">
    <button class="back-btn" @click="router.push({ name: 'boards' })">← Boards</button>
    <span v-if="store.board" class="invite">
      Invite code: <code>{{ store.board.invite_code }}</code>
      <button class="copy-btn" @click="copyCode">{{ copied ? 'Copied!' : 'Copy' }}</button>
      <button class="copy-btn" @click="store.exportBoard()">Export</button>
    </span>
    <span class="user">{{ auth.user?.user_metadata?.display_name || auth.user?.email }}</span>
    <button class="signout-btn" @click="signOut">Sign out</button>
  </header>

  <div v-if="store.loading" class="status">Loading…</div>
  <div v-else-if="store.error" class="status error">{{ store.error }}</div>
  <div v-else class="board">
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
    />
    <button class="add-column-btn" @click="store.addColumn()">+ Add Column</button>
  </div>

  <CardModal v-if="openCardId !== null" :card-id="openCardId" @close="openCardId = null" />
</template>

<style scoped>
.topbar {
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
  padding: 24px;
  font-size: 14px;
  color: var(--color-ink-dim);
}

.status.error {
  color: var(--color-overdue);
}

.board {
  display: flex;
  gap: 16px;
  padding: 24px;
  overflow-x: auto;
  align-items: flex-start;
  background: var(--color-bg);
  min-height: calc(100vh - 49px);
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

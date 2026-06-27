<script setup lang="ts">
import { ref, onMounted } from 'vue'
import KanbanColumn from './components/KanbanColumn.vue'
import { useBoardStore } from './stores/boardStore'

const store = useBoardStore()
onMounted(() => store.loadBoard())

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
</script>

<template>
  <div v-if="store.loading" class="status">Loading…</div>
  <div v-else-if="store.error" class="status error">{{ store.error }}</div>
  <div v-else class="board">
    <KanbanColumn
      v-for="column in store.columns"
      :key="column.id"
      :name="column.name"
      :cards="store.cardsByColumn(column.id)"
      @rename="store.renameColumn(column.id, $event)"
      @add-card="store.addCard(column.id)"
      @rename-card="(id, name) => store.renameCard(id, name)"
      @delete-card="store.deleteCard($event)"
      @delete="store.deleteColumn(column.id)"
      @card-drag-start="onCardDragStart(column.id, $event)"
      @card-dropped="onColumnDrop(column.id)"
      @card-dropped-on-card="(cardId, pos) => onCardDroppedOnCard(column.id, cardId, pos)"
    />
    <button class="add-column-btn" @click="store.addColumn()">+ Add Column</button>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: sans-serif;
  background: #d0d8e0;
  min-height: 100vh;
}
</style>

<style scoped>
.status {
  padding: 24px;
  font-size: 14px;
  color: #666;
}

.status.error {
  color: #c00;
}

.board {
  display: flex;
  gap: 16px;
  padding: 24px;
  overflow-x: auto;
  min-height: 100vh;
  align-items: flex-start;
}

.add-column-btn {
  flex-shrink: 0;
  align-self: flex-start;
  padding: 10px 16px;
  border: 2px dashed #aaa;
  border-radius: 8px;
  background: transparent;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}

.add-column-btn:hover {
  border-color: #888;
  color: #333;
}
</style>

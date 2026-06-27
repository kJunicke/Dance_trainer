<script setup lang="ts">
import { ref } from 'vue'
import KanbanColumn from './components/KanbanColumn.vue'

const columns = ref([
  {
    id: 1,
    title: 'Backlog',
    cards: [
      { id: 1, title: 'Salsa basic step', description: 'On1 and On2 timing' },
      { id: 2, title: 'Body isolation drill' },
      { id: 3, title: 'Footwork combo A', description: 'From workshop June 2024' },
    ],
  },
  {
    id: 2,
    title: 'Practising',
    cards: [
      { id: 4, title: 'Cross body lead', description: 'Focus on frame' },
      { id: 5, title: 'Cuban motion', description: 'Integrate into basic step' },
    ],
  },
  {
    id: 3,
    title: 'Polishing',
    cards: [
      { id: 6, title: 'Right turn', description: 'Spot turn consistency' },
    ],
  },
  {
    id: 4,
    title: 'Done',
    cards: [
      { id: 7, title: 'Cumbia basic' },
      { id: 8, title: 'Side step variations' },
    ],
  },
])

let nextColumnId = 5
let nextCardId = 9

function addColumn() {
  columns.value.push({ id: nextColumnId++, title: 'New Column', cards: [] })
}

function renameColumn(id: number, newTitle: string) {
  const col = columns.value.find((c) => c.id === id)
  if (col) col.title = newTitle
}

function addCard(columnId: number) {
  const col = columns.value.find((c) => c.id === columnId)
  if (col) col.cards.push({ id: nextCardId++, title: 'New Card' })
}

function renameCard(columnId: number, cardId: number, newTitle: string) {
  const col = columns.value.find((c) => c.id === columnId)
  if (!col) return
  const card = col.cards.find((c) => c.id === cardId)
  if (card) card.title = newTitle
}

function deleteColumn(columnId: number) {
  columns.value = columns.value.filter((c) => c.id !== columnId)
}

function deleteCard(columnId: number, cardId: number) {
  const col = columns.value.find((c) => c.id === columnId)
  if (col) col.cards = col.cards.filter((c) => c.id !== cardId)
}

const dragState = ref<{ cardId: number; sourceColumnId: number } | null>(null)

function onCardDragStart(columnId: number, cardId: number) {
  dragState.value = { cardId, sourceColumnId: columnId }
}

function onColumnDrop(targetColumnId: number) {
  if (!dragState.value) return
  const { cardId, sourceColumnId } = dragState.value
  dragState.value = null
  if (sourceColumnId === targetColumnId) return

  const sourceCol = columns.value.find((c) => c.id === sourceColumnId)
  const targetCol = columns.value.find((c) => c.id === targetColumnId)
  if (!sourceCol || !targetCol) return

  const cardIndex = sourceCol.cards.findIndex((c) => c.id === cardId)
  if (cardIndex === -1) return

  const [card] = sourceCol.cards.splice(cardIndex, 1)
  targetCol.cards.push(card)
}
</script>

<template>
  <div class="board">
    <KanbanColumn
      v-for="column in columns"
      :key="column.id"
      :title="column.title"
      :cards="column.cards"
      @rename="renameColumn(column.id, $event)"
      @add-card="addCard(column.id)"
      @rename-card="renameCard(column.id, $event[0], $event[1])"
      @delete-card="deleteCard(column.id, $event)"
      @delete="deleteColumn(column.id)"
      @card-drag-start="onCardDragStart(column.id, $event)"
      @card-dropped="onColumnDrop(column.id)"
    />
    <button class="add-column-btn" @click="addColumn">+ Add Column</button>
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

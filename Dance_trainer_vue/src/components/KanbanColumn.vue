<script setup lang="ts">
import { ref, nextTick } from 'vue'
import TaskCard from './TaskCard.vue'

const props = defineProps<{
  name: string
  cards: {
    id: number
    name: string
    description?: string | null
    due_date?: string | null
    labels?: { id: number; name: string; color: string }[]
  }[]
}>()

const emit = defineEmits<{
  rename: [newTitle: string]
  'rename-card': [cardId: number, newTitle: string]
  'delete-card': [cardId: number]
  'add-card': []
  delete: []
  'card-drag-start': [cardId: number]
  'card-dropped': []
  'card-dropped-on-card': [targetCardId: number, position: 'before' | 'after']
  'open-card': [cardId: number]
}>()

const isEditing = ref(false)
const editValue = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const dragOverCount = ref(0)
const dropIndicator = ref<{ cardId: number; position: 'before' | 'after' } | null>(null)

async function startEdit() {
  editValue.value = props.name
  isEditing.value = true
  await nextTick()
  inputEl.value?.select()
}

function confirmEdit() {
  const trimmed = editValue.value.trim()
  if (trimmed && trimmed !== props.name) emit('rename', trimmed)
  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
}

function onCardDragOver(event: Event, cardId: number) {
  const e = event as DragEvent
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  dropIndicator.value = {
    cardId,
    position: e.clientY < rect.top + rect.height / 2 ? 'before' : 'after',
  }
}

function onCardDrop(cardId: number) {
  if (!dropIndicator.value) return
  const position = dropIndicator.value.position
  dropIndicator.value = null
  dragOverCount.value = 0
  emit('card-dropped-on-card', cardId, position)
}

function onColumnDrop() {
  dropIndicator.value = null
  dragOverCount.value = 0
  emit('card-dropped')
}
</script>

<template>
  <div
    class="kanban-column"
    :class="{ 'drag-over': dragOverCount > 0 }"
    @dragover.prevent
    @dragenter="dragOverCount++"
    @dragleave="dragOverCount--"
    @drop.prevent="onColumnDrop"
  >
    <div class="column-header">
      <input
        v-if="isEditing"
        ref="inputEl"
        v-model="editValue"
        class="column-title-input"
        @blur="confirmEdit"
        @keydown.enter="confirmEdit"
        @keydown.esc="cancelEdit"
      />
      <h2 v-else class="column-title" @click="startEdit">{{ name }}</h2>
      <button class="delete-btn" @click="emit('delete')">×</button>
    </div>
    <div class="card-list">
      <template v-for="card in cards" :key="card.id">
        <div
          v-if="dropIndicator?.cardId === card.id && dropIndicator.position === 'before'"
          class="drop-line"
        />
        <TaskCard
          :id="card.id"
          :name="card.name"
          :description="card.description"
          :due-date="card.due_date"
          :labels="card.labels"
          @rename="emit('rename-card', card.id, $event)"
          @delete="emit('delete-card', card.id)"
          @open="emit('open-card', card.id)"
          @drag-start="emit('card-drag-start', $event)"
          @dragover.prevent="onCardDragOver($event, card.id)"
          @drop.prevent.stop="onCardDrop(card.id)"
        />
        <div
          v-if="dropIndicator?.cardId === card.id && dropIndicator.position === 'after'"
          class="drop-line"
        />
      </template>
    </div>
    <button class="add-card-btn" @click="emit('add-card')">+ Add Card</button>
  </div>
</template>

<style scoped>
.kanban-column {
  background: #f0f0f0;
  border-radius: 8px;
  padding: 12px;
  min-width: 260px;
  width: 260px;
  flex-shrink: 0;
  transition: background 0.15s;
}

.kanban-column.drag-over {
  background: #dce8f5;
  outline: 2px dashed #6aabdf;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
}

.column-title {
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #444;
  cursor: pointer;
  border-radius: 4px;
  padding: 2px 4px;
}

.column-title:hover {
  background: #e0e0e0;
}

.column-title-input {
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #444;
  border: 2px solid #888;
  border-radius: 4px;
  padding: 2px 4px;
  background: #fff;
  outline: none;
}

.delete-btn {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #aaa;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.delete-btn:hover {
  background: #e0e0e0;
  color: #c00;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drop-line {
  height: 3px;
  border-radius: 2px;
  background: #6aabdf;
  margin: -4px 0;
}

.add-card-btn {
  margin-top: 8px;
  width: 100%;
  padding: 6px;
  border: 2px dashed #bbb;
  border-radius: 6px;
  background: transparent;
  color: #888;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.add-card-btn:hover {
  border-color: #999;
  color: #555;
}
</style>

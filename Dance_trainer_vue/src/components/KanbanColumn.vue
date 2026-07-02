<script setup lang="ts">
import { ref, nextTick } from 'vue'
import TaskCard from './TaskCard.vue'

const props = defineProps<{
  id: number
  name: string
  cards: {
    id: number
    name: string
    description?: string | null
    due_date?: string | null
    labels?: { id: number; name: string; color: string }[]
  }[]
  touchDragOver?: boolean
}>()

const emit = defineEmits<{
  rename: [newTitle: string]
  'add-card': [name: string]
  'card-drag-start': [cardId: number]
  'card-drag-move': [x: number, y: number]
  'card-drag-end': [x: number, y: number]
  'card-dropped': []
  'card-dropped-on-card': [targetCardId: number, position: 'before' | 'after']
  'open-card': [cardId: number]
  'open-settings': []
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

const composing = ref(false)
const composerText = ref('')
const composerEl = ref<HTMLTextAreaElement | null>(null)

async function startCompose() {
  composing.value = true
  await nextTick()
  composerEl.value?.focus()
  composerEl.value?.scrollIntoView({ block: 'nearest' })
}

async function submitCompose() {
  const name = composerText.value.trim()
  if (!name) {
    composing.value = false
    return
  }
  emit('add-card', name)
  composerText.value = ''
  // Stay open for rapid entry of several cards in a row.
  await nextTick()
  composerEl.value?.focus()
  composerEl.value?.scrollIntoView({ block: 'nearest' })
}

function cancelCompose() {
  composerText.value = ''
  composing.value = false
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
    :class="{ 'drag-over': dragOverCount > 0 || touchDragOver }"
    :data-column-id="id"
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
      <h2 v-else class="column-title" title="Tap to rename" @click="startEdit">{{ name }}</h2>
      <span class="card-count">{{ cards.length }}</span>
      <button class="settings-btn" title="Column settings" @click="emit('open-settings')">⚙</button>
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
          @open="emit('open-card', card.id)"
          @drag-start="emit('card-drag-start', $event)"
          @drag-move="(x, y) => emit('card-drag-move', x, y)"
          @drag-end="(x, y) => emit('card-drag-end', x, y)"
          @dragover.prevent="onCardDragOver($event, card.id)"
          @drop.prevent.stop="onCardDrop(card.id)"
        />
        <div
          v-if="dropIndicator?.cardId === card.id && dropIndicator.position === 'after'"
          class="drop-line"
        />
      </template>
      <div v-if="composing" class="composer">
        <textarea
          ref="composerEl"
          v-model="composerText"
          rows="2"
          placeholder="Card title…"
          @keydown.enter.prevent="submitCompose"
          @keydown.esc="cancelCompose"
        />
        <div class="composer-actions">
          <button class="composer-add" @click="submitCompose">Add card</button>
          <button class="composer-cancel" title="Stop adding cards" @click="cancelCompose">×</button>
        </div>
      </div>
    </div>
    <button v-if="!composing" class="add-card-btn" @click="startCompose">+ Add Card</button>
  </div>
</template>

<style scoped>
.kanban-column {
  display: flex;
  flex-direction: column;
  max-height: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 12px;
  min-width: 260px;
  width: 260px;
  flex-shrink: 0;
  transition: background 0.15s;
  cursor: default;
}

@media (max-width: 640px) {
  .kanban-column {
    /* One column per swipe, with a sliver of the next as a scroll affordance. */
    min-width: min(84vw, 340px);
    width: min(84vw, 340px);
    scroll-snap-align: start;
  }

  /* Under 16px, iOS Safari zooms the page when the field gets focus. */
  .column-title-input,
  .composer textarea {
    font-size: 16px;
  }
}

.kanban-column.drag-over {
  background: var(--color-surface-light);
  outline: 2px dashed var(--color-ember);
}

.column-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--color-ember);
}

.column-title {
  flex: 1;
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-ink);
  cursor: pointer;
  border-radius: 4px;
  padding: 4px;
  overflow-wrap: anywhere;
}

.column-title:hover {
  background: var(--color-surface-light);
}

.column-title-input {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-ink);
  border: 2px solid var(--color-ember);
  border-radius: 4px;
  padding: 2px 4px;
  background: var(--color-bg);
  outline: none;
}

.card-count {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-ink-dim);
  padding: 1px 6px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
}

.settings-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-ink);
  opacity: 0.5;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.settings-btn:hover {
  background: var(--color-surface-light);
  opacity: 1;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 24px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.card-list > * {
  flex-shrink: 0;
}

.drop-line {
  height: 3px;
  border-radius: 2px;
  background: var(--color-ember);
  margin: -4px 0;
}

.composer textarea {
  width: 100%;
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  box-sizing: border-box;
  resize: none;
  border: 1px solid var(--color-ember);
  border-radius: var(--radius-sm);
  background: var(--color-surface-light);
  color: var(--color-ink);
  outline: none;
}

.composer-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.composer-add {
  padding: 8px 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-ember);
  color: var(--color-text-on-ember);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.composer-add:hover {
  background: var(--color-ember-light);
}

.composer-cancel {
  width: 34px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink-dim);
  font-size: 18px;
  cursor: pointer;
}

.composer-cancel:hover {
  background: var(--color-surface-light);
  color: var(--color-ink);
}

.add-card-btn {
  flex-shrink: 0;
  margin-top: 8px;
  width: 100%;
  padding: 10px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink-dim);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.add-card-btn:hover {
  border-color: var(--color-ember);
  color: var(--color-ink);
}
</style>

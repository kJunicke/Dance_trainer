<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useBoardStore } from '@/stores/boardStore'
import { renderMarkdown } from '@/lib/markdown'
import { LABEL_COLORS } from '@/lib/labelColors'

const props = defineProps<{
  cardId: number
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useBoardStore()

const card = computed(() => store.cards.find((c) => c.id === props.cardId) ?? null)
const boardId = computed(() => store.board?.id ?? null)
const cardLabelIds = computed(
  () => new Set(store.labelsForCard(props.cardId).map((l) => l.id)),
)

const descriptionDraft = ref('')
const editingDescription = ref(false)
const titleDraft = ref('')
const editingTitle = ref(false)
const titleInputEl = ref<HTMLInputElement | null>(null)
watch(
  card,
  (c) => {
    if (!c) { emit('close'); return }
    descriptionDraft.value = c.description ?? ''
    if (!editingTitle.value) titleDraft.value = c.name
  },
  { immediate: true },
)

function saveDescription() {
  store.updateCardDescription(props.cardId, descriptionDraft.value)
  editingDescription.value = false
}

async function startEditTitle() {
  titleDraft.value = card.value?.name ?? ''
  editingTitle.value = true
  await nextTick()
  titleInputEl.value?.select()
}

function saveTitle() {
  const trimmed = titleDraft.value.trim()
  if (trimmed && card.value && trimmed !== card.value.name) store.renameCard(props.cardId, trimmed)
  editingTitle.value = false
}

function cancelEditTitle() {
  editingTitle.value = false
}

function onDueDateChange(event: Event) {
  const value = (event.target as HTMLInputElement).value
  store.updateCardDueDate(props.cardId, value || null)
}

function onColumnChange(event: Event) {
  const columnId = Number((event.target as HTMLSelectElement).value)
  if (!card.value || columnId === card.value.column_id) return
  store.moveCard(props.cardId, columnId, store.cardsByColumn(columnId).length)
}

function deleteCard() {
  if (!card.value) return
  if (!window.confirm(`Delete "${card.value.name}"?`)) return
  store.deleteCard(props.cardId)
  // The card watcher also closes the modal, but only after the DB round-trip.
  emit('close')
}

const newLabelName = ref('')
const newLabelColor = ref<string>(Object.keys(LABEL_COLORS)[0] ?? 'rose')

function addLabel() {
  if (!boardId.value) return
  const name = newLabelName.value.trim()
  if (!name) return
  store.createLabel(boardId.value, name, newLabelColor.value)
  newLabelName.value = ''
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

// Escape only reaches the backdrop's keydown handler if something inside the
// modal has focus.
const backdropEl = ref<HTMLElement | null>(null)
onMounted(() => backdropEl.value?.focus())
</script>

<template>
  <div ref="backdropEl" class="backdrop" @click="onBackdropClick" @keydown="onKeydown" tabindex="-1">
    <div v-if="card" class="modal">
      <button class="close-btn" title="Close" @click="emit('close')">×</button>
      <input
        v-if="editingTitle"
        ref="titleInputEl"
        v-model="titleDraft"
        class="title-input"
        @blur="saveTitle"
        @keydown.enter="saveTitle"
        @keydown.esc="cancelEditTitle"
      />
      <h2 v-else class="title" @click="startEditTitle">{{ card.name }}</h2>

      <div class="field-row">
        <section class="field">
          <label class="field-label">Column</label>
          <select class="column-select" :value="card.column_id" @change="onColumnChange">
            <option v-for="col in store.columns" :key="col.id" :value="col.id">{{ col.name }}</option>
          </select>
        </section>

        <section class="field">
          <label class="field-label">Due date</label>
          <input type="date" :value="card.due_date ?? ''" @change="onDueDateChange" />
        </section>
      </div>

      <section class="field">
        <label class="field-label">Labels</label>
        <div class="label-list">
          <button
            v-for="label in store.labels"
            :key="label.id"
            class="label-chip"
            :class="{ active: cardLabelIds.has(label.id) }"
            :style="{ background: LABEL_COLORS[label.color] ?? '#ccc' }"
            :title="cardLabelIds.has(label.id) ? 'Remove label from card' : 'Add label to card'"
            @click="store.toggleCardLabel(props.cardId, label.id)"
          >
            {{ label.name }}
          </button>
        </div>
        <div class="new-label">
          <select v-model="newLabelColor">
            <option v-for="(hex, name) in LABEL_COLORS" :key="name" :value="name">{{ name }}</option>
          </select>
          <input v-model="newLabelName" placeholder="New label name" @keydown.enter="addLabel" />
          <button @click="addLabel">Add</button>
        </div>
      </section>

      <section class="field">
        <label class="field-label">Description</label>
        <div v-if="editingDescription">
          <textarea v-model="descriptionDraft" rows="8" placeholder="Markdown supported" />
          <div class="desc-actions">
            <button @click="saveDescription">Save</button>
            <button @click="editingDescription = false">Cancel</button>
          </div>
        </div>
        <div v-else class="desc-preview" @click="editingDescription = true">
          <p v-if="!card.description" class="placeholder">Click to add a description…</p>
          <div v-else v-html="renderMarkdown(card.description)" />
        </div>
      </section>

      <button class="delete-card-btn" @click="deleteCard">Delete card</button>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 16px;
  overflow-y: auto;
  z-index: 100;
}

.modal {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
  padding: 24px;
  width: 100%;
  max-width: 560px;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  color: var(--color-ink);
  opacity: 0.5;
}

.close-btn:hover {
  opacity: 1;
}

.title {
  margin: 0 32px 20px 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 22px;
  letter-spacing: -0.01em;
  color: var(--color-ink);
  border-radius: 4px;
  padding: 2px 4px;
  cursor: pointer;
}

.title:hover {
  background: var(--color-surface-light);
}

.title-input {
  display: block;
  width: 100%;
  margin: 0 32px 20px 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 22px;
  letter-spacing: -0.01em;
  color: var(--color-ink);
  border: 2px solid var(--color-ember);
  border-radius: 4px;
  padding: 2px 4px;
  background: var(--color-bg);
  outline: none;
  box-sizing: border-box;
}

.field {
  margin-bottom: 20px;
}

.field-row {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.field-row .field {
  min-width: 0;
}

.column-select {
  max-width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
  font-size: 14px;
}

.field-label {
  display: block;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-ember-light);
  margin-bottom: 6px;
}

input[type='date'] {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-mono);
  color-scheme: dark;
}

.label-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.label-chip {
  border: 2px solid transparent;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  color: #fff;
  cursor: pointer;
  opacity: 0.55;
}

.label-chip.active {
  opacity: 1;
  border-color: var(--color-ink);
}

.new-label {
  display: flex;
  gap: 6px;
}

.new-label input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
}

.new-label select {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
  padding: 8px;
}

.new-label button {
  padding: 8px 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-ember);
  color: var(--color-text-on-ember);
  font-weight: 600;
  cursor: pointer;
}

textarea {
  width: 100%;
  font: inherit;
  padding: 8px;
  box-sizing: border-box;
  resize: vertical;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
}

.desc-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}

.desc-actions button {
  padding: 6px 14px;
  border: 1px solid var(--color-ember);
  border-radius: var(--radius-sm);
  background: var(--color-ember);
  color: var(--color-text-on-ember);
  font-weight: 600;
  cursor: pointer;
}

.desc-actions button:last-child {
  background: transparent;
  color: var(--color-ink);
}

.desc-preview {
  min-height: 40px;
  padding: 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.desc-preview:hover {
  background: var(--color-surface-light);
}

.desc-preview :deep(.placeholder) {
  color: var(--color-ink-dim);
  margin: 0;
}

.desc-preview :deep(p) {
  margin: 0 0 8px;
}

.desc-preview :deep(ul),
.desc-preview :deep(ol) {
  margin: 0 0 8px;
  padding-left: 20px;
}

.delete-card-btn {
  padding: 8px 14px;
  border: 1px solid var(--color-overdue);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-overdue);
  font-size: 13px;
  cursor: pointer;
}

.delete-card-btn:hover {
  background: color-mix(in srgb, var(--color-overdue) 12%, transparent);
}

/* On a phone the modal becomes a full-screen sheet. */
@media (max-width: 640px) {
  .backdrop {
    padding: 0;
    align-items: stretch;
  }

  .modal {
    max-width: none;
    min-height: 100dvh;
    border: none;
    border-radius: 0;
    padding: 20px 16px;
  }

  .close-btn {
    width: 40px;
    height: 40px;
    font-size: 24px;
  }

  .label-chip {
    padding: 8px 14px;
    font-size: 13px;
  }

  /* Under 16px, iOS Safari zooms the page when the field gets focus. */
  .column-select {
    font-size: 16px;
  }
}
</style>

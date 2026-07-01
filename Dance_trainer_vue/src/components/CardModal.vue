<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
watch(
  card,
  (c) => {
    if (!c) { emit('close'); return }
    descriptionDraft.value = c.description ?? ''
  },
  { immediate: true },
)

function saveDescription() {
  store.updateCardDescription(props.cardId, descriptionDraft.value)
  editingDescription.value = false
}

function onDueDateChange(event: Event) {
  const value = (event.target as HTMLInputElement).value
  store.updateCardDueDate(props.cardId, value || null)
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
</script>

<template>
  <div class="backdrop" @click="onBackdropClick" @keydown="onKeydown" tabindex="-1">
    <div v-if="card" class="modal">
      <button class="close-btn" @click="emit('close')">×</button>
      <h2 class="title">{{ card.name }}</h2>

      <section class="field">
        <label class="field-label">Due date</label>
        <input type="date" :value="card.due_date ?? ''" @change="onDueDateChange" />
      </section>

      <section class="field">
        <label class="field-label">Labels</label>
        <div class="label-list">
          <button
            v-for="label in store.labels"
            :key="label.id"
            class="label-chip"
            :class="{ active: cardLabelIds.has(label.id) }"
            :style="{ background: LABEL_COLORS[label.color] ?? '#ccc' }"
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
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(33, 26, 34, 0.6);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 16px;
  overflow-y: auto;
  z-index: 100;
}

.modal {
  position: relative;
  background: var(--color-parquet);
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
  font-style: italic;
  font-variation-settings: 'WONK' 1;
  font-weight: 600;
  font-size: 22px;
  color: var(--color-ink);
}

.field {
  margin-bottom: 20px;
}

.field-label {
  display: block;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-aubergine);
  margin-bottom: 6px;
}

input[type='date'] {
  padding: 8px 10px;
  border: 1px solid var(--color-brass-light);
  border-radius: var(--radius-sm);
  background: var(--color-parquet-light);
  color: var(--color-ink);
  font-family: var(--font-mono);
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
  border: 1px solid var(--color-brass-light);
  border-radius: var(--radius-sm);
  background: var(--color-parquet-light);
}

.new-label select {
  border: 1px solid var(--color-brass-light);
  border-radius: var(--radius-sm);
  background: var(--color-parquet-light);
  padding: 8px;
}

.new-label button {
  padding: 8px 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-brass);
  color: var(--color-text-on-brass);
  font-weight: 600;
  cursor: pointer;
}

textarea {
  width: 100%;
  font: inherit;
  padding: 8px;
  box-sizing: border-box;
  resize: vertical;
  border: 1px solid var(--color-brass-light);
  border-radius: var(--radius-sm);
  background: var(--color-parquet-light);
  color: var(--color-ink);
}

.desc-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}

.desc-actions button {
  padding: 6px 14px;
  border: 1px solid var(--color-brass);
  border-radius: var(--radius-sm);
  background: var(--color-brass);
  color: var(--color-text-on-brass);
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
  background: var(--color-parquet-light);
}

.desc-preview :deep(.placeholder) {
  color: var(--color-ink);
  opacity: 0.5;
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
</style>

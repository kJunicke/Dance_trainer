<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { renderMarkdown } from '@/lib/markdown'
import { LABEL_COLORS } from '@/lib/labelColors'

const props = defineProps<{
  id: number
  name: string
  description?: string | null
  dueDate?: string | null
  labels?: { id: number; name: string; color: string }[]
}>()

const emit = defineEmits<{
  rename: [newTitle: string]
  delete: []
  open: []
  'drag-start': [cardId: number]
}>()

const descriptionHtml = computed(() =>
  props.description ? renderMarkdown(props.description) : '',
)

const isEditing = ref(false)
const editValue = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const suppressNextClick = ref(false)

function onDragEnd() {
  isDragging.value = false
  // Some browsers fire a synthetic click on the drag source right after
  // dragend; swallow exactly one click so a drag doesn't also open the modal.
  suppressNextClick.value = true
  requestAnimationFrame(() => { suppressNextClick.value = false })
}

function onCardClick() {
  if (suppressNextClick.value) { suppressNextClick.value = false; return }
  emit('open')
}

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
</script>

<template>
  <div
    class="task-card"
    :class="{ dragging: isDragging }"
    draggable="true"
    @dragstart="isDragging = true; emit('drag-start', id)"
    @dragend="onDragEnd"
    @click="onCardClick"
  >
    <div v-if="labels?.length" class="label-row">
      <span
        v-for="label in labels"
        :key="label.id"
        class="label-chip"
        :style="{ background: LABEL_COLORS[label.color] ?? '#ccc' }"
      >{{ label.name }}</span>
    </div>
    <div class="card-header">
      <input
        v-if="isEditing"
        ref="inputEl"
        v-model="editValue"
        class="task-title-input"
        @click.stop
        @blur="confirmEdit"
        @keydown.enter="confirmEdit"
        @keydown.esc="cancelEdit"
      />
      <p v-else class="task-title" @click.stop="startEdit">{{ name }}</p>
      <button class="delete-btn" @click.stop="emit('delete')">×</button>
    </div>
    <div v-if="description" class="task-description" v-html="descriptionHtml" />
    <p v-if="dueDate" class="due-badge">{{ dueDate }}</p>
  </div>
</template>

<style scoped>
.task-card {
  background: #fff;
  border-radius: 6px;
  padding: 10px 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  cursor: grab;
}

.task-card.dragging {
  opacity: 0.4;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-title {
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  border-radius: 3px;
  padding: 1px 3px;
  cursor: pointer;
}

.task-title:hover {
  background: #f0f0f0;
}

.task-title-input {
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  border: 2px solid #888;
  border-radius: 3px;
  padding: 1px 3px;
  outline: none;
  background: #fff;
}

.delete-btn {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: #ccc;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.delete-btn:hover {
  background: #fee;
  color: #c00;
}

.task-description {
  margin: 6px 0 0;
  font-size: 12px;
  color: #666;
  overflow: hidden;
  max-height: 4.5em;
}

.task-description :deep(p) {
  margin: 0 0 4px;
}

.task-description :deep(ul),
.task-description :deep(ol) {
  margin: 0 0 4px;
  padding-left: 16px;
}

.label-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.label-chip {
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  color: #fff;
}

.due-badge {
  margin: 6px 0 0;
  display: inline-block;
  font-size: 11px;
  color: #444;
  background: #eee;
  border-radius: 4px;
  padding: 2px 6px;
}
</style>

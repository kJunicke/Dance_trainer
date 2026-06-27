<script setup lang="ts">
import { ref, nextTick } from 'vue'

const props = defineProps<{
  id: number
  name: string
  description?: string | null
}>()

const emit = defineEmits<{
  rename: [newTitle: string]
  delete: []
  'drag-start': [cardId: number]
}>()

const isEditing = ref(false)
const editValue = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

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
    @dragend="isDragging = false"
  >
    <div class="card-header">
      <input
        v-if="isEditing"
        ref="inputEl"
        v-model="editValue"
        class="task-title-input"
        @blur="confirmEdit"
        @keydown.enter="confirmEdit"
        @keydown.esc="cancelEdit"
      />
      <p v-else class="task-title" @click="startEdit">{{ name }}</p>
      <button class="delete-btn" @click="emit('delete')">×</button>
    </div>
    <p v-if="description" class="task-description">{{ description }}</p>
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
}
</style>

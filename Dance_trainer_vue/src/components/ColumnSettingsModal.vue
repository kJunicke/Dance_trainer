<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useBoardStore } from '@/stores/boardStore'

const props = defineProps<{
  columnId: number
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useBoardStore()

const column = computed(() => store.columns.find((c) => c.id === props.columnId) ?? null)

watch(
  column,
  (c) => {
    if (!c) emit('close')
  },
  { immediate: true },
)

const ruleEnabled = computed(() => column.value?.due_offset_days !== null)

function onDueColumnToggle(event: Event) {
  if (!column.value) return
  const checked = (event.target as HTMLInputElement).checked
  store.updateColumnSettings(props.columnId, {
    is_due_column: checked,
    due_offset_days: checked ? null : column.value.due_offset_days,
  })
}

function onRuleToggle(event: Event) {
  if (!column.value) return
  const checked = (event.target as HTMLInputElement).checked
  store.updateColumnSettings(props.columnId, {
    is_due_column: column.value.is_due_column,
    due_offset_days: checked ? 0 : null,
  })
}

function onOffsetChange(event: Event) {
  if (!column.value) return
  const raw = Number((event.target as HTMLInputElement).value)
  const days = Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0
  ;(event.target as HTMLInputElement).value = String(days)
  store.updateColumnSettings(props.columnId, {
    is_due_column: column.value.is_due_column,
    due_offset_days: days,
  })
}

const columnIndex = computed(() =>
  store.columns.findIndex((c) => c.id === props.columnId),
)

function deleteColumn() {
  if (!column.value) return
  const count = store.cardsByColumn(props.columnId).length
  const suffix = count > 0 ? ` and its ${count} card${count === 1 ? '' : 's'}` : ''
  if (!window.confirm(`Delete "${column.value.name}"${suffix}?`)) return
  store.deleteColumn(props.columnId)
  emit('close')
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
    <div v-if="column" class="modal">
      <button class="close-btn" title="Close" @click="emit('close')">×</button>
      <h2 class="title">{{ column.name }}</h2>

      <section class="field">
        <label class="field-label">Due column</label>
        <label class="setting-row">
          <input type="checkbox" :checked="column.is_due_column" @change="onDueColumnToggle" />
          <span>Cards whose due date has arrived move here</span>
        </label>
        <p class="hint">If no column is marked, the leftmost column collects due cards.</p>
      </section>

      <section class="field" :class="{ disabled: column.is_due_column }">
        <label class="field-label">Due date on entry</label>
        <label class="setting-row">
          <input
            type="checkbox"
            :checked="ruleEnabled"
            :disabled="column.is_due_column"
            @change="onRuleToggle"
          />
          <span>Set due date when a card is moved in</span>
        </label>
        <label v-if="ruleEnabled" class="setting-row offset-row">
          <input
            type="number"
            min="0"
            step="1"
            :value="column.due_offset_days ?? 0"
            :disabled="column.is_due_column"
            @change="onOffsetChange"
          />
          <span>days from today (0 = due same day)</span>
        </label>
        <p v-if="column.is_due_column" class="hint">A due column can't set due dates itself.</p>
      </section>

      <section class="field">
        <label class="field-label">Position</label>
        <div class="position-row">
          <button
            class="move-btn"
            title="Move column left"
            :disabled="columnIndex <= 0"
            @click="store.moveColumn(props.columnId, -1)"
          >←</button>
          <span class="position-label">{{ columnIndex + 1 }} of {{ store.columns.length }}</span>
          <button
            class="move-btn"
            title="Move column right"
            :disabled="columnIndex === store.columns.length - 1"
            @click="store.moveColumn(props.columnId, 1)"
          >→</button>
        </div>
      </section>

      <button class="delete-column-btn" @click="deleteColumn">Delete column</button>
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
  max-width: 400px;
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
}

.field {
  margin-bottom: 20px;
}

.field.disabled .setting-row {
  opacity: 0.5;
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

.setting-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-ink);
  font-size: 14px;
  cursor: pointer;
}

.setting-row input[type='checkbox'] {
  accent-color: var(--color-ember);
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  cursor: pointer;
}

.setting-row input:disabled {
  cursor: default;
}

.offset-row {
  margin-top: 8px;
  color: var(--color-ink-dim);
}

.offset-row input[type='number'] {
  width: 64px;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-mono);
}

.hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--color-ink-dim);
}

.position-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.move-btn {
  width: 40px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
  font-size: 16px;
  cursor: pointer;
}

.move-btn:hover:not(:disabled) {
  border-color: var(--color-ember);
  background: var(--color-surface-light);
}

.move-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.position-label {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-ink-dim);
}

.delete-column-btn {
  padding: 8px 14px;
  border: 1px solid var(--color-overdue);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-overdue);
  font-size: 13px;
  cursor: pointer;
}

.delete-column-btn:hover {
  background: color-mix(in srgb, var(--color-overdue) 12%, transparent);
}
</style>

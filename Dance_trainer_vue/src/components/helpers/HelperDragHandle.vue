<script setup lang="ts">
import type { DragReorder } from '@/lib/useDragReorder'

defineProps<{
  reorder: DragReorder
  id: number
  label: string
}>()
</script>

<template>
  <button
    class="drag-handle"
    type="button"
    :aria-label="`Reorder ${label}. Drag, or use the up and down arrow keys.`"
    :data-reorder-handle="id"
    @pointerdown.prevent="reorder.grab($event, id, label)"
    @keydown="reorder.onKeydown($event, id)"
  >
    <span aria-hidden="true">⠿</span>
  </button>
</template>

<style scoped>
.drag-handle {
  flex: none;
  width: var(--hp-tap);
  height: var(--hp-tap);
  border: 1px solid var(--color-border);
  border-radius: var(--hp-r-m);
  background: var(--color-surface-light);
  color: var(--color-ink-dim);
  font-size: 18px;
  cursor: grab;
  touch-action: none;
  user-select: none;
  transition:
    background-color var(--hp-fast) var(--hp-ease),
    color var(--hp-fast) var(--hp-ease),
    transform var(--hp-fast) var(--hp-ease);
}

.drag-handle:active {
  background: var(--hp-amber);
  color: var(--color-ink);
  cursor: grabbing;
  transform: scale(1.06);
}
</style>

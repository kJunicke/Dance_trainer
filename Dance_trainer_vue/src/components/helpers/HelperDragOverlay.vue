<script setup lang="ts">
import type { DragReorder } from '@/lib/useDragReorder'
import HelperDragGhost from './HelperDragGhost.vue'

defineProps<{ reorder: DragReorder }>()
</script>

<template>
  <Teleport to="body">
    <template v-if="reorder.draggingId.value !== null">
      <div
        v-if="reorder.line.value"
        class="drop-line"
        :style="{
          top: `${reorder.line.value.top}px`,
          left: `${reorder.line.value.left}px`,
          width: `${reorder.line.value.width}px`,
        }"
      />
      <HelperDragGhost :x="reorder.ghost.value.x" :y="reorder.ghost.value.y" :label="reorder.ghost.value.label" />
    </template>
  </Teleport>
</template>

<style scoped>
/* Above the admin sheet, which the tab list is dragged inside. */
.drop-line {
  position: fixed;
  z-index: 200;
  height: 4px;
  margin-top: -2px;
  border-radius: var(--hp-r-full);
  background: var(--color-ink);
  box-shadow: 0 0 0 2px var(--hp-amber);
  pointer-events: none;
}
</style>

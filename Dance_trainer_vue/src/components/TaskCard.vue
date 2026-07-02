<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { renderMarkdown } from '@/lib/markdown'
import { LABEL_COLORS } from '@/lib/labelColors'
import { isDue } from '@/lib/dates'

const props = defineProps<{
  id: number
  name: string
  description?: string | null
  dueDate?: string | null
  labels?: { id: number; name: string; color: string }[]
}>()

const emit = defineEmits<{
  open: []
  'drag-start': [cardId: number]
  'drag-move': [x: number, y: number]
  'drag-end': [x: number, y: number]
}>()

const descriptionHtml = computed(() =>
  props.description ? renderMarkdown(props.description) : '',
)

const overdue = computed(() => isDue(props.dueDate))

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

// Touch has no native HTML5 drag support, so a tap always opens the modal
// unless the finger is held in place long enough to start a drag.
const LONG_PRESS_MS = 350
const MOVE_CANCEL_PX = 10
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let touchStart: { x: number; y: number; pointerId: number } | null = null
let touchDragActive = false

// preventDefault on pointermove does not stop native scrolling — only a
// non-passive touchmove listener does. Registered while a drag is active;
// the finger has been still for the long-press, so no scroll has started yet.
function blockTouchScroll(e: TouchEvent) {
  e.preventDefault()
}

function clearLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function endTouchDrag() {
  touchDragActive = false
  isDragging.value = false
  document.removeEventListener('touchmove', blockTouchScroll)
}

function onPointerDown(e: PointerEvent) {
  if (e.pointerType !== 'touch') return
  touchStart = { x: e.clientX, y: e.clientY, pointerId: e.pointerId }
  clearLongPress()
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    touchDragActive = true
    isDragging.value = true
    document.addEventListener('touchmove', blockTouchScroll, { passive: false })
    navigator.vibrate?.(30)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    emit('drag-start', props.id)
    emit('drag-move', touchStart!.x, touchStart!.y)
  }, LONG_PRESS_MS)
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerType !== 'touch' || !touchStart || e.pointerId !== touchStart.pointerId) return
  if (touchDragActive) {
    emit('drag-move', e.clientX, e.clientY)
    return
  }
  const dx = e.clientX - touchStart.x
  const dy = e.clientY - touchStart.y
  if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearLongPress()
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerType !== 'touch' || !touchStart || e.pointerId !== touchStart.pointerId) return
  clearLongPress()
  if (touchDragActive) {
    endTouchDrag()
    emit('drag-end', e.clientX, e.clientY)
    suppressNextClick.value = true
    requestAnimationFrame(() => { suppressNextClick.value = false })
  }
  touchStart = null
}

onUnmounted(() => {
  clearLongPress()
  document.removeEventListener('touchmove', blockTouchScroll)
})
</script>

<template>
  <div
    class="task-card"
    :class="{ dragging: isDragging }"
    :data-card-id="id"
    draggable="true"
    @dragstart="isDragging = true; emit('drag-start', id)"
    @dragend="onDragEnd"
    @click="onCardClick"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div v-if="labels?.length" class="label-row">
      <span
        v-for="label in labels"
        :key="label.id"
        class="label-chip"
        :style="{ background: LABEL_COLORS[label.color] ?? '#ccc' }"
      >{{ label.name }}</span>
    </div>
    <p class="task-title">{{ name }}</p>
    <div v-if="description" class="task-description" v-html="descriptionHtml" />
    <p v-if="dueDate" class="due-badge" :class="{ overdue }">{{ dueDate }}</p>
  </div>
</template>

<style scoped>
.task-card {
  position: relative;
  min-height: 44px;
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  /* pan-x/pan-y keep both board and column scrolling native from a card;
     long-press drags block scrolling themselves via a touchmove listener. */
  touch-action: pan-x pan-y;
}

.task-card:hover {
  border-color: color-mix(in srgb, var(--color-ember) 45%, var(--color-border));
}

.task-card.dragging {
  opacity: 0.4;
}

.task-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-ink);
  overflow-wrap: anywhere;
}

.task-description {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--color-ink-dim);
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
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-due);
  background: color-mix(in srgb, var(--color-due) 15%, var(--color-surface-light));
  border-radius: 4px;
  padding: 2px 6px;
}

.due-badge.overdue {
  color: var(--color-overdue);
  background: color-mix(in srgb, var(--color-overdue) 15%, var(--color-surface-light));
}
</style>

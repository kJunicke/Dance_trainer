<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { renderMarkdown } from '@/lib/markdown'
import { LABEL_COLORS, LABEL_TEXT_COLORS } from '@/lib/labelColors'
import { dueStatus, dueLabel } from '@/lib/dates'

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

const status = computed(() => dueStatus(props.dueDate))
const dueText = computed(() => dueLabel(props.dueDate))

const isDragging = ref(false)
const suppressNextClick = ref(false)

// Android Chrome also starts a native touch drag-and-drop on a long-press over
// a draggable element — racing the custom long-press drag below. The native
// drag can't actually proceed (blockTouchScroll + setPointerCapture disrupt
// it), so the browser aborts it almost immediately with a dragend, which was
// bubbling up and clearing the board's drag state mid-gesture. Disable native
// drag for touch pointers so only the custom touch drag runs; mouse keeps it.
const nativeDraggable = ref(true)

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
  nativeDraggable.value = e.pointerType !== 'touch'
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
    :class="[{ dragging: isDragging }, status ? `status-${status}` : '']"
    :data-card-id="id"
    :draggable="nativeDraggable"
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
        :style="{
          background: LABEL_COLORS[label.color] ?? '#ccc',
          color: LABEL_TEXT_COLORS[label.color] ?? '#2a2420',
        }"
      >{{ label.name }}</span>
    </div>
    <p class="task-title">{{ name }}</p>
    <div v-if="description" class="task-description" v-html="descriptionHtml" />
    <div v-if="dueText" class="meta">
      <span class="status-dot" />
      <span class="due-text">{{ dueText }}</span>
    </div>
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
  /* Without this, a long-press on Android/iOS selects the card's text (or
     shows the text-selection callout) instead of starting the drag. */
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

/* Traffic-light urgency rail on the left edge, drawn with an inset shadow so it
   layers over the border without shifting the card's content. Only actionable
   states (due today / overdue) and upcoming ones get a rail; undated cards stay plain. */
.task-card.status-overdue {
  box-shadow: inset 4px 0 0 var(--color-overdue), var(--shadow-card);
}

.task-card.status-due {
  box-shadow: inset 4px 0 0 var(--color-due), var(--shadow-card);
}

.task-card.status-scheduled {
  box-shadow: inset 4px 0 0 var(--color-good), var(--shadow-card);
}

.task-card:hover {
  border-color: color-mix(in srgb, var(--color-ember) 45%, var(--color-border));
}

.task-card.dragging {
  opacity: 0.4;
}

.task-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-ink);
  overflow-wrap: anywhere;
}

.task-description {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--color-ink-dim);
  overflow: hidden;
  max-height: 4.5em;
  /* A pasted share URL is one unbreakable token; without this it runs straight
     out past the card's right edge instead of wrapping into the preview. */
  overflow-wrap: anywhere;
}

.task-description :deep(p) {
  margin: 0 0 4px;
}

.task-description :deep(ul),
.task-description :deep(ol) {
  margin: 0 0 4px;
  padding-left: 16px;
}

/* On the board face a link is preview text, not a target — clicking anywhere on
   the card should open it, never navigate away mid-scan. */
.task-description :deep(a) {
  pointer-events: none;
  color: inherit;
  text-decoration: none;
}

.label-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

/* Chip ink comes from LABEL_TEXT_COLORS alongside the fill — white doesn't
   clear 4.5:1 on the three lighter label colors. */
.label-chip {
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
}

/* Consistent bottom strip: a status dot + the compact relative due label, always
   in the same spot so the eye learns where to check "when is this due." */
.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.status-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-ink-dim);
}

.status-scheduled .status-dot {
  background: var(--color-good);
}

.status-due .status-dot {
  background: var(--color-due);
}

.status-overdue .status-dot {
  background: var(--color-overdue);
}

.due-text {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-ink-dim);
}

/* Overdue is the one thing that should shout — color the label, not just the dot. */
.status-overdue .due-text {
  color: var(--color-overdue);
  font-weight: 700;
}
</style>

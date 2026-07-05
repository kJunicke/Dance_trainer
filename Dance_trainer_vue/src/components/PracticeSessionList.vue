<script setup lang="ts">
import { ref } from 'vue'
import type { Card } from '@/stores/boardStore'
import { useBoardStore } from '@/stores/boardStore'
import { dueStatus } from '@/lib/dates'
import { LABEL_COLORS } from '@/lib/labelColors'

const props = defineProps<{
  pendingCards: Card[]
  doneCards: Card[]
  activeId: number | null
  expanded: boolean
}>()

const emit = defineEmits<{
  focus: [cardId: number]
  reorder: [order: number[]]
  undo: [cardId: number]
  'toggle-expand': []
}>()

const store = useBoardStore()
function labelsFor(cardId: number) {
  return store.labelsForCard(cardId)
}

const listRowsEl = ref<HTMLElement | null>(null)
const draggingId = ref<number | null>(null)
const suppressNextClick = ref(false)

// Press-and-hold lifts a row for reordering; a quick tap (released before the
// hold fires) just focuses it. Mirrors TaskCard.vue's long-press-vs-tap split,
// adapted to a vertical list (BoardView's resolveCardDrop uses the same
// top-of-rect midpoint scan for vertical card drops within a column).
const LONG_PRESS_MS = 350
const MOVE_CANCEL_PX = 10
let pressTimer: ReturnType<typeof setTimeout> | null = null
let pressStart: { x: number; y: number; pointerId: number; cardId: number } | null = null
let localOrder: number[] = []

function clearPressTimer() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}

function blockTouchScroll(e: TouchEvent) {
  e.preventDefault()
}

function indexAtPoint(y: number): number {
  const rowEls = Array.from(listRowsEl.value?.querySelectorAll<HTMLElement>('[data-row-id]') ?? [])
  for (const el of rowEls) {
    const rect = el.getBoundingClientRect()
    if (y < rect.top + rect.height / 2) return rowEls.indexOf(el)
  }
  return rowEls.length
}

function onRowPointerDown(cardId: number, e: PointerEvent) {
  pressStart = { x: e.clientX, y: e.clientY, pointerId: e.pointerId, cardId }
  clearPressTimer()
  pressTimer = setTimeout(() => {
    pressTimer = null
    draggingId.value = cardId
    localOrder = props.pendingCards.map((c) => c.id)
    document.addEventListener('touchmove', blockTouchScroll, { passive: false })
    navigator.vibrate?.(20)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, LONG_PRESS_MS)
}

function onRowPointerMove(e: PointerEvent) {
  if (!pressStart || e.pointerId !== pressStart.pointerId) return
  if (draggingId.value === null) {
    const dx = e.clientX - pressStart.x
    const dy = e.clientY - pressStart.y
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearPressTimer()
    return
  }
  const fromIndex = localOrder.indexOf(draggingId.value)
  const toIndex = Math.min(indexAtPoint(e.clientY), localOrder.length - 1)
  if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
    localOrder.splice(toIndex, 0, localOrder.splice(fromIndex, 1)[0]!)
    emit('reorder', [...localOrder])
  }
}

function endDrag() {
  document.removeEventListener('touchmove', blockTouchScroll)
  if (draggingId.value !== null) {
    suppressNextClick.value = true
    requestAnimationFrame(() => { suppressNextClick.value = false })
  }
  draggingId.value = null
  pressStart = null
}

function onRowPointerUp(e: PointerEvent) {
  if (!pressStart || e.pointerId !== pressStart.pointerId) return
  clearPressTimer()
  endDrag()
}

function onRowClick(cardId: number) {
  if (suppressNextClick.value) { suppressNextClick.value = false; return }
  emit('focus', cardId)
}
</script>

<template>
  <div class="session-list" :class="{ expanded }">
    <button class="list-header" @click="emit('toggle-expand')">
      <span>Today's session ({{ pendingCards.length + doneCards.length }})</span>
      <span class="chevron">{{ expanded ? '⌄ Collapse' : '⌃ Expand' }}</span>
    </button>

    <div class="list-body">
      <div v-if="pendingCards.length === 0" class="list-empty">All done for today — review when ready.</div>
      <div v-else ref="listRowsEl" class="list-rows">
        <button
          v-for="card in pendingCards"
          :key="card.id"
          :data-row-id="card.id"
          class="list-row"
          :class="[
            dueStatus(card.due_date) ? `status-${dueStatus(card.due_date)}` : '',
            { active: card.id === activeId, dragging: card.id === draggingId },
          ]"
          @pointerdown="onRowPointerDown(card.id, $event)"
          @pointermove="onRowPointerMove"
          @pointerup="onRowPointerUp"
          @pointercancel="onRowPointerUp"
          @click="onRowClick(card.id)"
        >
          <span class="grip">⠿</span>
          <span class="row-dot" />
          <span class="row-title">{{ card.name }}</span>
          <span v-if="labelsFor(card.id).length" class="row-labels">
            <span
              v-for="l in labelsFor(card.id)"
              :key="l.id"
              class="label-dot"
              :style="{ background: LABEL_COLORS[l.color] ?? '#999' }"
              :title="l.name"
            />
          </span>
        </button>
      </div>

      <template v-if="doneCards.length">
        <div class="divider" />
        <div class="list-rows done-rows">
          <button
            v-for="card in doneCards"
            :key="card.id"
            class="list-row done"
            title="Tap to undo — bring it back into today's session"
            @click="emit('undo', card.id)"
          >
            <span class="row-check">✓</span>
            <span class="row-title">{{ card.name }}</span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.session-list {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: var(--session-list-height, clamp(200px, 34vh, 340px));
  background: var(--pc-surface);
  border-top: 1px solid var(--pc-border);
}

.session-list.expanded {
  flex: 1;
  height: auto;
}

.list-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 8px 14px;
  border: none;
  border-bottom: 1px solid var(--pc-border);
  background: transparent;
  color: var(--pc-ink-dim);
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.list-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 10px calc(6px + env(safe-area-inset-bottom));
}

.list-empty {
  padding: 14px 6px;
  color: var(--pc-ink-dim);
  font-size: 13px;
  font-style: italic;
}

.list-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.list-row {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--pc-ink-dim);
  font-size: 14px;
  font-family: var(--font-body);
  text-align: left;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  transition: background-color 150ms cubic-bezier(0.25, 1, 0.5, 1), opacity 150ms;
}

.list-row.active {
  border-color: var(--pc-ember);
  color: var(--pc-ink);
  background: color-mix(in srgb, var(--pc-ember) 14%, transparent);
}

.list-row.dragging {
  opacity: 0.85;
  box-shadow: var(--shadow-modal);
}

.grip {
  flex-shrink: 0;
  color: var(--pc-border);
  font-size: 13px;
  line-height: 1;
}

.row-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--pc-ink-dim);
}

.list-row.status-scheduled .row-dot { background: var(--pc-good); }
.list-row.status-due .row-dot { background: var(--pc-due); }
.list-row.status-overdue .row-dot { background: var(--pc-overdue); }

.row-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-labels {
  flex-shrink: 0;
  display: flex;
  gap: 3px;
}

.label-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.divider {
  height: 1px;
  background: var(--pc-border);
  margin: 6px 4px;
}

.list-row.done {
  opacity: 0.5;
}

.row-check {
  flex-shrink: 0;
  color: var(--pc-good);
  font-size: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .list-row {
    transition: none;
  }
}
</style>

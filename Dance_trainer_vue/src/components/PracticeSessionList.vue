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
  remove: [cardId: number]
  'toggle-expand': []
}>()

const store = useBoardStore()
function labelsFor(cardId: number) {
  return store.labelsForCard(cardId)
}

const listRowsEl = ref<HTMLElement | null>(null)
const draggingId = ref<number | null>(null)
const suppressNextClick = ref(false)

// Two ways in, because the grip used to be decoration: pressing the ⠿ handle
// lifts the row immediately, and press-and-hold anywhere else still works for
// anyone who learned that gesture. A quick tap (released before the hold fires)
// just focuses the row. Mirrors TaskCard.vue's long-press-vs-tap split, adapted
// to a vertical list (BoardView's resolveCardDrop uses the same top-of-rect
// midpoint scan for vertical card drops within a column).
const LONG_PRESS_MS = 350
const MOVE_CANCEL_PX = 10
let pressTimer: ReturnType<typeof setTimeout> | null = null
let pressStart: { x: number; y: number; pointerId: number; cardId: number } | null = null
let localOrder: number[] = []

// Swipe-to-remove. The same pointer gesture that can become a drag can also
// become a horizontal swipe — whichever axis wins the first 10px takes it, so
// the vertical reorder and this never fire together.
const REVEAL_PX = 88
const OPEN_PX = 44
const swipingId = ref<number | null>(null)
const swipeDx = ref(0)
const swipedId = ref<number | null>(null)

function closeSwipe() {
  swipingId.value = null
  swipeDx.value = 0
  swipedId.value = null
}

// Only ever returns a transform for a row mid-swipe or held open. An always-on
// inline transform would fight TransitionGroup's FLIP, which drives the
// reorder animation through that same property.
function rowStyle(cardId: number) {
  if (swipingId.value === cardId) return { transform: `translateX(${swipeDx.value}px)` }
  if (swipedId.value === cardId) return { transform: `translateX(${-REVEAL_PX}px)` }
  return {}
}

function onRemove(cardId: number) {
  closeSwipe()
  emit('remove', cardId)
}

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

function beginDrag(cardId: number, e: PointerEvent) {
  draggingId.value = cardId
  localOrder = props.pendingCards.map((c) => c.id)
  document.addEventListener('touchmove', blockTouchScroll, { passive: false })
  navigator.vibrate?.(20)
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onRowPointerDown(cardId: number, e: PointerEvent) {
  pressStart = { x: e.clientX, y: e.clientY, pointerId: e.pointerId, cardId }
  clearPressTimer()
  pressTimer = setTimeout(() => {
    pressTimer = null
    beginDrag(cardId, e)
  }, LONG_PRESS_MS)
}

// No timer and no move threshold: the handle exists to say "this row is
// draggable", so waiting 350ms after pressing it would contradict the
// affordance it advertises.
function onGripPointerDown(cardId: number, e: PointerEvent) {
  pressStart = { x: e.clientX, y: e.clientY, pointerId: e.pointerId, cardId }
  beginDrag(cardId, e)
}

function onRowPointerMove(e: PointerEvent) {
  if (!pressStart || e.pointerId !== pressStart.pointerId) return
  if (draggingId.value === null) {
    const dx = e.clientX - pressStart.x
    const dy = e.clientY - pressStart.y
    if (swipingId.value !== null) {
      // Rightward drag past the origin does nothing — there's nothing to
      // reveal on that side.
      swipeDx.value = Math.max(-REVEAL_PX, Math.min(0, dx))
      return
    }
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
      clearPressTimer()
      if (Math.abs(dx) > Math.abs(dy) && dx < 0) {
        swipedId.value = null
        swipingId.value = pressStart.cardId
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        // The starting move carries its own distance — a fast flick can be a
        // single event, and waiting for the next one would drop it.
        swipeDx.value = Math.max(-REVEAL_PX, dx)
      }
    }
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
  if (swipingId.value !== null) {
    swipedId.value = swipeDx.value <= -OPEN_PX ? swipingId.value : null
    swipingId.value = null
    swipeDx.value = 0
    suppressNextClick.value = true
    requestAnimationFrame(() => { suppressNextClick.value = false })
    pressStart = null
    return
  }
  endDrag()
}

// A tap anywhere while a row is held open just closes it — the same "tap out to
// dismiss" the drawer and menus use, without stealing the focus action.
function onRowClick(cardId: number) {
  if (suppressNextClick.value) { suppressNextClick.value = false; return }
  if (swipedId.value !== null) { swipedId.value = null; return }
  emit('focus', cardId)
}
</script>

<template>
  <div class="session-list" :class="{ expanded }">
    <button class="list-header" @click="emit('toggle-expand')">
      <span>Practice queue ({{ pendingCards.length + doneCards.length }})</span>
      <span class="chevron">{{ expanded ? '⌄ Collapse' : '⌃ Expand' }}</span>
    </button>

    <div class="list-body">
      <div v-if="pendingCards.length === 0" class="list-empty">Queue empty — sort what you practiced when you're ready.</div>
      <!-- The ref lives on a plain wrapper, not on the TransitionGroup: a ref on
           a component yields its instance, and indexAtPoint needs a DOM node. -->
      <div v-else ref="listRowsEl">
        <TransitionGroup tag="div" name="row" class="list-rows">
          <!-- The wrapper carries the row identity so the Remove button can sit
               behind the row and be uncovered by the swipe. -->
          <div v-for="card in pendingCards" :key="card.id" :data-row-id="card.id" class="row-slot">
            <button
              v-if="card.id === swipingId || card.id === swipedId"
              class="remove-btn"
              @click="onRemove(card.id)"
            >Remove</button>
            <button
              class="list-row"
              :class="[
                dueStatus(card.due_date) ? `status-${dueStatus(card.due_date)}` : '',
                {
                  active: card.id === activeId,
                  dragging: card.id === draggingId,
                  swiping: card.id === swipingId,
                  swiped: card.id === swipedId,
                },
              ]"
              :style="rowStyle(card.id)"
              @pointerdown="onRowPointerDown(card.id, $event)"
              @pointermove="onRowPointerMove"
              @pointerup="onRowPointerUp"
              @pointercancel="onRowPointerUp"
              @click="onRowClick(card.id)"
            >
              <span
                class="grip"
                aria-hidden="true"
                @pointerdown.stop="onGripPointerDown(card.id, $event)"
              >⠿</span>
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
        </TransitionGroup>
      </div>

      <template v-if="doneCards.length">
        <!-- Under the continuous model this group carries the debt: practiced,
             but not yet sorted back into the schedule. It used to be marked by
             a bare hairline, which named nothing. -->
        <div class="done-header">To sort ({{ doneCards.length }})</div>
        <div class="list-rows done-rows">
          <button
            v-for="card in doneCards"
            :key="card.id"
            class="list-row done"
            title="Tap to undo — put it back in the queue"
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
  /* Anchors the absolutely-positioned leaving row below. */
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Holds the row and, behind it, the Remove button the swipe uncovers. */
.row-slot {
  position: relative;
  flex-shrink: 0;
}

.remove-btn {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 88px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--pc-overdue);
  color: #2a0d0a;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.list-row {
  position: relative;
  width: 100%;
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
  /* pan-y leaves vertical scrolling to the browser and hands horizontal
     movement to the pointer handlers, which is what makes the swipe possible
     inside a scrolling list. */
  touch-action: pan-y;
  transition:
    background-color 150ms cubic-bezier(0.25, 1, 0.5, 1),
    opacity 150ms,
    transform 160ms cubic-bezier(0.25, 1, 0.5, 1);
}

/* Opaque while the Remove button is behind it — rows are transparent by
   default and the button would read straight through. */
.list-row.swiping,
.list-row.swiped {
  background: var(--pc-surface);
}

/* Follows the finger, so no easing. Deliberately duration-only: setting
   `transition: none` here would strip `transform` from the property list this
   rule hands to TransitionGroup's FLIP probe — see the note on .dragging. */
.list-row.swiping {
  transition-duration: 0s;
}

.list-row.active {
  border-color: var(--pc-ember);
  color: var(--pc-ink);
  background: color-mix(in srgb, var(--pc-ember) 14%, transparent);
}

/* FLIP. `reorder` fires live during the drag, so without a move transition the
   rows the dragged one displaces teleport into their new slots — the single
   biggest reason the reorder read as unclear. Background is restated because
   this rule overrides .list-row's own transition shorthand. */
.row-move {
  transition:
    transform 180ms cubic-bezier(0.25, 1, 0.5, 1),
    background-color 150ms cubic-bezier(0.25, 1, 0.5, 1);
}

.row-leave-active {
  position: absolute;
  left: 0;
  right: 0;
  transition: opacity 140ms ease;
}

.row-enter-active {
  transition: opacity 140ms ease;
}

.row-enter-from,
.row-leave-to {
  opacity: 0;
}

/* Lifted off the list rather than faded into it — the old `opacity: 0.85` made
   the row quieter, which reads as disabled, not as picked up.
   Deliberately no `transform` and no `transition: none` here, however tempting.
   TransitionGroup decides whether to run FLIP at all by cloning the *first*
   previous child, applying `.row-move` to it and checking the resolved
   `transition-property` for `transform`. `.list-row.dragging` outranks
   `.row-move`, so either declaration on this rule makes that probe report "no
   transform" whenever the lifted row sits at the top of the list — silently
   disabling the move animation for every row. A transform here would also be
   overwritten by FLIP's own translate mid-move. The lift is colour and shadow
   only, and the dragged row animates with the rest. */
.list-row.dragging {
  opacity: 1;
  border-color: var(--pc-ember);
  background: var(--pc-surface);
  box-shadow: var(--shadow-modal);
}

.list-row.dragging .grip {
  color: var(--pc-ember);
}

/* A real 30×44 target, not a 13px glyph. It was --pc-border (1.5:1) — visible
   enough to be decoration, not enough to be a control. */
.grip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  align-self: stretch;
  margin: -6px 0 -6px -6px;
  color: var(--pc-ink-dim);
  font-size: 14px;
  line-height: 1;
  cursor: grab;
  touch-action: none;
}

.list-row.dragging .grip,
.grip:active {
  cursor: grabbing;
}

/* A bar, not a dot: .label-dot to the right of every row is also a 7px circle,
   and a red "Drill" label was pixel-identical to an overdue status. Echoes the
   board card's own left-edge status stripe. */
.row-dot {
  flex-shrink: 0;
  width: 3px;
  height: 18px;
  border-radius: 2px;
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

.done-header {
  margin: 10px 4px 4px;
  padding-top: 8px;
  border-top: 1px solid var(--pc-border);
  color: var(--pc-good);
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
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
  .list-row,
  .row-move,
  .row-enter-active,
  .row-leave-active {
    transition: none;
  }
}
</style>

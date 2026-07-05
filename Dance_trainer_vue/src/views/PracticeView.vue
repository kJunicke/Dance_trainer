<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Card } from '@/stores/boardStore'
import { useBoardStore } from '@/stores/boardStore'
import { usePracticeSessionStore } from '@/stores/practiceSessionStore'
import PracticeFocusCard from '@/components/PracticeFocusCard.vue'
import PracticeSessionList from '@/components/PracticeSessionList.vue'

const props = defineProps<{
  boardId: number
}>()

const emit = defineEmits<{
  'open-add': []
}>()

const store = useBoardStore()
const session = usePracticeSessionStore()

watch(() => props.boardId, (id) => session.load(id), { immediate: true })

const focusedId = ref<number | null>(null)
const listExpanded = ref(false)
const confirming = ref(false)
let confirmTimer: ReturnType<typeof setTimeout> | null = null

function resolveCards(ids: number[]): Card[] {
  return ids
    .map((id) => store.cards.find((c) => c.id === id))
    .filter((c): c is Card => !!c)
}

const pendingCards = computed(() => resolveCards(session.pendingIds))
const doneCards = computed(() => resolveCards(session.doneIds))
// Falls through to the first pending card whenever the focused one is done,
// removed, or never chosen — no manual "advance to next" bookkeeping needed.
const focusedCard = computed(
  () => pendingCards.value.find((c) => c.id === focusedId.value) ?? pendingCards.value[0] ?? null,
)

function onDone(cardId: number) {
  session.markDone(cardId)
  // Reuses the drag-start haptic precedent from PracticeSessionList.vue.
  navigator.vibrate?.(20)
  // Brief "logged" receipt on the FAB itself — it's the one stable element
  // across every rep, the card underneath is about to be swapped out.
  confirming.value = true
  if (confirmTimer) clearTimeout(confirmTimer)
  confirmTimer = setTimeout(() => {
    confirming.value = false
  }, 200)
}

function onUndo(cardId: number) {
  session.markPending(cardId)
  focusedId.value = cardId
}
</script>

<template>
  <div class="practice-view">
    <!-- Hidden while the session list is expanded — reordering is the task at
         hand then, and the focus card would just be dead space above it. -->
    <div v-if="!listExpanded" class="practice-body">
      <div v-if="pendingCards.length === 0 && doneCards.length === 0" class="empty-state">
        <p>No cards in today's session yet.</p>
        <button class="add-cta" @click="emit('open-add')">+ Add cards to start</button>
      </div>
      <!-- out-in rather than a hard swap: markDone advances focusedCard
           instantly, and this is the single highest-frequency action in the
           view — an abrupt jump-cut every rep reads as broken, not snappy. -->
      <Transition v-else name="focus-swap" mode="out-in">
        <PracticeFocusCard v-if="focusedCard" :key="focusedCard.id" :card="focusedCard" />
      </Transition>
    </div>

    <PracticeSessionList
      v-if="pendingCards.length || doneCards.length"
      :pending-cards="pendingCards"
      :done-cards="doneCards"
      :active-id="focusedCard?.id ?? null"
      :expanded="listExpanded"
      @focus="focusedId = $event"
      @reorder="session.reorderPending"
      @undo="onUndo"
      @toggle-expand="listExpanded = !listExpanded"
    />

    <!-- Floating, thumb-reachable regardless of scroll or note length —
         overlaps the top of the session list on purpose, mirroring a
         Material-style FAB rather than living inline in the card flow (which
         made it shift around under a long or short note). Hidden while the
         list is expanded: there's no focus card to act on then. -->
    <button
      v-if="!listExpanded && focusedCard"
      class="done-fab"
      :class="{ confirming }"
      @click="onDone(focusedCard.id)"
    >Done</button>
  </div>
</template>

<style scoped>
.practice-view {
  /* Shared with PracticeSessionList's own height so the Done FAB below can
     anchor exactly to the card/timeline seam without duplicating the value. */
  --session-list-height: clamp(200px, 34vh, 340px);
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--pc-bg);
}

.practice-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 14px 16px;
  background: var(--pc-bg);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  padding: 24px 4px;
  color: var(--pc-ink-dim);
  font-size: 14px;
}

.empty-state p {
  margin: 0;
}

.add-cta {
  min-height: 44px;
  padding: 12px 20px;
  border: 1px solid var(--pc-ember);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--pc-ink);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.add-cta:hover {
  background: color-mix(in srgb, var(--pc-ember) 16%, transparent);
}

.done-fab {
  /* Anchored just above the session list's top edge, overlapping the bottom
     of the card content — floating ON the card, right over the timeline,
     not sitting below it in the document flow. */
  position: fixed;
  right: 16px;
  bottom: calc(var(--session-list-height) + 12px);
  z-index: 20;
  min-height: 48px;
  padding: 12px 20px;
  border: none;
  border-radius: 999px;
  background: var(--pc-ember);
  color: #1f1404;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--shadow-modal);
  transition: background 150ms cubic-bezier(0.25, 1, 0.5, 1), transform 150ms;
}

.done-fab:hover {
  background: var(--pc-ember-light);
}

.done-fab:active {
  transform: scale(0.96);
}

/* After :hover so it wins the specificity tie — the "logged" receipt should
   still read even if a mouse happens to be hovering. */
.done-fab.confirming {
  background: var(--pc-good);
}

.done-fab:focus-visible {
  outline: 2px solid var(--pc-ember-light);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .done-fab {
    transition: none;
  }
}

/* Card clearing off the top of the stack, not an index change. mode="out-in"
   avoids position:absolute overlap hacks; ~280ms total stays well under the
   "quick" delight budget. */
.focus-swap-enter-active,
.focus-swap-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}

.focus-swap-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.focus-swap-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (prefers-reduced-motion: reduce) {
  .focus-swap-enter-active,
  .focus-swap-leave-active {
    transition: none;
  }
}
</style>

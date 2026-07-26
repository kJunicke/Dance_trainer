<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useBoardStore } from '@/stores/boardStore'
import { usePracticeSessionStore } from '@/stores/practiceSessionStore'
import { useBackButtonClose } from '@/lib/useBackButtonClose'
import { dueStatus, dueLabel } from '@/lib/dates'
import PracticeFocusCard from './PracticeFocusCard.vue'
import LabelBar from './LabelBar.vue'

const emit = defineEmits<{
  close: []
}>()

const store = useBoardStore()
const session = usePracticeSessionStore()

useBackButtonClose(() => emit('close'))

// A frozen queue of this review pass — the session store's doneIds would
// otherwise shrink out from under us as each card resolves mid-review.
const queue = ref<number[]>([...session.doneIds])
const total = queue.value.length
const position = computed(() => total - queue.value.length + 1)

const currentCard = computed(() => {
  const id = queue.value[0]
  return id !== undefined ? (store.cards.find((c) => c.id === id) ?? null) : null
})

const showMoreColumns = ref(false)

// The bucket tray is fixed to the bottom of the panel, and MarkdownNote's format
// bar is also fixed there whenever a block editor is open (pinned above the
// on-screen keyboard). Two stacked bars over a keyboard leave almost nothing of
// the note visible, so the tray stands down while you're writing — you are not
// choosing an interval and typing at the same time.
const noteEditing = ref(false)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

const status = computed(() => dueStatus(currentCard.value?.due_date ?? null))
const dueText = computed(() => dueLabel(currentCard.value?.due_date ?? null))
const historyText = computed(() =>
  currentCard.value ? store.cardHistoryLabel(currentCard.value) : null,
)

// This is where the interval gets chosen, so "which Posture is this" has to be
// answerable without leaving the screen — the leaf name alone can't answer it.
const lineage = computed(() =>
  currentCard.value ? store.ancestorNamesForCard(currentCard.value.id).join(' › ') : '',
)

// Counted rather than derived from `total`: a "keep" resolves a card without
// moving it, so reporting the queue length as cards "sorted into columns"
// overstated the work by every keep in the pass.
const movedCount = ref(0)
const keptCount = ref(0)

const currentColumnName = computed(() => currentColumn.value?.name ?? null)

const quickTargets = computed(() => {
  if (!currentCard.value) return []
  return store.quickTargetColumns.filter((c) => c.id !== currentCard.value!.column_id)
})

// The ladder: quick targets that actually schedule, in interval order (which is
// already column order — the store sorts by position). Rendering the offset
// under each name is what makes this read as a sequence of rungs rather than a
// set of proper nouns; it comes straight off due_offset_days, so a board that
// grows a new rung shows the right number with no code change.
const ladderTargets = computed(() => quickTargets.value.filter((c) => c.due_offset_days !== null))

// Quick targets that don't schedule. Kept out of the ladder because one of them
// sitting at the end of an ascending row of intervals reads as "even longer than
// the last rung", when it actually means "off the schedule entirely".
const parkTargets = computed(() => quickTargets.value.filter((c) => c.due_offset_days === null))

const currentColumn = computed(
  () => store.columns.find((c) => c.id === currentCard.value?.column_id) ?? null,
)

const otherColumns = computed(() => {
  if (!currentCard.value) return []
  const quickIds = new Set(quickTargets.value.map((c) => c.id))
  return store.columns
    .filter((c) => c.id !== currentCard.value!.column_id && !quickIds.has(c.id))
    .slice()
    .sort((a, b) => a.position - b.position)
})

function resolve(targetColumnId: number | null) {
  const card = currentCard.value
  if (!card) return
  if (targetColumnId !== null) {
    store.moveCard(card.id, targetColumnId, store.cardsByColumn(targetColumnId).length)
    movedCount.value++
  } else {
    // Keeping a card is still a practice event, and the column's own on-enter
    // rule can't fire for a move that doesn't happen.
    store.recordPracticeInPlace(card.id)
    keptCount.value++
  }
  session.resolveCard(card.id)
  queue.value.shift()
  showMoreColumns.value = false
}

function onOtherColumnPick(e: Event) {
  const id = Number((e.target as HTMLSelectElement).value)
  if (id) resolve(id)
}
</script>

<template>
  <div class="review practice-view">
    <!-- Zone 1: pinned. Everything you need to make the decision — which card,
         how late it is, and what rung it's on — stays on screen while the note
         scrolls, and the ✕ never leaves with it. -->
    <div class="review-head">
      <div class="head-row">
        <span v-if="currentCard" class="progress">Review · {{ position }} of {{ total }}</span>
        <span v-else class="progress">Review complete</span>
        <button class="close-btn" aria-label="Close review" @click="emit('close')">✕</button>
      </div>
      <template v-if="currentCard">
        <LabelBar :card-id="currentCard.id" />
        <div v-if="status || dueText" class="focus-meta">
          <span v-if="status" class="status-dot" :class="`status-${status}`" />
          <span v-if="dueText" class="due-text" :class="{ overdue: status === 'overdue' }">{{ dueText }}</span>
        </div>
        <p v-if="lineage" class="head-lineage">{{ lineage }} ›</p>
        <h2 class="head-title">{{ currentCard.name }}</h2>
        <p v-if="historyText" class="head-history">{{ historyText }}</p>
      </template>
    </div>

    <!-- Zone 2: the only thing that scrolls. Still fully editable — notes get
         written during review, not just read. -->
    <div v-if="currentCard" class="review-body">
      <PracticeFocusCard
        :card="currentCard"
        head="none"
        @update:editing="(v: boolean) => (noteEditing = v)"
      />
    </div>

    <!-- Zone 3: pinned. The decision is always reachable without scrolling. -->
    <div v-if="currentCard" v-show="!noteEditing" class="review-tray">
      <p class="lede">Practiced — where should it go?</p>

      <div class="buckets">
        <button
          v-for="col in ladderTargets"
          :key="col.id"
          class="bucket-btn"
          @click="resolve(col.id)"
        >
          <span class="bucket-name">{{ col.name }}</span>
          <span class="bucket-interval">{{ col.due_offset_days }}d</span>
        </button>
        <button class="bucket-btn keep" @click="resolve(null)">
          <span class="bucket-name">Keep in {{ currentColumnName ?? 'place' }}</span>
          <span v-if="currentColumn?.due_offset_days != null" class="bucket-interval">
            {{ currentColumn.due_offset_days }}d
          </span>
        </button>
      </div>

      <div v-if="parkTargets.length" class="park-group">
        <span class="park-label">Off schedule</span>
        <div class="buckets">
          <button
            v-for="col in parkTargets"
            :key="col.id"
            class="bucket-btn park"
            @click="resolve(col.id)"
          >
            <span class="bucket-name">{{ col.name }}</span>
          </button>
        </div>
      </div>

      <button v-if="!showMoreColumns" class="more-link" @click="showMoreColumns = true">
        Choose another column…
      </button>
      <select v-else class="more-select" @change="onOtherColumnPick">
        <option value="">Choose a column…</option>
        <option v-for="col in otherColumns" :key="col.id" :value="col.id">{{ col.name }}</option>
      </select>
    </div>

    <div v-if="!currentCard" class="review-done">
      <template v-if="total > 0">
        <div class="review-done-badge" aria-hidden="true">✓</div>
        <h2 class="review-done-heading">Queue sorted</h2>
        <p class="review-done-sub">
          <template v-if="movedCount">{{ movedCount }} rescheduled</template>
          <template v-if="movedCount && keptCount"> · </template>
          <template v-if="keptCount">{{ keptCount }} kept in place</template>
        </p>
      </template>
      <p v-else class="review-done-sub">Nothing to sort yet.</p>
      <button class="bucket-btn keep" @click="emit('close')">Close</button>
    </div>
  </div>
</template>

<style scoped>
/* No backdrop: .review is an opaque full-screen panel, so a backdrop behind it
   was never visible and its click-to-dismiss could never fire. The ✕ in the
   header is the dismiss target. */
/* Three fixed zones, not one scroll. The panel itself never scrolls; only the
   note in the middle does. This is the only irreversible write in the app and
   there is deliberately no undo, so the card's identity (top) and the decision
   (bottom) must both be on screen at the moment of the tap — previously a long
   note pushed the title, the history line and the ✕ off the top while you
   scrolled down to reach the buttons.

   No backdrop: .review is an opaque full-screen panel, so a backdrop behind it
   was never visible and its click-to-dismiss could never fire. The ✕ in the
   header and Escape are the dismiss targets. */
.review {
  position: fixed;
  inset: 0;
  z-index: 201;
  display: flex;
  flex-direction: column;
  background: var(--pc-bg);
  padding: env(safe-area-inset-top) 16px calc(16px + env(safe-area-inset-bottom));
  overflow: hidden;
}

.review-head {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 0 12px;
  border-bottom: 1px solid var(--pc-border);
}

.head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Matches PracticeFocusCard's .focus-lineage — display face and 600 weight so
   it reads as the title's first line, and a negative margin cancelling most of
   .review-head's 6px gap so the pair doesn't look like two unrelated lines. */
.head-lineage {
  margin: 0 0 -4px;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--pc-ink-dim);
  overflow-wrap: anywhere;
}

/* 22px for the same reason as PracticeFocusCard's .focus-title, which this
   duplicates because Session Review draws the identity itself (head="none"). */
.head-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 22px;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--pc-ink);
  overflow-wrap: anywhere;
}

.head-history {
  margin: 0;
  color: var(--pc-ink-dim);
  font-family: var(--font-mono);
  font-size: 12px;
}

.focus-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--pc-ink-dim);
}

.status-dot.status-scheduled { background: var(--pc-good); }
.status-dot.status-due { background: var(--pc-due); }
.status-dot.status-overdue { background: var(--pc-overdue); }

.due-text {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--pc-ink-dim);
}

.due-text.overdue {
  color: var(--pc-overdue);
  font-weight: 700;
}

.progress {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--pc-ink-dim);
}

.close-btn {
  width: 44px;
  height: 44px;
  margin-right: -10px;
  border: none;
  background: transparent;
  color: var(--pc-ink-dim);
  font-size: 16px;
  cursor: pointer;
}

/* The only scrolling zone. min-height:0 is what lets it actually shrink inside
   the flex column instead of pushing the tray off the bottom. */
.review-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* Explicit: setting only overflow-y makes the x axis compute to `auto`, which
     put a horizontal scrollbar under every note whose link chips ran wide. */
  overflow-x: hidden;
  padding: 12px 0;
}

.review-tray {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--pc-border);
}

.lede {
  margin: 0;
  color: var(--pc-ink-dim);
  font-size: 13px;
}

.buckets {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.bucket-btn {
  flex: 1 1 auto;
  min-height: 44px;
  padding: 8px 14px;
  border: 1px solid var(--pc-ember);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--pc-ink);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.bucket-name {
  line-height: 1.2;
}

/* The interval this rung actually schedules. Mono because it is a measured
   value, and it is the whole reason the grid reads as a ladder: without it the
   buttons are proper nouns whose order you have to already know. */
.bucket-interval {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 400;
  color: var(--pc-ink-dim);
}

.bucket-btn:hover {
  background: color-mix(in srgb, var(--pc-ember) 16%, transparent);
}

.bucket-btn.keep {
  border-color: var(--pc-border);
  color: var(--pc-ink-dim);
}

.bucket-btn.keep:hover {
  background: var(--pc-surface);
}

/* Separated from the ladder because these don't schedule at all — one of them
   sitting after the longest rung reads as a longer interval, which is the
   opposite of what it does. */
.park-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--pc-border);
}

.park-label {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--pc-ink-dim);
}

.bucket-btn.park {
  border-color: var(--pc-border);
  color: var(--pc-ink-dim);
  font-weight: 400;
}

.bucket-btn.park:hover {
  background: var(--pc-surface);
}

.more-link {
  align-self: flex-start;
  min-height: 44px;
  border: none;
  background: transparent;
  color: var(--pc-ink-dim);
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
  padding: 8px 0;
}

.more-select {
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid var(--pc-border);
  border-radius: var(--radius-sm);
  background: var(--pc-surface);
  color: var(--pc-ink);
  font-size: 14px;
}

.review-done {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
  color: var(--pc-ink-dim);
  font-size: 14px;
}

.review-done-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--pc-good) 18%, transparent);
  color: var(--pc-good);
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 4px;
  animation: review-done-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.review-done-heading {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 18px;
  color: var(--pc-ink);
}

.review-done-sub {
  margin: 0 0 8px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--pc-ink-dim);
}

@keyframes review-done-in {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .review-done-badge {
    animation: none;
  }
}
</style>

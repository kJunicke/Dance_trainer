<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBoardStore } from '@/stores/boardStore'
import { usePracticeSessionStore } from '@/stores/practiceSessionStore'
import { useBackButtonClose } from '@/lib/useBackButtonClose'
import PracticeFocusCard from './PracticeFocusCard.vue'

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

const quickTargets = computed(() => {
  if (!currentCard.value) return []
  return store.quickTargetColumns.filter((c) => c.id !== currentCard.value!.column_id)
})

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
  <div class="review-backdrop" @click="emit('close')" />
  <div class="review practice-view">
    <div class="review-head">
      <span v-if="currentCard" class="progress">Review · {{ position }} of {{ total }}</span>
      <span v-else class="progress">Review complete</span>
      <button class="close-btn" @click="emit('close')">✕</button>
    </div>

    <div v-if="currentCard" class="review-body">
      <p class="lede">Practiced today — where should it go?</p>
      <PracticeFocusCard :card="currentCard" />

      <div class="buckets">
        <button
          v-for="col in quickTargets"
          :key="col.id"
          class="bucket-btn"
          @click="resolve(col.id)"
        >{{ col.name }}</button>
        <button class="bucket-btn keep" @click="resolve(null)">Keep in Due</button>
      </div>

      <button v-if="!showMoreColumns" class="more-link" @click="showMoreColumns = true">
        Choose another column…
      </button>
      <select v-else class="more-select" @change="onOtherColumnPick">
        <option value="">Choose a column…</option>
        <option v-for="col in otherColumns" :key="col.id" :value="col.id">{{ col.name }}</option>
      </select>
    </div>

    <div v-else class="review-done">
      <p>All caught up — every card from today's session has been sorted.</p>
      <button class="bucket-btn keep" @click="emit('close')">Close</button>
    </div>
  </div>
</template>

<style scoped>
.review-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 200;
}

.review {
  position: fixed;
  inset: 0;
  z-index: 201;
  display: flex;
  flex-direction: column;
  background: var(--pc-bg);
  padding: env(safe-area-inset-top) 16px calc(16px + env(safe-area-inset-bottom));
  overflow-y: auto;
}

.review-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
}

.progress {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--pc-ink-dim);
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--pc-ink-dim);
  font-size: 16px;
  cursor: pointer;
}

.review-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  padding: 10px 16px;
  border: 1px solid var(--pc-ember);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--pc-ink);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
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

.more-link {
  align-self: flex-start;
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
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  color: var(--pc-ink-dim);
  font-size: 14px;
}
</style>

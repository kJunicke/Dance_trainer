<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Card } from '@/stores/boardStore'
import { useBoardStore } from '@/stores/boardStore'
import { usePracticeSessionStore } from '@/stores/practiceSessionStore'
import { useBackButtonClose } from '@/lib/useBackButtonClose'
import { dueStatus } from '@/lib/dates'

const emit = defineEmits<{
  close: []
}>()

const store = useBoardStore()
const session = usePracticeSessionStore()

useBackButtonClose(() => emit('close'))

// Due column first (the common, everyday pull), then the board's quick-target
// columns (its own "fast access" flag), then the rest in normal board order.
const orderedColumns = computed(() => {
  const due = store.dueColumn
  const quickTargets = store.quickTargetColumns.filter((c) => c.id !== due?.id)
  const quickIds = new Set(quickTargets.map((c) => c.id))
  const rest = store.columns
    .filter((c) => c.id !== due?.id && !quickIds.has(c.id))
    .slice()
    .sort((a, b) => a.position - b.position)
  return [...(due ? [due] : []), ...quickTargets, ...rest]
})

const activeTabId = ref<number | null>(orderedColumns.value[0]?.id ?? null)

// Already-added cards stay pinned at the top regardless of which column tab
// is selected, so switching tabs to browse never hides what's already queued.
const addedCards = computed(() =>
  session.entries
    .map((e) => store.cards.find((c) => c.id === e.cardId))
    .filter((c): c is Card => !!c),
)

// The tab's own list only shows what isn't already pinned above — otherwise
// the same card would appear twice on screen at once.
const notAddedInTab = computed(() => {
  if (activeTabId.value === null) return []
  return store.cardsByColumn(activeTabId.value).filter((c) => !session.isInSession(c.id))
})
</script>

<template>
  <div class="drawer practice-view">
    <div class="drawer-head">
      <h2>Add to today's session</h2>
      <button class="close-btn" @click="emit('close')">✕</button>
    </div>

    <div v-if="addedCards.length" class="added-section">
      <div class="section-label">Added ({{ addedCards.length }})</div>
      <ul class="card-list added-list">
        <li
          v-for="card in addedCards"
          :key="card.id"
          class="card-row"
          @click="session.toggleCard(card.id)"
        >
          <span class="checkbox checked"><span>✓</span></span>
          <span v-if="dueStatus(card.due_date)" class="status-dot" :class="`status-${dueStatus(card.due_date)}`" />
          <span class="card-name">{{ card.name }}</span>
        </li>
      </ul>
    </div>

    <!-- Placed in the comfortable one-handed reach zone rather than pinned to
         the very top, since this is what gets tapped repeatedly while browsing. -->
    <div class="tabs">
      <button
        v-for="col in orderedColumns"
        :key="col.id"
        class="tab"
        :class="{ active: col.id === activeTabId }"
        @click="activeTabId = col.id"
      >{{ col.name }}</button>
    </div>

    <ul class="card-list">
      <li v-if="notAddedInTab.length === 0" class="empty-row">Nothing left to add from this column.</li>
      <li
        v-for="card in notAddedInTab"
        :key="card.id"
        class="card-row"
        @click="session.toggleCard(card.id)"
      >
        <span class="checkbox" />
        <span v-if="dueStatus(card.due_date)" class="status-dot" :class="`status-${dueStatus(card.due_date)}`" />
        <span class="card-name">{{ card.name }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.drawer {
  position: fixed;
  inset: 0;
  z-index: 201;
  display: flex;
  flex-direction: column;
  background: var(--pc-surface);
  padding: calc(16px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom));
  animation: fade-in 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .drawer {
    animation: none;
  }
}

.drawer-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.drawer-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--pc-ink);
}

.close-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--pc-ink-dim);
  font-size: 18px;
  cursor: pointer;
}

.added-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 28vh;
  margin-bottom: 10px;
}

.section-label {
  flex-shrink: 0;
  padding: 2px 4px 6px;
  color: var(--pc-good);
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.added-list {
  overflow-y: auto;
  border-bottom: 1px solid var(--pc-border);
  padding-bottom: 4px;
}

.tabs {
  flex-shrink: 0;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  margin-bottom: 10px;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tab {
  flex-shrink: 0;
  padding: 8px 14px;
  min-height: 40px;
  border: 1px solid var(--pc-border);
  border-radius: 999px;
  background: transparent;
  color: var(--pc-ink-dim);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}

.tab.active {
  border-color: var(--pc-ember);
  color: var(--pc-ink);
  background: color-mix(in srgb, var(--pc-ember) 14%, transparent);
}

.card-list {
  flex: 1;
  min-height: 0;
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
}

.empty-row {
  padding: 16px 4px;
  color: var(--pc-ink-dim);
  font-size: 13px;
  font-style: italic;
}

.card-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--pc-border);
  cursor: pointer;
}

.card-row:last-child {
  border-bottom: none;
}

.checkbox {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--pc-border);
  border-radius: 5px;
  color: #1f1404;
  font-size: 13px;
  font-weight: 700;
}

.checkbox.checked {
  background: var(--pc-ember);
  border-color: var(--pc-ember);
}

.status-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--pc-ink-dim);
}

.status-dot.status-scheduled { background: var(--pc-good); }
.status-dot.status-due { background: var(--pc-due); }
.status-dot.status-overdue { background: var(--pc-overdue); }

.card-name {
  min-width: 0;
  color: var(--pc-ink);
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

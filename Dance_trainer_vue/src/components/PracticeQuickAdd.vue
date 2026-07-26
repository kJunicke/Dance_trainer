<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import type { Card } from '@/stores/boardStore'
import { useBoardStore } from '@/stores/boardStore'
import { usePracticeSessionStore } from '@/stores/practiceSessionStore'
import { useBackButtonClose } from '@/lib/useBackButtonClose'
import { dueStatus, dueLabel } from '@/lib/dates'

const emit = defineEmits<{
  close: []
}>()

const store = useBoardStore()
const session = usePracticeSessionStore()

useBackButtonClose(() => emit('close'))

const query = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const highlight = ref(0)
// The query clears after every add so the next name can be typed straight
// away — without a receipt the only feedback would be the row vanishing.
const justAdded = ref<string | null>(null)
const creating = ref(false)

onMounted(async () => {
  await nextTick()
  inputEl.value?.focus()
})

// Same ordering as the add drawer's browse list: most overdue first, undated
// last. A name search can still return a dozen rows on a board this size.
function byUrgency(a: Card, b: Card): number {
  if (a.due_date === b.due_date) return 0
  if (!a.due_date) return 1
  if (!b.due_date) return -1
  return a.due_date.localeCompare(b.due_date)
}

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  return store.cards
    .filter((c) => c.name.toLowerCase().includes(q))
    .slice()
    .sort(byUrgency)
    .slice(0, 12)
})

// Already-queued cards stay in the list, dimmed. Hiding them would make the
// skill you just typed disappear, which reads as "not found".
const canCreate = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q || !store.inboxColumn) return false
  return !results.value.some((c) => c.name.trim().toLowerCase() === q)
})

const hint = computed(() => {
  if (!query.value.trim()) return 'Type a skill name to queue it.'
  if (results.value.length) return null
  if (canCreate.value) return null
  if (!store.inboxColumn) {
    return 'No cards match. Mark a column as Inbox in its settings to create new ones from here.'
  }
  return 'No cards match.'
})

watch(query, (q) => {
  highlight.value = 0
  // Cleared by the *next* keystroke, not by the add's own reset to ''.
  if (q) justAdded.value = null
})

function moveHighlight(delta: number) {
  const max = results.value.length - 1
  if (max < 0) return
  highlight.value = Math.min(max, Math.max(0, highlight.value + delta))
}

function add(card: Card) {
  if (session.isInSession(card.id)) return
  session.addCard(card.id)
  query.value = ''
  justAdded.value = card.name
  inputEl.value?.focus()
}

// Creating waits on the real row: addCard's optimistic id is negative and the
// session persists ids to localStorage, so a temp id would survive a reload
// pointing at nothing.
async function createCard() {
  const inbox = store.inboxColumn
  const name = query.value.trim()
  if (!inbox || !name || creating.value) return
  creating.value = true
  const card = await store.addCard(inbox.id, name)
  creating.value = false
  if (!card) return
  session.addCard(card.id)
  query.value = ''
  justAdded.value = card.name
  inputEl.value?.focus()
}

function onEnter() {
  const picked = results.value[highlight.value]
  if (picked) add(picked)
  else if (canCreate.value) createCard()
}

// Two-stage, matching the add drawer: Escape abandons the query first and only
// then the panel.
function onEscape() {
  if (query.value.trim()) query.value = ''
  else emit('close')
}
</script>

<template>
  <div class="quick-add practice-view">
    <div class="backdrop" @click="emit('close')" />

    <div class="panel">
      <div class="panel-head">
        <input
          ref="inputEl"
          v-model="query"
          class="search-input"
          placeholder="Search or name a new skill…"
          @keydown.down.prevent="moveHighlight(1)"
          @keydown.up.prevent="moveHighlight(-1)"
          @keydown.enter.prevent="onEnter"
          @keydown.esc="onEscape"
        />
        <button class="close-btn" title="Close" @click="emit('close')">✕</button>
      </div>

      <p v-if="justAdded" class="receipt">✓ {{ justAdded }} queued</p>

      <div class="results">
        <button
          v-for="(card, i) in results"
          :key="card.id"
          class="row"
          :class="{ highlighted: i === highlight, queued: session.isInSession(card.id) }"
          @click="add(card)"
        >
          <span class="mark">{{ session.isInSession(card.id) ? '✓' : '+' }}</span>
          <span
            v-if="dueStatus(card.due_date)"
            class="status-dot"
            :class="`status-${dueStatus(card.due_date)}`"
          />
          <span class="name">{{ card.name }}</span>
          <span
            v-if="dueLabel(card.due_date)"
            class="due-label"
            :class="`status-${dueStatus(card.due_date)}`"
          >{{ dueLabel(card.due_date) }}</span>
        </button>

        <!-- The whole point of the create row is that a skill you name
             mid-practice doesn't need the board: it lands in the inbox column
             and Session Review sorts it into the schedule afterwards. -->
        <button
          v-if="canCreate"
          class="row create-row"
          :disabled="creating"
          @click="createCard"
        >
          <span class="mark">+</span>
          <span class="name">Create “{{ query.trim() }}”</span>
          <span class="in-col">in {{ store.inboxColumn?.name }}</span>
        </button>

        <p v-if="hint" class="hint">{{ hint }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quick-add {
  position: fixed;
  inset: 0;
  z-index: 201;
}

.backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
}

/* Anchored near the top rather than centred: the keyboard takes the bottom
   half of the screen the moment this opens. */
.panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(560px, calc(100% - 20px));
  max-height: min(72vh, 520px);
  margin: calc(10px + env(safe-area-inset-top)) auto 0;
  padding: 10px;
  border: 1px solid var(--pc-border);
  border-radius: var(--radius-lg);
  background: var(--pc-surface);
  box-shadow: var(--shadow-modal);
  animation: panel-in 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes panel-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .panel {
    animation: none;
  }
}

.panel-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.search-input {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--pc-border);
  border-radius: var(--radius-sm);
  background: var(--pc-bg);
  color: var(--pc-ink);
  /* Under 16px, iOS Safari zooms the page when the field gets focus. */
  font-size: 16px;
  font-family: var(--font-body);
}

.search-input::placeholder {
  color: var(--pc-ink-dim);
}

.search-input:focus-visible {
  outline: 2px solid var(--pc-ember);
  outline-offset: -1px;
}

.close-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: var(--pc-ink-dim);
  font-size: 16px;
  cursor: pointer;
}

.receipt {
  flex-shrink: 0;
  margin: 8px 4px 0;
  color: var(--pc-good);
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin-top: 6px;
  scrollbar-width: thin;
  scrollbar-color: var(--pc-border) transparent;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  padding: 8px 6px;
  border: none;
  border-bottom: 1px solid var(--pc-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--pc-ink);
  font-size: 14px;
  font-family: var(--font-body);
  text-align: left;
  cursor: pointer;
}

.row.highlighted {
  background: color-mix(in srgb, var(--pc-ember) 14%, transparent);
}

.row.queued {
  color: var(--pc-ink-dim);
  cursor: default;
}

.row.queued .mark {
  color: var(--pc-good);
}

.mark {
  flex-shrink: 0;
  width: 18px;
  color: var(--pc-ember);
  font-size: 15px;
  font-weight: 700;
  text-align: center;
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

.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.due-label {
  flex-shrink: 0;
  color: var(--pc-ink-dim);
  font-family: var(--font-mono);
  font-size: 11px;
  white-space: nowrap;
}

.due-label.status-overdue {
  color: var(--pc-overdue);
}

/* Set apart from the matches above it — this row writes to the board, the
   others only touch the session. */
.create-row {
  margin-top: 4px;
  border: 1px dashed var(--pc-border);
}

.create-row:disabled {
  opacity: 0.6;
  cursor: default;
}

.in-col {
  flex-shrink: 0;
  color: var(--pc-ink-dim);
  font-family: var(--font-mono);
  font-size: 11px;
  white-space: nowrap;
}

.hint {
  margin: 0;
  padding: 14px 6px;
  color: var(--pc-ink-dim);
  font-size: 13px;
  font-style: italic;
}
</style>

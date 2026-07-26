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
// Anything that isn't a successful queueing: already-there, or a create that
// didn't land. Separate from justAdded because that one renders as a ✓ receipt.
const notice = ref<string | null>(null)
const creating = ref(false)

onMounted(async () => {
  await nextTick()
  inputEl.value?.focus()
})

// Same ordering as the add drawer's browse list: most overdue first, undated
// last. A name search can still return a dozen rows on a board this size.
// Same reason as the add drawer's: a search for "post" returns every family's
// Posture, and the stored name can't tell them apart.
function lineageFor(cardId: number): string {
  return store.ancestorNamesForCard(cardId).join(' › ')
}

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
// Three characters before offering to write a new card to the board. At one
// character every prefix that isn't an exact match looked creatable, so a
// half-typed name plus Enter filed a card called "dro".
const MIN_CREATE_LEN = 3

const canCreate = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (q.length < MIN_CREATE_LEN || !store.inboxColumn) return false
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
  // First row you can actually act on, not row 0 — queued cards stay in the
  // list (dimmed) so the thing you just typed doesn't vanish, but landing the
  // highlight on one meant Enter hit a no-op.
  highlight.value = results.value.findIndex((c) => !session.isInSession(c.id))
  // Cleared by the *next* keystroke, not by the add's own reset to ''.
  if (q) {
    justAdded.value = null
    notice.value = null
  }
})

function moveHighlight(delta: number) {
  const max = results.value.length - 1
  if (max < 0) return
  highlight.value = Math.min(max, Math.max(0, highlight.value + delta))
}

function add(card: Card) {
  // Say so rather than doing nothing. The query clears on a successful add, so
  // a silent return was indistinguishable from the keystroke not registering.
  if (session.isInSession(card.id)) {
    notice.value = `${card.name} is already queued`
    return
  }
  session.addCard(card.id)
  query.value = ''
  justAdded.value = card.name
  notice.value = null
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
  // A null row means the insert failed (offline, RLS). Saying nothing left the
  // tap indistinguishable from one that never registered.
  if (!card) {
    notice.value = `Couldn't create "${name}" — check your connection and try again.`
    return
  }
  session.addCard(card.id)
  query.value = ''
  justAdded.value = card.name
  notice.value = null
  inputEl.value?.focus()
}

function onEnter() {
  const picked = results.value[highlight.value]
  if (picked) {
    add(picked)
    return
  }
  // Enter only ever creates when nothing matched at all. It used to fall through
  // to create whenever the highlight didn't resolve — including the case where
  // every match was already queued — so typing a prefix of a card that was
  // already in the session and pressing Enter filed a second, half-named card.
  // Creating from a query that *did* match something is a deliberate tap.
  if (results.value.length) {
    notice.value = 'Every match is already queued.'
    return
  }
  if (canCreate.value) createCard()
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
      <p v-else-if="notice" class="notice" role="status">{{ notice }}</p>

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
          <span class="text">
            <span v-if="lineageFor(card.id)" class="lineage">{{ lineageFor(card.id) }}</span>
            <span class="name">{{ card.name }}</span>
          </span>
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

/* Heavier than the usual 55% scrim: this palette's background is already
   #14100c, so a half-black wash over near-black barely reads and the panel
   didn't feel modal — the FAB and queue rows stayed plainly legible behind it.
   The blur does the separating work the luminance drop can't. */
.backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(3px);
}

/* Anchored near the top rather than centred: the keyboard takes the bottom
   half of the screen the moment this opens. */
.panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(560px, calc(100% - 20px));
  max-height: min(72dvh, 520px);
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

/* Colour comes from the scoped --pc-focus rule; only the inset offset is local,
   because a full-bleed input's ring would otherwise clip on the panel edge. */
.search-input:focus-visible {
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

/* Same slot as the receipt, dim rather than green: these are "nothing
   happened" messages, not confirmations. Sentence case because two of them are
   full sentences. */
.notice {
  flex-shrink: 0;
  margin: 8px 4px 0;
  color: var(--pc-ink-dim);
  font-size: 12px;
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

.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* Head-truncated like every other lineage line — the nearest parent is the
   informative end. Not rendered on the create row: a card being named here has
   no parent yet, it lands in the inbox. */
.lineage {
  direction: rtl;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1.35;
  color: var(--pc-ink-dim);
}

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

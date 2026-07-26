<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useBoardStore } from '@/stores/boardStore'
import { useBackButtonClose } from '@/lib/useBackButtonClose'
import { LABEL_COLORS } from '@/lib/labelColors'

const props = defineProps<{ cardId: number }>()

const emit = defineEmits<{
  close: []
}>()

const store = useBoardStore()

// Its own component rather than a v-if inside LabelBar, because
// useBackButtonClose has to run on mount to push its history entry — the phone
// back gesture closing the panel instead of leaving the board is the whole
// point, and a composable can't be called conditionally. Same shape as
// PracticeQuickAdd and PracticeAddDrawer for the same reason.
useBackButtonClose(() => emit('close'))

const query = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

const COLORS = Object.keys(LABEL_COLORS)
const newColor = ref(COLORS[0] ?? 'rose')

const activeIds = computed(() => new Set(store.labelsForCard(props.cardId).map((l) => l.id)))

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  const rows = q ? store.labels.filter((l) => l.name.toLowerCase().includes(q)) : store.labels
  // Checked first, so what's already on the card is never scrolled out of sight
  // by a board with twenty labels. Stable within each group, i.e. board order.
  return [...rows].sort(
    (a, b) => Number(activeIds.value.has(b.id)) - Number(activeIds.value.has(a.id)),
  )
})

// Offer to create only when the typed name isn't already a label — matched
// against every label on the board, not just the filtered rows, so a name
// hidden by the filter can't be duplicated.
const canCreate = computed(() => {
  const name = query.value.trim()
  return !!name && !store.labels.some((l) => l.name.toLowerCase() === name.toLowerCase())
})

// Default to a colour the board isn't using yet, so six labels made in a row
// don't all come out the same. Falls back to the first swatch once every
// colour is taken.
onMounted(async () => {
  const used = new Set(store.labels.map((l) => l.color))
  newColor.value = COLORS.find((c) => !used.has(c)) ?? COLORS[0] ?? 'rose'
  await nextTick()
  inputEl.value?.focus()
})

async function createAndAdd() {
  const name = query.value.trim()
  const boardId = store.board?.id
  if (!name || !boardId) return
  const created = await store.createLabel(boardId, name, newColor.value)
  // A null row means the insert failed — createLabel has already shown the
  // toast and rolled back its optimistic push, so leave the query alone for a
  // retry rather than clearing it.
  if (!created) return
  store.toggleCardLabel(props.cardId, created.id)
  query.value = ''
  inputEl.value?.focus()
}

// Enter creates only when nothing matched, the rule PracticeQuickAdd settled
// on: falling through to create while rows were still on screen is what filed
// a card called "dro".
function onEnter() {
  if (results.value.length || !canCreate.value) return
  createAndAdd()
}

// Two-stage, matching every other practice overlay: Escape drops the query
// first and only then the panel.
function onEscape() {
  if (query.value.trim()) query.value = ''
  else emit('close')
}
</script>

<template>
  <div class="picker practice-view">
    <div class="backdrop" @click="emit('close')" />

    <div class="panel">
      <div class="panel-head">
        <input
          ref="inputEl"
          v-model="query"
          class="search-input"
          placeholder="Filter or name a new label…"
          @keydown.enter.prevent="onEnter"
          @keydown.esc="onEscape"
        />
        <button class="close-btn" aria-label="Close" @click="emit('close')">✕</button>
      </div>

      <div class="rows">
        <button
          v-for="label in results"
          :key="label.id"
          class="row"
          :class="{ checked: activeIds.has(label.id) }"
          @click="store.toggleCardLabel(cardId, label.id)"
        >
          <span class="box">{{ activeIds.has(label.id) ? '✓' : '' }}</span>
          <span class="swatch" :style="{ background: LABEL_COLORS[label.color] ?? '#ccc' }" />
          <span class="row-name">{{ label.name }}</span>
        </button>

        <p v-if="!results.length && !canCreate" class="hint">
          {{ store.labels.length ? 'No labels match.' : 'No labels on this board yet — type a name to make one.' }}
        </p>
      </div>

      <!-- Pinned below the scroller rather than sitting at the end of it: on a
           board with twenty labels this is what you came for once the filter
           found nothing, and at the end of the list it was two scrolls away. -->
      <div v-if="canCreate" class="create">
        <div class="swatches">
          <button
            v-for="c in COLORS"
            :key="c"
            class="swatch-btn"
            :class="{ picked: c === newColor }"
            :style="{ background: LABEL_COLORS[c] }"
            :aria-label="c"
            @click="newColor = c"
          />
        </div>
        <button class="create-btn" @click="createAndAdd">Create “{{ query.trim() }}”</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Geometry copied from PracticeQuickAdd on purpose: this is the same gesture —
   open a panel, filter a list, act on a row — and the two must not feel like
   different mechanisms. Above it in the stack (202 vs 201) because Session
   Review can be open underneath, and above the card modal for the same reason.

   Palette comes from the host via --lp-*, the same no-props contract
   MarkdownNote uses: the defaults below are the light board, and LabelBar's
   host maps them onto --pc-* inside the practice view. Custom properties
   inherit down the DOM even though this is position:fixed, so nothing has to be
   passed in. */
.picker {
  position: fixed;
  inset: 0;
  z-index: 202;
}

.backdrop {
  position: absolute;
  inset: 0;
  background: var(--lp-scrim, rgba(0, 0, 0, 0.55));
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
  border: 1px solid var(--lp-border, var(--color-border));
  border-radius: var(--radius-lg);
  background: var(--lp-surface, var(--color-surface));
  box-shadow: var(--shadow-modal);
  animation: panel-in 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes panel-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .panel { animation: none; }
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
  border: 1px solid var(--lp-border, var(--color-border));
  border-radius: var(--radius-sm);
  background: var(--lp-field-bg, var(--color-surface-light));
  color: var(--lp-ink, var(--color-ink));
  /* Under 16px, iOS Safari zooms the page when the field gets focus. */
  font-size: 16px;
  font-family: var(--font-body);
}

.search-input::placeholder { color: var(--lp-ink-dim, var(--color-ink-dim)); }

/* Colour comes from whichever ring the host is under — the global one on the
   board, the scoped --pc-focus one inside .practice-view. Only the inset offset
   is local, because a full-bleed input's ring clips on the panel edge. */
.search-input:focus-visible { outline-offset: -1px; }

.close-btn {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  color: var(--lp-ink-dim, var(--color-ink-dim));
  font-size: 16px;
  cursor: pointer;
}

.rows {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* Explicit: setting only overflow-y makes overflow-x compute to auto, which
     put a horizontal scrollbar under the list. */
  overflow-x: hidden;
  margin-top: 6px;
  scrollbar-width: thin;
  scrollbar-color: var(--lp-border, var(--color-border)) transparent;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  padding: 8px 6px;
  border: none;
  border-bottom: 1px solid var(--lp-border, var(--color-border));
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--lp-ink, var(--color-ink));
  font-size: 14px;
  font-family: var(--font-body);
  text-align: left;
  cursor: pointer;
}

/* The same tinted wash the quick-add gives its highlighted row. A checked label
   is the state you scan the list for, so it gets a ground and not just a tick. */
.row.checked {
  background: color-mix(in srgb, var(--lp-accent, var(--color-ember)) 14%, transparent);
}

.box {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid var(--lp-ink-dim, var(--color-ink-dim));
  border-radius: var(--radius-sm);
  color: var(--lp-accent, var(--color-ember));
  font-size: 13px;
  font-weight: 700;
}

.row.checked .box { border-color: var(--lp-accent, var(--color-ember)); }

.swatch {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hint {
  margin: 0;
  padding: 14px 6px;
  color: var(--lp-ink-dim, var(--color-ink-dim));
  font-size: 13px;
  font-style: italic;
}

.create {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--lp-border, var(--color-border));
}

.swatches {
  flex-shrink: 0;
  display: flex;
  gap: 5px;
}

.swatch-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
}

/* The ring sits outside the fill so the colour itself stays judgeable at 22px —
   an inset marker on a dot this size eats the swatch it's marking. */
.swatch-btn.picked {
  border-color: var(--lp-ink, var(--color-ink));
  outline: 1px solid var(--lp-field-bg, var(--color-surface-light));
  outline-offset: -3px;
}

.create-btn {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px dashed var(--lp-border, var(--color-border));
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--lp-ink, var(--color-ink));
  font-family: var(--font-body);
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
</style>

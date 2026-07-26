<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useBoardStore } from '@/stores/boardStore'
import { useBackButtonClose } from '@/lib/useBackButtonClose'
import { LABEL_COLORS, LABEL_TEXT_COLORS } from '@/lib/labelColors'

const props = defineProps<{ cardId: number }>()

const store = useBoardStore()

const activeLabels = computed(() => store.labelsForCard(props.cardId))
const activeIds = computed(() => new Set(activeLabels.value.map((l) => l.id)))

// --- The picker. Modelled on PracticeQuickAdd rather than on the card modal's
// inline adder: a full overlay anchored to the top, because the keyboard takes
// the bottom half of a phone the moment the filter field takes focus, and an
// inline popover inside a sticky head has nowhere to grow.
//
// Unlike the modal's adder this lists *every* label with a checkbox rather than
// only the addable ones — one panel adds and removes, so taking a wrong label
// off mid-session doesn't need a second, differently-shaped control.
const open = ref(false)
const query = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

const COLORS = Object.keys(LABEL_COLORS)
const newColor = ref(COLORS[0] ?? 'rose')

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

// Default the new label to a colour the board isn't using yet, so six labels
// made in a row don't all come out the same. Falls back to the first swatch
// once every colour is taken.
watch(open, async (isOpen) => {
  if (!isOpen) return
  query.value = ''
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
  // toast and rolled back its optimistic push, so just leave the query alone
  // for a retry rather than clearing it.
  if (!created) return
  store.toggleCardLabel(props.cardId, created.id)
  query.value = ''
  inputEl.value?.focus()
}

// Two-stage, matching every other practice overlay: Escape drops the query
// first and only then the panel.
function onEscape() {
  if (query.value.trim()) query.value = ''
  else open.value = false
}
</script>

<template>
  <div class="label-bar">
    <!-- Chips open the picker too. The `+` alone is a small target for the one
         thing you'd reach for after reading a label you disagree with. -->
    <button
      v-for="label in activeLabels"
      :key="label.id"
      class="chip"
      :style="{
        background: LABEL_COLORS[label.color] ?? '#ccc',
        color: LABEL_TEXT_COLORS[label.color] ?? '#2a2420',
      }"
      @click="open = true"
    >{{ label.name }}</button>
    <button class="add-btn" :aria-label="activeLabels.length ? 'Edit labels' : 'Add a label'" @click="open = true">
      {{ activeLabels.length ? '+' : '+ Label' }}
    </button>
  </div>

  <LabelPicker v-if="open" />
</template>

<!-- The picker markup lives in the same component as the bar that owns it: it
     has no other caller, no props of its own, and splitting it would mean
     threading cardId, the query and the colour through a second file. -->
<script lang="ts">
export default { name: 'PracticeLabelBar' }
</script>

<template v-if="false"></template>

<style scoped>
.label-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.chip {
  border: none;
  border-radius: 999px;
  padding: 2px 9px;
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;
}

/* Outlined, not filled: it sits in a row of solid chips and must not read as
   one more label. Below the 44px floor deliberately — it's an inline text
   control in a wrapping chip row, where a 44px box would set the row height
   for cards that have no labels at all. The chips beside it are the larger
   target for the same action. */
.add-btn {
  min-height: 24px;
  padding: 2px 9px;
  border: 1px dashed var(--pc-border);
  border-radius: 999px;
  background: transparent;
  color: var(--pc-ink-dim);
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;
}
</style>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBoardStore } from '@/stores/boardStore'
import { LABEL_COLORS, LABEL_TEXT_COLORS } from '@/lib/labelColors'
import LabelPicker from './LabelPicker.vue'

const props = defineProps<{ cardId: number }>()

const store = useBoardStore()

const activeLabels = computed(() => store.labelsForCard(props.cardId))

const picking = ref(false)
</script>

<template>
  <div class="label-bar">
    <!-- Chips open the picker too. The `+` on its own is a small target for the
         thing you reach for right after reading a label you disagree with, and
         removal now lives in the picker rather than on a chip-sized `×`. -->
    <button
      v-for="label in activeLabels"
      :key="label.id"
      class="chip"
      :style="{
        background: LABEL_COLORS[label.color] ?? '#ccc',
        color: LABEL_TEXT_COLORS[label.color] ?? '#2a2420',
      }"
      @click="picking = true"
    >{{ label.name }}</button>
    <button
      class="add-btn"
      :aria-label="activeLabels.length ? 'Edit labels' : 'Add a label'"
      @click="picking = true"
    >{{ activeLabels.length ? '+' : '+ Label' }}</button>

    <LabelPicker v-if="picking" :card-id="cardId" @close="picking = false" />
  </div>
</template>

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

/* Chips are tap targets now — they open the picker — so they grow on touch.
   Inherited from the rule the card modal used to carry for its own chips at
   ≤640px; keyed on the pointer instead of the width, since the practice view is
   touch-first at every size and this component serves both. */
@media (pointer: coarse) {
  .chip,
  .add-btn {
    padding: 6px 12px;
    font-size: 13px;
  }
}

/* Outlined, not filled: it sits in a row of solid chips and must not read as
   one more label. Deliberately under the 44px touch floor — it's an inline text
   control in a wrapping chip row, where a 44px box would set the row height on
   every card including the ones carrying no labels at all. The chips beside it
   open the same panel and are the larger target; the panel's own rows are 48px. */
.add-btn {
  min-height: 24px;
  padding: 2px 9px;
  border: 1px dashed var(--lp-border, var(--color-border));
  border-radius: 999px;
  background: transparent;
  color: var(--lp-ink-dim, var(--color-ink-dim));
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;
}
</style>

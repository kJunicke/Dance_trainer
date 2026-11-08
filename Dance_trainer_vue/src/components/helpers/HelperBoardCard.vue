<script setup lang="ts">
import { computed } from 'vue'
import { openPlaces, type HelperRow } from '@/lib/helperPlan'

const props = defineProps<{
  row: HelperRow
  eyebrow?: string
  detail?: string
  // Replaces the who line, for a heading standing in for its tasks.
  summary?: string
  // Open places across the tasks a heading stands in for.
  groupOpen?: number
  moveLabel: string
}>()

const emit = defineEmits<{
  open: []
  grab: [event: PointerEvent]
}>()

const open = computed(() => props.groupOpen ?? openPlaces(props.row))
const who = computed(() => {
  if (props.summary) return props.summary
  const names = props.row.who.join(', ')
  if (!open.value) return names
  return names ? `${names} · needs ${open.value} more` : `Needs ${open.value}`
})
</script>

<template>
  <article class="card" :class="{ full: open === 0, done: row.done, heading: row.type === 'section' }">
    <button class="main" type="button" :aria-label="`${moveLabel}: ${row.task}`" @click="emit('open')">
      <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
      <span class="task">{{ row.task }}</span>
      <span v-if="detail" class="detail">{{ detail }}</span>
      <span v-if="who" class="who">{{ who }}</span>
    </button>
    <button
      class="handle"
      type="button"
      :aria-label="`Drag or tap to move ${row.task}`"
      @pointerdown.prevent="emit('grab', $event)"
      @click="emit('open')"
    >
      <span class="grip" aria-hidden="true">⠿</span>
    </button>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  min-width: 0;
  overflow: hidden;
  border-left: 5px solid var(--color-overdue);
  border-radius: var(--hp-r-m);
  background: var(--color-surface-light);
  box-shadow: var(--shadow-card);
}

.card.full {
  border-left-color: var(--color-good);
}

.card.heading {
  background: var(--hp-amber-soft);
}

.card :focus-visible {
  outline-offset: -2px;
}

button {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.main {
  flex: 1;
  min-width: 0;
  min-height: var(--hp-tap);
  padding: 7px var(--hp-1) 7px 10px;
  text-align: left;
  touch-action: manipulation;
  transition: background-color var(--hp-fast) var(--hp-ease);
}

.main:active {
  background: color-mix(in srgb, var(--color-ink) 7%, transparent);
}

.main > span {
  display: block;
  overflow-wrap: anywhere;
}

.eyebrow {
  color: var(--color-ink-dim);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.3;
}

.task {
  display: -webkit-box !important;
  overflow: hidden;
  color: var(--color-ink);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.25;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.card.done .task {
  color: var(--color-ink-dim);
  text-decoration: line-through;
}

.detail,
.who {
  margin-top: 2px;
  color: var(--color-ink-dim);
  font-size: 13px;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}

/* A square, not a full-height strip: touch-action none would stop a thumb scrolling
   anywhere along the card's edge. */
.handle {
  flex: none;
  align-self: center;
  width: var(--hp-tap);
  height: var(--hp-tap);
  color: var(--color-ink-dim);
  font-size: 20px;
  touch-action: none;
  cursor: grab;
  transition:
    background-color var(--hp-fast) var(--hp-ease),
    color var(--hp-fast) var(--hp-ease);
}

.grip {
  display: inline-block;
  transition: transform var(--hp-fast) var(--hp-ease);
}

.handle:active {
  background: var(--hp-amber);
  color: var(--color-ink);
  cursor: grabbing;
}

.handle:active .grip {
  transform: scale(1.2);
}

@media (hover: hover) {
  .main:hover {
    background: color-mix(in srgb, var(--color-ink) 4%, transparent);
  }

  .handle:hover {
    color: var(--color-ink);
  }
}
</style>

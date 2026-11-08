<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { addWhen, clearWhen, formatClock, parseWhen, writeWhen, type WhenSlot } from '@/lib/helperBoards'

const props = defineProps<{
  presets: string[]
  // Which time in the cell to start on, by its character position.
  occurrence?: number
}>()

const model = defineModel<string>({ required: true })

interface Clock {
  hour: number
  minute: number
}

const HOURS = [...Array.from({ length: 18 }, (_, i) => i + 6), 0, 1, 2, 3, 4, 5]
const MINUTES = [0, 15, 30, 45]

const editing = ref<'start' | 'end'>('start')

function toClock(time: number | null | undefined): Clock | null {
  if (time === null || time === undefined) return null
  const wrapped = time % 1440
  return { hour: Math.floor(wrapped / 60), minute: wrapped % 60 }
}

const slots = computed(() => parseWhen(model.value))
const selected = ref(Math.max(0, slots.value.findIndex((s) => s.index === props.occurrence)))
const activeIndex = computed(() => Math.min(selected.value, slots.value.length - 1))
const slot = computed(() => slots.value[activeIndex.value] ?? null)
const start = computed(() => toClock(slot.value?.start))
const end = computed(() => toClock(slot.value?.end))
const current = computed(() => (editing.value === 'start' ? start.value : end.value))

// With no start there is nothing for an end to belong to, and hours would do nothing.
watch(start, (value) => {
  if (!value) editing.value = 'start'
})

function label(clock: Clock | null): string {
  return clock ? `${clock.hour}:${String(clock.minute).padStart(2, '0')}` : '—'
}

function typed(item: WhenSlot): string {
  return model.value.slice(item.index, item.index + item.length)
}

function write(nextStart: Clock | null, nextEnd: Clock | null) {
  if (!nextStart) return
  model.value = writeWhen(model.value, slot.value, nextEnd ? `${label(nextStart)}–${label(nextEnd)}` : label(nextStart))
}

function set(next: Clock) {
  // Tapping the value already set must not rewrite "14 Uhr" as "14:00".
  if (current.value?.hour === next.hour && current.value.minute === next.minute) return
  if (editing.value === 'start') write(next, end.value)
  else write(start.value, next)
}

function pickHour(hour: number) {
  set({ hour, minute: current.value?.minute ?? 0 })
}

function pickMinute(minute: number) {
  if (!current.value) return
  set({ hour: current.value.hour, minute })
  // From then Until is the usual order, so the next tap needn't aim at the tab.
  if (editing.value === 'start') editing.value = 'end'
}

function clearEnd() {
  write(start.value, null)
  editing.value = 'start'
}

function choose(index: number) {
  selected.value = index
  editing.value = 'start'
}

function addAnother() {
  const last = slots.value[slots.value.length - 1]
  if (!last) return
  const next = addWhen(model.value, formatClock((last.end ?? last.start) + 60))
  model.value = next
  // Worked out from `next`: the model only changes once the parent re-renders.
  choose(parseWhen(next).length - 1)
}

function removeSelected() {
  if (slot.value) model.value = clearWhen(model.value, slot.value)
  editing.value = 'start'
}
</script>

<template>
  <div class="picker">
    <div v-if="slots.length" class="hp-chip-row hp-chip-row--scroll hp-chips--roomy" role="group" aria-label="Times in this cell">
      <template v-if="slots.length > 1">
        <template v-for="(item, i) in slots" :key="i">
          <button type="button" class="hp-tap" :aria-pressed="i === activeIndex" @click="choose(i)"><span class="hp-chip time">{{ typed(item) }}</span></button>
          <button
            v-if="i === activeIndex"
            type="button"
            class="hp-tap remove"
            :aria-label="`Remove ${typed(item)}`"
            @click="removeSelected"
          ><span class="hp-chip">×</span></button>
        </template>
      </template>
      <button type="button" class="hp-tap" @click="addAnother"><span class="hp-chip hp-chip--open">+ Another time</span></button>
    </div>

    <div class="segments" role="group" aria-label="Which time to set">
      <button type="button" class="seg" :aria-pressed="editing === 'start'" @click="editing = 'start'">
        <span class="seg-label">From</span> <span class="seg-time">{{ label(start) }}</span>
      </button>
      <button type="button" class="seg" :aria-pressed="editing === 'end'" :disabled="!start" @click="editing = 'end'">
        <span class="seg-label">Until</span> <span class="seg-time">{{ label(end) }}</span>
      </button>
      <button v-if="end" type="button" class="seg clear" aria-label="No end time" @click="clearEnd">×</button>
    </div>

    <div class="hours" role="group" aria-label="Hour">
      <button
        v-for="hour in HOURS"
        :key="hour"
        type="button"
        class="cell"
        :aria-pressed="current?.hour === hour"
        :disabled="editing === 'end' && !start"
        @click="pickHour(hour)"
      >{{ hour }}</button>
    </div>

    <div class="minutes" role="group" aria-label="Minutes">
      <button
        v-for="minute in MINUTES"
        :key="minute"
        type="button"
        class="cell"
        :aria-pressed="current?.minute === minute"
        :disabled="!current"
        @click="pickMinute(minute)"
      >:{{ String(minute).padStart(2, '0') }}</button>
    </div>

    <div v-if="presets.length" class="hp-chip-row hp-chip-row--scroll hp-chips--roomy" aria-label="Times used on this plan">
      <button v-for="preset in presets" :key="preset" type="button" class="hp-tap" @click="model = writeWhen(model, slot, preset)">
        <span class="hp-chip time">{{ preset }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: var(--hp-1);
}

.time {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.remove .hp-chip {
  justify-content: center;
  width: 36px;
  padding: 0;
  font-size: 16px;
}

.segments {
  display: flex;
  gap: var(--hp-1);
}

.seg,
.cell {
  border: none;
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
  touch-action: manipulation;
  transition:
    background-color var(--hp-fast) var(--hp-ease),
    color var(--hp-fast) var(--hp-ease),
    transform var(--hp-fast) var(--hp-ease);
}

.seg:disabled,
.cell:disabled {
  opacity: 0.4;
  cursor: default;
}

.seg:active:not(:disabled),
.cell:active:not(:disabled) {
  background: var(--color-border);
  transform: scale(0.96);
}

.seg[aria-pressed='true'],
.cell[aria-pressed='true'],
.seg[aria-pressed='true']:active:not(:disabled),
.cell[aria-pressed='true']:active:not(:disabled) {
  background: var(--color-ink);
  color: var(--hp-amber-soft);
}

.seg {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: var(--hp-tap);
  border-radius: var(--hp-r-m);
}

.seg.clear {
  flex: 0 0 var(--hp-tap);
  font-size: 18px;
}

.seg-label {
  font-size: 12px;
  font-weight: 400;
}

.seg-time {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.hours {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 3px;
}

.minutes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
}

.cell {
  min-height: var(--hp-tap);
  border-radius: var(--hp-r-s);
  font-family: var(--font-mono);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
</style>

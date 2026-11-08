<script setup lang="ts">
import { computed, ref } from 'vue'
import { cellOverLimit, countOpen, HELPER_LIMITS, type HelperRow } from '@/lib/helperPlan'
import {
  bucketOf,
  buildTimeline,
  clearWhen,
  formatClock,
  formatDuration,
  headingOf,
  moveWhen,
  parseWhen,
  relocateSlot,
  type TimelineItem,
  type WhenSlot,
} from '@/lib/helperBoards'
import { useDragMove } from '@/lib/useDragMove'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import { useToastStore } from '@/stores/toastStore'
import HelperBoardCard from './HelperBoardCard.vue'
import HelperDragGhost from './HelperDragGhost.vue'

const NO_TIME = 'none'

const props = defineProps<{
  rows: HelperRow[]
  scroller: HTMLElement | null
}>()

const emit = defineEmits<{ edit: [rowId: number, occurrence?: number] }>()

const store = useHelperPlanStore()
const toast = useToastStore()
const plan = computed(() => buildTimeline(props.rows))

interface Moving {
  row: HelperRow
  // The row whose time the new one is worked out from: a task without its own
  // time starts from its heading's.
  baseId: number
  slot: WhenSlot | null
  ownTime: boolean
}

const drag = useDragMove<Moving>({
  scroller: () => props.scroller,
  onDrop: (item, key) => void drop(item, key),
})

// Worked out from the store, not the card: someone may have edited the cell since
// the finger went down.
async function drop(item: Moving, key: string) {
  if (key === NO_TIME && !item.ownTime) {
    toast.show("This task follows its heading's time. Change the heading to move it.")
    return
  }
  if (key === NO_TIME && !item.slot) return
  const row = store.rowById(item.row.id)
  const base = store.rowById(item.baseId)
  const slot = base ? relocateSlot(item.slot, base.when) : undefined
  if (!row || !base || slot === undefined || (!item.ownTime && row.when.trim())) {
    toast.show('This task just changed. Check it and move it again.')
    return
  }
  if (key === NO_TIME) {
    if (!slot) return
    const cleared = clearWhen(row.when, slot)
    if (!(await store.setCell(row.id, 'when', cleared))) return
    // An empty cell under a timed heading inherits that time, so it isn't untimed.
    const heading = cleared.trim() ? null : headingOf(store.rowsByPage[row.page_id] ?? [], row.id)
    if (heading && parseWhen(heading.when).length) {
      toast.success(`Back with ${heading.task.split('\n')[0]} · ${heading.when}`)
    }
    return
  }
  const minute = Number(key)
  if (slot && item.ownTime && bucketOf(slot.start) === minute) return
  const next = moveWhen(base.when, slot, minute)
  if (cellOverLimit('when', next)) {
    toast.show(`The When cell would be over its ${HELPER_LIMITS.when} characters. Shorten it first.`)
    return
  }
  if (await store.setCell(row.id, 'when', next)) {
    toast.success(`Moved to ${formatClock(minute)}`)
  }
}

const expanded = ref(new Set<string>())
function groupKey(item: TimelineItem): string {
  return `${item.row.id}-${item.slot?.index ?? 0}`
}
function toggle(item: TimelineItem) {
  const key = groupKey(item)
  if (!expanded.value.delete(key)) expanded.value.add(key)
  expanded.value = new Set(expanded.value)
}

function timeText(item: TimelineItem): string {
  const { slot, row } = item
  if (!slot) return ''
  const typed = row.when.slice(slot.index, slot.index + slot.length)
  return slot.end === null ? typed : `${typed} · ${formatDuration(slot.end - slot.start)}`
}

function detail(item: TimelineItem): string {
  return [timeText(item), item.row.where.replace(/\n/g, ' ')].filter(Boolean).join(' · ')
}

function grab(event: PointerEvent, item: TimelineItem, origin: string) {
  drag.start(event, { row: item.row, baseId: item.row.id, slot: item.slot, ownTime: true }, item.row.task, origin)
}

function grabChild(event: PointerEvent, task: HelperRow, item: TimelineItem, origin: string) {
  drag.start(event, { row: task, baseId: item.row.id, slot: item.slot, ownTime: false }, task.task, origin)
}

function childDetail(task: HelperRow): string {
  return task.where.replace(/\n/g, ' ')
}

function groupOpen(tasks: HelperRow[]): number {
  return countOpen(tasks)
}

function groupSummary(tasks: HelperRow[]): string {
  const open = groupOpen(tasks)
  return `${tasks.length} task${tasks.length === 1 ? '' : 's'}${open ? ` · ${open} open` : ''}`
}

const hasTimes = computed(() => props.rows.some((row) => parseWhen(row.when).length))
</script>

<template>
  <div class="timeline" :class="{ dragging: drag.dragging.value }">
    <p class="hint hp-hint">
      {{ hasTimes ? 'Tap a task to change its time, or drag ⠿ to another slot.' : 'No times yet. Drag ⠿ onto a slot or tap a task.' }}
    </p>

    <section
      v-for="bucket in plan.buckets"
      :key="bucket.minute"
      class="slot"
      :class="{ over: drag.overKey.value === String(bucket.minute), empty: !bucket.items.length, hour: bucket.minute % 60 === 0, 'has-running': bucket.running.length > 0 }"
      :data-drop="bucket.minute"
    >
      <h3 class="rail">{{ formatClock(bucket.minute) }}</h3>
      <div class="items">
        <p v-if="bucket.running.length" class="running">
          <span class="running-names">{{ bucket.running.slice(0, 2).join(', ') }}</span>
          <span class="running-more">{{ bucket.running.length > 2 ? `+${bucket.running.length - 2} ` : '' }}still on</span>
        </p>
        <div
          v-for="item in bucket.items"
          :key="`${item.kind}-${groupKey(item)}`"
          class="item"
          :class="{ group: item.kind === 'group', 'group-full': item.kind === 'group' && groupOpen(item.tasks) === 0 }"
        >
          <template v-if="item.kind === 'group'">
            <HelperBoardCard
              :row="item.row"
              :detail="timeText(item)"
              :summary="groupSummary(item.tasks)"
              :group-open="groupOpen(item.tasks)"
              move-label="Change time of"
              @open="emit('edit', item.row.id, item.slot.index)"
              @grab="grab($event, item, String(bucket.minute))"
            />
            <button class="expand" type="button" :aria-expanded="expanded.has(groupKey(item))" @click="toggle(item)">
              <span class="chevron" aria-hidden="true" />
              {{ expanded.has(groupKey(item)) ? 'Hide tasks' : `Show ${item.tasks.length} task${item.tasks.length === 1 ? '' : 's'}` }}
            </button>
            <div v-if="expanded.has(groupKey(item))" class="children">
              <HelperBoardCard
                v-for="task in item.tasks"
                :key="task.id"
                :row="task"
                :detail="childDetail(task)"
                move-label="Set a time for"
                @open="emit('edit', task.id)"
                @grab="grabChild($event, task, item, String(bucket.minute))"
              />
            </div>
          </template>
          <HelperBoardCard
            v-else
            :row="item.row"
            :eyebrow="item.heading"
            :detail="detail(item)"
            move-label="Change time of"
            @open="emit('edit', item.row.id, item.slot?.index)"
            @grab="grab($event, item, String(bucket.minute))"
          />
        </div>
      </div>
      <span v-if="drag.dragging.value && bucket.items.length" class="count">{{ bucket.items.length }}</span>
    </section>

    <section
      v-if="plan.untimed.length || drag.dragging.value"
      class="untimed"
      :class="{ over: drag.overKey.value === NO_TIME }"
      :data-drop="NO_TIME"
    >
      <h3 class="untimed-title">No time yet ({{ plan.untimed.length }})</h3>
      <div class="items">
        <HelperBoardCard
          v-for="item in plan.untimed"
          :key="item.row.id"
          :row="item.row"
          :eyebrow="item.kind === 'task' ? item.heading : ''"
          :detail="[item.row.when, item.row.where.replace(/\n/g, ' ')].filter(Boolean).join(' · ')"
          move-label="Set a time for"
          @open="emit('edit', item.row.id)"
          @grab="grab($event, item, NO_TIME)"
        />
      </div>
    </section>

    <HelperDragGhost v-if="drag.dragging.value" :x="drag.ghost.value.x" :y="drag.ghost.value.y" :label="drag.ghost.value.label" />
  </div>
</template>

<style scoped>
.timeline {
  --rail: 52px;
  --node: 11px;
  position: relative;
}

.hint {
  margin-bottom: var(--hp-2);
}

/* One continuous line runs down the whole day; each slot only adds to it. */
.slot {
  position: relative;
  display: flex;
  min-height: 32px;
  border-radius: var(--hp-r-s);
  transition: background-color var(--hp-fast) var(--hp-ease);
}

.slot::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--rail) - 1px);
  width: 2px;
  background: var(--color-border);
  content: '';
}

/* Empty half-hours between events add nothing to read until a drag needs them. */
.slot.empty:not(.hour):not(.has-running) {
  min-height: 10px;
}

.slot.empty:not(.hour):not(.has-running) .rail {
  visibility: hidden;
}

.slot:not(.empty)::after {
  position: absolute;
  top: 13px;
  left: calc(var(--rail) - var(--node) / 2);
  width: var(--node);
  height: var(--node);
  border: 2.5px solid var(--color-ink);
  border-radius: 50%;
  background: var(--hp-amber);
  content: '';
}

/* Something still running: the line thickens to amber, so a long shift reads
   as one solid span down the night. */
.slot.has-running::before {
  left: calc(var(--rail) - 2px);
  width: 4px;
  background: var(--hp-amber);
}

.rail {
  flex: 0 0 var(--rail);
  padding: 10px 10px 0 0;
  color: var(--color-ink-dim);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 14px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.slot.hour .rail {
  color: var(--color-ink);
  font-size: 12px;
  font-weight: 700;
}

.slot.over,
.untimed.over {
  background: var(--hp-amber);
  box-shadow: inset 0 0 0 2px var(--color-ink);
}

.slot.over::before {
  background: var(--color-ink);
}

.slot.over .rail {
  color: var(--color-ink);
  font-weight: 700;
}

.slot.over::after {
  background: var(--color-ink);
}

.items {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 6px;
  padding-left: 14px;
}

.slot:not(.empty) .items {
  padding-top: var(--hp-1);
  padding-bottom: var(--hp-2);
}

.item {
  min-width: 0;
}

/* Heading card and its disclosure are one piece. */
.item.group {
  overflow: hidden;
  border-radius: var(--hp-r-m);
  box-shadow: var(--shadow-card);
}

.item.group :deep(.card) {
  border-radius: 0;
  box-shadow: none;
}

.running {
  display: flex;
  align-items: center;
  gap: var(--hp-1);
  min-width: 0;
  min-height: 32px;
  color: var(--color-ink-dim);
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
}

.running-names {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.running-more {
  flex: none;
}

.expand {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: var(--hp-tap);
  padding: 0 10px;
  border: none;
  border-top: 1px solid rgba(42, 36, 32, 0.12);
  border-left: 5px solid var(--color-overdue);
  background: var(--hp-amber-soft);
  color: var(--color-ink);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;
  transition: background-color var(--hp-fast) var(--hp-ease);
}

.group-full .expand {
  border-left-color: var(--color-good);
}

.expand:active {
  background: var(--hp-amber);
}

.expand:focus-visible {
  outline-offset: -2px;
}

.chevron {
  width: 8px;
  height: 8px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(-45deg);
  transition: transform var(--hp-fast) var(--hp-ease);
}

.expand[aria-expanded='true'] .chevron {
  transform: rotate(45deg);
}

.children {
  display: grid;
  gap: var(--hp-1);
  padding: var(--hp-1) 0 var(--hp-1) var(--hp-3);
  border-left: 5px solid var(--hp-amber-soft);
  background: var(--hp-amber-pale);
}

.children :deep(.card) {
  border-radius: var(--hp-r-s);
}

.untimed {
  margin-top: var(--hp-4);
  padding: var(--hp-2);
  border: 1.5px dashed var(--color-ink-dim);
  border-radius: var(--hp-r-m);
  transition: background-color var(--hp-fast) var(--hp-ease);
}

.untimed .items {
  padding-left: 0;
}

.untimed-title {
  margin-bottom: 6px;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
}

/* Folded during a drag, so every slot is in reach of one thumb movement. */
.dragging .items,
.dragging .hint {
  display: none;
}

.dragging .slot,
.dragging .slot.empty:not(.hour):not(.has-running) {
  align-items: center;
  min-height: 40px;
}

.dragging .slot.empty:not(.hour):not(.has-running) .rail {
  visibility: visible;
}

.dragging .rail {
  padding-top: 0;
}

.dragging .slot:not(.empty)::after {
  top: 50%;
  margin-top: calc(var(--node) / -2);
}

.count {
  margin-left: auto;
  padding-right: var(--hp-2);
  color: var(--color-ink-dim);
  font-family: var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.slot.over .count {
  color: var(--color-ink);
}

@media (min-width: 760px) {
  .timeline {
    --rail: 76px;
  }

  .rail {
    font-size: 13px;
  }

  .slot.hour .rail {
    font-size: 14px;
  }

  .items {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--hp-2);
  }

  .running {
    grid-column: 1 / -1;
  }
}
</style>

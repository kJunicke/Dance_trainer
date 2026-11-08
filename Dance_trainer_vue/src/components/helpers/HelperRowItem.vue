<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import {
  extraField,
  openPlaces,
  pageColumnCount,
  sameName,
  type EditField,
  type HelperPage,
  type HelperRow,
} from '@/lib/helperPlan'
import { ROW_REORDER } from '@/lib/useDragReorder'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import HelperRowAdminActions from './HelperRowAdminActions.vue'

interface OptionalCell {
  field: EditField
  label: string
  value: string
}

const props = defineProps<{
  row: HelperRow
  page: HelperPage
}>()

const emit = defineEmits<{
  edit: [field: EditField]
  'add-name': []
}>()

const store = useHelperPlanStore()

const reorder = inject(ROW_REORDER, null)

const optionalCells = computed<OptionalCell[]>(() => {
  const { page, row } = props
  const cells: OptionalCell[] = []
  if (page.show_when) cells.push({ field: 'when', label: 'When', value: row.when })
  if (page.show_where) cells.push({ field: 'where', label: 'Where', value: row.where })
  if (page.show_comment) cells.push({ field: 'comment', label: 'Comment', value: row.comment })
  for (const column of page.custom_columns) {
    cells.push({ field: extraField(column.id), label: column.name, value: row.extra[column.id] ?? '' })
  }
  return cells
})
const filledCells = computed(() => optionalCells.value.filter((cell) => cell.value))
// A heading's time sits beside its title, like a schedule entry; the rest goes below.
const headingTime = computed(() => filledCells.value.find((cell) => cell.field === 'when') ?? null)
const headingDetails = computed(() => filledCells.value.filter((cell) => cell.field !== 'when'))
// A plain range stacks over its own two lines, which leaves the title room for one.
const headingTimeStacks = computed(() => /^\d{1,2}[:.]\d{2}–\d{1,2}[:.]\d{2}$/.test(headingTime.value?.value ?? ''))
const emptyCells = computed(() => optionalCells.value.filter((cell) => !cell.value))
const columnCount = computed(() => pageColumnCount(props.page))
const dragged = computed(() => reorder?.draggingId.value === props.row.id)

const open = computed(() => openPlaces(props.row))
const canAddMe = computed(
  () =>
    open.value > 0 &&
    store.guestName !== '' &&
    !props.row.who.some((name) => sameName(name, store.guestName)),
)

// Lives here, keyed by name: a live refresh re-renders the row but keeps this
// component, so a confirm that's open stays open.
const confirming = ref<string | null>(null)
// Phone only: the "+ When / + Comment" row stays folded so more tasks fit on screen.
const addOpen = ref(false)
const busy = ref(false)

async function addMe() {
  if (busy.value) return
  busy.value = true
  await store.signUp(props.row.id, store.guestName)
  busy.value = false
}

async function toggleDone(event: Event) {
  const box = event.target as HTMLInputElement
  if (busy.value) return
  busy.value = true
  await store.setDone(props.row.id, box.checked)
  busy.value = false
  // After a refusal the box must not keep showing what the server turned down.
  box.checked = props.row.done
}

async function remove(name: string) {
  if (busy.value) return
  busy.value = true
  await store.removeName(props.row.id, name)
  busy.value = false
  confirming.value = null
}
</script>

<template>
  <tr v-if="row.type === 'section'" class="row-section" :class="{ dragged }" :data-reorder-id="row.id">
    <td class="cell sec-cell" :colspan="columnCount">
      <div class="sec-head">
        <button class="sec-title" :class="{ 'has-details': headingDetails.length }" type="button" @click="emit('edit', 'task')">{{ row.task }}</button>
        <button
          v-if="headingTime"
          class="sec-when"
          :class="{ stacked: headingTimeStacks }"
          type="button"
          :aria-label="`Edit when: ${headingTime.value}`"
          @click="emit('edit', 'when')"
        >{{ headingTime.value }}</button>
        <button
          v-if="emptyCells.length"
          class="sec-more"
          type="button"
          :aria-expanded="addOpen"
          :aria-label="`Details: add ${emptyCells.map((cell) => cell.label.toLowerCase()).join(' or ')}`"
          @click="addOpen = !addOpen"
        >{{ addOpen ? '−' : '⋯' }}</button>
      </div>
      <div class="sec-meta">
        <button
          v-for="cell in headingDetails"
          :key="cell.field"
          class="sec-value"
          type="button"
          :aria-label="`Edit ${cell.label.toLowerCase()}: ${cell.value}`"
          @click="emit('edit', cell.field)"
        ><span class="sec-value-text">{{ cell.value }}</span></button>
        <button
          v-for="cell in emptyCells"
          :key="cell.field"
          class="add-field on-amber"
          :class="{ folded: !addOpen }"
          type="button"
          @click="emit('edit', cell.field)"
        >+ {{ cell.label }}</button>
      </div>
      <HelperRowAdminActions :row="row" />
    </td>
  </tr>

  <tr
    v-else
    class="row-task"
    :class="[open > 0 ? 'is-open' : 'is-full', { 'is-done': row.done, 'has-done': page.show_done, dragged }]"
    :data-reorder-id="row.id"
  >
    <td class="cell c-task">
      <button class="task-btn" type="button" @click="emit('edit', 'task')">{{ row.task }}</button>
      <button
        v-if="emptyCells.length"
        class="more-btn"
        type="button"
        :aria-expanded="addOpen"
        :aria-label="`Details: add ${emptyCells.map((cell) => cell.label.toLowerCase()).join(' or ')}`"
        @click="addOpen = !addOpen"
      >{{ addOpen ? '−' : '⋯' }}</button>
      <HelperRowAdminActions class="task-admin" :row="row" />
    </td>

    <td v-if="page.show_when" class="cell c-field c-meta c-when" :class="{ blank: !row.when }">
      <span class="lbl">When</span>
      <button class="value-btn" type="button" :aria-label="`Edit when: ${row.when || 'empty'}`" @click="emit('edit', 'when')">
        <template v-if="row.when">{{ row.when }}</template>
        <span v-else class="plus" aria-hidden="true">+</span>
      </button>
    </td>

    <td v-if="page.show_where" class="cell c-field c-meta" :class="{ blank: !row.where }">
      <span class="lbl">Where</span>
      <button class="value-btn" type="button" :aria-label="`Edit where: ${row.where || 'empty'}`" @click="emit('edit', 'where')">
        <template v-if="row.where">{{ row.where }}</template>
        <span v-else class="plus" aria-hidden="true">+</span>
      </button>
    </td>

    <td class="cell c-field c-who">
      <span class="lbl">Who</span>
      <div class="who">
        <template v-for="name in row.who" :key="name">
          <span v-if="confirming === name" class="confirm">
            <span class="confirm-q">Remove {{ name }}?</span>
            <button class="hp-btn hp-btn--danger hp-btn--small" type="button" :disabled="busy" @click="remove(name)">Remove</button>
            <button class="hp-btn hp-btn--ghost hp-btn--small" type="button" @click="confirming = null">Keep</button>
          </span>
          <button
            v-else
            class="hp-tap"
            type="button"
            :aria-label="`Remove ${name}`"
            @click="confirming = name"
          >
            <span class="hp-chip" :class="{ 'hp-chip--mine': sameName(name, store.guestName) }">{{ name }}</span>
          </button>
        </template>

        <button v-if="canAddMe" class="hp-tap" type="button" :disabled="busy" @click="addMe">
          <span class="hp-chip hp-chip--take">+ Add me</span>
        </button>
        <button v-if="open > 0" class="hp-tap" type="button" aria-label="Add someone else" @click="emit('add-name')">
          <span class="hp-chip hp-chip--open"><span class="phone-only">+ Other</span><span class="wide-only">+ Someone else</span></span>
        </button>
        <button
          class="count-btn hp-tap"
          type="button"
          :aria-label="`${row.who.length} of ${row.needed} places filled. Change how many people are needed`"
          @click="emit('edit', 'needed')"
        >
          <span class="hp-chip hp-chip--count">
            <svg class="count-icon" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
              <path fill="currentColor" d="M8 8a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 8 8Zm0 1.4c-3.3 0-6 1.6-6 3.8v1.2h12v-1.2c0-2.2-2.7-3.8-6-3.8Z" />
            </svg>
            {{ row.who.length }} of {{ row.needed }}
          </span>
        </button>
      </div>
    </td>

    <td v-if="page.show_done" class="cell c-field c-done">
      <span class="lbl">Done</span>
      <label class="done-toggle">
        <input type="checkbox" :checked="row.done" :disabled="busy" :aria-label="`Done: ${row.task}`" @change="toggleDone" />
      </label>
    </td>

    <td v-if="page.show_comment" class="cell c-field" :class="{ blank: !row.comment }">
      <span class="lbl">Comment</span>
      <button class="value-btn" type="button" :aria-label="`Edit comment: ${row.comment || 'empty'}`" @click="emit('edit', 'comment')">
        <template v-if="row.comment">{{ row.comment }}</template>
        <span v-else class="plus" aria-hidden="true">+</span>
      </button>
    </td>

    <td
      v-for="column in page.custom_columns"
      :key="column.id"
      class="cell c-field"
      :class="{ blank: !row.extra[column.id] }"
    >
      <span class="lbl custom">{{ column.name }}</span>
      <button
        class="value-btn"
        type="button"
        :aria-label="`Edit ${column.name}: ${row.extra[column.id] || 'empty'}`"
        @click="emit('edit', extraField(column.id))"
      >
        <template v-if="row.extra[column.id]">{{ row.extra[column.id] }}</template>
        <span v-else class="plus" aria-hidden="true">+</span>
      </button>
    </td>

    <td v-if="emptyCells.length" v-show="addOpen" class="cell c-add">
      <button
        v-for="cell in emptyCells"
        :key="cell.field"
        class="add-field"
        type="button"
        @click="emit('edit', cell.field)"
      >+ {{ cell.label }}</button>
    </td>
  </tr>
</template>

<style scoped>
/* :where keeps this as weak as a bare button rule, so the classes below still win. */
button:where(:not(.hp-btn)) {
  border: none;
  background: transparent;
  color: inherit;
  font-size: inherit;
  cursor: pointer;
  touch-action: manipulation;
}

button:where(:not(.hp-btn)):disabled {
  opacity: 0.55;
  cursor: default;
}

/* Base layout is the phone: every table part is a block, each task a card. */
.cell {
  display: block;
  min-width: 0;
}

.row-task {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  margin-bottom: var(--hp-2);
  overflow: hidden;
  border-left: 5px solid var(--color-overdue);
  border-radius: var(--hp-r-m);
  background: var(--color-surface-light);
  box-shadow: var(--shadow-card);
}

.row-task.is-full {
  border-left-color: var(--color-good);
}

.row-task :focus-visible {
  outline-offset: -2px;
}

.c-task {
  display: flex;
  flex: 1 1 calc(100% - 44px);
  flex-wrap: wrap;
  align-items: flex-start;
  padding: 0 84px 0 var(--hp-3);
  background: var(--hp-amber-soft);
}

.task-admin {
  flex: 0 0 100%;
  padding: 0 var(--hp-3) var(--hp-1) 0;
}

.more-btn {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 1;
  width: var(--hp-tap);
  height: var(--hp-tap);
  color: var(--color-ink);
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
  transition: background-color var(--hp-fast) var(--hp-ease);
}

.more-btn:active {
  background: var(--hp-amber);
}

.task-btn {
  display: block;
  flex: 1 1 100%;
  min-width: 0;
  min-height: var(--hp-tap);
  padding: 11px 0;
  color: var(--color-ink);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  text-align: left;
  white-space: pre-line;
  overflow-wrap: anywhere;
  transition: opacity var(--hp-fast) var(--hp-ease);
}

.task-btn:active,
.value-btn:active,
.sec-title:active,
.sec-when:active,
.sec-value:active {
  opacity: 0.6;
}

.c-field {
  display: flex;
  gap: var(--hp-2);
  padding: 0 var(--hp-3);
}

.c-field.blank {
  display: none;
}

.c-field:not(.c-meta, .c-done, .c-who),
.c-add {
  flex: 0 0 100%;
}

/* When and Where share a line with the sign-ups whenever they fit. The negative
   margin only counts on that shared line; alone on a row it does nothing. */
.c-meta {
  flex: 0 1 auto;
  max-width: 100%;
  margin-right: calc(var(--hp-2) * -1);
  padding-right: 0;
}

.c-meta + .c-meta {
  margin-left: var(--hp-2);
}

.c-meta .lbl,
.c-who .lbl {
  display: none;
}

.c-meta .value-btn {
  padding: 6px 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.25;
}

.c-when .value-btn {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.c-done {
  flex: 0 0 44px;
  order: -1;
  padding: 0;
  background: var(--hp-amber-soft);
}

.c-done .lbl {
  display: none;
}

.has-done .c-task {
  padding-left: 0;
}

.wide-only {
  display: none;
}

.lbl {
  flex: 0 0 58px;
  padding-top: 15px;
  color: var(--color-ink-dim);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* A column name the admin chose can be longer than the built-in ones. */
.lbl.custom {
  flex-basis: 76px;
  overflow-wrap: anywhere;
}

.dragged {
  opacity: 0.4;
  outline: 2px dashed var(--color-ink-dim);
  outline-offset: -2px;
}

.value-btn {
  flex: 1;
  min-width: var(--hp-tap);
  min-height: var(--hp-tap);
  padding: 6px 0;
  color: var(--color-ink);
  font-size: 14px;
  line-height: 1.35;
  text-align: left;
  white-space: pre-line;
  overflow-wrap: anywhere;
  transition: opacity var(--hp-fast) var(--hp-ease);
}

.plus {
  color: var(--color-ink-dim);
  font-family: var(--font-mono);
}

/* Takes what the When/Where line leaves, and wraps below it when that's too little. */
.c-who {
  flex: 1 1 auto;
  min-width: 0;
  gap: var(--hp-1);
  padding: 0 var(--hp-2) 0 var(--hp-3);
  --hp-chip-x: 7px;
}

.who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: var(--hp-1);
}

.row-task:has(.more-btn) .who {
  padding-right: var(--hp-tap);
}

/* Top right of every card: how many people a task needs is one glance and one tap. */
.count-btn {
  position: absolute;
  top: 0;
  right: var(--hp-1);
}

.count-icon {
  flex: none;
}

.done-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--hp-tap);
  height: var(--hp-tap);
  cursor: pointer;
}

.done-toggle input {
  width: 22px;
  height: 22px;
  accent-color: var(--color-good);
  cursor: pointer;
}

.row-task.is-done .task-btn {
  color: var(--color-ink-dim);
  text-decoration: line-through;
}

.confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: var(--hp-2);
  width: 100%;
}

.confirm-q {
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.c-add {
  display: flex;
  flex-wrap: wrap;
  column-gap: 6px;
  padding: 0 var(--hp-3);
  border-top: 1px solid var(--color-surface);
}

.add-field {
  min-height: var(--hp-tap);
  padding: 0 6px;
  color: var(--color-ink-dim);
  font-size: 13px;
  font-weight: 500;
}

.add-field:active {
  opacity: 0.6;
}

.row-section {
  display: block;
  margin: var(--hp-3) 0 var(--hp-2);
}

.row-section:first-child {
  margin-top: 0;
}

.sec-cell {
  position: relative;
  padding: 0 0 0 var(--hp-3);
  border-radius: var(--hp-r-m);
  background: var(--hp-amber);
}

.sec-cell :focus-visible {
  outline-color: var(--color-ink);
  outline-offset: -2px;
}

.sec-head {
  display: flex;
  align-items: stretch;
}

.sec-more {
  flex: none;
  width: var(--hp-tap);
  min-height: var(--hp-tap);
  color: var(--color-ink);
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  transition: background-color var(--hp-fast) var(--hp-ease);
}

.sec-more:active {
  background: var(--hp-amber-press);
}

.add-field.folded {
  display: none;
}

.sec-title {
  position: relative;
  display: block;
  flex: 1;
  min-width: 0;
  min-height: var(--hp-tap);
  padding: 9px 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  text-align: left;
  white-space: pre-line;
  overflow-wrap: anywhere;
  transition: opacity var(--hp-fast) var(--hp-ease);
}

/* With a detail line below, both rows shrink and each borrows the empty gap
   above or below the heading to keep a full 44px target. */
.sec-title.has-details {
  min-height: 36px;
  padding: 7px 0 3px;
}

.sec-title.has-details::before {
  position: absolute;
  inset: -8px 0 0;
  content: '';
}

.sec-when {
  flex: none;
  max-width: 46%;
  min-height: var(--hp-tap);
  padding: 0 var(--hp-2);
  color: var(--color-ink);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.25;
  text-align: right;
  white-space: pre-line;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
  transition: opacity var(--hp-fast) var(--hp-ease);
}

.sec-when.stacked {
  width: min-content;
  overflow-wrap: normal;
}

.sec-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: var(--hp-3);
  padding-right: var(--hp-3);
}

.sec-value {
  position: relative;
  min-width: var(--hp-tap);
  min-height: 36px;
  max-width: 100%;
  padding: 2px 0 7px;
  color: var(--color-ink);
  font-size: 13px;
  line-height: 1.3;
  text-align: left;
  white-space: pre-line;
  overflow-wrap: anywhere;
  transition: opacity var(--hp-fast) var(--hp-ease);
}

.sec-value-text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.sec-value::after {
  position: absolute;
  inset: 0 0 -8px;
  content: '';
}

.add-field.on-amber {
  padding: 0;
  color: var(--color-ink);
}

/* From here on it's the real table, like the sheet the team plans in. */
@media (min-width: 760px) {
  .row-task,
  .row-section {
    display: table-row;
    margin: 0;
    box-shadow: none;
  }

  .row-task :focus-visible {
    outline-offset: 2px;
  }

  .cell,
  .c-field,
  .c-field.blank {
    display: table-cell;
    padding: 2px 10px;
    border-top: 1px solid var(--color-border);
    vertical-align: top;
  }

  .row-task:nth-child(even) .cell {
    background: var(--color-surface);
  }

  .c-add,
  .more-btn,
  .sec-more,
  .phone-only {
    display: none;
  }

  .wide-only {
    display: inline;
  }

  .add-field.folded {
    display: inline-block;
  }

  .row-task.has-done .c-task {
    padding-left: 10px;
  }

  .c-done {
    text-align: center;
  }

  .c-task {
    display: table-cell;
    padding: 2px 10px;
  }

  .row-task {
    position: static;
  }

  .task-btn {
    width: 100%;
  }

  .task-admin {
    padding: 0;
  }

  .lbl {
    display: none;
  }

  .row-task .c-task,
  .row-task:nth-child(even) .c-task {
    border-left: 5px solid var(--color-overdue);
    background: var(--hp-amber-soft);
  }

  .row-task.is-full .c-task,
  .row-task.is-full:nth-child(even) .c-task {
    border-left-color: var(--color-good);
  }

  .who {
    column-gap: 6px;
  }

  .count-btn {
    position: static;
  }

  .row-task:has(.more-btn) .who {
    padding-right: 0;
  }

  .c-meta .value-btn,
  .value-btn {
    display: block;
    width: 100%;
    padding: 11px 0;
    font-size: 14px;
  }

  .c-when .value-btn {
    font-size: 13px;
  }

  .sec-cell {
    padding: 0 10px;
    border-radius: 0;
  }

  .sec-title,
  .sec-title.has-details {
    min-height: var(--hp-tap);
    padding: 11px 0;
  }

  .sec-title.has-details::before,
  .sec-value::after {
    content: none;
  }

  .sec-value-text {
    display: block;
    overflow: visible;
  }

  .sec-meta {
    padding-right: 0;
  }

  .sec-value {
    min-height: var(--hp-tap);
    padding: 0;
  }

  .sec-when,
  .sec-when.stacked {
    width: auto;
    max-width: 30%;
    overflow-wrap: anywhere;
    padding: 0 var(--hp-2);
    font-size: 13px;
  }

  .value-btn:hover,
  .task-btn:hover,
  .sec-title:hover,
  .sec-when:hover,
  .sec-value:hover {
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
  }
}
</style>

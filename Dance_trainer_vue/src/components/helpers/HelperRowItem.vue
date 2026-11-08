<script setup lang="ts">
import { computed, ref } from 'vue'
import { openPlaces, sameName, type CellField, type HelperRow } from '@/lib/helperPlan'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import HelperRowAdminActions from './HelperRowAdminActions.vue'

type OptionalField = 'when' | 'where' | 'comment'

const props = defineProps<{
  row: HelperRow
}>()

const emit = defineEmits<{
  edit: [field: CellField]
  'add-name': []
}>()

const store = useHelperPlanStore()

const LABELS: Record<OptionalField, string> = { when: 'When', where: 'Where', comment: 'Comment' }
const OPTIONAL_FIELDS: OptionalField[] = ['when', 'where', 'comment']

const filledFields = computed(() => OPTIONAL_FIELDS.filter((f) => props.row[f]))
const emptyFields = computed(() => OPTIONAL_FIELDS.filter((f) => !props.row[f]))

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

async function remove(name: string) {
  if (busy.value) return
  busy.value = true
  await store.removeName(props.row.id, name)
  busy.value = false
  confirming.value = null
}
</script>

<template>
  <tr v-if="row.type === 'section'" class="row-section">
    <td class="cell sec-cell" colspan="5">
      <button class="sec-title" type="button" @click="emit('edit', 'task')">{{ row.task }}</button>
      <div class="sec-meta">
        <button
          v-for="field in filledFields"
          :key="field"
          class="sec-value"
          type="button"
          :aria-label="`Edit ${LABELS[field].toLowerCase()}: ${row[field]}`"
          @click="emit('edit', field)"
        >{{ row[field] }}</button>
        <button
          v-for="field in emptyFields"
          :key="field"
          class="add-field on-amber"
          type="button"
          @click="emit('edit', field)"
        >+ {{ LABELS[field] }}</button>
      </div>
      <HelperRowAdminActions :row="row" />
    </td>
  </tr>

  <tr v-else class="row-task" :class="open > 0 ? 'is-open' : 'is-full'">
    <td class="cell c-task">
      <button class="task-btn" type="button" @click="emit('edit', 'task')">{{ row.task }}</button>
      <button
        v-if="emptyFields.length"
        class="more-btn"
        type="button"
        :aria-expanded="addOpen"
        :aria-label="`Details: add ${emptyFields.map((f) => LABELS[f].toLowerCase()).join(' or ')}`"
        @click="addOpen = !addOpen"
      >{{ addOpen ? '− Details' : '+ Details' }}</button>
      <HelperRowAdminActions class="task-admin" :row="row" />
    </td>

    <td class="cell c-field" :class="{ blank: !row.when }">
      <span class="lbl">When</span>
      <button class="value-btn" type="button" :aria-label="`Edit when: ${row.when || 'empty'}`" @click="emit('edit', 'when')">
        <template v-if="row.when">{{ row.when }}</template>
        <span v-else class="plus" aria-hidden="true">+</span>
      </button>
    </td>

    <td class="cell c-field" :class="{ blank: !row.where }">
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
            <button class="confirm-btn danger" type="button" :disabled="busy" @click="remove(name)">Remove</button>
            <button class="confirm-btn" type="button" @click="confirming = null">Keep</button>
          </span>
          <button
            v-else
            class="chip"
            type="button"
            :aria-label="`Remove ${name}`"
            @click="confirming = name"
          >
            <span class="pill" :class="{ mine: sameName(name, store.guestName) }">{{ name }}</span>
          </button>
        </template>

        <button v-if="canAddMe" class="slot-btn" type="button" :disabled="busy" @click="addMe">
          <span class="slot strong">+ Add me</span>
        </button>
        <button v-if="open > 0" class="slot-btn" type="button" @click="emit('add-name')">
          <span class="slot">+ Someone else</span>
        </button>
        <button
          class="count-btn"
          type="button"
          :aria-label="`${row.who.length} of ${row.needed} places filled. Change how many people are needed`"
          @click="emit('edit', 'needed')"
        >{{ row.who.length }} of {{ row.needed }}</button>
      </div>
    </td>

    <td class="cell c-field" :class="{ blank: !row.comment }">
      <span class="lbl">Comment</span>
      <button class="value-btn" type="button" :aria-label="`Edit comment: ${row.comment || 'empty'}`" @click="emit('edit', 'comment')">
        <template v-if="row.comment">{{ row.comment }}</template>
        <span v-else class="plus" aria-hidden="true">+</span>
      </button>
    </td>

    <td v-if="emptyFields.length" v-show="addOpen" class="cell c-add">
      <button
        v-for="field in emptyFields"
        :key="field"
        class="add-field"
        type="button"
        @click="emit('edit', field)"
      >+ {{ LABELS[field] }}</button>
    </td>
  </tr>
</template>

<style scoped>
button {
  border: none;
  background: transparent;
  color: inherit;
  font-size: inherit;
  cursor: pointer;
  touch-action: manipulation;
}

button:disabled {
  opacity: 0.55;
  cursor: default;
}

/* Base layout is the phone: every table part is a block, each task a card. */
.cell {
  display: block;
  min-width: 0;
}

.row-task {
  display: block;
  margin-bottom: 10px;
  overflow: hidden;
  border-left: 6px solid var(--color-overdue);
  border-radius: var(--radius-lg);
  background: var(--color-surface-light);
  box-shadow: var(--shadow-card);
}

.row-task.is-full {
  border-left-color: var(--color-good);
}

.c-task {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  padding: 0 0 0 12px;
  background: var(--hp-amber-soft);
}

.task-admin {
  flex: 0 0 100%;
  padding: 0 12px 4px 0;
}

.more-btn {
  flex: none;
  min-width: 44px;
  height: 44px;
  padding: 0 10px;
  color: var(--color-ink);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.task-btn {
  display: block;
  flex: 1 1 0;
  min-width: 0;
  min-height: 44px;
  padding: 10px 0;
  color: var(--color-ink);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  text-align: left;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.c-field {
  display: flex;
  gap: 8px;
  padding: 0 12px;
}

.c-field.blank {
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

.value-btn {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 11px 0;
  color: var(--color-ink);
  font-size: 15px;
  line-height: 1.4;
  text-align: left;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.plus {
  color: var(--color-ink-dim);
  font-family: var(--font-mono);
}

/* Shorter than the other labels' column: at 320px every pixel of it is needed
   to keep "+ Add me", "+ Someone else" and the count on one line. */
.c-who {
  gap: 4px;
  padding-right: 8px;
}

.c-who .lbl {
  flex: none;
}

.who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 4px;
}

/* The button is the 44px target; the pill inside is what you see. */
.chip,
.slot-btn {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 44px;
  padding: 0;
}

.pill,
.slot {
  display: block;
  max-width: 100%;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 14px;
  line-height: 1.3;
  text-align: left;
  overflow-wrap: anywhere;
}

.pill {
  border: 1.5px solid transparent;
  background: var(--color-surface);
  color: var(--color-ink);
}

.pill.mine {
  border-color: var(--color-ink);
  font-weight: 600;
}

.slot {
  padding: 6px;
  border: 1.5px dashed var(--color-ink-dim);
  color: var(--color-ink-dim);
  font-size: 13px;
}

.slot.strong {
  border-color: var(--color-overdue);
  color: var(--color-overdue);
  font-weight: 600;
}

.count-btn {
  min-height: 44px;
  min-width: 44px;
  padding: 0 2px;
  color: var(--color-ink-dim);
  font-family: var(--font-mono);
  font-size: 12px;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  white-space: nowrap;
}

.confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 8px;
  width: 100%;
}

.confirm-q {
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.confirm-btn {
  min-height: 44px;
  padding: 0 10px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: underline;
}

.confirm-btn.danger {
  color: var(--color-overdue);
}

.c-add {
  display: flex;
  flex-wrap: wrap;
  column-gap: 6px;
  padding: 0 12px;
  border-top: 1px solid var(--color-surface);
}

.add-field {
  min-height: 44px;
  padding: 0 6px;
  color: var(--color-ink-dim);
  font-size: 13px;
}

.row-section {
  display: block;
  margin: 12px 0 8px;
}

.row-section:first-child {
  margin-top: 0;
}

.sec-cell {
  padding: 2px 12px;
  border-radius: var(--radius-lg);
  background: var(--hp-amber);
}

.sec-title {
  display: block;
  width: 100%;
  min-height: 44px;
  padding: 10px 0 2px;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
  text-align: left;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.sec-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 12px;
}

.sec-value {
  min-width: 44px;
  min-height: 44px;
  max-width: 100%;
  color: var(--color-ink);
  font-size: 14px;
  text-align: left;
  white-space: pre-line;
  overflow-wrap: anywhere;
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
  .more-btn {
    display: none;
  }

  .c-task {
    display: table-cell;
    padding: 2px 10px;
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
    border-left: 6px solid var(--color-overdue);
    background: var(--hp-amber-soft);
  }

  .row-task.is-full .c-task,
  .row-task.is-full:nth-child(even) .c-task {
    border-left-color: var(--color-good);
  }

  .pill {
    background: var(--color-bg);
  }

  .who {
    column-gap: 6px;
  }

  .slot {
    padding: 6px 12px;
    font-size: 14px;
  }

  .count-btn {
    padding: 0 8px;
  }

  .value-btn {
    display: block;
    width: 100%;
  }

  .sec-cell {
    border-radius: 0;
  }

  .sec-title {
    padding-bottom: 0;
  }

  button:hover .pill,
  .value-btn:hover,
  .task-btn:hover {
    text-decoration: underline;
    text-decoration-thickness: 1px;
  }
}
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { HELPER_LIMITS, cleanName, sameName, suggestNames } from '@/lib/helperPlan'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import HelperAdminSheet from './HelperAdminSheet.vue'

const props = defineProps<{
  rowId: number
}>()

const emit = defineEmits<{ close: [] }>()

const store = useHelperPlanStore()
const draft = ref('')
const busy = ref(false)

// Looked up in the store rather than passed in: each write below has to see the
// row as it stands after the previous one.
const row = computed(() => Object.values(store.rowsByPage).flat().find((r) => r.id === props.rowId) ?? null)
const who = computed(() => row.value?.who ?? [])
const needed = computed(() => row.value?.needed ?? 1)

// Another phone can delete the row while this is open.
watch(row, (current) => {
  if (!current) emit('close')
})

const matches = computed(() =>
  suggestNames(
    store.knownNames.filter((name) => !who.value.some((taken) => sameName(name, taken))),
    draft.value,
    8,
  ),
)

async function run(action: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = true
  await action()
  busy.value = false
}

const setNeeded = (count: number) => run(() => store.setCell(props.rowId, 'needed', String(count)))

// Assigning someone to a full task is a clear wish for one more place.
async function addOne(name: string): Promise<boolean> {
  const before = needed.value
  const bumped = who.value.length >= before
  if (bumped && !(await store.setCell(props.rowId, 'needed', String(who.value.length + 1)))) return false
  if (await store.signUp(props.rowId, name)) return true
  // Only the place still empty can go: someone else may have just taken it.
  const restored = Math.max(before, who.value.length)
  if (bumped && needed.value > restored) await store.setCell(props.rowId, 'needed', String(restored))
  return false
}

function newNames(names: string[]): string[] {
  const seen = [...who.value]
  return names.filter((name) => {
    if (seen.some((other) => sameName(other, name))) return false
    seen.push(name)
    return true
  })
}

const addNames = (names: string[], typed = false) =>
  run(async () => {
    const todo = newNames(names)
    if (typed) draft.value = todo.join(', ')
    for (const [index, name] of todo.entries()) {
      if (!(await addOne(name))) return
      if (typed) draft.value = todo.slice(index + 1).join(', ')
    }
    draft.value = ''
  })

function submit() {
  const names = draft.value.split(/[,\n]+/).map(cleanName).filter(Boolean)
  if (names.length) void addNames(names, true)
}

const confirming = ref<string | null>(null)

const remove = (name: string) =>
  run(async () => {
    await store.removeName(props.rowId, name)
    confirming.value = null
  })
</script>

<template>
  <HelperAdminSheet v-if="row" title="People on this task" :keep-on-backdrop-tap="draft.trim() !== ''" @close="emit('close')">
    <div class="people">
      <p class="task">{{ row.task }}</p>

      <div class="count-row">
        <span class="ha-label">People needed</span>
        <div class="hp-stepper count-stepper">
          <button
            type="button"
            class="ha-btn hp-stepper-btn"
            aria-label="One fewer"
            :disabled="busy || needed <= Math.max(1, who.length)"
            @click="setNeeded(needed - 1)"
          >−</button>
          <output class="hp-stepper-value" aria-live="polite">{{ needed }}</output>
          <button
            type="button"
            class="ha-btn hp-stepper-btn"
            aria-label="One more"
            :disabled="busy || needed >= HELPER_LIMITS.neededMax"
            @click="setNeeded(needed + 1)"
          >+</button>
        </div>
      </div>

      <ul v-if="who.length" class="assigned" aria-label="Assigned people">
        <li v-for="name in who" :key="name" class="person" :class="{ confirming: confirming === name }">
          <template v-if="confirming === name">
            <span class="person-name">Remove {{ name }}?</span>
            <button type="button" class="ha-btn danger" :disabled="busy" @click="remove(name)">Remove</button>
            <button type="button" class="ha-btn" @click="confirming = null">Keep</button>
          </template>
          <template v-else>
            <span class="person-name">{{ name }}</span>
            <button type="button" class="hp-tap remove" :aria-label="`Remove ${name}`" :disabled="busy" @click="confirming = name">×</button>
          </template>
        </li>
      </ul>
      <p v-else class="ha-hint">Nobody yet.</p>

      <form class="add" @submit.prevent="submit">
        <label class="ha-field grow">
          <span class="ha-label">Add people</span>
          <input
            v-model="draft"
            class="ha-input"
            type="text"
            autocomplete="off"
            enterkeyhint="done"
            placeholder="Name, or several with commas"
          />
        </label>
        <button type="submit" class="ha-btn primary" :disabled="busy || !draft.trim()">Add</button>
      </form>

      <ul v-if="matches.length" class="hp-chip-row hp-chips--roomy suggest" aria-label="Names already on the plan">
        <li v-for="name in matches" :key="name">
          <button type="button" class="hp-tap" :disabled="busy" @click="addNames([name])"><span class="hp-chip">{{ name }}</span></button>
        </li>
      </ul>

      <div class="ha-actions">
        <button type="button" class="ha-btn primary" @click="emit('close')">Done</button>
      </div>
    </div>
  </HelperAdminSheet>
</template>

<style scoped>
.people {
  display: flex;
  flex-direction: column;
  gap: var(--hp-3);
}

.task {
  font-weight: 600;
  line-height: 1.3;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.count-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hp-2);
}

.count-stepper {
  flex: 0 0 196px;
}

.people .count-stepper .hp-stepper-btn {
  flex-basis: 56px;
  width: 56px;
  min-height: 48px;
}

.count-stepper .hp-stepper-value {
  min-height: 48px;
  font-size: 22px;
}

.assigned {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hp-1);
  list-style: none;
}

.person {
  display: flex;
  align-items: center;
  max-width: 100%;
  padding-left: var(--hp-3);
  border-radius: var(--hp-r-full);
  background: var(--color-surface-light);
  box-shadow: inset 0 0 0 1px var(--color-border);
  font-size: 15px;
}

.person.confirming {
  flex-wrap: wrap;
  gap: var(--hp-2);
  width: 100%;
  padding: var(--hp-2);
  border-radius: var(--hp-r-m);
}

.person-name {
  min-width: 0;
  overflow-wrap: anywhere;
}

.remove {
  justify-content: center;
  flex: none;
  width: var(--hp-tap);
  height: var(--hp-tap);
  border-radius: var(--hp-r-full);
  color: var(--color-ink);
  font-size: 18px;
  transition: background-color var(--hp-fast) var(--hp-ease);
}

.remove:active:not(:disabled) {
  background: var(--color-border);
}

.add {
  display: flex;
  align-items: flex-end;
  gap: var(--hp-2);
}

.grow {
  flex: 1;
  min-width: 0;
}

.suggest {
  margin-top: calc(var(--hp-1) * -1);
}
</style>

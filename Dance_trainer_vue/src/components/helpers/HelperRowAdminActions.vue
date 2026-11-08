<script setup lang="ts">
import { computed, ref } from 'vue'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import type { HelperRow } from '@/lib/helperPlan'

const SNIPPET_LENGTH = 60

const props = defineProps<{
  row: HelperRow
}>()

const store = useHelperPlanStore()
const confirming = ref(false)
const busy = ref(false)

const siblings = computed(() => store.rowsByPage[props.row.page_id] ?? [])
const index = computed(() => siblings.value.findIndex((r) => r.id === props.row.id))
const label = computed(() => (props.row.type === 'section' ? 'heading' : 'task'))

// Tasks run to 500 characters, and the confirm has to fit a phone-width card.
const snippet = computed(() => {
  const text = props.row.task.replace(/\s+/g, ' ').trim()
  return text.length > SNIPPET_LENGTH ? `${text.slice(0, SNIPPET_LENGTH - 1)}…` : text
})

const consequence = computed(() => {
  if (props.row.type === 'section') return 'The tasks below it stay.'
  const n = props.row.who.length
  if (n === 0) return ''
  return n === 1 ? '1 sign-up goes with it.' : `${n} sign-ups go with it.`
})

async function move(delta: number) {
  if (busy.value) return
  busy.value = true
  await store.moveRow(props.row.id, delta)
  busy.value = false
}

async function remove() {
  if (busy.value) return
  busy.value = true
  const ok = await store.deleteRow(props.row.id)
  busy.value = false
  if (ok) confirming.value = false
}
</script>

<template>
  <!-- .stop: the row around this may open an editor on tap. -->
  <div v-if="store.isAdmin" class="row-admin" @click.stop>
    <template v-if="confirming">
      <p class="question" role="alert">
        Delete {{ label }} <strong>“{{ snippet }}”</strong>? {{ consequence }}
      </p>
      <div class="buttons">
        <button type="button" class="btn" @click="confirming = false">Cancel</button>
        <button type="button" class="btn danger" :disabled="busy" @click="remove">Delete</button>
      </div>
    </template>
    <div v-else class="buttons">
      <button
        type="button"
        class="btn square"
        :aria-label="`Move ${snippet} up`"
        :disabled="index <= 0 || busy"
        @click="move(-1)"
      >↑</button>
      <button
        type="button"
        class="btn square"
        :aria-label="`Move ${snippet} down`"
        :disabled="index === -1 || index === siblings.length - 1 || busy"
        @click="move(1)"
      >↓</button>
      <button type="button" class="btn" :aria-label="`Delete ${snippet}`" @click="confirming = true">Delete</button>
    </div>
  </div>
</template>

<style scoped>
.row-admin {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.question {
  font-size: 14px;
  color: var(--color-ink);
  overflow-wrap: anywhere;
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.btn {
  min-width: 44px;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-light);
  color: var(--color-ink);
  font-size: 14px;
  cursor: pointer;
}

.btn.square {
  width: 44px;
  padding: 0;
  font-size: 18px;
}

.btn.danger {
  border-color: var(--color-overdue);
  background: var(--color-overdue);
  color: #fff;
  font-weight: 600;
}

.btn:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>

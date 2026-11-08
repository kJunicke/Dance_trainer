<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import type { HelperRow } from '@/lib/helperPlan'
import { ROW_REORDER } from '@/lib/useDragReorder'
import HelperDragHandle from './HelperDragHandle.vue'

const SNIPPET_LENGTH = 60

const props = defineProps<{
  row: HelperRow
}>()

const store = useHelperPlanStore()
const reorder = inject(ROW_REORDER)
const confirming = ref(false)
const busy = ref(false)

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
        <button type="button" class="hp-btn hp-btn--small" @click="confirming = false">Cancel</button>
        <button type="button" class="hp-btn hp-btn--danger hp-btn--small" :disabled="busy" @click="remove">Delete</button>
      </div>
    </template>
    <div v-else class="buttons">
      <HelperDragHandle v-if="reorder" :reorder="reorder" :id="row.id" :label="snippet" />
      <button type="button" class="hp-btn hp-btn--small" :aria-label="`Delete ${snippet}`" @click="confirming = true">Delete</button>
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
</style>

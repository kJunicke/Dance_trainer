<script setup lang="ts">
import { computed, ref } from 'vue'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import type { RowType } from '@/lib/helperPlan'

const props = defineProps<{
  pageId: number
  type: RowType
}>()

const emit = defineEmits<{ done: [] }>()

const store = useHelperPlanStore()
const task = ref('')
const when = ref('')
const where = ref('')
const needed = ref<number | ''>(1)
const comment = ref('')
const busy = ref(false)

const isTask = computed(() => props.type === 'task')
const canSave = computed(() => task.value.trim().length > 0 && !busy.value)

function clampedNeeded(): number {
  const n = Math.trunc(Number(needed.value))
  return Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : 1
}

async function submit() {
  if (!canSave.value) return
  busy.value = true
  const ok = await store.addRow(props.pageId, {
    type: props.type,
    task: task.value,
    when: when.value,
    where: isTask.value ? where.value : '',
    needed: isTask.value ? clampedNeeded() : 1,
    comment: comment.value,
  })
  busy.value = false
  if (ok) emit('done')
}
</script>

<template>
  <form class="ha-form" @submit.prevent="submit">
    <label class="ha-field">
      <span class="ha-label">{{ isTask ? 'Task' : 'Heading' }}</span>
      <textarea v-model="task" class="ha-input" maxlength="500" rows="2" />
    </label>
    <label class="ha-field">
      <span class="ha-label">When</span>
      <input v-model="when" class="ha-input" maxlength="100" placeholder="e.g. 17:30–20:00" />
    </label>
    <template v-if="isTask">
      <label class="ha-field">
        <span class="ha-label">Where</span>
        <input v-model="where" class="ha-input" maxlength="200" />
      </label>
      <label class="ha-field">
        <span class="ha-label">How many people?</span>
        <input v-model.number="needed" class="ha-input" type="number" inputmode="numeric" min="1" max="50" />
      </label>
    </template>
    <label class="ha-field">
      <span class="ha-label">Comment</span>
      <textarea v-model="comment" class="ha-input" maxlength="1000" rows="2" />
    </label>
    <div class="ha-actions">
      <button type="submit" class="ha-btn primary" :disabled="!canSave">
        {{ isTask ? 'Add task' : 'Add heading' }}
      </button>
    </div>
  </form>
</template>

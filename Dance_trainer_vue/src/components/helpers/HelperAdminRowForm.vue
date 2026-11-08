<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import { HELPER_LIMITS, type RowType } from '@/lib/helperPlan'

const props = defineProps<{
  pageId: number
  type: RowType
}>()

const emit = defineEmits<{ done: []; dirty: [value: boolean] }>()

const store = useHelperPlanStore()
const task = ref('')
const when = ref('')
const where = ref('')
const needed = ref<number | ''>(1)
const comment = ref('')
const busy = ref(false)

const isTask = computed(() => props.type === 'task')
const page = computed(() => store.pages.find((p) => p.id === props.pageId))
const showWhen = computed(() => page.value?.show_when ?? true)
const showWhere = computed(() => page.value?.show_where ?? true)
const showComment = computed(() => page.value?.show_comment ?? true)
const customColumns = computed(() => page.value?.custom_columns ?? [])
const extra = ref<Record<string, string>>({})
const canSave = computed(() => task.value.trim().length > 0 && !busy.value)
const dirty = computed(
  () =>
    needed.value !== 1 ||
    [task.value, when.value, where.value, comment.value, ...Object.values(extra.value)].some((text) => text.trim()),
)
watch(dirty, (value) => emit('dirty', value))

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
    when: showWhen.value ? when.value : '',
    where: isTask.value && showWhere.value ? where.value : '',
    needed: isTask.value ? clampedNeeded() : 1,
    comment: showComment.value ? comment.value : '',
    extra: extra.value,
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
    <label v-if="showWhen" class="ha-field">
      <span class="ha-label">When</span>
      <input v-model="when" class="ha-input" maxlength="100" placeholder="e.g. 17:30–20:00" />
    </label>
    <template v-if="isTask">
      <label v-if="showWhere" class="ha-field">
        <span class="ha-label">Where</span>
        <input v-model="where" class="ha-input" maxlength="200" />
      </label>
      <label class="ha-field">
        <span class="ha-label">How many people?</span>
        <input v-model.number="needed" class="ha-input" type="number" inputmode="numeric" min="1" max="50" />
      </label>
    </template>
    <label v-if="showComment" class="ha-field">
      <span class="ha-label">Comment</span>
      <textarea v-model="comment" class="ha-input" maxlength="1000" rows="2" />
    </label>
    <label v-for="column in customColumns" :key="column.id" class="ha-field">
      <span class="ha-label">{{ column.name }}</span>
      <textarea v-model="extra[column.id]" class="ha-input" :maxlength="HELPER_LIMITS.extra" rows="2" />
    </label>
    <div class="ha-actions">
      <button type="submit" class="ha-btn primary" :disabled="!canSave">
        {{ isTask ? 'Add task' : 'Add heading' }}
      </button>
    </div>
  </form>
</template>

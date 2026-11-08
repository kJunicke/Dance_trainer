<script setup lang="ts">
import { computed, ref } from 'vue'
import { useHelperPlanStore } from '@/stores/helperPlanStore'

const emit = defineEmits<{ done: [] }>()

const store = useHelperPlanStore()
const title = ref(store.meta.title)
const info = ref(store.meta.info)
const busy = ref(false)

const canSave = computed(() => title.value.trim().length > 0 && !busy.value)

async function submit() {
  if (!canSave.value) return
  busy.value = true
  const ok = await store.setMeta(title.value, info.value)
  busy.value = false
  if (ok) emit('done')
}
</script>

<template>
  <form class="ha-form" @submit.prevent="submit">
    <label class="ha-field">
      <span class="ha-label">Title</span>
      <input v-model="title" class="ha-input" maxlength="200" />
    </label>
    <p class="ha-hint">Printed before the tab name, as in “DanceFest – To Do's FRIDAY”.</p>
    <label class="ha-field">
      <span class="ha-label">Info</span>
      <textarea v-model="info" class="ha-input" maxlength="500" rows="3" />
    </label>
    <div class="ha-actions">
      <button type="submit" class="ha-btn primary" :disabled="!canSave">Save</button>
    </div>
  </form>
</template>

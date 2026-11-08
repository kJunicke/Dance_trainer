<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useHelperPlanStore } from '@/stores/helperPlanStore'

const emit = defineEmits<{ done: [] }>()

const store = useHelperPlanStore()
const pin = ref('')
const busy = ref(false)
const failed = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)

onMounted(() => inputEl.value?.focus())

async function submit() {
  if (!pin.value || busy.value) return
  busy.value = true
  failed.value = false
  const ok = await store.adminLogin(pin.value)
  busy.value = false
  if (ok) {
    emit('done')
    return
  }
  failed.value = true
  await nextTick()
  inputEl.value?.select()
}
</script>

<template>
  <form class="ha-form" @submit.prevent="submit">
    <label class="ha-field">
      <span class="ha-label">Admin PIN</span>
      <input
        ref="inputEl"
        v-model="pin"
        class="ha-input"
        type="password"
        inputmode="text"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        @input="failed = false"
      />
    </label>
    <p v-if="failed" class="ha-error" role="alert">That PIN was not accepted. Check it and try again.</p>
    <div class="ha-actions">
      <button type="submit" class="ha-btn primary" :disabled="!pin || busy">
        {{ busy ? 'Checking…' : 'Log in' }}
      </button>
    </div>
  </form>
</template>

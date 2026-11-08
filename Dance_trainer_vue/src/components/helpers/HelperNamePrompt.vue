<script setup lang="ts">
import { HELPER_LIMITS } from '@/lib/helperPlan'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import HelperCellSheet from './HelperCellSheet.vue'

const emit = defineEmits<{
  close: []
}>()

const store = useHelperPlanStore()

// Captured at open: on the first visit, saving fills guestName, and the sheet
// shouldn't grow a Cancel button in the instant before it closes.
const locked = store.guestName === ''

function save(name: string) {
  store.setGuestName(name)
  emit('close')
}
</script>

<template>
  <HelperCellSheet
    :title="locked ? 'What\'s your name?' : 'Change your name'"
    :context="locked ? 'It goes next to the tasks you take on.' : 'Names already on the plan stay as they are.'"
    kind="input"
    :initial="store.guestName"
    :maxlength="HELPER_LIMITS.name"
    required
    :locked="locked"
    :suggestions="store.knownNames"
    note-taken-name
    :save-label="locked ? 'Continue' : 'Save'"
    @save="save"
    @cancel="emit('close')"
  />
</template>

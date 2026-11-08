<script setup lang="ts">
import { computed, ref } from 'vue'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import { useToastStore } from '@/stores/toastStore'
import { visibleRows } from '@/lib/helperPlan'
import { localToday } from '@/lib/dates'
import type { ExportFormat } from '@/lib/helperSpreadsheet'
import HelperAdminSheet from './HelperAdminSheet.vue'

const props = defineProps<{
  tabName: string
  onlyOpen: boolean
}>()

const emit = defineEmits<{
  close: []
  print: [choice: { allTabs: boolean; onlyOpen: boolean }]
}>()

const FORMATS: ExportFormat[] = ['xlsx', 'ods', 'csv', 'tsv']

const store = useHelperPlanStore()
const toast = useToastStore()
const scope = ref<'tab' | 'all'>('tab')
const onlyOpenChoice = ref(props.onlyOpen)
const exporting = ref<ExportFormat | null>(null)

// A tab with nothing to show is left out of "all tabs" rather than printed as
// an empty page, so with every task covered there may be nothing at all.
const nothingToPrint = computed(
  () =>
    scope.value === 'all' &&
    !store.pages.some((p) => visibleRows(store.rowsByPage[p.id] ?? [], onlyOpenChoice.value).length > 0),
)

function submit() {
  if (nothingToPrint.value) return
  emit('print', { allTabs: scope.value === 'all', onlyOpen: onlyOpenChoice.value })
}

async function download(format: ExportFormat) {
  if (exporting.value) return
  exporting.value = format
  try {
    const { buildExport } = await import('@/lib/helperSpreadsheet')
    const url = URL.createObjectURL(buildExport(format, store.pages, store.rowsByPage))
    const link = document.createElement('a')
    link.href = url
    link.download = `helper-plan-${localToday()}.${format}`
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    toast.show(error instanceof Error ? error.message : 'The export failed.')
  } finally {
    exporting.value = null
  }
}
</script>

<template>
  <HelperAdminSheet title="Print / Export" @close="emit('close')">
    <form class="ha-form" @submit.prevent="submit">
      <div role="radiogroup" aria-label="What to print">
        <label class="ha-choice">
          <input v-model="scope" type="radio" name="helper-print-scope" value="tab" />
          <span>This tab ({{ tabName }})</span>
        </label>
        <label class="ha-choice">
          <input v-model="scope" type="radio" name="helper-print-scope" value="all" />
          <span>All tabs, each on its own page</span>
        </label>
      </div>
      <label class="ha-choice">
        <input v-model="onlyOpenChoice" type="checkbox" />
        <span>Only open tasks</span>
      </label>
      <p v-if="nothingToPrint" class="ha-hint">No tab has anything to print with this filter.</p>
      <button type="submit" class="ha-btn primary" :disabled="nothingToPrint">Print or save as PDF</button>
      <p class="ha-hint">Opens your browser's print dialog. Pick “Save as PDF” there to get a file.</p>
    </form>

    <section class="export">
      <h3 class="ha-label">Download the whole plan</h3>
      <div class="formats">
        <button
          v-for="format in FORMATS"
          :key="format"
          type="button"
          class="ha-btn"
          :disabled="exporting !== null"
          @click="download(format)"
        >.{{ format }}</button>
      </div>
    </section>
  </HelperAdminSheet>
</template>

<style scoped>
.export {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.formats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.formats .ha-btn {
  padding: 0;
}
</style>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import { printSheets } from '@/lib/helperPlan'
import HelperPrintDialog from './HelperPrintDialog.vue'
import HelperPrintSheets from './HelperPrintSheets.vue'

const props = defineProps<{
  activePageId: number | null
  onlyOpen: boolean
}>()

const store = useHelperPlanStore()

const dialogOpen = ref(false)
// Set only between the dialog's Print and `afterprint`. Null means "what Ctrl+P
// should print": the current tab with the current filter.
const chosen = ref<{ allTabs: boolean; onlyOpen: boolean } | null>(null)
const printedAt = ref(new Date())

const activePage = computed(() => store.pages.find((p) => p.id === props.activePageId) ?? null)
const onlyOpenNow = computed(() => chosen.value?.onlyOpen ?? props.onlyOpen)

const sheets = computed(() =>
  printSheets(store.pages, store.rowsByPage, activePage.value, {
    allTabs: chosen.value?.allTabs ?? false,
    onlyOpen: onlyOpenNow.value,
  }),
)

const printedAtLabel = computed(() =>
  printedAt.value.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
)

const signupUrl = `${new URL(import.meta.env.BASE_URL, window.location.origin).href}#/helpers`

function openDialog() {
  printedAt.value = new Date()
  dialogOpen.value = true
}

async function printChoice(choice: { allTabs: boolean; onlyOpen: boolean }) {
  chosen.value = choice
  printedAt.value = new Date()
  dialogOpen.value = false
  await nextTick()
  // Closing the dialog queues a history.back(); let it land before print()
  // blocks the page.
  setTimeout(() => window.print(), 50)
}

// The markup is mounted long before anyone presses Ctrl+P.
function onBeforePrint() {
  printedAt.value = new Date()
}

function onAfterPrint() {
  chosen.value = null
}

// Not every mobile browser fires afterprint. Moving on to another tab or filter
// must still put Ctrl+P back on what is on screen.
watch([() => props.activePageId, () => props.onlyOpen], () => {
  chosen.value = null
})

onMounted(() => {
  window.addEventListener('beforeprint', onBeforePrint)
  window.addEventListener('afterprint', onAfterPrint)
})

onUnmounted(() => {
  window.removeEventListener('beforeprint', onBeforePrint)
  window.removeEventListener('afterprint', onAfterPrint)
})
</script>

<template>
  <div class="helper-print-controls">
    <button type="button" class="print-btn" :disabled="!activePage" @click="openDialog">Print / Export</button>
    <HelperPrintDialog
      v-if="dialogOpen && activePage"
      :active-page="activePage"
      :only-open="onlyOpen"
      :printed-at="printedAtLabel"
      :signup-url="signupUrl"
      @close="dialogOpen = false"
      @print="printChoice"
    />
    <HelperPrintSheets
      :sheets="sheets"
      :plan-title="store.meta.title"
      :printed-at="printedAtLabel"
      :signup-url="signupUrl"
      :only-open="onlyOpenNow"
    />
  </div>
</template>

<style scoped>
.helper-print-controls {
  display: inline-flex;
}

.print-btn {
  min-height: 44px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-light);
  color: var(--color-ink);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.print-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>

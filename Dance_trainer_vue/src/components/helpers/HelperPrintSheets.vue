<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import type { PrintSheet } from '@/lib/helperPlan'
import HelperPrintDocument from './HelperPrintDocument.vue'

defineProps<{
  sheets: PrintSheet[]
  planTitle: string
  printedAt: string
  signupUrl: string
  onlyOpen: boolean
}>()

// @page cannot be put behind a selector, and a <style> block in an SFC stays in
// the document after its component is gone. Declared there, A4 landscape would
// leak into printing every other route, so this one rule lives exactly as long
// as the print markup.
let pageRule: HTMLStyleElement | null = null

onMounted(() => {
  pageRule = document.createElement('style')
  pageRule.textContent = '@page { size: A4 landscape; margin: 10mm; }'
  document.head.append(pageRule)
})

onUnmounted(() => {
  pageRule?.remove()
  pageRule = null
})
</script>

<template>
  <Teleport to="body">
    <HelperPrintDocument v-if="sheets.length" class="helper-print-root" v-bind="$props" />
  </Teleport>
</template>

<!-- Not scoped, and every rule that reaches outside the print root is gated on
     :has(.helper-print-root). The stylesheet outlives this component, the
     markup does not, so other routes print exactly as they did before. -->
<style>
@media screen {
  .helper-print-root {
    display: none !important;
  }
}

@media print {
  /* App.vue clips html/body to the viewport. Left on, only one page prints. */
  html:has(.helper-print-root),
  html:has(.helper-print-root) body {
    height: auto !important;
    overflow: visible !important;
    background: #fff !important;
  }

  /* #app (with the toasts inside it) and every sheet teleported to body. */
  html:has(.helper-print-root) body > :not(.helper-print-root) {
    display: none !important;
  }
}
</style>

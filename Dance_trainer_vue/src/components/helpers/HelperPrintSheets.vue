<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { openPlaces } from '@/lib/helperPlan'
import type { HelperPage, HelperRow } from '@/lib/helperPlan'

const props = defineProps<{
  sheets: { page: HelperPage; rows: HelperRow[] }[]
  planTitle: string
  printedAt: string
  signupUrl: string
  onlyOpen: boolean
}>()

function sheetTitle(page: HelperPage): string {
  return `${props.planTitle} ${page.name}`.trim()
}

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
    <div v-if="sheets.length" class="helper-print-root">
      <section v-for="sheet in sheets" :key="sheet.page.id" class="hp-sheet">
        <table class="hp-table">
          <colgroup>
            <col />
            <col style="width: 11%" />
            <col style="width: 14%" />
            <col style="width: 23%" />
            <col style="width: 20%" />
          </colgroup>
          <thead>
            <tr>
              <th class="hp-title" colspan="5">{{ sheetTitle(sheet.page) }}</th>
            </tr>
            <tr>
              <th>Task</th>
              <th>When</th>
              <th>Where</th>
              <th>Who</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in sheet.rows" :key="row.id">
              <tr v-if="row.type === 'section'" class="hp-section">
                <td class="hp-task">{{ row.task }}</td>
                <td>{{ row.when }}</td>
                <td>{{ row.where }}</td>
                <td colspan="2">{{ row.comment }}</td>
              </tr>
              <tr v-else>
                <td class="hp-task">{{ row.task }}</td>
                <td>{{ row.when }}</td>
                <td>{{ row.where }}</td>
                <td class="hp-who">
                  <div v-if="row.who.length">{{ row.who.join(', ') }}</div>
                  <span v-for="n in openPlaces(row)" :key="n" class="hp-line" />
                </td>
                <td>{{ row.comment }}</td>
              </tr>
            </template>
            <tr v-if="!sheet.rows.length">
              <td colspan="5">{{ onlyOpen ? 'No open tasks.' : 'No tasks yet.' }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td class="hp-foot" colspan="5">As of {{ printedAt }} · Sign up online: {{ signupUrl }}</td>
            </tr>
          </tfoot>
        </table>
      </section>
    </div>
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

  .helper-print-root,
  .helper-print-root * {
    color: #000 !important;
  }

  .helper-print-root {
    display: block;
    background: #fff;
    font-size: 10.5pt;
  }

  .hp-sheet + .hp-sheet {
    break-before: page;
  }

  .hp-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
  }

  .hp-table thead {
    display: table-header-group;
  }

  .hp-table tfoot {
    display: table-footer-group;
  }

  .hp-table tr {
    break-inside: avoid;
  }

  .hp-table th,
  .hp-table td {
    padding: 1.5mm 2mm;
    border: 1px solid #999;
    background: #fff;
    text-align: left;
    vertical-align: top;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }

  .hp-table th {
    background: #f0b429;
    font-size: 12pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .hp-table td.hp-task {
    background: #fbe7b0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* A heading alone at the foot of a page is a label for nothing. */
  .hp-table tr.hp-section {
    break-after: avoid;
  }

  .hp-table tr.hp-section td {
    font-size: 11.5pt;
    font-weight: 700;
  }

  .hp-table tr.hp-section td.hp-task {
    background: #f0b429;
  }

  .hp-table td.hp-who {
    white-space: normal;
  }

  /* Tall enough to actually write a name on. */
  .hp-line {
    display: block;
    height: 7mm;
    border-bottom: 1px solid #000;
  }

  .hp-table th.hp-title {
    padding: 0 0 3mm;
    border: none;
    background: #fff;
    text-align: center;
    font-size: 16pt;
    font-weight: 500;
  }

  .hp-table td.hp-foot {
    padding: 3mm 0 0;
    border: none;
    font-size: 8.5pt;
  }
}
</style>

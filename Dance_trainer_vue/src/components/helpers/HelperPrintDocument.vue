<script setup lang="ts">
import { openPlaces, pageColumnCount } from '@/lib/helperPlan'
import type { HelperPage, PrintSheet } from '@/lib/helperPlan'

// The printed tables. The print target and the dialog's preview both render this,
// so what the preview shows cannot drift from what comes out of the printer.
const props = defineProps<{
  sheets: PrintSheet[]
  planTitle: string
  printedAt: string
  signupUrl: string
  onlyOpen: boolean
}>()

const CUSTOM_COLUMN_PERCENT = 14

// Custom columns take their share from the others, so Task keeps the remainder.
function colWidth(page: HelperPage, percent: number): string {
  const scale = 100 / (100 + CUSTOM_COLUMN_PERCENT * page.custom_columns.length)
  return `width: ${(percent * scale).toFixed(2)}%`
}

// A heading has no Who or Done: its comment spans them.
function headingCommentSpan(page: HelperPage): number {
  return 1 + Number(page.show_done) + Number(page.show_comment)
}

function sheetTitle(page: HelperPage): string {
  return `${props.planTitle} ${page.name}`.trim()
}
</script>

<template>
  <div class="hp-doc">
    <section v-for="sheet in sheets" :key="sheet.page.id" class="hp-sheet">
      <table class="hp-table">
        <colgroup>
          <col />
          <col v-if="sheet.page.show_when" :style="colWidth(sheet.page, 11)" />
          <col v-if="sheet.page.show_where" :style="colWidth(sheet.page, 14)" />
          <col :style="colWidth(sheet.page, 23)" />
          <col v-if="sheet.page.show_done" style="width: 16mm" />
          <col v-if="sheet.page.show_comment" :style="colWidth(sheet.page, 20)" />
          <col v-for="column in sheet.page.custom_columns" :key="column.id" :style="colWidth(sheet.page, CUSTOM_COLUMN_PERCENT)" />
        </colgroup>
        <thead>
          <tr>
            <th class="hp-title" :colspan="pageColumnCount(sheet.page)">{{ sheetTitle(sheet.page) }}</th>
          </tr>
          <tr>
            <th>Task</th>
            <th v-if="sheet.page.show_when">When</th>
            <th v-if="sheet.page.show_where">Where</th>
            <th>Who</th>
            <th v-if="sheet.page.show_done">Done</th>
            <th v-if="sheet.page.show_comment">Comment</th>
            <th v-for="column in sheet.page.custom_columns" :key="column.id">{{ column.name }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in sheet.rows" :key="row.id">
            <tr v-if="row.type === 'section'" class="hp-section">
              <td class="hp-task">{{ row.task }}</td>
              <td v-if="sheet.page.show_when">{{ row.when }}</td>
              <td v-if="sheet.page.show_where">{{ row.where }}</td>
              <td :colspan="headingCommentSpan(sheet.page)">{{ sheet.page.show_comment ? row.comment : '' }}</td>
              <td v-for="column in sheet.page.custom_columns" :key="column.id">{{ row.extra[column.id] }}</td>
            </tr>
            <tr v-else>
              <td class="hp-task">{{ row.task }}</td>
              <td v-if="sheet.page.show_when">{{ row.when }}</td>
              <td v-if="sheet.page.show_where">{{ row.where }}</td>
              <td class="hp-who">
                <div v-if="row.who.length">{{ row.who.join(', ') }}</div>
                <span v-for="n in openPlaces(row)" :key="n" class="hp-line" />
              </td>
              <td v-if="sheet.page.show_done" class="hp-done">{{ row.done ? '✓' : '' }}</td>
              <td v-if="sheet.page.show_comment">{{ row.comment }}</td>
              <td v-for="column in sheet.page.custom_columns" :key="column.id">{{ row.extra[column.id] }}</td>
            </tr>
          </template>
          <tr v-if="!sheet.rows.length">
            <td :colspan="pageColumnCount(sheet.page)">{{ onlyOpen ? 'No open tasks.' : 'No tasks yet.' }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td class="hp-foot" :colspan="pageColumnCount(sheet.page)">As of {{ printedAt }} · Sign up online: {{ signupUrl }}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  </div>
</template>

<!-- Not scoped: the same rules style the teleported print target and the preview.
     Physical units on purpose, the preview lays the page out at real size. -->
<style>
.hp-doc,
.hp-doc * {
  color: #000 !important;
}

.hp-doc {
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

.hp-table td.hp-done {
  text-align: center;
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
</style>

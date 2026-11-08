<script setup lang="ts">
import { computed, ref } from 'vue'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import { useToastStore } from '@/stores/toastStore'
import {
  HELPER_LIMITS,
  countOverLimitCells,
  findTabPage,
  sheetsToTabImports,
  tsvToImportRows,
  type ImportRow,
} from '@/lib/helperPlan'
import type { WorkbookSheet } from '@/lib/helperSpreadsheet'

const MAX_ROWS = HELPER_LIMITS.importRowsPerTab
const MAX_NAMES = HELPER_LIMITS.neededMax
const MAX_TABS = 50

const props = defineProps<{
  pageId: number
  pageName: string
}>()

const emit = defineEmits<{ done: [] }>()

const store = useHelperPlanStore()
const toast = useToastStore()

const text = ref('')
const sectionsFromEmpty = ref(true)
const mode = ref<'append' | 'replace'>('append')
const busy = ref(false)
const failure = ref('')

const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref('')
const flatFile = ref(false)
const workbook = ref<WorkbookSheet[] | null>(null)
const reading = ref(false)
const fileError = ref('')
const scope = ref<'one' | 'all'>('all')
const chosenTab = ref('')
let readToken = 0

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Cleared at once, so picking the same file again after fixing it still fires.
  input.value = ''
  if (!file) return

  const token = ++readToken
  reading.value = true
  fileError.value = ''
  failure.value = ''
  try {
    const { readWorkbook } = await import('@/lib/helperSpreadsheet')
    const sheets = await readWorkbook(file)
    if (token !== readToken) return
    workbook.value = sheets
    fileName.value = file.name
    flatFile.value = /\.(csv|tsv|txt)$/i.test(file.name)
    scope.value = 'all'
    chosenTab.value = ''
  } catch (error) {
    if (token !== readToken) return
    clearFile()
    fileError.value =
      error instanceof Error && error.name === 'SpreadsheetError'
        ? error.message
        : "The file reader couldn't load. Check your connection and try again."
  } finally {
    if (token === readToken) reading.value = false
  }
}

function clearFile() {
  workbook.value = null
  fileName.value = ''
  fileError.value = ''
}

const parsedFile = computed(() =>
  workbook.value
    ? sheetsToTabImports(workbook.value, {
        sectionsFromEmpty: sectionsFromEmpty.value,
        blankTab: flatFile.value ? props.pageName : undefined,
      })
    : null,
)
const fileTabs = computed(() => parsedFile.value?.tabs ?? [])
const showScopeChoice = computed(() => fileTabs.value.length > 1 || (parsedFile.value?.usedTabColumn ?? false))
const selectedTab = computed(
  () => fileTabs.value.find((tab) => tab.name === chosenTab.value) ?? fileTabs.value[0] ?? null,
)

interface Target {
  name: string
  pageId: number | null
  rows: ImportRow[]
  existing: number
}

function existingRows(pageId: number | null): number {
  return pageId === null ? 0 : (store.rowsByPage[pageId]?.length ?? 0)
}

function currentTabTarget(rows: ImportRow[]): Target {
  return { name: props.pageName, pageId: props.pageId, rows, existing: existingRows(props.pageId) }
}

const targets = computed<Target[]>(() => {
  if (!workbook.value) {
    const rows = tsvToImportRows(text.value, { sectionsFromEmpty: sectionsFromEmpty.value })
    return rows.length ? [currentTabTarget(rows)] : []
  }
  if (showScopeChoice.value && scope.value === 'all') {
    // Sheets that land on the same existing tab become one target: as two, the
    // second's replace would wipe the first's rows.
    const merged = new Map<number | string, Target>()
    for (const tab of fileTabs.value) {
      const page = findTabPage(tab.name, store.pages)
      const key = page?.id ?? tab.name
      const known = merged.get(key)
      if (known) known.rows = [...known.rows, ...tab.rows]
      else {
        merged.set(key, {
          name: page?.name ?? tab.name,
          pageId: page?.id ?? null,
          rows: tab.rows,
          existing: existingRows(page?.id ?? null),
        })
      }
    }
    return [...merged.values()]
  }
  return selectedTab.value ? [currentTabTarget(selectedTab.value.rows)] : []
})

function summarize(rows: ImportRow[]): string {
  const headings = rows.filter((row) => row.type === 'section').length
  const tasks = rows.length - headings
  return `${tasks} task${tasks === 1 ? '' : 's'}, ${headings} heading${headings === 1 ? '' : 's'}`
}

const allRows = computed(() => targets.value.flatMap((target) => target.rows))
const preview = computed(() => summarize(allRows.value))
const manyTargets = computed(() => targets.value.length > 1)
const shortened = computed(() => countOverLimitCells(allRows.value))

const oversized = computed(() => targets.value.filter((target) => target.rows.length > MAX_ROWS))
const tooManyTabs = computed(() => targets.value.length > MAX_TABS)
const overfullRow = computed(() => allRows.value.find((row) => row.who.length > MAX_NAMES) ?? null)
const blocked = computed(() => oversized.value.length > 0 || tooManyTabs.value || overfullRow.value !== null)

const canImport = computed(() => allRows.value.length > 0 && !blocked.value && !busy.value && !reading.value)
const nothingInFile = computed(() => workbook.value !== null && fileTabs.value.length === 0)

const replaced = computed(() => targets.value.filter((target) => target.existing > 0))
const replacedCount = computed(() => replaced.value.reduce((sum, target) => sum + target.existing, 0))
const replacedNames = computed(() => replaced.value.map((target) => target.name).join(', '))

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

async function submit() {
  if (!canImport.value) return
  busy.value = true
  failure.value = ''
  // A snapshot: each write below reloads the store, which recomputes `targets`.
  const plan = targets.value.map((target) => ({ ...target }))
  const replace = mode.value === 'replace'
  const finished: string[] = []
  let failedAt: string | null = null

  for (const target of plan) {
    const pageId = target.pageId ?? (await store.addPage(target.name))
    if (pageId === null || !(await store.importRows(pageId, target.rows, replace))) {
      failedAt = target.name
      break
    }
    finished.push(target.name)
  }
  busy.value = false

  if (failedAt) {
    failure.value = finished.length
      ? `Stopped at ${failedAt}. Already imported: ${finished.join(', ')}. Tabs after it were not touched.`
      : `Nothing was imported into ${failedAt}.`
    return
  }
  const count = plan.reduce((sum, target) => sum + target.rows.length, 0)
  const where = plan.length === 1 ? (plan[0]?.name ?? '') : plural(plan.length, 'tab')
  toast.success(`Imported ${plural(count, 'row')} into ${where}`)
  emit('done')
}
</script>

<template>
  <form class="ha-form" @submit.prevent="submit">
    <input ref="fileInput" class="file-input" type="file" hidden @change="onFilePicked" />

    <template v-if="workbook">
      <div class="file-row">
        <p class="file-name">{{ fileName }}</p>
        <button type="button" class="ha-btn" @click="clearFile">Remove</button>
      </div>
    </template>
    <template v-else>
      <div class="ha-field">
        <button type="button" class="ha-btn pick" :disabled="reading" @click="fileInput?.click()">
          {{ reading ? 'Reading the file…' : 'Choose a file' }}
        </button>
        <p class="ha-hint">.xlsx, .ods, .csv or .tsv</p>
      </div>
      <p v-if="fileError" class="ha-error" role="alert">{{ fileError }}</p>
      <label class="ha-field">
        <span class="ha-label">Or paste cells from Numbers or LibreOffice</span>
        <textarea v-model="text" class="ha-input paste" wrap="off" rows="4" placeholder="Paste here…" />
      </label>
      <p class="ha-hint">Columns in this order: Task, When, Where, Who, Comment.</p>
    </template>

    <p v-if="nothingInFile" class="ha-error" role="alert">No tasks found in this file.</p>

    <div v-if="showScopeChoice" role="radiogroup" aria-label="Where the sheets go">
      <label class="ha-choice">
        <input v-model="scope" type="radio" name="helper-import-scope" value="all" />
        <span>All sheets into tabs of the same name</span>
      </label>
      <label class="ha-choice">
        <input v-model="scope" type="radio" name="helper-import-scope" value="one" />
        <span>One sheet into {{ pageName }}</span>
      </label>
      <label v-if="scope === 'one'" class="ha-field">
        <span class="ha-label">Sheet</span>
        <select class="ha-input" :value="selectedTab?.name" @change="chosenTab = ($event.target as HTMLSelectElement).value">
          <option v-for="tab in fileTabs" :key="tab.name" :value="tab.name">
            {{ tab.name }} ({{ plural(tab.rows.length, 'row') }})
          </option>
        </select>
      </label>
    </div>

    <label class="ha-choice">
      <input v-model="sectionsFromEmpty" type="checkbox" />
      <span>Rows without Where and Who become section headings</span>
    </label>

    <div role="radiogroup" aria-label="How to import">
      <label class="ha-choice">
        <input v-model="mode" type="radio" name="helper-import-mode" value="append" />
        <span>Add to the end of {{ manyTargets ? 'each tab' : pageName }}</span>
      </label>
      <label class="ha-choice">
        <input v-model="mode" type="radio" name="helper-import-mode" value="replace" />
        <span>Replace everything on {{ manyTargets ? 'each tab' : pageName }}</span>
      </label>
    </div>

    <p v-if="mode === 'replace'" class="ha-warning" role="alert">
      <template v-if="replacedCount > 0">
        This removes {{ replacedCount === 1 ? 'the 1 existing row' : `all ${replacedCount} existing rows` }} on
        <strong>{{ replacedNames }}</strong>, including their sign-ups.
      </template>
      <template v-else-if="manyTargets">Those tabs have no rows yet, so nothing is lost.</template>
      <template v-else><strong>{{ pageName }}</strong> has no rows yet, so nothing is lost.</template>
    </p>

    <ul v-if="manyTargets" class="preview-list" aria-live="polite">
      <li v-for="target in targets" :key="target.name">
        <strong>{{ target.name }}</strong>: {{ summarize(target.rows) }}{{ target.pageId === null ? ' (new tab)' : '' }}
      </li>
    </ul>
    <p class="preview" aria-live="polite">{{ preview }}</p>
    <p v-if="shortened > 0" class="ha-warning shortened">
      {{ shortened === 1 ? '1 cell is' : `${shortened} cells are` }} longer than the limit and will be shortened.
    </p>

    <p v-for="target in oversized" :key="target.name" class="ha-error" role="alert">
      {{ target.name }} has {{ target.rows.length }} rows; one import can hold at most {{ MAX_ROWS }} per tab. Nothing
      was cut off: split the file and import it in parts.
    </p>
    <p v-if="tooManyTabs" class="ha-error" role="alert">
      That is {{ targets.length }} tabs; one import can create or fill at most {{ MAX_TABS }}.
    </p>
    <p v-if="overfullRow" class="ha-error" role="alert">
      “{{ overfullRow.task.slice(0, 60) }}” lists {{ overfullRow.who.length }} names; a task can hold at most
      {{ MAX_NAMES }}.
    </p>
    <p v-if="failure" class="ha-error" role="alert">{{ failure }}</p>

    <div class="ha-actions">
      <button type="submit" class="ha-btn" :class="mode === 'replace' ? 'danger' : 'primary'" :disabled="!canImport">
        {{ mode === 'replace' ? 'Replace and import' : 'Import' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.pick {
  align-self: flex-start;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.paste {
  font-family: var(--font-mono);
  white-space: pre;
  overflow-x: auto;
}

.preview {
  font-size: 15px;
  font-weight: 600;
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  list-style: none;
  font-size: 14px;
  overflow-wrap: anywhere;
}
</style>

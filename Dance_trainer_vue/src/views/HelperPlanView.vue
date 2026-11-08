<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { countOpen, HELPER_LIMITS, visibleRows, type CellField } from '@/lib/helperPlan'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import HelperTabBar from '@/components/helpers/HelperTabBar.vue'
import HelperRowItem from '@/components/helpers/HelperRowItem.vue'
import HelperCellSheet from '@/components/helpers/HelperCellSheet.vue'
import HelperNamePrompt from '@/components/helpers/HelperNamePrompt.vue'
import HelperAdminBar from '@/components/helpers/HelperAdminBar.vue'
import HelperPrintControls from '@/components/helpers/HelperPrintControls.vue'

const ACTIVE_PAGE_KEY = 'helper-active-page'
const ONLY_OPEN_KEY = 'helper-only-open'

const store = useHelperPlanStore()

function remembered(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private browsing: the tab just won't be remembered.
  }
}

const chosenPageId = ref<number | null>(Number(remembered(ACTIVE_PAGE_KEY)) || null)
const onlyOpen = ref(remembered(ONLY_OPEN_KEY) === '1')
const renaming = ref(false)
const infoOpen = ref(false)

// Falls back to the first tab when the chosen one was deleted under us.
const activePage = computed(
  () => store.pages.find((p) => p.id === chosenPageId.value) ?? store.pages[0] ?? null,
)
const activePageId = computed(() => activePage.value?.id ?? null)
const activeRows = computed(() =>
  activePage.value ? (store.rowsByPage[activePage.value.id] ?? []) : [],
)
const rows = computed(() => visibleRows(activeRows.value, onlyOpen.value))

const openByPage = computed(() => {
  const counts: Record<number, number> = {}
  for (const page of store.pages) counts[page.id] = countOpen(store.rowsByPage[page.id] ?? [])
  return counts
})
const openHere = computed(() => (activePageId.value === null ? 0 : (openByPage.value[activePageId.value] ?? 0)))
const openTotal = computed(() => Object.values(openByPage.value).reduce((a, b) => a + b, 0))

const scroller = ref<HTMLElement | null>(null)
const band = ref<HTMLElement | null>(null)

// Each tab starts at its top, but without pulling the header back into view if
// the reader had already scrolled past it.
function selectPage(id: number) {
  chosenPageId.value = id
  remember(ACTIVE_PAGE_KEY, String(id))
  void nextTick(() => {
    if (!scroller.value || !band.value) return
    const tabsTop = band.value.offsetTop + band.value.offsetHeight
    if (scroller.value.scrollTop > tabsTop) scroller.value.scrollTop = tabsTop
  })
}

function toggleOnlyOpen() {
  onlyOpen.value = !onlyOpen.value
  remember(ONLY_OPEN_KEY, onlyOpen.value ? '1' : '0')
}

// The sheet belongs to the view, not the row: "only open" can remove a row from
// the list the moment someone takes its last place, and the draft has to survive.
interface OpenSheet {
  rowId: number
  field: CellField | 'name'
  context: string
  initial: string
}

const sheet = ref<OpenSheet | null>(null)
const saving = ref(false)

const SHEET_SETUP = {
  task: { title: 'Task', kind: 'textarea', maxlength: HELPER_LIMITS.task },
  when: { title: 'When', kind: 'input', maxlength: HELPER_LIMITS.when },
  where: { title: 'Where', kind: 'textarea', maxlength: HELPER_LIMITS.where },
  comment: { title: 'Comment', kind: 'textarea', maxlength: HELPER_LIMITS.comment },
  needed: { title: 'People needed', kind: 'number', maxlength: undefined },
  name: { title: 'Add a name', kind: 'input', maxlength: HELPER_LIMITS.name },
} as const

const sheetSetup = computed(() => (sheet.value ? SHEET_SETUP[sheet.value.field] : null))

// Read live, unlike the draft: if someone signs up while the stepper is open,
// the lowest allowed number really has moved.
const sheetSignups = computed(() => {
  const id = sheet.value?.rowId
  for (const pageRows of Object.values(store.rowsByPage)) {
    const row = pageRows.find((r) => r.id === id)
    if (row) return row.who.length
  }
  return 0
})

const sheetHint = computed(() => {
  if (sheet.value?.field !== 'needed' || sheetSignups.value === 0) return undefined
  const n = sheetSignups.value
  return `${n} ${n === 1 ? 'person is' : 'people are'} signed up, so it can't go lower.`
})

function rowById(id: number) {
  return activeRows.value.find((r) => r.id === id)
}

function openCell(rowId: number, field: CellField) {
  const row = rowById(rowId)
  if (!row) return
  sheet.value = {
    rowId,
    field,
    context: field === 'task' ? '' : row.task,
    initial: String(row[field]),
  }
}

function openAddName(rowId: number) {
  const row = rowById(rowId)
  if (row) sheet.value = { rowId, field: 'name', context: row.task, initial: '' }
}

async function saveSheet(value: string) {
  const current = sheet.value
  if (!current) return
  if (value === current.initial) {
    sheet.value = null
    return
  }
  saving.value = true
  const ok =
    current.field === 'name'
      ? await store.signUp(current.rowId, value)
      : await store.setCell(current.rowId, current.field, value)
  saving.value = false
  // A refusal keeps the sheet open, so what was typed isn't lost to the toast.
  if (ok) sheet.value = null
}

onMounted(() => {
  void store.load()
  store.startLive()
})
onUnmounted(() => store.stopLive())
</script>

<template>
  <div ref="scroller" class="helper-plan">
    <header class="head">
      <div class="head-bar">
        <RouterLink class="head-link" :to="{ name: 'boards' }">← Dance Trainer</RouterLink>
        <button
          v-if="store.meta.info"
          class="head-link info-toggle"
          type="button"
          :aria-expanded="infoOpen"
          @click="infoOpen = !infoOpen"
        >Info</button>
        <button class="head-link you" type="button" @click="renaming = true">
          <span class="you-name">{{ store.guestName || 'Set your name' }}</span>
          <span class="you-change">Change</span>
        </button>
      </div>
      <h1 class="title">{{ store.meta.title }}</h1>
      <p v-if="store.meta.info" class="info" :class="{ open: infoOpen }">{{ store.meta.info }}</p>
    </header>

    <div ref="band" class="band" :class="{ done: store.pages.length > 0 && openTotal === 0 }">
      <p class="band-text">
        <template v-if="store.pages.length === 0">Who's doing what</template>
        <template v-else-if="openTotal === 0">
          <span class="band-short">All covered!</span>
          <span class="band-long">Everything is covered. Thank you!</span>
        </template>
        <template v-else>
          <span class="band-short">{{ openHere }} open · {{ openTotal }} overall</span>
          <span class="band-long">{{ openHere }} open on {{ activePage?.name }} · {{ openTotal }} open overall</span>
        </template>
      </p>
      <button class="toggle" type="button" :aria-pressed="onlyOpen" @click="toggleOnlyOpen">Only open</button>
      <HelperPrintControls :active-page-id="activePageId" :only-open="onlyOpen" />
    </div>

    <div class="sticky">
      <HelperTabBar
        :pages="store.pages"
        :active-id="activePageId"
        :open-by-page="openByPage"
        @select="selectPage"
      />
    </div>

    <HelperAdminBar v-if="store.isAdmin" :active-page-id="activePageId" @select-page="selectPage" />

    <main class="body">
      <p v-if="store.loadFailed && store.pages.length" class="status stale">
        Can't reach the plan right now. What you see may be out of date.
      </p>

      <p v-if="store.loading" class="status"><LoadingSpinner :size="14" /> Loading the plan…</p>
      <div v-else-if="store.loadFailed && !store.pages.length" class="status column">
        <p>The plan didn't load. Check your connection and try again.</p>
        <button class="retry" type="button" @click="store.load()">Try again</button>
      </div>
      <p v-else-if="!activePage" class="status">The team hasn't added any tabs yet.</p>
      <p v-else-if="rows.length === 0" class="status">
        {{ onlyOpen && activeRows.length ? 'Nothing open on this tab. Every task has enough people.' : 'No tasks on this tab yet.' }}
      </p>

      <template v-else>
        <p class="tap-hint">Tap any field to change it.</p>
        <table class="plan">
          <thead>
            <tr>
              <th class="th-task">Task</th>
              <th class="th-when">When</th>
              <th class="th-where">Where</th>
              <th class="th-who">Who</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            <HelperRowItem
              v-for="row in rows"
              :key="row.id"
              :row="row"
              @edit="openCell(row.id, $event)"
              @add-name="openAddName(row.id)"
            />
          </tbody>
        </table>
      </template>

      <HelperAdminBar v-if="!store.isAdmin" :active-page-id="activePageId" @select-page="selectPage" />
    </main>

    <HelperCellSheet
      v-if="sheet && sheetSetup"
      :key="`${sheet.rowId}-${sheet.field}`"
      :title="sheetSetup.title"
      :context="sheet.context"
      :kind="sheetSetup.kind"
      :initial="sheet.initial"
      :maxlength="sheetSetup.maxlength"
      :min="sheet.field === 'needed' ? sheetSignups : undefined"
      :max="HELPER_LIMITS.neededMax"
      :required="sheet.field === 'task' || sheet.field === 'name'"
      :hint="sheetHint"
      :save-label="sheet.field === 'name' ? 'Add' : 'Save'"
      :busy="saving"
      @save="saveSheet"
      @cancel="sheet = null"
    />

    <HelperNamePrompt v-if="!store.guestName || renaming" @close="renaming = false" />
  </div>
</template>

<style scoped>
.helper-plan {
  --hp-amber: #f0b429;
  --hp-amber-soft: #fbe7b0;

  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: var(--color-bg);
}

.head {
  padding: 0 12px 4px;
  background: var(--hp-amber);
  color: var(--color-ink);
}

.head-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.head-link {
  display: inline-flex;
  align-items: center;
  flex: none;
  gap: 6px;
  min-height: 44px;
  border: none;
  background: transparent;
  color: var(--color-ink);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

/* Only the name gives way: at 40 characters it would otherwise squeeze the
   link beside it. */
.head-link.you {
  flex: 0 1 auto;
  min-width: 0;
  margin-left: auto;
}

.you-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.you-change {
  flex: none;
  font-weight: 400;
  text-decoration: underline;
}

.title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}

.info-toggle {
  min-width: 44px;
  justify-content: center;
  text-decoration: underline;
}

.info {
  display: none;
  padding-bottom: 6px;
  font-size: 15px;
  line-height: 1.35;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.info.open {
  display: block;
}

/* The wristband: one dark strip with what's still needed and what to do about it. */
.band {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 12px;
  background: var(--color-ink);
  color: var(--hp-amber-soft);
}

.band-text {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.band-long {
  display: none;
}

.band.done {
  background: var(--color-good);
  color: var(--color-text-on-ember);
}

.sticky {
  position: sticky;
  top: 0;
  z-index: 5;
}

.toggle {
  flex: none;
  min-height: 44px;
  padding: 0 8px;
  border: 1px solid currentColor;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  touch-action: manipulation;
}

.toggle[aria-pressed='true'] {
  background: var(--hp-amber-soft);
  color: var(--color-ink);
}

.body {
  max-width: 1200px;
  margin: 0 auto;
  padding: 6px 12px calc(32px + env(safe-area-inset-bottom));
}

.tap-hint {
  margin-bottom: 4px;
  color: var(--color-ink-dim);
  font-size: 12px;
  line-height: 16px;
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  color: var(--color-ink-dim);
  font-size: 15px;
}

.status.column {
  flex-direction: column;
  align-items: flex-start;
}

.status.stale {
  padding: 0 0 10px;
  color: var(--color-overdue);
  font-size: 13px;
}

.retry {
  min-height: 44px;
  padding: 0 16px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-ember);
  color: var(--color-text-on-ember);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.plan,
.plan tbody {
  display: block;
}

.plan thead {
  display: none;
}

@media (min-width: 760px) {
  .head {
    padding: 8px 24px 20px;
  }

  .head-bar {
    margin-bottom: 4px;
  }

  .title {
    font-size: 48px;
  }

  .info,
  .info.open {
    display: block;
    margin-top: 8px;
  }

  .info-toggle {
    display: none;
  }

  .band {
    padding: 6px 24px;
    gap: 10px;
  }

  .band-text {
    font-size: 13px;
  }

  .band-short {
    display: none;
  }

  .band-long {
    display: inline;
  }

  .body {
    padding: 14px 24px 40px;
  }

  .plan {
    display: table;
    width: 100%;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface-light);
  }

  .plan thead {
    display: table-header-group;
  }

  .plan tbody {
    display: table-row-group;
  }

  .plan th {
    padding: 10px;
    background: var(--hp-amber);
    color: var(--color-ink);
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    text-align: left;
  }

  .th-task {
    width: 32%;
  }

  .th-when {
    width: 11%;
  }

  .th-where {
    width: 15%;
  }

  .th-who {
    width: 24%;
  }
}
</style>

<!-- Not scoped: the toast stack lives in App.vue, outside this view. Keyed on a
     class only helper sheets carry, so toasts everywhere else stay at the bottom.
     While a sheet is open the toast sits above it, one at a time and of bounded
     height, and a sheet tall enough to reach it shrinks out of its way. -->
<style>
html:has(.helper-sheet-backdrop) .toast-stack {
  top: calc(8px + env(safe-area-inset-top));
  bottom: auto;
}

html:has(.helper-sheet-backdrop) .toast-stack .toast:not(:last-child) {
  display: none;
}

html:has(.helper-sheet-backdrop) .toast-stack .toast {
  max-height: 96px;
  overflow-y: auto;
}

html:has(.toast-stack .toast) .helper-sheet-backdrop {
  padding-top: calc(112px + env(safe-area-inset-top));
}
</style>

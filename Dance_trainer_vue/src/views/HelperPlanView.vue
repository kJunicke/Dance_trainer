<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import {
  countOpen,
  extraColumnId,
  HELPER_LIMITS,
  isExtraField,
  myRows,
  visibleRows,
  type EditField,
} from '@/lib/helperPlan'
import { isRoomName } from '@/lib/helperBoards'
import { ROW_REORDER, useDragReorder } from '@/lib/useDragReorder'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import { useToastStore } from '@/stores/toastStore'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import HelperTabBar from '@/components/helpers/HelperTabBar.vue'
import HelperRowItem from '@/components/helpers/HelperRowItem.vue'
import HelperCellSheet from '@/components/helpers/HelperCellSheet.vue'
import HelperNamePrompt from '@/components/helpers/HelperNamePrompt.vue'
import HelperAdminBar from '@/components/helpers/HelperAdminBar.vue'
import HelperPrintControls from '@/components/helpers/HelperPrintControls.vue'
import HelperTimelineView from '@/components/helpers/HelperTimelineView.vue'
import HelperRoomsView from '@/components/helpers/HelperRoomsView.vue'
import HelperPeopleSheet from '@/components/helpers/HelperPeopleSheet.vue'
import HelperDragOverlay from '@/components/helpers/HelperDragOverlay.vue'
import '@/assets/helperUi.css'

const ACTIVE_PAGE_KEY = 'helper-active-page'
const ONLY_OPEN_KEY = 'helper-only-open'
const VIEW_KEY = 'helper-view'

const store = useHelperPlanStore()
const toast = useToastStore()

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
type PlanFilter = 'all' | 'open' | 'mine'
const storedFilter = remembered(ONLY_OPEN_KEY)
const filter = ref<PlanFilter>(storedFilter === '1' ? 'open' : storedFilter === 'mine' ? 'mine' : 'all')
const onlyOpen = computed(() => filter.value === 'open')
type PlanView = 'list' | 'time' | 'rooms'
const VIEWS: { id: PlanView; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'time', label: 'Timeline' },
  { id: 'rooms', label: 'Rooms' },
]
const storedView = remembered(VIEW_KEY)
const chosenView = ref<PlanView>(storedView === 'time' || storedView === 'rooms' ? storedView : 'list')
function chooseView(view: PlanView) {
  chosenView.value = view
  remember(VIEW_KEY, view)
}
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
// Timeline needs When and Rooms needs Where. The choice is kept, so the next tab
// that has the column goes back to it.
const availableViews = computed(() =>
  VIEWS.filter(
    (view) =>
      (view.id !== 'time' || activePage.value?.show_when) && (view.id !== 'rooms' || activePage.value?.show_where),
  ),
)
const planView = computed<PlanView>(() =>
  availableViews.value.some((view) => view.id === chosenView.value) ? chosenView.value : 'list',
)
const rows = computed(() =>
  filter.value === 'mine' ? myRows(activeRows.value, store.guestName) : visibleRows(activeRows.value, onlyOpen.value),
)

const openByPage = computed(() => {
  const counts: Record<number, number> = {}
  for (const page of store.pages) counts[page.id] = countOpen(store.rowsByPage[page.id] ?? [])
  return counts
})
const openHere = computed(() => (activePageId.value === null ? 0 : (openByPage.value[activePageId.value] ?? 0)))
const openTotal = computed(() => Object.values(openByPage.value).reduce((a, b) => a + b, 0))

const mineByPage = computed(() => {
  const counts: Record<number, number> = {}
  for (const page of store.pages) {
    counts[page.id] = myRows(store.rowsByPage[page.id] ?? [], store.guestName).filter((r) => r.type === 'task').length
  }
  return counts
})
const mineHere = computed(() => (activePageId.value === null ? 0 : (mineByPage.value[activePageId.value] ?? 0)))
const mineTotal = computed(() => Object.values(mineByPage.value).reduce((a, b) => a + b, 0))

const emptyMessage = computed(() => {
  if (filter.value === 'mine') {
    return mineTotal.value ? 'None of your tasks are on this tab.' : "You haven't taken on any tasks yet."
  }
  return onlyOpen.value && activeRows.value.length
    ? 'Nothing open on this tab. Every task has enough people.'
    : 'No tasks on this tab yet.'
})

const rowList = ref<HTMLElement | null>(null)
const rowReorder = useDragReorder({
  list: () => rowList.value,
  ids: () => activeRows.value.map((row) => row.id),
  move: store.moveRow,
})
provide(ROW_REORDER, rowReorder)

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

function toggleFilter(choice: 'open' | 'mine') {
  filter.value = filter.value === choice ? 'all' : choice
  remember(ONLY_OPEN_KEY, filter.value === 'open' ? '1' : filter.value === 'mine' ? 'mine' : '0')
}

// The sheet belongs to the view, not the row: "only open" can remove a row from
// the list the moment someone takes its last place, and the draft has to survive.
interface OpenSheet {
  rowId: number
  field: Exclude<EditField, 'needed'>
  context: string
  initial: string
  // A custom column's name, fixed when the sheet opens.
  title?: string
  // Where in a When cell the tapped time sits, when it came from the timeline.
  occurrence?: number
}

const sheet = ref<OpenSheet | null>(null)
const saving = ref(false)

const SHEET_SETUP = {
  task: { title: 'Task', kind: 'textarea', maxlength: HELPER_LIMITS.task },
  when: { title: 'When', kind: 'time', maxlength: HELPER_LIMITS.when },
  where: { title: 'Where', kind: 'textarea', maxlength: HELPER_LIMITS.where },
  comment: { title: 'Comment', kind: 'textarea', maxlength: HELPER_LIMITS.comment },
} as const

const sheetSetup = computed(() => {
  const current = sheet.value
  if (!current) return null
  if (isExtraField(current.field)) {
    return { title: current.title ?? 'Column', kind: 'textarea' as const, maxlength: HELPER_LIMITS.extra }
  }
  return SHEET_SETUP[current.field]
})

function rowById(id: number) {
  return activeRows.value.find((r) => r.id === id)
}

// Another phone can delete the row or the column while the sheet is open.
const sheetTargetGone = computed(() => {
  const current = sheet.value
  if (!current) return null
  const row = store.rowById(current.rowId)
  if (!row) return 'task'
  if (!isExtraField(current.field)) return null
  const id = extraColumnId(current.field)
  return store.pages.find((page) => page.id === row.page_id)?.custom_columns.some((column) => column.id === id)
    ? null
    : 'column'
})

watch(sheetTargetGone, (gone) => {
  if (!gone) return
  sheet.value = null
  toast.show(`Someone deleted this ${gone} while you were editing it.`)
})

const peopleRowId = ref<number | null>(null)

// A room exists through the tasks in it, so a new one is only held here until
// the first task is moved in.
const extraRooms = ref<string[]>([])
const addingRoom = ref(false)

function addRoom(name: string) {
  if (!isRoomName(name)) {
    toast.show("A room name can't contain a comma or brackets: a cell would read it as several rooms or a note.")
    return
  }
  extraRooms.value.push(name)
  addingRoom.value = false
}

function openCell(rowId: number, field: EditField, occurrence?: number) {
  if (field === 'needed') {
    peopleRowId.value = rowId
    return
  }
  const row = rowById(rowId)
  if (!row) return
  if (isExtraField(field)) {
    const id = extraColumnId(field)
    const title = activePage.value?.custom_columns.find((column) => column.id === id)?.name
    sheet.value = { rowId, field, context: row.task, initial: row.extra[id] ?? '', title }
    return
  }
  sheet.value = {
    rowId,
    field,
    context: field === 'task' ? '' : row.task,
    initial: row[field],
    occurrence,
  }
}

async function saveSheet(value: string) {
  const current = sheet.value
  if (!current) return
  if (value === current.initial) {
    sheet.value = null
    return
  }
  saving.value = true
  const ok = isExtraField(current.field)
    ? await store.setExtra(current.rowId, extraColumnId(current.field), value)
    : await store.setCell(current.rowId, current.field, value)
  saving.value = false
  // A refusal keeps the sheet open, so what was typed isn't lost to the toast.
  if (ok && sheet.value === current) sheet.value = null
}

// iOS Safari only applies :active once something on the page listens for touches.
function noop() {}

onMounted(() => {
  void store.load()
  store.startLive()
  document.addEventListener('touchstart', noop, { passive: true })
})
onUnmounted(() => {
  store.stopLive()
  document.removeEventListener('touchstart', noop)
})
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
    <div class="hp-perf head-perf" aria-hidden="true" />

    <div ref="band" class="band" :class="{ done: store.pages.length > 0 && openTotal === 0 }">
      <p class="band-text">
        <template v-if="store.pages.length === 0">Who's doing what</template>
        <template v-else-if="openTotal === 0">
          <span class="band-short">All covered!</span>
          <span class="band-long">Everything is covered. Thank you!</span>
        </template>
        <template v-else-if="filter === 'mine'">
          <span class="band-short"><b class="band-num">{{ mineTotal }}</b> yours</span>
          <span class="band-long">{{ mineHere }} of your tasks on {{ activePage?.name }} · {{ mineTotal }} overall</span>
        </template>
        <template v-else>
          <span class="band-short"><b class="band-num">{{ openHere }}</b> open</span>
          <span class="band-long">{{ openHere }} open on {{ activePage?.name }} · {{ openTotal }} open overall</span>
        </template>
      </p>
      <button class="toggle hp-btn hp-btn--dark hp-btn--small" type="button" :aria-pressed="filter === 'open'" aria-label="Only open tasks" @click="toggleFilter('open')">
        <span class="band-short">Open</span><span class="band-long">Only open</span>
      </button>
      <button class="toggle hp-btn hp-btn--dark hp-btn--small" type="button" :aria-pressed="filter === 'mine'" aria-label="Only my tasks" @click="toggleFilter('mine')">
        <span class="band-short">Mine</span><span class="band-long">Only mine</span>
      </button>
      <HelperPrintControls :active-page-id="activePageId" :only-open="onlyOpen" />
    </div>

    <div class="sticky">
      <HelperTabBar
        :pages="store.pages"
        :active-id="activePageId"
        :open-by-page="filter === 'mine' ? mineByPage : openByPage"
        :badge-word="filter === 'mine' ? 'yours' : 'open'"
        @select="selectPage"
      />
    </div>

    <HelperAdminBar v-if="store.isAdmin" :active-page-id="activePageId" @select-page="selectPage" />

    <main class="body">
      <p v-if="store.loadFailed && store.pages.length" class="status stale">
        Can't reach the plan right now. What you see may be out of date.
      </p>

      <div v-if="activePage && availableViews.length > 1" class="view-switch" role="group" aria-label="How to show this tab">
        <button
          v-for="view in availableViews"
          :key="view.id"
          type="button"
          class="view-btn"
          :aria-pressed="planView === view.id"
          @click="chooseView(view.id)"
        >{{ view.label }}</button>
      </div>

      <p v-if="store.loading" class="status"><LoadingSpinner :size="14" /> Loading the plan…</p>
      <div v-else-if="store.loadFailed && !store.pages.length" class="status column">
        <p>The plan didn't load. Check your connection and try again.</p>
        <button class="hp-btn hp-btn--primary" type="button" @click="store.load()">Try again</button>
      </div>
      <p v-else-if="!activePage" class="status empty">The team hasn't added any tabs yet.</p>
      <p v-else-if="rows.length === 0" class="status empty">
        {{ emptyMessage }}
      </p>

      <HelperTimelineView
        v-else-if="planView === 'time'"
        :rows="rows"
        :scroller="scroller"
        @edit="(rowId, occurrence) => openCell(rowId, 'when', occurrence)"
      />
      <HelperRoomsView
        v-else-if="planView === 'rooms'"
        :rows="rows"
        :scroller="scroller"
        :extra-rooms="extraRooms"
        @edit="openCell($event, 'where')"
        @add-room="addingRoom = true"
      />
      <template v-else>
        <p class="tap-hint hp-hint">Tap any field to change it.</p>
        <div class="plan-scroll">
          <table
            class="plan"
            :class="{ 'has-custom': activePage.custom_columns.length > 0 }"
            :style="{ '--custom-columns': activePage.custom_columns.length }"
          >
            <thead>
              <tr>
                <th class="th-task">Task</th>
                <th v-if="activePage.show_when" class="th-when">When</th>
                <th v-if="activePage.show_where" class="th-where">Where</th>
                <th class="th-who">Who</th>
                <th v-if="activePage.show_done" class="th-done">Done</th>
                <th v-if="activePage.show_comment">Comment</th>
                <th v-for="column in activePage.custom_columns" :key="column.id">{{ column.name }}</th>
              </tr>
            </thead>
            <tbody ref="rowList">
              <HelperRowItem
                v-for="row in rows"
                :key="row.id"
                :row="row"
                :page="activePage"
                @edit="openCell(row.id, $event)"
                @add-name="peopleRowId = row.id"
              />
            </tbody>
          </table>
        </div>
        <HelperDragOverlay :reorder="rowReorder" />
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
      :required="sheet.field === 'task'"
      :suggestions="sheet.field === 'where' ? store.knownRooms : undefined"
      :suggest-by-part="sheet.field === 'where'"
      :presets="sheet.field === 'when' ? store.commonTimes : undefined"
      :occurrence="sheet.occurrence"
      :rows="sheet.field === 'where' ? 2 : undefined"
      :busy="saving"
      @save="saveSheet"
      @cancel="sheet = null"
    />

    <HelperCellSheet
      v-if="addingRoom"
      title="New room"
      context="Then move tasks into it."
      kind="input"
      initial=""
      :maxlength="HELPER_LIMITS.where"
      required
      save-label="Add"
      @save="addRoom"
      @cancel="addingRoom = false"
    />

    <HelperPeopleSheet v-if="peopleRowId !== null" :row-id="peopleRowId" @close="peopleRowId = null" />

    <HelperNamePrompt v-if="!store.guestName || renaming" @close="renaming = false" />
  </div>
</template>

<style scoped>
.helper-plan {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: var(--color-bg);
}

.head {
  padding: 0 var(--hp-3) var(--hp-1);
  background: var(--hp-amber);
  color: var(--color-ink);
}

.head :focus-visible {
  outline-color: var(--color-ink);
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
  min-height: var(--hp-tap);
  border: none;
  background: transparent;
  color: var(--color-ink);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  touch-action: manipulation;
  transition: opacity var(--hp-fast) var(--hp-ease);
}

.head-link:active {
  opacity: 0.6;
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
  text-underline-offset: 2px;
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
  min-width: var(--hp-tap);
  justify-content: center;
  text-decoration: underline;
  text-underline-offset: 2px;
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

/* Tears off the amber into the band below it. */
.head-perf {
  background-color: var(--color-ink);
}

.helper-plan:has(.band.done) .head-perf {
  background-color: var(--color-good);
}

/* The wristband: one dark strip with what's still needed and what to do about it. */
.band {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px var(--hp-3) 6px;
  background: var(--color-ink);
  color: var(--hp-amber-soft);
}

.band :focus-visible {
  outline-color: var(--hp-amber);
}

.band-text {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.band-num {
  color: var(--hp-amber);
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.band-long {
  display: none;
}

.band.done {
  background: var(--color-good);
  color: var(--color-text-on-ember);
}

.band.done :focus-visible {
  outline-color: var(--color-text-on-ember);
}

.band.done .band-num {
  color: inherit;
}

.band.done .toggle {
  border-color: var(--color-text-on-ember);
  color: var(--color-text-on-ember);
}

.band.done .toggle[aria-pressed='true'] {
  background: var(--color-text-on-ember);
  color: var(--hp-amber-soft);
}

.toggle {
  flex: none;
  white-space: nowrap;
}

/* The print button belongs to the print builder's component; only its colours are
   taken over here, so the band reads as one set of controls. */
.band :deep(.print-btn) {
  padding: 0 var(--hp-2);
  border-color: rgba(251, 231, 176, 0.45);
  border-radius: var(--hp-r-m);
  background: transparent;
  color: var(--hp-amber-soft);
  touch-action: manipulation;
  transition: background-color var(--hp-fast) var(--hp-ease);
}

.band :deep(.print-btn:active:not(:disabled)) {
  background: rgba(251, 231, 176, 0.16);
}

.band.done :deep(.print-btn) {
  border-color: var(--color-text-on-ember);
  color: var(--color-text-on-ember);
}

.sticky {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--color-bg);
  box-shadow: 0 1px 0 var(--color-border), 0 3px 8px rgba(70, 55, 40, 0.06);
}

.body {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--hp-2) var(--hp-3) calc(32px + env(safe-area-inset-bottom));
}

.view-switch {
  display: grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  gap: 2px;
  max-width: 420px;
  margin-bottom: var(--hp-2);
  padding: 3px;
  border-radius: var(--hp-r-m);
  background: var(--color-surface);
  box-shadow: inset 0 0 0 1px var(--color-border);
}

.view-btn {
  min-height: var(--hp-tap);
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--color-ink);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
  transition:
    background-color var(--hp-fast) var(--hp-ease),
    color var(--hp-fast) var(--hp-ease),
    transform var(--hp-fast) var(--hp-ease);
}

.view-btn:active {
  transform: scale(0.97);
}

.view-btn[aria-pressed='true'] {
  background: var(--color-ink);
  color: var(--hp-amber-soft);
}

.tap-hint {
  margin-bottom: var(--hp-1);
}

.status {
  display: flex;
  align-items: center;
  gap: var(--hp-2);
  padding: var(--hp-3) 0;
  color: var(--color-ink-dim);
  font-size: 15px;
}

.status.empty {
  justify-content: center;
  margin-top: var(--hp-1);
  padding: var(--hp-6) var(--hp-4);
  border: 1.5px dashed var(--color-ink-dim);
  border-radius: var(--hp-r-m);
  color: var(--color-ink);
  text-align: center;
}

.status.column {
  flex-direction: column;
  align-items: flex-start;
  gap: var(--hp-3);
}

.status.stale {
  margin-bottom: var(--hp-2);
  padding: var(--hp-2) 10px;
  border-left: 4px solid var(--color-overdue);
  border-radius: var(--hp-r-s);
  background: color-mix(in srgb, var(--color-overdue) 10%, var(--color-surface-light));
  color: var(--color-ink);
  font-size: 13px;
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
    padding: var(--hp-2) var(--hp-6) 20px;
  }

  .head-bar {
    margin-bottom: var(--hp-1);
  }

  .title {
    font-size: 48px;
  }

  .info,
  .info.open {
    display: block;
    margin-top: var(--hp-2);
  }

  .info-toggle {
    display: none;
  }

  .band {
    padding: var(--hp-2) var(--hp-6) 10px;
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
    padding: 14px var(--hp-6) 40px;
  }

  .plan-scroll {
    overflow-x: auto;
  }

  /* Past a few custom columns the table scrolls sideways rather than crushing them. */
  .plan.has-custom {
    min-width: calc(760px + var(--custom-columns) * 140px);
  }

  .plan {
    display: table;
    width: 100%;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--hp-r-m);
    background: var(--color-surface-light);
    box-shadow: var(--shadow-card);
  }

  .plan thead {
    display: table-header-group;
  }

  .plan tbody {
    display: table-row-group;
  }

  .plan th {
    padding: 10px;
    background: var(--color-ink);
    color: var(--hp-amber-soft);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-align: left;
    text-transform: uppercase;
    overflow-wrap: anywhere;
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

  .th-done {
    width: 72px;
    text-align: center;
  }

  .has-custom .th-task {
    width: auto;
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

/* Keyed on the drag ghost, which only exists mid-drag: a toast over a drop target
   would swallow the drop. They come back when the finger lifts. */
html:has(.hp-ghost) .toast-stack .toast {
  opacity: 0;
  pointer-events: none;
}
</style>

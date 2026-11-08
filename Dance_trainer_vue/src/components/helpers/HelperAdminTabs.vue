<script setup lang="ts">
import { ref } from 'vue'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import { HELPER_LIMITS, type CustomColumn, type HelperPage, type ToggleColumn } from '@/lib/helperPlan'
import { useDragReorder } from '@/lib/useDragReorder'
import HelperDragHandle from './HelperDragHandle.vue'
import HelperDragOverlay from './HelperDragOverlay.vue'

const props = defineProps<{
  activePageId: number | null
}>()

const emit = defineEmits<{ 'select-page': [id: number] }>()

const store = useHelperPlanStore()
const busy = ref(false)
// One tab at a time is being renamed or confirmed, so the list stays short
// enough to scan at 320px.
const editing = ref<{ id: number; kind: 'rename' | 'delete' } | null>(null)
const renameText = ref('')
const newName = ref('')
// One tab's columns are open at a time, for the same reason.
const columnsOpenId = ref<number | null>(null)
const confirmingColumn = ref<string | null>(null)
const newColumn = ref('')

const TOGGLES: { column: ToggleColumn; label: string; flag: 'show_when' | 'show_where' | 'show_done' | 'show_comment' }[] = [
  { column: 'when', label: 'When', flag: 'show_when' },
  { column: 'where', label: 'Where', flag: 'show_where' },
  { column: 'done', label: 'Done', flag: 'show_done' },
  { column: 'comment', label: 'Comment', flag: 'show_comment' },
]

const tabList = ref<HTMLElement | null>(null)
const tabReorder = useDragReorder({
  list: () => tabList.value,
  ids: () => store.pages.map((page) => page.id),
  move: store.movePage,
})

function toggleColumnsOpen(page: HelperPage) {
  columnsOpenId.value = columnsOpenId.value === page.id ? null : page.id
  confirmingColumn.value = null
  newColumn.value = ''
}

function shownCount(page: HelperPage): number {
  return TOGGLES.filter(({ flag }) => page[flag]).length + page.custom_columns.length
}

function columnValues(page: HelperPage, column: CustomColumn): number {
  return (store.rowsByPage[page.id] ?? []).filter((row) => row.extra[column.id]).length
}

function rowCount(id: number): number {
  return store.rowsByPage[id]?.length ?? 0
}

function rowsLabel(n: number): string {
  return `${n} row${n === 1 ? '' : 's'}`
}

async function run(action: () => Promise<boolean>): Promise<boolean> {
  if (busy.value) return false
  busy.value = true
  const ok = await action()
  busy.value = false
  return ok
}

function startRename(page: HelperPage) {
  renameText.value = page.name
  editing.value = { id: page.id, kind: 'rename' }
}

async function saveRename(page: HelperPage) {
  const name = renameText.value.trim()
  if (!name) return
  if (name === page.name || (await run(() => store.renamePage(page.id, name)))) editing.value = null
}

async function confirmDelete(page: HelperPage) {
  const index = store.pages.findIndex((p) => p.id === page.id)
  const neighbour = store.pages[index + 1] ?? store.pages[index - 1] ?? null
  const wasActive = page.id === props.activePageId
  const ok = await run(() => store.deletePage(page.id))
  if (!ok) return
  editing.value = null
  if (wasActive && neighbour) emit('select-page', neighbour.id)
}

// Hiding a column keeps what's in it, so switching back brings it all back.
async function toggleColumn(page: HelperPage, toggle: (typeof TOGGLES)[number], event: Event) {
  const box = event.target as HTMLInputElement
  await run(() => store.setColumnShown(page.id, toggle.column, box.checked))
  const now = store.pages.find((p) => p.id === page.id)
  if (now) box.checked = now[toggle.flag]
}

async function addColumn(page: HelperPage) {
  const name = newColumn.value.trim()
  if (!name) return
  if (await run(() => store.addColumn(page.id, name))) newColumn.value = ''
}

async function deleteColumn(page: HelperPage, column: CustomColumn) {
  if (await run(() => store.deleteColumn(page.id, column.id))) confirmingColumn.value = null
}

async function addTab() {
  const name = newName.value.trim()
  if (!name) return
  if (await run(async () => (await store.addPage(name)) !== null)) newName.value = ''
}
</script>

<template>
  <div class="tabs">
    <ul ref="tabList" class="list">
      <li
        v-for="page in store.pages"
        :key="page.id"
        class="tab"
        :class="{ dragged: tabReorder.draggingId.value === page.id }"
        :data-reorder-id="page.id"
      >
        <form
          v-if="editing?.id === page.id && editing.kind === 'rename'"
          class="ha-form"
          @submit.prevent="saveRename(page)"
        >
          <label class="ha-field">
            <span class="ha-label">Rename {{ page.name }}</span>
            <input v-model="renameText" class="ha-input" maxlength="40" />
          </label>
          <div class="ha-actions">
            <button type="button" class="ha-btn" @click="editing = null">Cancel</button>
            <button type="submit" class="ha-btn primary" :disabled="!renameText.trim() || busy">Save</button>
          </div>
        </form>

        <div v-else-if="editing?.id === page.id && editing.kind === 'delete'" class="ha-form">
          <p class="ha-warning" role="alert">
            Delete the tab <strong>{{ page.name }}</strong> and its {{ rowsLabel(rowCount(page.id)) }}? Sign-ups on them
            are lost too.
          </p>
          <div class="ha-actions">
            <button type="button" class="ha-btn" @click="editing = null">Cancel</button>
            <button type="button" class="ha-btn danger" :disabled="busy" @click="confirmDelete(page)">Delete tab</button>
          </div>
        </div>

        <template v-else>
          <div class="head">
            <HelperDragHandle :reorder="tabReorder" :id="page.id" :label="page.name" />
            <p class="name">
              <span class="name-text">{{ page.name }}</span>
              <span class="count">{{ rowsLabel(rowCount(page.id)) }}</span>
            </p>
          </div>
          <div class="controls">
            <button
              type="button"
              class="ha-btn"
              :aria-expanded="columnsOpenId === page.id"
              @click="toggleColumnsOpen(page)"
            >Columns ({{ shownCount(page) + 2 }})</button>
            <span class="spacer" />
            <button type="button" class="ha-btn" @click="startRename(page)">Rename</button>
            <button type="button" class="ha-btn" @click="editing = { id: page.id, kind: 'delete' }">Delete</button>
          </div>

          <div v-if="columnsOpenId === page.id" class="columns" role="group" :aria-label="`Columns on ${page.name}`">
            <p class="ha-hint">Task and Who are always shown. Switching a column off only hides it.</p>
            <div class="toggles">
              <label v-for="toggle in TOGGLES" :key="toggle.column" class="ha-choice">
                <input type="checkbox" :checked="page[toggle.flag]" :disabled="busy" @change="toggleColumn(page, toggle, $event)" />
                <span>{{ toggle.label }}</span>
              </label>
            </div>

            <ul v-if="page.custom_columns.length" class="custom-list">
              <li v-for="column in page.custom_columns" :key="column.id">
                <div v-if="confirmingColumn === column.id" class="ha-form">
                  <p class="ha-warning" role="alert">
                    Delete the column <strong>{{ column.name }}</strong>? Its {{ columnValues(page, column) }} filled
                    {{ columnValues(page, column) === 1 ? 'cell is' : 'cells are' }} lost.
                  </p>
                  <div class="ha-actions">
                    <button type="button" class="ha-btn" @click="confirmingColumn = null">Cancel</button>
                    <button type="button" class="ha-btn danger" :disabled="busy" @click="deleteColumn(page, column)">Delete column</button>
                  </div>
                </div>
                <div v-else class="custom-item">
                  <span class="custom-name">{{ column.name }}</span>
                  <button type="button" class="ha-btn" :aria-label="`Delete column ${column.name}`" @click="confirmingColumn = column.id">Delete</button>
                </div>
              </li>
            </ul>

            <form v-if="page.custom_columns.length < HELPER_LIMITS.customColumns" class="add" @submit.prevent="addColumn(page)">
              <label class="ha-field grow">
                <span class="ha-label">New column</span>
                <input v-model="newColumn" class="ha-input" :maxlength="HELPER_LIMITS.columnName" placeholder="e.g. Car" />
              </label>
              <button type="submit" class="ha-btn primary" :disabled="!newColumn.trim() || busy">Add</button>
            </form>
          </div>
        </template>
      </li>
    </ul>

    <form class="add" @submit.prevent="addTab">
      <label class="ha-field grow">
        <span class="ha-label">New tab</span>
        <input v-model="newName" class="ha-input" maxlength="40" placeholder="e.g. SATURDAY" />
      </label>
      <button type="submit" class="ha-btn primary" :disabled="!newName.trim() || busy">Add</button>
    </form>

    <HelperDragOverlay :reorder="tabReorder" />
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
}

.tab {
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--hp-r-m);
  background: var(--color-bg);
}

.dragged {
  opacity: 0.4;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.name {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.name-text {
  min-width: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.count {
  flex: none;
  font-size: 13px;
  color: var(--color-ink-dim);
}

.columns {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.toggles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.custom-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  list-style: none;
}

.custom-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.custom-name {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spacer {
  flex: 1;
}

.controls .ha-btn {
  padding: 0 8px;
}

.add {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.grow {
  flex: 1;
  min-width: 0;
}
</style>

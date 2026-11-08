<script setup lang="ts">
import { ref } from 'vue'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import type { HelperPage } from '@/lib/helperPlan'

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

async function addTab() {
  const name = newName.value.trim()
  if (!name) return
  if (await run(async () => (await store.addPage(name)) !== null)) newName.value = ''
}
</script>

<template>
  <div class="tabs">
    <ul class="list">
      <li v-for="(page, index) in store.pages" :key="page.id" class="tab">
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
          <p class="name">
            <span class="name-text">{{ page.name }}</span>
            <span class="count">{{ rowsLabel(rowCount(page.id)) }}</span>
          </p>
          <div class="controls">
            <button
              type="button"
              class="ha-btn square"
              :aria-label="`Move ${page.name} up`"
              :disabled="index === 0 || busy"
              @click="run(() => store.movePage(page.id, -1))"
            >↑</button>
            <button
              type="button"
              class="ha-btn square"
              :aria-label="`Move ${page.name} down`"
              :disabled="index === store.pages.length - 1 || busy"
              @click="run(() => store.movePage(page.id, 1))"
            >↓</button>
            <span class="spacer" />
            <button type="button" class="ha-btn" @click="startRename(page)">Rename</button>
            <button type="button" class="ha-btn" @click="editing = { id: page.id, kind: 'delete' }">Delete</button>
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
  border-radius: var(--radius-sm);
  background: var(--color-bg);
}

.name {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
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

.controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spacer {
  flex: 1;
}

.ha-btn.square {
  flex: none;
  width: 44px;
  padding: 0;
  font-size: 18px;
}

.controls .ha-btn:not(.square) {
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

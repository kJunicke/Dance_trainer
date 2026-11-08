<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import HelperAdminSheet from './HelperAdminSheet.vue'
import HelperAdminPinForm from './HelperAdminPinForm.vue'
import HelperAdminMenu from './HelperAdminMenu.vue'
import HelperAdminRowForm from './HelperAdminRowForm.vue'
import HelperAdminDetailsForm from './HelperAdminDetailsForm.vue'
import HelperAdminTabs from './HelperAdminTabs.vue'
import HelperImportForm from './HelperImportForm.vue'

type View = 'pin' | 'menu' | 'add-task' | 'add-section' | 'details' | 'tabs' | 'import'

const props = defineProps<{
  activePageId: number | null
}>()

const emit = defineEmits<{ 'select-page': [id: number] }>()

const store = useHelperPlanStore()

const view = ref<View | null>(null)
const activePage = computed(() => store.pages.find((p) => p.id === props.activePageId) ?? null)

const title = computed(() => {
  const tab = activePage.value?.name ?? ''
  switch (view.value) {
    case 'pin':
      return 'Admin login'
    case 'add-task':
      return `New task on ${tab}`
    case 'add-section':
      return `New heading on ${tab}`
    case 'details':
      return 'Title and info'
    case 'tabs':
      return 'Tabs'
    case 'import':
      return `Import into ${tab}`
    default:
      return 'Admin'
  }
})

const showBack = computed(() => view.value !== null && view.value !== 'pin' && view.value !== 'menu')

function close() {
  view.value = null
}

// The session can end underneath an open sheet (the stored PIN failing its
// re-check on load); the admin views must not stay up without it.
watch(
  () => store.isAdmin,
  (isAdmin) => {
    if (!isAdmin && view.value !== 'pin') close()
  },
)

// A realtime delete from another admin can remove the tab a form is aimed at, and
// the fallback tab must not quietly become its target.
watch(
  () => props.activePageId,
  () => {
    if (view.value === 'add-task' || view.value === 'add-section' || view.value === 'import') view.value = 'menu'
  },
)

const formDirty = ref(false)
watch(view, () => {
  formDirty.value = false
})

function logout() {
  store.adminLogout()
  close()
}
</script>

<template>
  <div class="helper-admin-bar" :class="{ active: store.isAdmin }">
    <template v-if="store.isAdmin">
      <span class="state">Admin</span>
      <button type="button" class="hp-btn hp-btn--small bar-btn" :disabled="!activePage" @click="view = 'add-task'">Add task</button>
      <button type="button" class="hp-btn hp-btn--small bar-btn" @click="view = 'tabs'">Tabs</button>
      <button type="button" class="hp-btn hp-btn--small bar-btn" @click="view = 'menu'">Manage</button>
    </template>
    <button v-else type="button" class="hp-btn hp-btn--ghost hp-btn--small entry" @click="view = 'pin'">Admin</button>

    <HelperAdminSheet
      v-if="view"
      :title="title"
      :show-back="showBack"
      :keep-on-backdrop-tap="formDirty"
      @close="close"
      @back="view = 'menu'"
    >
      <HelperAdminPinForm v-if="view === 'pin'" @done="close" />
      <HelperAdminMenu
        v-else-if="view === 'menu'"
        :active-tab-name="activePage?.name ?? null"
        @add-task="view = 'add-task'"
        @add-section="view = 'add-section'"
        @details="view = 'details'"
        @tabs="view = 'tabs'"
        @import="view = 'import'"
        @logout="logout"
      />
      <HelperAdminRowForm
        v-else-if="(view === 'add-task' || view === 'add-section') && activePage"
        :key="view"
        :page-id="activePage.id"
        :type="view === 'add-task' ? 'task' : 'section'"
        @done="close"
        @dirty="formDirty = $event"
      />
      <HelperAdminDetailsForm v-else-if="view === 'details'" @done="close" />
      <HelperAdminTabs
        v-else-if="view === 'tabs'"
        :active-page-id="activePageId"
        @select-page="emit('select-page', $event)"
      />
      <HelperImportForm
        v-else-if="view === 'import' && activePage"
        :page-id="activePage.id"
        :page-name="activePage.name"
        @done="close"
        @dirty="formDirty = $event"
      />
    </HelperAdminSheet>
  </div>
</template>

<style scoped>
.helper-admin-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--hp-2);
  padding: 0 var(--hp-3);
}

.helper-admin-bar.active {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding: var(--hp-1) var(--hp-3);
}

.state {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-ink-dim);
}

.entry {
  color: var(--color-ink-dim);
}

.bar-btn {
  flex: none;
}
</style>

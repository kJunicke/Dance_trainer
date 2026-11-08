<script setup lang="ts">
defineProps<{
  activeTabName: string | null
}>()

const emit = defineEmits<{
  addTask: []
  addSection: []
  details: []
  tabs: []
  import: []
  logout: []
}>()
</script>

<template>
  <div class="menu">
    <button type="button" class="ha-btn item" :disabled="!activeTabName" @click="emit('addTask')">Add task</button>
    <button type="button" class="ha-btn item" :disabled="!activeTabName" @click="emit('addSection')">
      Add section heading
    </button>
    <button type="button" class="ha-btn item" :disabled="!activeTabName" @click="emit('import')">
      Import into {{ activeTabName ?? 'tab' }}
    </button>
    <p v-if="!activeTabName" class="ha-hint">Add a tab first to put tasks on it.</p>
    <button type="button" class="ha-btn item" @click="emit('tabs')">Add or remove tabs</button>
    <button type="button" class="ha-btn item" @click="emit('details')">Edit title and info</button>
    <button type="button" class="ha-btn item" @click="emit('logout')">Log out of admin</button>
  </div>
</template>

<style scoped>
.menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.menu .item {
  justify-content: flex-start;
  width: 100%;
  min-height: 48px;
  text-align: left;
  overflow-wrap: anywhere;
}
</style>

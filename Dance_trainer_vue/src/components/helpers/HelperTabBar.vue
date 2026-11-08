<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import type { HelperPage } from '@/lib/helperPlan'

const props = defineProps<{
  pages: HelperPage[]
  activeId: number | null
  openByPage: Record<number, number>
}>()

const emit = defineEmits<{
  select: [id: number]
}>()

const strip = ref<HTMLElement | null>(null)

// Set on the strip directly: scrollIntoView would also move the plan's own
// vertical scroller.
function centerActiveTab() {
  const el = strip.value
  const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]')
  if (!el || !tab) return
  el.scrollLeft = tab.offsetLeft - (el.clientWidth - tab.offsetWidth) / 2
}

onMounted(centerActiveTab)
watch(
  () => props.activeId,
  () => nextTick(centerActiveTab),
)
</script>

<template>
  <nav ref="strip" class="tabs" role="tablist" aria-label="Plan tabs">
    <button
      v-for="page in pages"
      :key="page.id"
      class="tab"
      type="button"
      role="tab"
      :aria-selected="page.id === activeId"
      @click="emit('select', page.id)"
    >
      <span class="tab-name">{{ page.name }}</span>
      <span v-if="openByPage[page.id]" class="badge" :aria-label="`${openByPage[page.id]} open`">
        {{ openByPage[page.id] }}
      </span>
    </button>
  </nav>
</template>

<style scoped>
.tabs {
  position: relative;
  display: flex;
  gap: 6px;
  padding: 2px 12px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tab {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 80%;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  touch-action: manipulation;
}

.tab[aria-selected='true'] {
  border-color: var(--color-ink);
  background: var(--hp-amber);
}

.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  flex: none;
  min-width: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--color-overdue);
  color: #fff;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 22px;
  text-align: center;
}
</style>

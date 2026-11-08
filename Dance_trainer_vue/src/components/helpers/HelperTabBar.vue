<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import type { HelperPage } from '@/lib/helperPlan'

const props = defineProps<{
  pages: HelperPage[]
  activeId: number | null
  openByPage: Record<number, number>
  badgeWord: string
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
      <span v-if="openByPage[page.id]" class="badge" :aria-label="`${openByPage[page.id]} ${badgeWord}`">
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
  padding: var(--hp-1) var(--hp-3);
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  /* Fades the strip's edges so a half-hidden tab reads as more to scroll to. */
  -webkit-mask-image: linear-gradient(to right, transparent, #000 12px, #000 calc(100% - 12px), transparent);
  mask-image: linear-gradient(to right, transparent, #000 12px, #000 calc(100% - 12px), transparent);
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
  min-height: var(--hp-tap);
  padding: 0 var(--hp-3);
  border: 1px solid transparent;
  border-radius: var(--hp-r-m);
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  touch-action: manipulation;
  transition:
    background-color var(--hp-fast) var(--hp-ease),
    border-color var(--hp-fast) var(--hp-ease),
    transform var(--hp-fast) var(--hp-ease);
}

.tab:active {
  transform: scale(0.97);
}

.tab[aria-selected='true'] {
  background: var(--hp-amber);
}

.tab:focus-visible {
  outline-offset: -2px;
}

@media (hover: hover) {
  .tab:hover:not([aria-selected='true']) {
    background: var(--color-surface-light);
  }
}

.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  flex: none;
  min-width: 20px;
  padding: 0 5px;
  border-radius: var(--hp-r-full);
  background: var(--color-border);
  color: var(--color-ink);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.tab[aria-selected='true'] .badge {
  background: var(--color-ink);
  color: var(--hp-amber-soft);
}
</style>

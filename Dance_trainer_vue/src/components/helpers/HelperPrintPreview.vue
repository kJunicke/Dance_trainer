<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

// Pages are laid out at real A4 size and shrunk with a transform rather than
// drawn smaller, so text wraps exactly where the printed page wraps it.
const READABLE_SCALE = 0.75

const viewportEl = ref<HTMLElement | null>(null)
const pagesEl = ref<HTMLElement | null>(null)

const fitScale = ref(1)
const pageSize = ref({ width: 0, height: 0 })
const zoomed = ref(false)

// On a screen wide enough to read the whole page there is nothing to zoom to.
const canZoom = computed(() => fitScale.value < READABLE_SCALE)
const scale = computed(() => (zoomed.value && canZoom.value ? READABLE_SCALE : fitScale.value))
const fitStyle = computed(() => ({
  width: zoomed.value && canZoom.value ? `${Math.ceil(pageSize.value.width * scale.value)}px` : undefined,
  height: `${Math.ceil(pageSize.value.height * scale.value)}px`,
}))

function fit() {
  if (!viewportEl.value || !pagesEl.value) return
  const style = getComputedStyle(viewportEl.value)
  const available = viewportEl.value.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  pageSize.value = { width: pagesEl.value.offsetWidth, height: pagesEl.value.offsetHeight }
  fitScale.value = available / pagesEl.value.offsetWidth
}

function toggleZoom() {
  zoomed.value = !zoomed.value
  viewportEl.value?.scrollTo(0, 0)
}

let observer: ResizeObserver | null = null

// The sized box inside the pane isn't observed: fit() sets its height, and observing
// that would make ResizeObserver report an undelivered loop on every change.
onMounted(() => {
  fit()
  observer = new ResizeObserver(fit)
  if (viewportEl.value) observer.observe(viewportEl.value)
  if (pagesEl.value) observer.observe(pagesEl.value)
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <!-- Chrome makes a scroller with no focusable children a Tab stop, which would
       put focus inside aria-hidden. tabindex="-1" takes it out of the Tab order
       and the prevented mousedown keeps a click from focusing it either. -->
  <div class="preview-frame">
    <div ref="viewportEl" class="preview" aria-hidden="true" tabindex="-1" @mousedown.prevent>
      <div class="fit" :style="fitStyle">
        <div ref="pagesEl" class="pages" :style="{ transform: `scale(${scale})` }">
          <slot />
        </div>
      </div>
    </div>
    <button v-if="canZoom" class="zoom hp-tap" type="button" @click="toggleZoom">
      <span class="hp-chip">{{ zoomed ? 'Whole page' : 'Zoom in' }}</span>
    </button>
  </div>
</template>

<style scoped>
.preview-frame {
  position: relative;
  flex: none;
}

.zoom {
  position: absolute;
  top: 0;
  right: 0;
  justify-content: flex-end;
  padding: 4px;
}

.preview {
  /* Bleeds through the sheet's 16px padding: at 320px every pixel of width is
     legibility. */
  margin-inline: -16px;
  height: clamp(150px, 34vh, 480px);
  height: clamp(150px, 34dvh, 480px);
  padding: 8px;
  /* Always scroll, never auto: a scrollbar that comes and goes changes the width,
     which changes the scale, which changes whether the scrollbar is needed. */
  overflow-y: scroll;
  background: var(--color-border);
}

.fit {
  overflow: hidden;
  pointer-events: none;
}

.pages {
  width: 297mm;
  transform-origin: 0 0;
}

/* @page's margin, drawn: the real page is a 277mm box inside a 10mm margin. */
.pages :deep(.hp-sheet) {
  box-sizing: border-box;
  width: 297mm;
  min-height: 210mm;
  padding: 10mm;
  background: #fff;
}

.pages :deep(.hp-sheet + .hp-sheet) {
  margin-top: 48px;
}

@media (min-width: 640px) {
  .preview {
    height: clamp(260px, 52vh, 560px);
    height: clamp(260px, 52dvh, 560px);
  }
}

@media print {
  .preview-frame {
    display: none;
  }
}
</style>

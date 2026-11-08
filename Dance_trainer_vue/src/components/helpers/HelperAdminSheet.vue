<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useBackButtonClose, useEscapeClose } from '@/lib/useBackButtonClose'

// The bottom sheet every admin view and the print dialog sit in.
//
// Views swap *inside* one instance rather than each mounting their own sheet.
// useBackButtonClose pops its history entry with an asynchronous history.back()
// on unmount, so closing one overlay and opening another in the same tick lets
// that popstate land on the new overlay and close it immediately.
const props = defineProps<{
  title: string
  showBack?: boolean
  wide?: boolean
  // Something typed in the sheet: a stray tap outside must not throw it away.
  keepOnBackdropTap?: boolean
}>()

const emit = defineEmits<{
  close: []
  back: []
}>()

useBackButtonClose(() => emit('close'))

const backdropEl = ref<HTMLElement | null>(null)
useEscapeClose(() => backdropEl.value, () => emit('close'))
const opener = document.activeElement as HTMLElement | null

// A fixed bottom sheet sits behind the on-screen keyboard: neither Android
// Chrome nor iOS Safari shrinks the layout viewport for it by default, so a PIN
// field would be typed into blind. The visual viewport does know.
const keyboardInset = ref(0)

function updateKeyboardInset() {
  const vv = window.visualViewport
  if (!vv) return
  keyboardInset.value = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
}

onMounted(() => {
  // Tab has to start inside the sheet. A form that autofocused its first field
  // already put focus there.
  if (!backdropEl.value?.contains(document.activeElement)) backdropEl.value?.focus()
  window.visualViewport?.addEventListener('resize', updateKeyboardInset)
  window.visualViewport?.addEventListener('scroll', updateKeyboardInset)
  updateKeyboardInset()
})

onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', updateKeyboardInset)
  window.visualViewport?.removeEventListener('scroll', updateKeyboardInset)
  opener?.focus?.({ preventScroll: true })
})

function onBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget && !props.keepOnBackdropTap) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      ref="backdropEl"
      class="ha-backdrop helper-sheet-backdrop"
      tabindex="-1"
      :style="{ paddingBottom: `${keyboardInset}px` }"
      @click="onBackdropClick"
    >
      <div class="ha-sheet" :class="{ wide }" role="dialog" aria-modal="true" :aria-label="title">
        <header class="ha-head">
          <button v-if="showBack" type="button" class="ha-icon-btn" aria-label="Back" @click="emit('back')">‹</button>
          <h2 class="ha-title">{{ title }}</h2>
          <button type="button" class="ha-icon-btn" aria-label="Close" @click="emit('close')">×</button>
        </header>
        <div class="ha-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="ha-foot">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<!-- Not scoped: these classes are the shared vocabulary of the forms rendered
     into the slot. Everything is namespaced under .ha-sheet. -->
<style>
.ha-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  background: rgba(42, 36, 32, 0.55);
  animation: hp-backdrop-in 160ms ease-out;
}

.ha-sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: calc(100% - 24px);
  background: var(--color-surface);
  color: var(--color-ink);
  border-radius: var(--hp-r-l) var(--hp-r-l) 0 0;
  border-top: 6px solid var(--hp-amber);
  overflow: hidden;
  animation: hp-sheet-in 220ms var(--hp-ease);
  box-shadow: var(--shadow-modal);
}

.ha-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 4px 4px 16px;
  border-bottom: 1px solid var(--color-border);
}

.ha-head .ha-icon-btn:first-child {
  margin-left: -12px;
}

.ha-title {
  flex: 1;
  min-width: 0;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.ha-icon-btn {
  flex: none;
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  color: var(--color-ink);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  touch-action: manipulation;
  border-radius: var(--hp-r-m);
  transition: background-color var(--hp-fast) var(--hp-ease);
}

.ha-icon-btn:active {
  background: var(--color-border);
}

.ha-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}

.ha-foot {
  flex: none;
  display: flex;
  flex-direction: column;
  padding: 8px 16px calc(8px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--color-border);
}

.ha-sheet .ha-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ha-sheet .ha-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ha-sheet .ha-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-ink-dim);
}

.ha-sheet textarea.ha-input {
  min-height: 88px;
  resize: vertical;
}

.ha-sheet .ha-choice {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  font-size: 15px;
  cursor: pointer;
}

.ha-sheet .ha-choice input {
  flex: none;
  width: 20px;
  height: 20px;
  accent-color: var(--color-ember);
}

.ha-sheet .ha-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.ha-sheet .ha-hint {
  font-size: 13px;
  color: var(--color-ink-dim);
}

.ha-sheet .ha-error {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-ink);
  padding: 8px 10px;
  border-left: 4px solid var(--color-overdue);
  border-radius: var(--hp-r-s);
  background: color-mix(in srgb, var(--color-overdue) 12%, transparent);
}

.ha-sheet .ha-warning {
  font-size: 14px;
  color: var(--color-ink);
  padding: 8px 10px;
  border-left: 4px solid var(--color-overdue);
  border-radius: var(--hp-r-s);
  background: color-mix(in srgb, var(--color-overdue) 12%, transparent);
  overflow-wrap: anywhere;
}

@media (min-width: 640px) {
  .ha-backdrop {
    justify-content: center;
    align-items: center;
  }

  .ha-sheet {
    max-width: 480px;
    max-height: calc(100% - 64px);
    border-radius: var(--hp-r-l);
  }

  .ha-sheet.wide {
    max-width: 760px;
  }
}
</style>

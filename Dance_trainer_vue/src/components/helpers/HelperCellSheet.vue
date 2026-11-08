<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useBackButtonClose } from '@/lib/useBackButtonClose'

const props = defineProps<{
  title: string
  // Which row this edit belongs to, so a long list doesn't lose the thread.
  context?: string
  kind: 'input' | 'textarea' | 'number'
  initial: string
  maxlength?: number
  min?: number
  max?: number
  required?: boolean
  placeholder?: string
  hint?: string
  saveLabel?: string
  busy?: boolean
  // No way out without saving: the first-visit name prompt.
  locked?: boolean
}>()

const emit = defineEmits<{
  save: [value: string]
  cancel: []
}>()

// Copied once and never re-synced from props: a live refresh repainting the
// plan behind this sheet must not touch what is being typed.
const draft = ref(props.initial)
const dirty = computed(() => draft.value !== props.initial)

if (!props.locked) useBackButtonClose(() => emit('cancel'))

const lowest = computed(() => Math.max(1, props.min ?? 1))
const highest = computed(() => props.max ?? 50)
const numberValue = computed(() => (/^\d+$/.test(draft.value) ? Number(draft.value) : NaN))

const canSave = computed(() => {
  if (props.busy) return false
  if (props.kind === 'number') {
    return numberValue.value >= lowest.value && numberValue.value <= highest.value
  }
  return !props.required || draft.value.trim() !== ''
})

function step(delta: number) {
  const current = Number.isNaN(numberValue.value) ? lowest.value : numberValue.value
  draft.value = String(Math.min(highest.value, Math.max(lowest.value, current + delta)))
}

function submit() {
  if (canSave.value) emit('save', props.kind === 'number' ? draft.value : draft.value.trim())
}

function cancel() {
  if (!props.locked) emit('cancel')
}

// A stray tap outside must not throw away something typed.
function onBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget && !dirty.value) cancel()
}

const fieldEl = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
const sheetEl = ref<HTMLFormElement | null>(null)

// Chrome on Android and iOS Safari lay out under the on-screen keyboard rather
// than above it, so a sheet pinned to the bottom would open behind the keyboard.
// Only visualViewport knows how much of the screen is really left.
const keyboardInset = ref(0)
function syncKeyboardInset() {
  const viewport = window.visualViewport
  if (!viewport) return
  keyboardInset.value = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
}

onMounted(() => {
  window.visualViewport?.addEventListener('resize', syncKeyboardInset)
  window.visualViewport?.addEventListener('scroll', syncKeyboardInset)
  // The stepper has no field to focus, and Escape needs focus inside the sheet.
  ;(fieldEl.value ?? sheetEl.value)?.focus()
})

onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', syncKeyboardInset)
  window.visualViewport?.removeEventListener('scroll', syncKeyboardInset)
})
</script>

<template>
  <div
    class="backdrop helper-sheet-backdrop"
    :style="{ paddingBottom: `${keyboardInset}px` }"
    @click="onBackdropClick"
    @keydown.esc="cancel"
  >
    <form
      ref="sheetEl"
      class="sheet"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      :aria-label="title"
      @submit.prevent="submit"
    >
      <h2 class="title">{{ title }}</h2>
      <p v-if="context" class="context">{{ context }}</p>

      <div v-if="kind === 'number'" class="stepper">
        <button
          type="button"
          class="step"
          aria-label="One fewer"
          :disabled="numberValue <= lowest"
          @click="step(-1)"
        >−</button>
        <input
          v-model="draft"
          class="step-value"
          type="text"
          inputmode="numeric"
          :aria-label="title"
        />
        <button
          type="button"
          class="step"
          aria-label="One more"
          :disabled="numberValue >= highest"
          @click="step(1)"
        >+</button>
      </div>
      <textarea
        v-else-if="kind === 'textarea'"
        ref="fieldEl"
        v-model="draft"
        class="field"
        rows="4"
        :maxlength="maxlength"
        :placeholder="placeholder"
        :aria-label="title"
      ></textarea>
      <input
        v-else
        ref="fieldEl"
        v-model="draft"
        class="field"
        type="text"
        enterkeyhint="done"
        :maxlength="maxlength"
        :placeholder="placeholder"
        :aria-label="title"
      />

      <p v-if="hint" class="hint">{{ hint }}</p>

      <div class="actions">
        <button v-if="!locked" type="button" class="btn" @click="cancel">Cancel</button>
        <button type="submit" class="btn primary" :disabled="!canSave">
          {{ saveLabel ?? 'Save' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  background: rgba(42, 36, 32, 0.55);
}

.sheet {
  width: 100%;
  max-width: 520px;
  max-height: 100%;
  overflow-y: auto;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
  background: var(--color-surface-light);
  border-top: 6px solid var(--hp-amber, var(--color-ember));
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-modal);
  animation: rise 180ms cubic-bezier(0.25, 1, 0.5, 1);
}

@keyframes rise {
  from {
    transform: translateY(24px);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sheet {
    animation: none;
  }
}

.title {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  color: var(--color-ink);
}

.context {
  margin-top: 2px;
  font-size: 14px;
  color: var(--color-ink-dim);
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

.field {
  display: block;
  width: 100%;
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 16px;
  line-height: 1.4;
  resize: vertical;
}

.field:focus {
  outline: none;
  border-color: var(--color-ember);
}

.stepper {
  display: flex;
  align-items: stretch;
  gap: 8px;
  margin-top: 12px;
}

.step {
  flex: 0 0 72px;
  height: 64px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 30px;
  line-height: 1;
  cursor: pointer;
  touch-action: manipulation;
}

.step:disabled {
  opacity: 0.35;
  cursor: default;
}

.step-value {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 700;
  text-align: center;
}

.hint {
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-ink-dim);
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.btn {
  flex: 1;
  min-height: 48px;
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.btn.primary {
  border-color: var(--color-ember);
  background: var(--color-ember);
  color: var(--color-text-on-ember);
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>

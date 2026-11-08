<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { cellOverLimit, sameName, suggestNames } from '@/lib/helperPlan'
import { completeRoom, splitRooms, toggleRoom, typedRoom } from '@/lib/helperBoards'
import { useBackButtonClose, useEscapeClose } from '@/lib/useBackButtonClose'
import HelperTimePicker from './HelperTimePicker.vue'

const props = defineProps<{
  title: string
  // Which row this edit belongs to, so a long list doesn't lose the thread.
  context?: string
  kind: 'input' | 'textarea' | 'time'
  rows?: number
  // One-tap times for the time picker.
  presets?: string[]
  // Which time in the cell the picker starts on, by character position.
  occurrence?: number
  initial: string
  maxlength?: number
  required?: boolean
  placeholder?: string
  saveLabel?: string
  busy?: boolean
  // No way out without saving: the first-visit name prompt.
  locked?: boolean
  // Names to offer while typing; one tap saves.
  suggestions?: string[]
  // Say so when the typed name is already someone's on the plan.
  noteTakenName?: boolean
  // Suggestions toggle rooms in the draft instead of saving: a cell can list several.
  suggestByPart?: boolean
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

const backdropEl = ref<HTMLElement | null>(null)
const opener = document.activeElement as HTMLElement | null
useEscapeClose(() => backdropEl.value, cancel)

const typedPart = computed(() => {
  if (props.suggestByPart) return typedRoom(draft.value, props.suggestions ?? [])
  return dirty.value ? draft.value : ''
})
// A room left off the list couldn't be toggled off, so rooms get no cap.
const matches = computed(() =>
  suggestNames(props.suggestions ?? [], typedPart.value, props.suggestByPart ? props.suggestions?.length : undefined),
)
const roomsInDraft = computed(() => new Set(splitRooms(draft.value).map((ref) => ref.name.toLowerCase())))

function pick(suggestion: string) {
  if (!props.suggestByPart) emit('save', suggestion)
  else draft.value = typedPart.value ? completeRoom(draft.value, suggestion) : toggleRoom(draft.value, suggestion)
}

const typing = ref(false)
const takenName = computed(() =>
  props.noteTakenName && dirty.value
    ? ((props.suggestions ?? []).find((name) => sameName(name, draft.value)) ?? null)
    : null,
)

// The picker and the room chips write the draft directly, past the field's maxlength.
const overLimit = computed(() => {
  if (props.kind === 'time') return cellOverLimit('when', draft.value)
  return props.suggestByPart ? cellOverLimit('where', draft.value) : false
})

const canSave = computed(() => {
  if (props.busy || overLimit.value) return false
  return !props.required || draft.value.trim() !== ''
})

function submit() {
  if (canSave.value) emit('save', draft.value.trim())
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
  // The time picker has no field to focus. Room toggles come first: the keyboard would cover them, and typing is the exception.
  ;((props.suggestByPart ? null : fieldEl.value) ?? sheetEl.value)?.focus()
})

onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', syncKeyboardInset)
  window.visualViewport?.removeEventListener('scroll', syncKeyboardInset)
  opener?.focus?.({ preventScroll: true })
})
</script>

<template>
  <div
    ref="backdropEl"
    class="backdrop helper-sheet-backdrop"
    :style="{ paddingBottom: `${keyboardInset}px` }"
    @click="onBackdropClick"
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
      <div class="hp-perf sheet-perf" aria-hidden="true" />
      <div class="sheet-head">
        <h2 class="title">{{ title }}</h2>
        <div v-if="kind === 'time' && !typing" class="time-links">
          <button type="button" class="hp-btn hp-btn--ghost hp-btn--small" @click="typing = true">Type instead</button>
          <button type="button" class="hp-btn hp-btn--ghost hp-btn--small" :disabled="!draft" @click="draft = ''">Clear</button>
        </div>
      </div>
      <p v-if="context" class="context">{{ context }}</p>

      <div class="sheet-body">
      <template v-if="kind === 'time'">
        <HelperTimePicker v-model="draft" :presets="presets ?? []" :occurrence="occurrence" />
        <input
          v-if="typing"
          v-model="draft"
          class="hp-input typed"
          type="text"
          enterkeyhint="done"
          :maxlength="maxlength"
          :aria-label="title"
        />
      </template>
      <textarea
        v-else-if="kind === 'textarea'"
        ref="fieldEl"
        v-model="draft"
        class="hp-input field"
        :rows="rows ?? 4"
        :maxlength="maxlength"
        :placeholder="placeholder"
        :aria-label="title"
      ></textarea>
      <input
        v-else
        ref="fieldEl"
        v-model="draft"
        class="hp-input field"
        type="text"
        enterkeyhint="done"
        :autocomplete="suggestions ? 'off' : undefined"
        :maxlength="maxlength"
        :placeholder="placeholder"
        :aria-label="title"
      />

      <ul
        v-if="matches.length"
        class="suggest hp-chip-row hp-chips--roomy"
        :class="{ rooms: suggestByPart }"
        :aria-label="suggestByPart ? 'Rooms on the plan' : 'Names already on the plan'"
      >
        <li v-for="name in matches" :key="name">
          <button
            type="button"
            class="hp-tap"
            :disabled="busy"
            :aria-pressed="suggestByPart ? roomsInDraft.has(name.toLowerCase()) : undefined"
            @click="pick(name)"
          ><span class="hp-chip">{{ name }}</span></button>
        </li>
      </ul>

      <p v-if="takenName" class="hint">{{ takenName }} is already on the plan. Continuing makes you the same person.</p>
      <p v-if="overLimit" class="hint">That's more than the {{ maxlength }} characters this cell can hold. Take something out to save it.</p>
      </div>

      <div class="actions">
        <button v-if="!locked" type="button" class="hp-btn action" @click="cancel">Cancel</button>
        <button type="submit" class="hp-btn hp-btn--primary action" :disabled="!canSave">
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
  animation: hp-backdrop-in 160ms ease-out;
}

/* Head and actions stay put; only the middle scrolls, so Save is always on screen. */
.sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 520px;
  max-height: calc(100% - 16px);
  min-height: 0;
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--color-surface-light);
  border-radius: var(--hp-r-l) var(--hp-r-l) 0 0;
  box-shadow: var(--shadow-modal);
  animation: hp-sheet-in 220ms var(--hp-ease);
}

.sheet:focus-visible {
  outline: none;
}

.sheet-perf {
  background-color: var(--color-surface-light);
}

.sheet-head {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--hp-2);
  min-height: var(--hp-tap);
  padding: 0 var(--hp-3);
}

.title {
  flex: 1;
  min-width: 0;
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 700;
  color: var(--color-ink);
  overflow-wrap: anywhere;
}

.time-links {
  display: flex;
  flex: none;
  gap: 2px;
  margin-right: -6px;
}

.context {
  flex: none;
  padding: 0 var(--hp-3);
  font-size: 13px;
  line-height: 1.3;
  color: var(--color-ink-dim);
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

.sheet-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--hp-2) var(--hp-3) var(--hp-1);
}

.field {
  resize: vertical;
}

.typed {
  margin-top: 6px;
}

.suggest {
  margin-top: var(--hp-1);
}

/* A long room list scrolls on its own, so Save stays on screen. */
.suggest.rooms {
  max-height: 160px;
  overflow-y: auto;
}

.hint {
  margin-top: var(--hp-2);
  font-size: 13px;
  line-height: 1.3;
  color: var(--color-ink-dim);
}

.actions {
  display: flex;
  flex: none;
  gap: var(--hp-2);
  padding: var(--hp-2) var(--hp-3) var(--hp-3);
  border-top: 1px solid var(--color-surface);
}

.action {
  flex: 1;
  min-height: 48px;
  font-size: 15px;
}

@media (min-width: 760px) {
  .backdrop {
    justify-content: center;
  }

  .sheet {
    border-radius: var(--hp-r-l);
  }
}
</style>

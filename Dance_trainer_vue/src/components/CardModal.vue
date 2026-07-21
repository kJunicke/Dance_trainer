<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useBoardStore } from '@/stores/boardStore'
import { caretOffsetFromClick, renderMarkdownWithLinkChips } from '@/lib/markdown'
import { LABEL_COLORS, LABEL_TEXT_COLORS } from '@/lib/labelColors'
import { useBackButtonClose } from '@/lib/useBackButtonClose'

const props = defineProps<{
  cardId: number
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useBoardStore()

// Any close path (X, backdrop, Escape, phone back-gesture) flushes an in-progress
// description edit instead of discarding it.
function closeModal() {
  if (editingDescription.value) saveDescription()
  emit('close')
}

useBackButtonClose(closeModal)

const card = computed(() => store.cards.find((c) => c.id === props.cardId) ?? null)
const historyText = computed(() => (card.value ? store.cardHistoryLabel(card.value) : null))
const boardId = computed(() => store.board?.id ?? null)
const cardLabelIds = computed(
  () => new Set(store.labelsForCard(props.cardId).map((l) => l.id)),
)

const descriptionDraft = ref('')
const editingDescription = ref(false)
// Keep in sync with .desc-textarea's min-height in this file's styles.
const DESC_MIN_EDIT_HEIGHT = 180
const descPreviewEl = ref<HTMLElement | null>(null)
const descTextareaEl = ref<HTMLTextAreaElement | null>(null)
const editHeight = ref(0)
const titleDraft = ref('')
const editingTitle = ref(false)
const titleInputEl = ref<HTMLInputElement | null>(null)
watch(
  card,
  (c) => {
    if (!c) { emit('close'); return }
    descriptionDraft.value = c.description ?? ''
    if (!editingTitle.value) titleDraft.value = c.name
  },
  { immediate: true },
)

// Entering edit mode must not move the text under the pointer: the textarea
// adopts the height the preview just had (both are border-box, so offsetHeight
// transfers directly), and the caret lands on the word that was clicked rather
// than at the top or the end of the source.
async function startEditDescription(e: MouseEvent) {
  const preview = descPreviewEl.value
  // Only override when the preview was taller than the textarea's own floor —
  // a short or empty description would otherwise inline a min-height *below*
  // the CSS one and shrink the writing surface.
  const measured = preview?.offsetHeight ?? 0
  editHeight.value = measured > DESC_MIN_EDIT_HEIGHT ? measured : 0

  // Resolved before the preview is torn down — it reads the rendered layout.
  const body = preview?.querySelector('.md-body')
  const offset = body
    ? caretOffsetFromClick(body, e, descriptionDraft.value)
    : descriptionDraft.value.length

  editingDescription.value = true
  await nextTick()
  const el = descTextareaEl.value
  if (!el) return
  el.focus()
  el.setSelectionRange(offset, offset)
}

function saveDescription() {
  store.updateCardDescription(props.cardId, descriptionDraft.value)
  // Deferred a tick: this also fires on blur, which happens as soon as the user's
  // click lands on the next element (e.g. the Save button itself, or Delete card).
  // Collapsing the textarea synchronously here would shift that element out from
  // under the pointer before its own click completed, silently swallowing the tap.
  setTimeout(() => { editingDescription.value = false }, 0)
}

function onDescriptionKeydown(e: KeyboardEvent) {
  if (e.key !== 'Tab') return
  e.preventDefault()
  const el = e.target as HTMLTextAreaElement
  const { selectionStart, selectionEnd, value } = el
  descriptionDraft.value = value.slice(0, selectionStart) + '\t' + value.slice(selectionEnd)
  nextTick(() => {
    el.selectionStart = el.selectionEnd = selectionStart + 1
  })
}

async function startEditTitle() {
  titleDraft.value = card.value?.name ?? ''
  editingTitle.value = true
  await nextTick()
  titleInputEl.value?.select()
}

function saveTitle() {
  const trimmed = titleDraft.value.trim()
  if (trimmed && card.value && trimmed !== card.value.name) store.renameCard(props.cardId, trimmed)
  editingTitle.value = false
}

function cancelEditTitle() {
  editingTitle.value = false
}

function onDueDateChange(event: Event) {
  const value = (event.target as HTMLInputElement).value
  store.updateCardDueDate(props.cardId, value || null)
}

function onColumnChange(event: Event) {
  const columnId = Number((event.target as HTMLSelectElement).value)
  if (!card.value || columnId === card.value.column_id) return
  store.moveCard(props.cardId, columnId, store.cardsByColumn(columnId).length)
}

function deleteCard() {
  if (!card.value) return
  if (!window.confirm(`Delete "${card.value.name}"?`)) return
  store.deleteCard(props.cardId)
  // The card watcher also closes the modal, but only after the DB round-trip.
  emit('close')
}

// --- Labels: show only the card's labels as chips; a "+" opens an adder that
// filters existing labels as you type and can create a new one in a chosen color.
const activeLabels = computed(() => store.labelsForCard(props.cardId))

const addingLabel = ref(false)
const labelQuery = ref('')
const colorPickerOpen = ref(false)
const newLabelColor = ref<string>(Object.keys(LABEL_COLORS)[0] ?? 'rose')
const labelInputEl = ref<HTMLInputElement | null>(null)
const labelFieldEl = ref<HTMLElement | null>(null)

// Click anywhere outside the labels field while the adder is open closes it —
// it's an inline popover, not a modal of its own.
function onDocumentClick(e: MouseEvent) {
  if (!addingLabel.value) return
  if (labelFieldEl.value && !labelFieldEl.value.contains(e.target as Node)) {
    addingLabel.value = false
  }
}

// Labels not yet on this card, filtered by the query.
const addableLabels = computed(() => {
  const q = labelQuery.value.trim().toLowerCase()
  return store.labels.filter(
    (l) => !cardLabelIds.value.has(l.id) && (!q || l.name.toLowerCase().includes(q)),
  )
})

// Offer "create" only when the typed name doesn't already exist on the board.
const canCreate = computed(() => {
  const name = labelQuery.value.trim()
  return !!name && !store.labels.some((l) => l.name.toLowerCase() === name.toLowerCase())
})

async function openAdder() {
  addingLabel.value = true
  await nextTick()
  labelInputEl.value?.focus()
}

function addExisting(labelId: number) {
  store.toggleCardLabel(props.cardId, labelId)
  labelQuery.value = ''
  labelInputEl.value?.focus()
}

function pickColor(name: string) {
  newLabelColor.value = name
  colorPickerOpen.value = false
}

// Enter / Create: reuse an exact-name match if one exists, otherwise make a new
// label in the chosen color. Either way the label lands on this card.
async function submitLabel() {
  const name = labelQuery.value.trim()
  if (!name || !boardId.value) return
  const existing = store.labels.find((l) => l.name.toLowerCase() === name.toLowerCase())
  if (existing) {
    if (!cardLabelIds.value.has(existing.id)) store.toggleCardLabel(props.cardId, existing.id)
  } else {
    const created = await store.createLabel(boardId.value, name, newLabelColor.value)
    if (created) store.toggleCardLabel(props.cardId, created.id)
  }
  labelQuery.value = ''
  labelInputEl.value?.focus()
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) closeModal()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeModal()
}

// Escape only reaches the backdrop's keydown handler if something inside the
// modal has focus.
const backdropEl = ref<HTMLElement | null>(null)
onMounted(() => {
  backdropEl.value?.focus()
  document.addEventListener('click', onDocumentClick)
})
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div ref="backdropEl" class="backdrop" @click="onBackdropClick" @keydown="onKeydown" tabindex="-1">
    <div v-if="card" class="modal">
      <button class="close-btn" title="Close" @click="closeModal">×</button>
      <input
        v-if="editingTitle"
        ref="titleInputEl"
        v-model="titleDraft"
        class="title-input"
        @blur="saveTitle"
        @keydown.enter="saveTitle"
        @keydown.esc="cancelEditTitle"
      />
      <h2 v-else class="title" @click="startEditTitle">{{ card.name }}</h2>

      <div class="field-row">
        <section class="field">
          <label class="field-label">Column</label>
          <select class="column-select" :value="card.column_id" @change="onColumnChange">
            <option v-for="col in store.columns" :key="col.id" :value="col.id">{{ col.name }}</option>
          </select>
        </section>

        <section class="field">
          <label class="field-label">Due date</label>
          <input type="date" :value="card.due_date ?? ''" @change="onDueDateChange" />
        </section>
      </div>

      <!-- Where this card was last filed, and when — the scheduling context the
           due date alone can't give, since a swept card's date says nothing
           about which bucket it came from. -->
      <p v-if="historyText" class="history-line">{{ historyText }}</p>

      <section ref="labelFieldEl" class="field">
        <label class="field-label">Labels</label>
        <div class="label-list">
          <button
            v-for="label in activeLabels"
            :key="label.id"
            class="label-chip active"
            :style="{
              background: LABEL_COLORS[label.color] ?? '#ccc',
              color: LABEL_TEXT_COLORS[label.color] ?? '#2a2420',
            }"
            title="Remove label from card"
            @click="store.toggleCardLabel(props.cardId, label.id)"
          >
            {{ label.name }}<span class="chip-x">×</span>
          </button>
          <button
            class="add-label-btn"
            :class="{ open: addingLabel }"
            :title="addingLabel ? 'Close' : 'Add a label'"
            @click="addingLabel ? (addingLabel = false) : openAdder()"
          >+</button>
        </div>

        <div v-if="addingLabel" class="label-adder">
          <div class="adder-input-row">
            <button
              class="color-dot"
              :style="{ background: LABEL_COLORS[newLabelColor] }"
              title="Pick a color for a new label"
              @click="colorPickerOpen = !colorPickerOpen"
            />
            <input
              ref="labelInputEl"
              v-model="labelQuery"
              class="label-input"
              placeholder="Find or name a label"
              @keydown.enter="submitLabel"
            />
            <button class="create-btn" :disabled="!canCreate" @click="submitLabel">Create</button>
          </div>

          <div v-if="colorPickerOpen" class="color-swatches">
            <button
              v-for="(hex, name) in LABEL_COLORS"
              :key="name"
              class="swatch"
              :class="{ selected: name === newLabelColor }"
              :style="{ background: hex }"
              :title="name"
              @click="pickColor(name)"
            />
          </div>

          <ul v-if="addableLabels.length" class="label-options">
            <li
              v-for="label in addableLabels"
              :key="label.id"
              class="label-option"
              @click="addExisting(label.id)"
            >
              <span class="opt-dot" :style="{ background: LABEL_COLORS[label.color] ?? '#ccc' }" />
              {{ label.name }}
            </li>
          </ul>
          <p v-else-if="labelQuery.trim()" class="adder-empty">
            No match — Create makes “{{ labelQuery.trim() }}”.
          </p>
          <p v-else class="adder-empty">Every label is already on this card.</p>
        </div>
      </section>

      <section class="field desc-field">
        <label class="field-label">Description</label>
        <div v-if="editingDescription">
          <textarea
            ref="descTextareaEl"
            class="desc-textarea"
            :style="editHeight ? { minHeight: editHeight + 'px' } : undefined"
            v-model="descriptionDraft"
            placeholder="Markdown supported"
            @keydown="onDescriptionKeydown"
            @blur="saveDescription"
          />
          <div class="desc-actions">
            <button @click="saveDescription">Save</button>
          </div>
        </div>
        <div v-else ref="descPreviewEl" class="desc-preview" @click="startEditDescription">
          <p v-if="!card.description" class="placeholder">Click to add a description…</p>
          <div v-else class="md-body" v-html="renderMarkdownWithLinkChips(card.description)" />
        </div>
      </section>

      <button class="delete-card-btn" @click="deleteCard">Delete card</button>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 16px;
  overflow-y: auto;
  z-index: 100;
}

.modal {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
  padding: 24px;
  width: 100%;
  max-width: 560px;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  color: var(--color-ink);
  opacity: 0.5;
}

.close-btn:hover {
  opacity: 1;
}

.title {
  margin: 0 32px 20px 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 22px;
  letter-spacing: -0.01em;
  color: var(--color-ink);
  border-radius: 4px;
  padding: 2px 4px;
  cursor: pointer;
}

.title:hover {
  background: var(--color-surface-light);
}

.title-input {
  display: block;
  width: 100%;
  margin: 0 32px 20px 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 22px;
  letter-spacing: -0.01em;
  color: var(--color-ink);
  border: 2px solid var(--color-ember);
  border-radius: 4px;
  padding: 2px 4px;
  background: var(--color-bg);
  outline: none;
  box-sizing: border-box;
}

.field {
  margin-bottom: 20px;
}

/* Column + due date share a row and stay side by side, even on phones. */
.field-row {
  display: flex;
  gap: 12px;
}

.field-row .field {
  flex: 1;
  min-width: 0;
}

.column-select,
.field-row input[type='date'] {
  width: 100%;
  box-sizing: border-box;
}

.column-select {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
  font-size: 14px;
}

/* An eyebrow names the field; the value under it is the content. Four 12px bold
   uppercase ember runs stacked down one dialog inverted that — the labels shouted
   and the values whispered. Dropped to the regular mono weight and the dim ink so
   it reads as a caption, not an accent. (It also moves off ember-as-text, which
   only cleared 2.78:1 here; --color-ink-dim is 5.11 on the modal surface.) */
.history-line {
  margin: -8px 0 20px;
  color: var(--color-ink-dim);
  font-family: var(--font-mono);
  font-size: 12px;
}

.field-label {
  display: block;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-ink-dim);
  margin-bottom: 6px;
}

input[type='date'] {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-mono);
  color-scheme: light;
}

.label-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

/* Chip ink comes from LABEL_TEXT_COLORS alongside the fill — white doesn't
   clear 4.5:1 on the three lighter label colors. */
.label-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  border-radius: 4px;
  padding: 4px 8px 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.chip-x {
  font-size: 14px;
  line-height: 1;
  opacity: 0.7;
}

.label-chip:hover .chip-x {
  opacity: 1;
}

.add-label-btn {
  width: 26px;
  height: 26px;
  border: 1px dashed var(--color-ember);
  border-radius: 4px;
  background: transparent;
  color: var(--color-ember-text);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.add-label-btn:hover,
.add-label-btn.open {
  background: var(--color-surface-light);
}

.label-adder {
  margin-top: 10px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
}

.adder-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-dot {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
}

.label-input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-light);
  color: var(--color-ink);
  font-size: 14px;
}

.create-btn {
  flex-shrink: 0;
  padding: 8px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-ember);
  color: var(--color-text-on-ember);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.create-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.color-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.swatch {
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
}

.swatch.selected {
  border-color: var(--color-ink);
}

.label-options {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  max-height: 168px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.label-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--color-ink);
  cursor: pointer;
}

.label-option:hover {
  background: var(--color-surface-light);
}

.opt-dot {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.adder-empty {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--color-ink-dim);
}

.desc-textarea {
  width: 100%;
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.5;
  min-height: 180px;
  padding: 12px;
  box-sizing: border-box;
  resize: vertical;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
}

.desc-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}

.desc-actions button {
  padding: 6px 14px;
  border: 1px solid var(--color-ember);
  border-radius: var(--radius-sm);
  background: var(--color-ember);
  color: var(--color-text-on-ember);
  font-weight: 600;
  cursor: pointer;
}

.desc-preview {
  min-height: 40px;
  max-height: 280px;
  overflow-y: auto;
  padding: 12px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  line-height: 1.5;
  /* Base is full ink so blockquotes, tables and bare text nodes inherit a
     readable colour; the dim treatment is the exception, not the default. */
  color: var(--color-ink);
  cursor: pointer;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.desc-preview:hover {
  background: var(--color-surface-light);
}

.desc-preview :deep(.placeholder) {
  color: var(--color-ink-dim);
  margin: 0;
}

.desc-preview :deep(p) {
  margin: 0 0 8px;
}

.desc-preview :deep(ul),
.desc-preview :deep(ol) {
  margin: 0 0 8px;
  padding-left: 20px;
}

/* Heading sizing/weight is the shared em-relative block in assets/tokens.css,
   which keys off .desc-preview. The 14px base above is what it scales from. */

.desc-preview :deep(code) {
  font-family: var(--font-mono);
  font-size: 13px;
  background: color-mix(in srgb, var(--color-ink) 8%, transparent);
  padding: 1px 4px;
  border-radius: var(--radius-sm);
}

/* Truncated from the HEAD, not the tail. A Nextcloud share URL is ~280px wide
   and its first 156px are the same host on every link, so clipping the tail
   rendered six different links as six identical `https://team.jive.berli`
   pills. `direction: rtl` puts the overflow edge — and the ellipsis — at the
   start, so the distinguishing `…/s/k7jWymo` is what survives; `text-align:
   left` keeps a short URL flush against the ▶ instead of drifting right. A URL
   is one strong-LTR run, so the RTL paragraph direction reorders nothing inside
   it (a trailing `/` is the one neutral that would move, and it lands in the
   clipped head).

   inline-block, not inline-flex: text-overflow only applies to block
   containers, so on the old flex container the text was an anonymous flex item
   and the ellipsis never rendered — it was a hard clip. The ▶ is taken out of
   the inline flow so the RTL direction can't pull it to the far side.

   The fill is 10% ember rather than 18%: --color-ember-text is 4.52:1 on the
   lighter tint but only 4.17:1 on the heavier one, i.e. still short of the text
   floor these 10px chips need. */
.desc-preview :deep(.md-link-chip) {
  display: inline-block;
  position: relative;
  max-width: 40vw;
  padding: 2px 8px 2px 19px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-ember) 10%, transparent);
  color: var(--color-ember-text);
  font-family: var(--font-mono);
  font-size: 10px;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
  direction: rtl;
  text-align: left;
}

.desc-preview :deep(.md-link-chip::before) {
  content: '▶';
  position: absolute;
  top: 50%;
  left: 8px;
  transform: translateY(-50%);
  font-size: 8px;
}

.desc-field {
  padding-bottom: 16px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--color-border);
}

.delete-card-btn {
  padding: 8px 14px;
  border: 1px solid var(--color-overdue);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-overdue);
  font-size: 13px;
  cursor: pointer;
}

.delete-card-btn:hover {
  background: color-mix(in srgb, var(--color-overdue) 12%, transparent);
}

/* On a phone the modal becomes a full-screen sheet. */
@media (max-width: 640px) {
  .backdrop {
    padding: 0;
    align-items: stretch;
  }

  .modal {
    max-width: none;
    min-height: 100dvh;
    border: none;
    border-radius: 0;
    padding: 20px 16px;
  }

  .close-btn {
    width: 40px;
    height: 40px;
    font-size: 24px;
  }

  .label-chip {
    padding: 8px 14px;
    font-size: 13px;
  }

  /* Under 16px, iOS Safari zooms the page when the field gets focus. */
  .column-select {
    font-size: 16px;
  }
}
</style>

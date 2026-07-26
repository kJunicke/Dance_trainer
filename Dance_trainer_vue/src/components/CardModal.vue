<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useBoardStore } from '@/stores/boardStore'
import MarkdownNote from './MarkdownNote.vue'
import CardFamilyTree, { type FamilyNode } from './CardFamilyTree.vue'
import { LABEL_COLORS, LABEL_TEXT_COLORS } from '@/lib/labelColors'
import { useBackButtonClose } from '@/lib/useBackButtonClose'
import {
  ancestorsOf,
  childrenOf,
  composedName,
  descendantIdsOf,
  familyRootOf,
} from '@/lib/cardTree'
import { mergeNote, noteSections, splitSection, type NoteSection } from '@/lib/markdown'

const props = defineProps<{
  cardId: number
  // Deep link from the board face's family icon: open scrolled to the Family
  // section instead of the top of the note.
  focusFamily?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useBoardStore()

// Any close path (X, backdrop, Escape, phone back-gesture) flushes an in-progress
// description edit instead of discarding it.
function closeModal() {
  noteEl.value?.flush()
  emit('close')
}

useBackButtonClose(closeModal)

// The breadcrumb and the family tree move between cards *within* the modal, so
// the card on show is this ref rather than the prop — the board only supplies
// the entry point and never hears about the navigation.
const cardId = ref(props.cardId)
watch(() => props.cardId, (id) => { cardId.value = id })

function openCard(id: number) {
  // Same reason closeModal() flushes: an open block editor holds the *old*
  // card's text and would otherwise commit it onto the card we switch to.
  noteEl.value?.flush()
  cardId.value = id
}

const card = computed(() => store.cards.find((c) => c.id === cardId.value) ?? null)
const historyText = computed(() => (card.value ? store.cardHistoryLabel(card.value) : null))
const boardId = computed(() => store.board?.id ?? null)
const cardLabelIds = computed(
  () => new Set(store.labelsForCard(cardId.value).map((l) => l.id)),
)

const noteEl = ref<{ flush: () => void } | null>(null)
// Delete lives behind a ⋯ menu so destroying a card takes two deliberate taps.
const menuOpen = ref(false)
const modalActionsEl = ref<HTMLElement | null>(null)
const titleDraft = ref('')
const editingTitle = ref(false)
const titleInputEl = ref<HTMLInputElement | null>(null)
watch(
  card,
  (c) => {
    if (!c) { emit('close'); return }
    if (!editingTitle.value) titleDraft.value = c.name
  },
  { immediate: true },
)

async function startEditTitle() {
  titleDraft.value = card.value?.name ?? ''
  editingTitle.value = true
  await nextTick()
  titleInputEl.value?.select()
}

function saveTitle() {
  const trimmed = titleDraft.value.trim()
  if (trimmed && card.value && trimmed !== card.value.name) store.renameCard(cardId.value, trimmed)
  editingTitle.value = false
}

function cancelEditTitle() {
  editingTitle.value = false
}

function onDueDateChange(event: Event) {
  const value = (event.target as HTMLInputElement).value
  store.updateCardDueDate(cardId.value, value || null)
}

function onColumnChange(event: Event) {
  const columnId = Number((event.target as HTMLSelectElement).value)
  if (!card.value || columnId === card.value.column_id) return
  store.moveCard(cardId.value, columnId, store.cardsByColumn(columnId).length)
}

function deleteCard() {
  if (!card.value) return
  // Parts survive their parent — they move up to the grandparent — so the
  // confirm has to name that, or "delete" reads as taking the family with it.
  const parts = children.value.length
  const consequence = parts
    ? `\n\nIts ${parts} ${parts === 1 ? 'part' : 'parts'} will become ${
        parentCard.value ? `parts of “${parentCard.value.name}”` : 'top-level cards'
      }. Their notes and schedules are kept.`
    : ''
  if (!window.confirm(`Delete "${card.value.name}"?${consequence}`)) return
  store.deleteCard(cardId.value)
  // The card watcher also closes the modal, but only after the DB round-trip.
  emit('close')
}

// --- Labels: show only the card's labels as chips; a "+" opens an adder that
// filters existing labels as you type and can create a new one in a chosen color.
const activeLabels = computed(() => store.labelsForCard(cardId.value))

const addingLabel = ref(false)
const labelQuery = ref('')
const colorPickerOpen = ref(false)
const newLabelColor = ref<string>(Object.keys(LABEL_COLORS)[0] ?? 'rose')
const labelInputEl = ref<HTMLInputElement | null>(null)
const labelFieldEl = ref<HTMLElement | null>(null)

// Click anywhere outside the labels field while the adder is open closes it —
// it's an inline popover, not a modal of its own. Same for the ⋯ menu.
function onDocumentClick(e: MouseEvent) {
  if (
    menuOpen.value &&
    modalActionsEl.value &&
    !modalActionsEl.value.contains(e.target as Node)
  ) {
    menuOpen.value = false
  }
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
  store.toggleCardLabel(cardId.value, labelId)
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
    if (!cardLabelIds.value.has(existing.id)) store.toggleCardLabel(cardId.value, existing.id)
  } else {
    const created = await store.createLabel(boardId.value, name, newLabelColor.value)
    if (created) store.toggleCardLabel(cardId.value, created.id)
  }
  labelQuery.value = ''
  labelInputEl.value?.focus()
}

// --- Family: the "part of" link, the tree under the note, and the split/merge
// flows that create and undo it. See Card Relationships.md — nothing here
// touches scheduling.
const ancestors = computed(() => ancestorsOf(store.cards, cardId.value))
const children = computed(() => childrenOf(store.cards, cardId.value))
const parentCard = computed(() => {
  const parentId = card.value?.parent_id
  return parentId == null ? null : (store.cards.find((c) => c.id === parentId) ?? null)
})

// The nested shape CardFamilyTree renders; it assembles nothing itself. `seen`
// guards the descent the way every walk in cardTree.ts guards its own — a cycle
// out of a bad import would recurse forever otherwise.
function familyNode(id: number, seen: Set<number>): FamilyNode {
  seen.add(id)
  const c = store.cards.find((x) => x.id === id)
  return {
    id,
    name: c?.name ?? '',
    columnName: store.columns.find((col) => col.id === c?.column_id)?.name ?? '',
    dueDate: c?.due_date ?? null,
    labels: store.labelsForCard(id),
    children: childrenOf(store.cards, id)
      .filter((child) => !seen.has(child.id))
      .map((child) => familyNode(child.id, seen)),
  }
}

// Null for a card with no relations at all: the section still offers the two
// actions that start a family, but a one-chip "tree" is just noise.
const familyTree = computed<FamilyNode | null>(() => {
  if (ancestors.value.length === 0 && children.value.length === 0) return null
  const root = familyRootOf(store.cards, cardId.value)
  return root ? familyNode(root.id, new Set()) : null
})

// One overlay sheet serves all four family flows — they're mutually exclusive,
// and the picker opens from two places (the breadcrumb and the Family section)
// that would otherwise need the same panel twice.
const dialog = ref<'parent' | 'child' | 'split' | 'merge' | null>(null)
const pickerQuery = ref('')

function openPicker(mode: 'parent' | 'child') {
  pickerQuery.value = ''
  dialog.value = mode
}

// A cycle isn't offerable in the first place, but which ids that excludes
// depends on the direction: a new *parent* may not be one of this card's
// descendants, and a new *part* may not be one of its ancestors — that closes
// the same loop from the other end. `setCardParent` re-checks either way.
const pickerCandidates = computed(() => {
  const blocked =
    dialog.value === 'child'
      ? new Set(ancestors.value.map((a) => a.id))
      : descendantIdsOf(store.cards, cardId.value)
  const q = pickerQuery.value.trim().toLowerCase()
  return store.cards.filter(
    (c) =>
      c.id !== cardId.value &&
      !blocked.has(c.id) &&
      (!q || composedName(store.cards, c.id).toLowerCase().includes(q)),
  )
})

// null is the "None" row, which only the parent picker offers — a detach.
function pick(pickedId: number | null) {
  if (dialog.value === 'child' && pickedId !== null) store.setCardParent(pickedId, cardId.value)
  else store.setCardParent(cardId.value, pickedId)
  dialog.value = null
}

// Every heading at every level, so the list is a flat menu to pick one entry
// from — the ranges overlap on purpose and must never be treated as a split of
// the note. The template shows the level so that's legible.
const sections = computed(() => noteSections(card.value?.description ?? ''))

function splitOut(section: NoteSection) {
  // The exact text the offsets were computed against, handed to the store so it
  // can refuse to rewrite a note that changed during the split's round trips.
  const source = card.value?.description ?? ''
  const { remaining, extracted } = splitSection(source, section)
  dialog.value = null
  store.splitCardFromNote(cardId.value, section.title, extracted, remaining, source)
}

const mergeLevel = ref(1)
const mergePreview = computed(() =>
  parentCard.value && card.value
    ? mergeNote(
        parentCard.value.description ?? '',
        card.value.name,
        card.value.description ?? '',
        mergeLevel.value,
      )
    : '',
)

function openMerge() {
  mergeLevel.value = 1
  dialog.value = 'merge'
}

// Merge is deliberately one tap from here: no confirmation, no warning. The
// modal then follows the text to the parent rather than closing — what the user
// was reading now lives there, and closing would send them back to the board to
// find it. Switching before the await also keeps the `card` watcher from seeing
// a vanished card and closing the modal out from under them.
async function mergeUp() {
  const parent = parentCard.value
  if (!parent) return
  const childId = cardId.value
  const merged = mergePreview.value
  dialog.value = null
  cardId.value = parent.id
  await store.mergeCardIntoParent(childId, merged)
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) closeModal()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  // Backing out of the ⋯ menu shouldn't also throw away the card you were
  // looking at — Escape dismisses the menu first, the modal only after. A
  // family sheet is a layer above both and goes first of all.
  if (dialog.value) {
    dialog.value = null
    return
  }
  if (menuOpen.value) {
    menuOpen.value = false
    return
  }
  closeModal()
}

// Escape only reaches the backdrop's keydown handler if something inside the
// modal has focus.
const backdropEl = ref<HTMLElement | null>(null)
const familyEl = ref<HTMLElement | null>(null)
onMounted(() => {
  backdropEl.value?.focus()
  document.addEventListener('click', onDocumentClick)
  // Opened from the board face's family icon: the note above is uncapped, so
  // the section it deep-links to can be a long way down.
  if (props.focusFamily) familyEl.value?.scrollIntoView({ block: 'start' })
})
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div ref="backdropEl" class="backdrop" @click="onBackdropClick" @keydown="onKeydown" tabindex="-1">
    <div v-if="card" class="modal">
      <div ref="modalActionsEl" class="modal-actions">
        <button class="menu-btn" title="More actions" @click="menuOpen = !menuOpen">⋯</button>
        <button class="close-btn" title="Close" @click="closeModal">×</button>
        <div v-if="menuOpen" class="overflow-menu">
          <button class="menu-item danger" @click="menuOpen = false; deleteCard()">Delete card</button>
        </div>
      </div>
      <!-- Ancestors above the title. The family tree repeats this path, but the
           note between them is uncapped and the tree can be a long scroll away
           — instant context on open is the whole point of keeping both. -->
      <div class="parentage">
        <nav v-if="ancestors.length" class="crumbs">
          <button
            v-for="(ancestor, i) in [...ancestors].reverse()"
            :key="ancestor.id"
            class="crumb"
            @click="openCard(ancestor.id)"
          >{{ ancestor.name }}<span v-if="i > 0" class="crumb-sep">›</span></button>
        </nav>
        <button class="part-of-btn" @click="openPicker('parent')">Part of…</button>
      </div>

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
            @click="store.toggleCardLabel(cardId, label.id)"
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

      <section class="field">
        <label class="field-label">Description</label>
        <div class="desc-preview">
          <MarkdownNote
            ref="noteEl"
            :source="card.description ?? ''"
            @update:source="(v: string) => store.updateCardDescription(cardId, v)"
          />
        </div>
      </section>

      <section ref="familyEl" class="field">
        <label class="field-label">Family</label>
        <CardFamilyTree
          v-if="familyTree"
          :root="familyTree"
          :current-id="cardId"
          @open="openCard"
        />
        <div class="family-actions">
          <button
            class="family-btn"
            :disabled="!sections.length"
            :title="
              sections.length
                ? 'Turn a section of the note into its own card'
                : 'The note has no headers to split at'
            "
            @click="dialog = 'split'"
          >+ Split</button>
          <button class="family-btn" @click="openPicker('child')">+ Add existing card as part</button>
          <button v-if="parentCard" class="family-btn" @click="openMerge()">
            Merge into “{{ parentCard.name }}”
          </button>
        </div>
      </section>

      <!-- All four family flows are one-decision dialogs over the modal, and
           they share this sheet rather than each growing an inline panel. -->
      <div v-if="dialog" class="sheet-backdrop" @click.self="dialog = null">
        <div class="sheet">
          <template v-if="dialog === 'parent' || dialog === 'child'">
            <h3 class="sheet-title">
              {{ dialog === 'parent' ? 'Part of…' : 'Add existing card as part' }}
            </h3>
            <input v-model="pickerQuery" class="label-input" placeholder="Find a card" />
            <button
              v-if="dialog === 'parent' && card.parent_id !== null"
              class="sheet-row"
              @click="pick(null)"
            >None — make this a top-level card</button>
            <ul v-if="pickerCandidates.length" class="sheet-list">
              <li v-for="candidate in pickerCandidates" :key="candidate.id">
                <button class="sheet-row" @click="pick(candidate.id)">
                  {{ composedName(store.cards, candidate.id) }}
                </button>
              </li>
            </ul>
            <p v-else class="adder-empty">No card matches.</p>
          </template>

          <template v-else-if="dialog === 'split'">
            <h3 class="sheet-title">Split a section into its own card</h3>
            <p class="sheet-hint">
              The header becomes the new card's name, and a section takes its subsections with it.
            </p>
            <ul class="sheet-list">
              <li v-for="section in sections" :key="section.start">
                <button
                  class="sheet-row"
                  :style="{ paddingLeft: `${8 + (section.level - 1) * 14}px` }"
                  @click="splitOut(section)"
                >
                  <span class="hashes">{{ '#'.repeat(section.level) }}</span> {{ section.title }}
                </button>
              </li>
            </ul>
          </template>

          <template v-else>
            <h3 class="sheet-title">Merge into “{{ parentCard?.name }}”</h3>
            <div class="level-row">
              <label class="field-label">Title level</label>
              <button
                v-for="level in 6"
                :key="level"
                class="level-btn"
                :class="{ selected: level === mergeLevel }"
                @click="mergeLevel = level"
              >{{ '#'.repeat(level) }}</button>
            </div>
            <pre class="merge-preview">{{ mergePreview }}</pre>
            <button class="create-btn" @click="mergeUp()">Merge</button>
          </template>
        </div>
      </div>
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
  max-width: 720px;
}

.modal-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 2px;
}

.close-btn,
.menu-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  color: var(--color-ink);
  opacity: 0.5;
}

.close-btn:hover,
.menu-btn:hover {
  opacity: 1;
}

/* Anchored to the actions row's RIGHT edge so it grows leftward, into the
   modal. Anchoring it left grows it rightward instead: the row is only as wide
   as its two buttons and sits 12px from the modal's right edge, so on a
   full-bleed phone sheet a third of the menu rendered past the viewport and
   got clipped by .backdrop's overflow — with Delete now only reachable here,
   that made the card undeletable. */
.overflow-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 140px;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  box-shadow: var(--shadow-modal);
  z-index: 1;
}

.menu-item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
  font-size: 13px;
  cursor: pointer;
}

.menu-item.danger {
  color: var(--color-overdue);
}

.menu-item.danger:hover {
  background: color-mix(in srgb, var(--color-overdue) 12%, transparent);
}

/* Same header clearance as .title, for the same reason. */
.parentage {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin: 0 68px 8px 0;
}

/* Head-truncated, not tail: the nearest parent is what places the card, so the
   *root* end is the one to lose on a narrow screen. row-reverse over a reversed
   list keeps the reading order left-to-right while putting the overflow — and
   so the clip — on the left edge. No justify-content: the row is a shrink-to-fit
   flex item, so it never has free space to distribute, and setting flex-end
   would flip which edge the overflow spills past. */
.crumbs {
  display: flex;
  flex-direction: row-reverse;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}

.crumb {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  padding: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-ink-dim);
  white-space: nowrap;
  cursor: pointer;
}

.crumb:hover {
  color: var(--color-ember-text);
}

.crumb-sep {
  color: var(--color-border);
}

.part-of-btn {
  flex-shrink: 0;
  padding: 2px 8px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-ink-dim);
  cursor: pointer;
}

.part-of-btn:hover {
  border-color: var(--color-ember);
  color: var(--color-ember-text);
}

/* Right margin clears the header button row (⋯ + ×), which grows on the phone
   breakpoint — see the override there. Without it the title's first line runs
   under the buttons and a tap meant for the title opens the menu. */
.title {
  margin: 0 68px 20px 0;
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

/* Same header clearance as .title, but taken out of the width rather than as a
   right margin: with width:100% the box is over-constrained and LTR silently
   drops margin-right, so the field spanned the full content box and ran under
   the buttons painted on top of it — the caret at the end of a long title sat
   behind the ⋯, and a tap there opened the menu instead of placing it. */
.title-input {
  display: block;
  width: calc(100% - 68px);
  margin: 0 0 20px;
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

/* MarkdownNote ships the markdown typography itself; what stays here is the
   palette it themes off, in the modal's light --color-* tokens.

   --note-ink is full ink rather than dim so blockquotes, tables and bare text
   nodes inherit a readable colour; the dim treatment is the exception (the
   placeholder / + add row), never the default.

   The chip is --color-ember-text on a *10%* ember fill, not --color-ember on
   18%: ember-as-text is only 3.30:1 on white, and ember-text on the heavier
   tint is 4.17:1 — both under the floor these 10px chips need, where the
   lighter tint clears it at 4.52:1. The chip's head-truncation (and why it
   truncates from the head at all) travels with the chip rule into
   MarkdownNote.vue; --note-chip-max is the width it clips at.

   No max-height any more: the notes field grows to its natural height and the
   modal itself scrolls (the backdrop on desktop, the full-screen sheet on a
   phone). The old 280/440px cap existed only to keep the destructive Delete
   button reachable below it, and Delete now lives in the header's ⋯ menu. */
.desc-preview {
  --note-font-size: 14px;
  --note-ink: var(--color-ink);
  --note-ink-dim: var(--color-ink-dim);
  --note-accent: var(--color-ember-text);
  --note-accent-bg: color-mix(in srgb, var(--color-ember) 10%, transparent);
  --note-hover-bg: var(--color-surface-light);
  --note-editor-bg: var(--color-bg);
  --note-editor-border: var(--color-ember);
  --note-chip-max: 40vw;
  min-height: 40px;
  padding: 12px;
  border-radius: var(--radius-sm);
  line-height: 1.5;
}

.family-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

/* Same dashed-ember affordance as the label "+": these add structure rather
   than commit anything, and none of them is the modal's primary action. */
.family-btn {
  padding: 6px 10px;
  border: 1px dashed var(--color-ember);
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: 12px;
  color: var(--color-ember-text);
  cursor: pointer;
}

.family-btn:hover:not(:disabled) {
  background: var(--color-surface-light);
}

.family-btn:disabled {
  border-color: var(--color-border);
  color: var(--color-ink-dim);
  cursor: default;
}

.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  z-index: 101;
}

.sheet {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 420px;
  max-height: 100%;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-modal);
  overflow-y: auto;
}

.sheet-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 15px;
  color: var(--color-ink);
}

.sheet-hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-ink-dim);
}

.sheet-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 260px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.sheet-row {
  display: block;
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
  font-size: 14px;
  color: var(--color-ink);
  cursor: pointer;
}

.sheet-row:hover {
  background: var(--color-surface-light);
}

/* The literal hashes carry the level, so the indent doesn't have to be read on
   its own — and picking a `##` visibly takes the `###`s nested under it. */
.hashes {
  font-family: var(--font-mono);
  color: var(--color-ink-dim);
}

.level-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.level-row .field-label {
  margin: 0;
}

.level-btn {
  padding: 4px 7px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-ink-dim);
  cursor: pointer;
}

.level-btn.selected {
  border-color: var(--color-ember);
  color: var(--color-ember-text);
}

/* Raw markdown rather than the rendered note: the one thing the level picker
   changes is heading depth, and `##` vs `###` is what makes that legible. */
.merge-preview {
  margin: 0;
  max-height: 240px;
  overflow: auto;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-ink);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
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

  .close-btn,
  .menu-btn {
    width: 40px;
    height: 40px;
    font-size: 24px;
  }

  /* Two 40px targets plus the row's own inset, measured from the sheet's
     narrower 16px padding. */
  .title,
  .parentage {
    margin-right: 84px;
  }

  .title-input {
    width: calc(100% - 84px);
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

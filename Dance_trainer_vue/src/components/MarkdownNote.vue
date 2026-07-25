<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { splitBlocks, caretOffsetInBlock, focusAtOffset } from '@/lib/markdown'

const props = defineProps<{
  source: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:source': [string]
}>()

const blocks = computed(() => splitBlocks(props.source))

// Index of the block being edited. `blocks.length` is the virtual trailing
// block — how a new paragraph gets appended to a note that's already long.
const editingIndex = ref<number | null>(null)
const draft = ref('')
// Newlines marked stored on the block's raw. They're structure, not content, so
// they're held back from the textarea and restored on save — otherwise editing
// a paragraph eats the blank line after it and welds it onto the next block.
const draftTrailing = ref('')
const editHeight = ref(0)
// Plain function refs rather than `ref="…"`: a template ref registered inside
// v-for is collected into an array, and only ever one editor is open.
const editorEl = ref<HTMLTextAreaElement | null>(null)
const rootEl = ref<HTMLElement | null>(null)

// Queried on demand rather than kept in a template-ref array, which would need
// to stay in step with a list that re-renders on every save. Only ever called
// while all blocks are rendered, so DOM order matches block order.
function blockElAt(index: number): HTMLElement | null {
  return rootEl.value?.querySelectorAll<HTMLElement>(':scope > .md-block')[index] ?? null
}

function setEditor(el: unknown) {
  editorEl.value = (el as HTMLTextAreaElement | null) ?? null
}

// The editor never scrolls internally — it grows to fit its raw source and
// pushes the blocks below it down. Raw markdown is almost always taller than
// what it renders to (`##`, `- `, a link's `](url)` all wrap), so an editor
// fixed to the rendered block's height would hide most of what you're editing
// behind a scrollbar, which is the disorientation this whole model exists to
// remove.
function autosize() {
  const el = editorEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

const isAppending = computed(() => editingIndex.value === blocks.value.length)

function targetAt(index: number): { start: number; raw: string } {
  const block = blocks.value[index]
  return block ? { start: block.start, raw: block.raw } : { start: props.source.length, raw: '' }
}

// Handled on mousedown, not click. Committing the open editor reflows the note
// — the raw block collapses back to its rendered height — and that reflow lands
// *between* mousedown and click, so by the time a click handler ran, the block
// aimed at had already slid out from under the pointer and the tap either hit
// the wrong block or nothing at all.
//
// So the click is resolved here, against the layout as it still stands, and
// carried across the reflow as a source offset: pixel coordinates and block
// indices both go stale when the note reflows, a source offset doesn't.
async function startEdit(index: number, e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const block = blocks.value[index]
  if (!block) return
  // Suppress mousedown's default focus change. Vue flushes `nextTick` at the
  // microtask checkpoint *before* that default action runs, so without this we
  // mount the editor and focus it, and the browser then moves focus to the
  // backdrop — blurring the editor, which saves and closes it in the same
  // gesture that opened it. It also keeps the previous editor focused until
  // we've read the layout below, since blur is what commits it.
  e.preventDefault()
  let offset = block.start + caretOffsetInBlock(el, e, block.raw)

  if (editingIndex.value !== null) {
    const open = targetAt(editingIndex.value)
    // Text before the edited block keeps its offsets; text after it shifts by
    // however much that block grew or shrank.
    if (open.start < block.start) offset += pendingReplacement().length - open.raw.length
    saveEdit()
    await nextTick()
  }
  openAt(offset)
}

// Open the block containing `sourceOffset`, caret at that offset. Resolving the
// block by offset rather than by index keeps this correct even when the save
// that just ran changed how many blocks there are.
async function openAt(sourceOffset: number) {
  const list = blocks.value
  let index = list.findIndex((b) => sourceOffset < b.start + b.raw.length)
  if (index < 0) index = list.length - 1
  const block = list[index]
  if (!block) return
  const trailing = block.raw.match(/\n*$/)?.[0] ?? ''
  const body = block.raw.slice(0, block.raw.length - trailing.length)

  editHeight.value = blockElAt(index)?.offsetHeight ?? 0
  draft.value = body
  draftTrailing.value = trailing
  editingIndex.value = index
  await nextTick()
  autosize()
  if (editorEl.value) {
    focusAtOffset(editorEl.value, Math.min(Math.max(sourceOffset - block.start, 0), body.length))
  }
}

async function startAppend() {
  if (editingIndex.value !== null) saveEdit()
  draft.value = ''
  draftTrailing.value = ''
  editHeight.value = 0
  editingIndex.value = blocks.value.length
  await nextTick()
  autosize()
  editorEl.value?.focus()
}

function pendingReplacement(): string {
  const body = draft.value.trim()
  if (!body) return ''
  const replacement = body + (draftTrailing.value || '\n\n')
  // Appending onto a note whose last block has no trailing blank line: add the
  // separator so the new text lexes as its own block instead of merging.
  if (isAppending.value && props.source.length && !props.source.endsWith('\n\n')) {
    return (props.source.endsWith('\n') ? '\n' : '\n\n') + replacement
  }
  return replacement
}

function saveEdit() {
  const index = editingIndex.value
  if (index === null) return
  const { start, raw } = targetAt(index)
  const next = props.source.slice(0, start) + pendingReplacement() + props.source.slice(start + raw.length)

  editingIndex.value = null
  if (next !== props.source) emit('update:source', next)
}

function cancelEdit() {
  editingIndex.value = null
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    // Escape backs out of the block edit only — without this it keeps bubbling
    // to the modal's own handler and closes the whole card.
    e.stopPropagation()
    cancelEdit()
    return
  }
  // Cmd/Ctrl+Enter commits without having to reach for the mouse.
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    saveEdit()
    return
  }
  if (e.key !== 'Tab') return
  e.preventDefault()
  const el = e.target as HTMLTextAreaElement
  const { selectionStart, selectionEnd, value } = el
  draft.value = value.slice(0, selectionStart) + '\t' + value.slice(selectionEnd)
  nextTick(() => {
    el.selectionStart = el.selectionEnd = selectionStart + 1
    autosize()
  })
}

// Let the parent commit an open edit before it closes the modal.
defineExpose({ flush: saveEdit })
</script>

<template>
  <div ref="rootEl" class="md-note">
    <template v-for="(block, i) in blocks" :key="block.start">
      <textarea
        v-if="editingIndex === i"
        :ref="setEditor"
        class="md-block-editor"
        :style="editHeight ? { minHeight: editHeight + 'px' } : undefined"
        v-model="draft"
        @input="autosize"
        @keydown="onKeydown"
        @blur="saveEdit"
      />
      <div
        v-else
        class="md-block"
        v-html="block.html"
        @mousedown="startEdit(i, $event)"
      />
    </template>

    <textarea
      v-if="isAppending"
      :ref="setEditor"
      class="md-block-editor"
      v-model="draft"
      placeholder="New note…"
      @input="autosize"
      @keydown="onKeydown"
      @blur="saveEdit"
    />
    <button v-else class="md-add" @click="startAppend">
      {{ blocks.length ? '+ add' : (placeholder ?? 'Click to add a description…') }}
    </button>
  </div>
</template>

<style scoped>
.md-note {
  display: flow-root;
}

/* Blocks read as plain note text until hovered — the affordance shouldn't turn
   the note into a grid of obvious boxes. */
.md-block {
  border-radius: var(--radius-sm);
  margin: 0 -4px;
  padding: 0 4px;
  cursor: text;
}

.md-block:hover {
  background: var(--color-surface-light);
}

/* Sized and positioned to sit where the block did, so committing an edit
   doesn't shift the rest of the note. */
.md-block-editor {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin: 0 -4px 8px;
  padding: 4px;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  color: var(--color-ink);
  background: var(--color-bg);
  border: 1px solid var(--color-ember);
  border-radius: var(--radius-sm);
  /* Height is driven entirely by autosize() — never an internal scrollbar. */
  overflow: hidden;
  resize: none;
}

.md-block-editor:focus {
  outline: none;
}

.md-add {
  display: block;
  width: 100%;
  margin-top: 4px;
  padding: 4px;
  text-align: left;
  font: inherit;
  color: var(--color-ink-dim);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.md-add:hover {
  background: var(--color-surface-light);
  color: var(--color-ink);
}
</style>

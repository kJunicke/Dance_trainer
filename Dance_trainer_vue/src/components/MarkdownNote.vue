<script setup lang="ts">
import { ref, computed, nextTick, watch, onUnmounted } from 'vue'
import {
  renderMarkdown,
  splitBlocks,
  caretOffsetInBlock,
  focusAtOffset,
  hasVisibleContent,
  blockSeparator,
} from '@/lib/markdown'

const props = withDefaults(
  defineProps<{
    source: string
    editable?: boolean
    placeholder?: string
  }>(),
  { editable: true },
)

const emit = defineEmits<{
  'update:source': [string]
}>()

// Read-only is the board card face, which renders one of these per card for a
// whole board. It renders the note in a single pass and never touches the block
// machinery — no lexing, no per-token render, no handlers. renderMarkdown()
// strips href/target/rel, so its links are deliberately dead: a click anywhere
// on a board card opens the card, it never navigates away mid-scan.
//
// Both computeds are lazy and the template reads exactly one of them, so the
// editable path costs nothing on the board and vice versa.
const readOnlyHtml = computed(() => renderMarkdown(props.source))
const blocks = computed(() => splitBlocks(props.source))

// Index of the block being edited. `blocks.length` is the virtual trailing
// block — how a new paragraph gets appended to a note that's already long.
const editingIndex = ref<number | null>(null)
const draft = ref('')
const editHeight = ref(0)
// Plain function refs rather than `ref="…"`: a template ref registered inside
// v-for is collected into an array, and only ever one editor is open.
const editorEl = ref<HTMLTextAreaElement | null>(null)
const rootEl = ref<HTMLElement | null>(null)

// Every opened editor gets a sequence number, because blur commits immediately
// but closes a macrotask later (see onBlur). Two things need to tell "the
// editor I saved" from "an editor opened since": the commit, which must happen
// once — a close path landing inside that window would splice the already-saved
// draft over a source that has moved on — and the deferred close itself, which
// must not close a newly opened editor.
let openSeq = 0
let committedSeq = -1
// Set when an editor opens, handed back on a keyboard close. See openAt().
let lastFocus: HTMLElement | null = null

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

// --- Opening a block: capture on pointerdown, commit on pointerup.
//
// Both halves have to exist. Resolving the target on *down* is what survives
// the reflow: committing the open editor collapses a raw block back to its
// rendered height, and that reflow lands before any later event, so a handler
// running on up/click would aim at a layout where the block had already slid
// out from under the pointer. Acting only on *up* is what keeps a scroll
// gesture that happens to start on a block from opening an editor.
//
// What's carried across is the target block's start offset plus a caret offset
// within it — never a pixel coordinate or a block index, both of which go stale
// when the note reflows.
const MOVE_CANCEL_PX = 10
let pending: { start: number; caret: number; x: number; y: number; pointerId: number } | null = null

function discardPending() {
  pending = null
}

function onBlockPointerDown(index: number, e: PointerEvent) {
  pending = null
  // Right/middle click belongs to the context menu, not to opening an editor.
  if (e.button !== 0) return
  const block = blocks.value[index]
  if (!block) return
  // A click on a link chip is a click on the link — following a reference video
  // is the commonest thing done in these notes, so it must not also open an
  // editor. (`a` is exempt from the root's preventDefault below for the other
  // half of the same requirement: keeping the navigation itself alive.) The
  // block stays editable from the slack beside the chip, which is most of its
  // width (chips cap at --note-chip-max).
  if ((e.target as HTMLElement).closest('a')) return
  pending = {
    start: block.start,
    caret: caretOffsetInBlock(e.currentTarget as HTMLElement, e, block.raw),
    x: e.clientX,
    y: e.clientY,
    pointerId: e.pointerId,
  }
}

function onPointerMove(e: PointerEvent) {
  if (!pending || e.pointerId !== pending.pointerId) return
  if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > MOVE_CANCEL_PX) pending = null
}

async function onPointerUp(e: PointerEvent) {
  const hit = pending
  pending = null
  if (!hit || e.pointerId !== hit.pointerId) return

  let start = hit.start
  if (editingIndex.value !== null) {
    // Text before the edited block keeps its offsets; text after it shifts by
    // whatever the commit actually changed — which is the commit's own answer,
    // not something to re-derive here.
    const openStart = targetAt(editingIndex.value).start
    const delta = saveEdit()
    if (openStart < start) start += delta
    await nextTick()
  }
  openAt(start, hit.caret)
}

// Suppress mousedown's default focus change. It has to be mousedown and not
// pointerdown: Chrome fires a touch pointerdown as non-cancelable while a
// scroll is still possible, and on touch the compatibility mousedown arrives
// *after* pointerup — i.e. after the editor has already been opened and
// focused. Without this the browser then moves focus off the freshly-mounted
// textarea (Vue flushes nextTick at the microtask checkpoint before the default
// action runs), firing blur, which saves and closes the editor in the same
// gesture that opened it — it looked like it never opened at all. This one
// handler covers both the real mouse mousedown and the touch compatibility one,
// and is the only place preventDefault is used.
function onRootMouseDown(e: MouseEvent) {
  // Only two exemptions. Links must navigate, and the open textarea must stay
  // tappable so the caret can be repositioned inside it. Buttons — the `+ add`
  // row and every formatting-bar key — are deliberately NOT exempt: they act on
  // pointerdown and never need mousedown's default, whereas letting them take
  // focus blurs the textarea, which commits and (a macrotask later) closes the
  // editor. For the formatting bar that is fatal: the first indent tap would
  // close the very editor it was meant to indent. `@pointerdown.prevent` on
  // those buttons usually suppresses the compatibility mousedown, but that is
  // not guaranteed on every engine matching (pointer: coarse) — pen and hybrid
  // inputs included — so the guard has to cover them too.
  if ((e.target as HTMLElement).closest('a, textarea')) return
  e.preventDefault()
}

// Open the block starting at `start`, caret `caret` characters into its raw
// source. Matching on the start offset — not on "the block containing this
// offset" — is what keeps a click on a block's last word from opening the block
// below: a caret at the very end of a block is also the first offset of the
// next one, and a click in the slack to the right of a short line resolves
// there every time.
async function openAt(start: number, caret: number) {
  const list = blocks.value
  let index = list.findIndex((b) => b.start === start)
  // The save that just ran can re-lex the text around it, so if the block no
  // longer starts exactly there, take whichever one now covers that offset.
  if (index < 0) index = list.findIndex((b) => start < b.start + b.raw.length)
  const block = list[index]
  if (!block) return
  const trailing = block.raw.match(/\n*$/)?.[0] ?? ''
  const body = block.raw.slice(0, block.raw.length - trailing.length)

  editHeight.value = blockElAt(index)?.offsetHeight ?? 0
  draft.value = body
  // Whatever held focus before the editor took it. Opening a block deliberately
  // suppresses the browser's own focus change (see onRootMouseDown), so this is
  // still whatever the surrounding surface had focused — the card modal focuses
  // its backdrop on mount precisely so Escape has somewhere to land. Without
  // handing that back on a keyboard close, focus falls to <body> and Escape
  // stops closing the card after you've edited a single block.
  lastFocus = document.activeElement as HTMLElement | null
  openSeq++
  editingIndex.value = index
  await nextTick()
  autosize()
  if (editorEl.value) focusAtOffset(editorEl.value, Math.min(caret, body.length))
}

async function startAppend() {
  saveEdit()
  draft.value = ''
  editHeight.value = 0
  openSeq++
  editingIndex.value = blocks.value.length
  await nextTick()
  autosize()
  editorEl.value?.focus()
}

// The text the open editor will splice in over its block's raw source —
// separator included, since what follows the block has to keep lexing as its
// own block. Empty when the block has been emptied, which deletes it.
function pendingReplacement(): string {
  const index = editingIndex.value
  if (index === null || !hasVisibleContent(draft.value)) return ''
  const { start, raw } = targetAt(index)
  // Trailing-only. A full trim() ate the leading tab that the format bar's
  // indent button — and the Tab key at offset 0 — had just inserted, so
  // indenting a block or nesting a list's first bullet saved a byte-identical
  // source and looked like it did nothing. blockSeparator() owns the trailing
  // side; nothing owns the leading side, which is exactly why it has to survive.
  const body = draft.value.replace(/\s+$/, '')
  const sep = blockSeparator(
    body,
    props.source.slice(start + raw.length),
    raw.match(/\n*$/)?.[0] ?? '',
  )
  // Appending onto a note whose last block has no trailing blank line: add the
  // separator so the new text lexes as its own block instead of merging.
  const prefix =
    isAppending.value && props.source.length && !props.source.endsWith('\n\n')
      ? props.source.endsWith('\n')
        ? '\n'
        : '\n\n'
      : ''
  return prefix + body + sep
}

// Splice, don't rewrite: everything outside the edited block stays
// byte-identical, so no round-trip through a renderer can quietly reformat the
// rest of a note. Returns how far offsets *after* the edited block moved — 0
// when nothing was committed — so a caller holding an offset into the old
// source can carry it across rather than re-deriving it (which, inside the
// deferred-close window, would read a source that has already advanced).
function commitEdit(): number {
  const index = editingIndex.value
  if (index === null || committedSeq === openSeq) return 0
  committedSeq = openSeq
  const { start, raw } = targetAt(index)
  const replacement = pendingReplacement()
  // A deleted block takes the blank line that followed it with it. Splicing out
  // only `raw` left the separator behind, and since those stray newlines lex as
  // `space` tokens that splitBlocks() skips, nothing ever showed them — they
  // just accumulated in the stored description, one per deletion, for good.
  // Deleting the last block leaves the note's own trailing newline alone, so a
  // following no-op save is still byte-identical.
  const rest = props.source.slice(start + raw.length)
  const spliced =
    props.source.slice(0, start) + replacement + (replacement ? rest : rest.replace(/^\n+/, ''))
  // Emptying the last block should leave the note actually empty, not a string
  // of leftover invisibles. splitBlocks() skips tokens with nothing visible in
  // them, so a note whose only remaining content is a stray zero-width
  // character reads as zero blocks here and still renders a bare empty
  // paragraph on the board face, where the truthiness of `description` is what
  // decides whether a note shows at all.
  const next = hasVisibleContent(spliced) ? spliced : ''
  if (next !== props.source) emit('update:source', next)
  return next.length - props.source.length
}

// Every explicit close — Cmd/Ctrl+Enter, switching blocks, flush(), append —
// commits and closes in one go.
function saveEdit(): number {
  const delta = commitEdit()
  editingIndex.value = null
  return delta
}

// Blur is the exception: save now, collapse a macrotask later. Blur fires as
// the user's tap lands on the *next* element (a Session Review bucket button,
// say), and collapsing the editor synchronously shifts that element out from
// under the pointer before its own click completes, silently swallowing the
// tap. Only the visual close is deferred — the data is written immediately.
function onBlur() {
  commitEdit()
  const seq = openSeq
  setTimeout(() => {
    if (openSeq === seq) editingIndex.value = null
  }, 0)
}

function cancelEdit() {
  editingIndex.value = null
}

// Give focus back to whatever had it before this editor opened. Only for the
// keyboard closes: a blur close means the user has already moved focus
// somewhere themselves, and a click onto another block is about to focus that
// block's editor instead.
function restoreFocus() {
  if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true })
  lastFocus = null
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    // Escape backs out of the block edit only — without this it keeps bubbling
    // to the modal's own handler and closes the whole card.
    e.stopPropagation()
    cancelEdit()
    restoreFocus()
    return
  }
  // Cmd/Ctrl+Enter commits without having to reach for the mouse.
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    saveEdit()
    restoreFocus()
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

// --- Formatting bar. A phone keyboard has no Tab key, so nested list editing
// was impossible on mobile; desktop has Tab and Cmd+Enter and never sees this.
const isCoarse = window.matchMedia('(pointer: coarse)').matches
const showFormatBar = computed(() => isCoarse && editingIndex.value !== null)

// Pinned directly above the on-screen keyboard: the visual viewport shrinks by
// the keyboard's height, so what's hidden below it is the gap between the
// layout viewport's bottom and the visual viewport's.
const barBottom = ref(0)
function updateBarOffset() {
  const vv = window.visualViewport
  barBottom.value = vv ? window.innerHeight - (vv.height + vv.offsetTop) : 0
}

function unsubscribeViewport() {
  window.visualViewport?.removeEventListener('resize', updateBarOffset)
  window.visualViewport?.removeEventListener('scroll', updateBarOffset)
}

watch(showFormatBar, (open) => {
  const vv = window.visualViewport
  if (!vv) return
  if (!open) {
    unsubscribeViewport()
    return
  }
  updateBarOffset()
  vv.addEventListener('resize', updateBarOffset)
  vv.addEventListener('scroll', updateBarOffset)
})

onUnmounted(unsubscribeViewport)

// The buttons fire on pointerdown (see the template), so the textarea still
// holds focus and its selection here. Write back, restore the selection, regrow.
async function applyToDraft(value: string, selStart: number, selEnd: number) {
  draft.value = value
  await nextTick()
  const el = editorEl.value
  if (!el) return
  el.setSelectionRange(selStart, selEnd)
  autosize()
}

// Indent/outdent every line the selection touches. Real tabs, matching what the
// Tab key inserts.
function shiftLines(indent: boolean) {
  const el = editorEl.value
  if (!el) return
  const { selectionStart, selectionEnd } = el
  const value = draft.value
  const from = value.lastIndexOf('\n', selectionStart - 1) + 1
  const end = value.indexOf('\n', selectionEnd)
  const to = end < 0 ? value.length : end

  let headDelta = 0
  let totalDelta = 0
  const shifted = value
    .slice(from, to)
    .split('\n')
    .map((line, i) => {
      // Outdent takes one tab, or up to two spaces where a note was typed with
      // spaces instead.
      const strip = indent ? '' : (/^(?:\t| {1,2})/.exec(line)?.[0] ?? '')
      const delta = indent ? 1 : -strip.length
      if (i === 0) headDelta = delta
      totalDelta += delta
      return indent ? `\t${line}` : line.slice(strip.length)
    })
    .join('\n')

  applyToDraft(
    value.slice(0, from) + shifted + value.slice(to),
    Math.max(from, selectionStart + headDelta),
    Math.max(from, selectionEnd + totalDelta),
  )
}

// Wrap the selection; with nothing selected, drop the pair in and sit between.
function wrapSelection(marker: string) {
  const el = editorEl.value
  if (!el) return
  const { selectionStart, selectionEnd } = el
  const value = draft.value
  applyToDraft(
    value.slice(0, selectionStart) +
      marker +
      value.slice(selectionStart, selectionEnd) +
      marker +
      value.slice(selectionEnd),
    selectionStart + marker.length,
    selectionEnd + marker.length,
  )
}

// # -> ## -> ### -> none on the caret's line.
function cycleHeading() {
  const el = editorEl.value
  if (!el) return
  const { selectionStart, selectionEnd } = el
  const value = draft.value
  const from = value.lastIndexOf('\n', selectionStart - 1) + 1
  const prefix = /^(?:#+ ?)?/.exec(value.slice(from))?.[0] ?? ''
  const level = prefix.replace(/[^#]/g, '').length
  const next = level >= 3 ? '' : `${'#'.repeat(level + 1)} `
  const delta = next.length - prefix.length

  applyToDraft(
    value.slice(0, from) + next + value.slice(from + prefix.length),
    Math.max(from, selectionStart + delta),
    Math.max(from, selectionEnd + delta),
  )
}

// Let the parent commit an open edit before it closes the modal.
defineExpose({ flush: saveEdit })
</script>

<template>
  <div v-if="!editable" class="md-note">
    <div class="md-block" v-html="readOnlyHtml" />
  </div>

  <div
    v-else
    ref="rootEl"
    class="md-note editable"
    @mousedown="onRootMouseDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="discardPending"
    @pointerleave="discardPending"
  >
    <template v-for="(block, i) in blocks" :key="block.start">
      <textarea
        v-if="editingIndex === i"
        :ref="setEditor"
        class="md-block-editor"
        :style="editHeight ? { minHeight: editHeight + 'px' } : undefined"
        v-model="draft"
        @input="autosize"
        @keydown="onKeydown"
        @blur="onBlur"
      />
      <div v-else class="md-block" v-html="block.html" @pointerdown="onBlockPointerDown(i, $event)" />
    </template>

    <textarea
      v-if="isAppending"
      :ref="setEditor"
      class="md-block-editor"
      v-model="draft"
      placeholder="New note…"
      @input="autosize"
      @keydown="onKeydown"
      @blur="onBlur"
    />
    <button v-else class="md-add" @click="startAppend">
      {{ blocks.length ? '+ add' : (placeholder ?? 'Click to add a description…') }}
    </button>

    <div v-if="showFormatBar" class="md-format-bar" :style="{ bottom: `${barBottom}px` }">
      <button title="Outdent" @pointerdown.prevent="shiftLines(false)">⇤</button>
      <button title="Indent" @pointerdown.prevent="shiftLines(true)">⇥</button>
      <button title="Bold" class="fmt-bold" @pointerdown.prevent="wrapSelection('**')">B</button>
      <button title="Italic" class="fmt-italic" @pointerdown.prevent="wrapSelection('*')">I</button>
      <button title="Heading" @pointerdown.prevent="cycleHeading()">H</button>
    </div>
  </div>
</template>

<style scoped>
.md-note {
  display: flow-root;
  font-size: var(--note-font-size, 14px);
  color: var(--note-ink, #2a2420);
}

/* Blocks read as plain note text until hovered — the affordance shouldn't turn
   the note into a grid of obvious boxes. The bleed is the hover highlight's,
   not padding around the tap target: it is zero-sum (−4px margin, +4px padding)
   so the text sits exactly where it would unstyled. Read-only has no hover, so
   it gets none of it. */
.editable .md-block {
  border-radius: var(--radius-sm);
  margin: 0 -4px;
  padding: 0 4px;
  cursor: text;
}

.editable .md-block:hover {
  background: var(--note-hover-bg, #ffffff);
}

/* --- Markdown typography. This lives here, once, because scoped styles don't
   reach v-html content without :deep() and the three surfaces used to keep
   three drifting copies of these rules — which is why a fix would land on the
   card modal and never on the board face or the practice card. Everything
   palette- or size-dependent reads a --note-* variable the host sets. */

/* A `# Heading` in a note is field content, not a page heading: at the browser
   default an <h1> is 2em, which on the board card face means 24px against a
   15px card title inside a preview clipped at 4.5em. Sizes stay *em-relative*
   because the three surfaces deliberately read at different base sizes (board
   12px, modal and practice card 14px) — each host keeps owning its own base.
   See Dance_trainer_logseq/pages/Card Notes.md. */
.md-block :deep(:is(h1, h2, h3, h4, h5, h6)) {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1.25;
}

.md-block :deep(h1) {
  font-size: 1.15em;
}

.md-block :deep(h2) {
  font-size: 1.08em;
}

.md-block :deep(:is(h3, h4, h5, h6)) {
  font-size: 1em;
}

.md-block :deep(p) {
  margin: 0 0 var(--note-block-gap, 8px);
}

/* The reset belongs to read-only only, where the whole note is one .md-block
   and the last paragraph's margin is dead space at the bottom of the field. In
   editable mode every block is its own element, so `p:last-child` would match
   in all of them and zero the gap between the blocks. */
.md-note:not(.editable) .md-block :deep(p:last-child) {
  margin-bottom: 0;
}

/* Indent in em for the same reason the headings are: 20px of bullet indent at
   the modal's 14px is a third of the board face's 12px line. */
.md-block :deep(:is(ul, ol)) {
  margin: 0 0 var(--note-block-gap, 8px);
  padding-left: 1.4em;
}

.md-block :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.93em;
  background: color-mix(in srgb, var(--note-ink, #2a2420) 8%, transparent);
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
   containers, so on a flex container the text is an anonymous flex item and the
   ellipsis never renders — it becomes a hard clip. The ▶ is taken out of the
   inline flow so the RTL direction can't pull it to the far side. */
.md-block :deep(.md-link-chip) {
  display: inline-block;
  position: relative;
  max-width: var(--note-chip-max, 40vw);
  padding: 2px 8px 2px 19px;
  border-radius: 999px;
  background: var(--note-accent-bg, rgba(224, 109, 10, 0.1));
  color: var(--note-accent, #a04c00);
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

.md-block :deep(.md-link-chip::before) {
  content: '▶';
  position: absolute;
  top: 50%;
  left: 8px;
  transform: translateY(-50%);
  font-size: 8px;
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
  color: var(--note-ink, #2a2420);
  background: var(--note-editor-bg, #e6e0d4);
  border: 1px solid var(--note-editor-border, #e06d0a);
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
  color: var(--note-ink-dim, #6a6156);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.md-add:hover {
  background: var(--note-hover-bg, #ffffff);
  color: var(--note-ink, #2a2420);
}

.md-format-bar {
  position: fixed;
  left: 0;
  right: 0;
  z-index: 200;
  display: flex;
  gap: 2px;
  padding: 4px;
  background: var(--note-editor-bg, #e6e0d4);
  border-top: 1px solid var(--note-editor-border, #e06d0a);
}

.md-format-bar button {
  flex: 1;
  padding: 8px 0;
  font-family: var(--font-body);
  font-size: 15px;
  color: var(--note-ink, #2a2420);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
}

.md-format-bar button:active {
  background: var(--note-hover-bg, #ffffff);
}

.fmt-bold {
  font-weight: 700;
}

.fmt-italic {
  font-style: italic;
}
</style>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, nextTick } from 'vue'
import type { Card } from '@/stores/boardStore'
import { useBoardStore } from '@/stores/boardStore'
import { renderMarkdownWithLinkChips, caretOffsetFromClick, focusAtOffset } from '@/lib/markdown'
import { dueStatus, dueLabel } from '@/lib/dates'

const props = defineProps<{
  card: Card
}>()

const store = useBoardStore()

const status = computed(() => dueStatus(props.card.due_date))
const dueText = computed(() => dueLabel(props.card.due_date))
// "Wöchentlich · practiced 8d ago". This component is what Session Review shows
// above the bucket buttons, so this line is the evidence for the choice being
// made there — "it was weekly and it went well, move it up a rung".
const historyText = computed(() => store.cardHistoryLabel(props.card))
const renderedNotes = computed(() =>
  props.card.description ? renderMarkdownWithLinkChips(props.card.description) : '',
)

const editing = ref(false)
const noteDraft = ref('')
const textareaEl = ref<HTMLTextAreaElement | null>(null)

// The parent keys this component by card.id (PracticeView.vue's focus-swap
// transition), so a card change unmounts this instance rather than patching
// its props — a mid-edit note would otherwise be silently dropped when that
// happens. Flush it to the card it belonged to before teardown.
onBeforeUnmount(() => {
  if (editing.value) saveNote()
})

// The caret lands on the word that was tapped rather than at the end of the
// note — editing a line halfway down a month-old note meant hunting for it
// again in the raw markdown every time. Falls back to the end of the source
// when the tap didn't resolve to rendered text (the placeholder, or padding).
async function startEdit(e: MouseEvent) {
  noteDraft.value = props.card.description ?? ''

  const body = (e.currentTarget as HTMLElement).querySelector('.md-body')
  const offset = body ? caretOffsetFromClick(body, e, noteDraft.value) : noteDraft.value.length

  editing.value = true
  await nextTick()
  const el = textareaEl.value
  if (!el) return
  focusAtOffset(el, offset)
}

function saveNote(cardId = props.card.id) {
  store.updateCardDescription(cardId, noteDraft.value)
  // Deferred a tick: this fires on blur, which happens as soon as the user's
  // tap lands on the *next* element (e.g. a Session Review bucket button).
  // Collapsing the textarea synchronously here would shift that element out
  // from under the pointer before its own click completed, silently
  // swallowing the tap. The timeout lets that click land first.
  setTimeout(() => { editing.value = false }, 0)
}
</script>

<template>
  <div class="focus-card">
    <!-- Meta (status + due) sits on its own line above the title so a long,
         wrapping title never has to share a row with it — the two fighting
         for space on one line is what produced the awkward "due text floats
         next to only the first line" layout. -->
    <div v-if="status || dueText" class="focus-meta">
      <span v-if="status" class="status-dot" :class="`status-${status}`" />
      <span v-if="dueText" class="due-text" :class="{ overdue: status === 'overdue' }">{{ dueText }}</span>
    </div>
    <h2 class="focus-title">{{ card.name }}</h2>
    <p v-if="historyText" class="focus-history">{{ historyText }}</p>

    <div v-if="editing" class="note-edit">
      <textarea
        ref="textareaEl"
        v-model="noteDraft"
        placeholder="Notes, references, quick thoughts… markdown supported"
        @blur="saveNote()"
      />
    </div>
    <div v-else class="note-preview" @click="startEdit">
      <p v-if="!card.description" class="placeholder">Tap to add notes or a reference link…</p>
      <!-- .md-body is what startEdit walks up to, to identify which top-level
           rendered block was tapped. -->
      <div v-else class="md-body" v-html="renderedNotes" />
    </div>
  </div>
</template>

<style scoped>
/* No card chrome here on purpose — no border, background, or radius. This
   sits directly on the practice view's own committed-color surface (set by
   the parent), full width; a boxed "card" nested inside the page was the
   card-in-a-card anti-pattern and wasted space on a small screen. */
.focus-card {
  display: flex;
  flex-direction: column;
  /* Grows to fill leftover space (so an editing textarea below can expand
     into it), but never SHRINKS below its content — shrink:1 (the default)
     let a long note get squeezed smaller than its own rendered text, which
     then visually overflowed into Session Review's buttons below since
     nothing was clipping it. flex-shrink:0 forces the ancestor scroll
     containers (practice-body / review) to grow and scroll instead. */
  flex: 1 0 auto;
  gap: 10px;
}

.focus-meta {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--pc-ink-dim);
}

.status-dot.status-scheduled { background: var(--pc-good); }
.status-dot.status-due { background: var(--pc-due); }
.status-dot.status-overdue { background: var(--pc-overdue); }

.due-text {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--pc-ink-dim);
}

.due-text.overdue {
  color: var(--pc-overdue);
  font-weight: 700;
}

.focus-title {
  flex-shrink: 0;
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 20px;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--pc-ink);
  overflow-wrap: anywhere;
}

.focus-history {
  flex-shrink: 0;
  margin: 6px 0 0;
  color: var(--pc-ink-dim);
  font-family: var(--font-mono);
  font-size: 12px;
}

/* Deliberately NOT flex:1 — a long note should push whatever comes after it
   (Session Review's bucket buttons) further down the page, not have those
   buttons overlap the overflow. Natural block sizing plus the page's own
   scroll (practice-body / review) handles long content correctly; flex:1
   here caused exactly that overlap. */
/* Base is --pc-ink with .placeholder as the one dim exception. It was the
   other way round — base dim, with p/ul/ol overridden back — which left
   headings, blockquotes, tables and bare text nodes inheriting the dim colour,
   so a markdown heading rendered quieter than the body under it. Same
   inversion, same fix as .desc-preview in CardModal.vue: exceptions are opted
   into, never out of. */
.note-preview {
  min-height: 44px;
  padding: 4px 0;
  color: var(--pc-ink);
  font-size: 14px;
  line-height: 1.5;
  cursor: pointer;
}

.note-preview .placeholder {
  margin: 0;
  color: var(--pc-ink-dim);
  font-style: italic;
}

.note-preview :deep(p) {
  margin: 0 0 8px;
}

.note-preview :deep(p:last-child) {
  margin-bottom: 0;
}

.note-preview :deep(ul),
.note-preview :deep(ol) {
  margin: 0 0 8px;
  padding-left: 18px;
}

/* Head truncation, same technique and same reasoning as the card modal's chip —
   see the long comment on `.desc-preview :deep(.md-link-chip)` in CardModal.vue.
   This is the surface where it mattered most: six share links filled 60% of the
   focus card with the same clipped host. Colors stay on the dark --pc-* palette,
   which already clears the text floor (--pc-ember-light is 7.84:1 on the tinted
   pill), so only the truncation changes here. */
.note-preview :deep(.md-link-chip) {
  display: inline-block;
  position: relative;
  max-width: 40vw;
  padding: 2px 8px 2px 19px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--pc-ember) 18%, transparent);
  color: var(--pc-ember-light);
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

.note-preview :deep(.md-link-chip::before) {
  content: '▶';
  position: absolute;
  top: 50%;
  left: 8px;
  transform: translateY(-50%);
  font-size: 8px;
}

/* Editing fills whatever room the card has, rather than a small fixed box —
   this is the primary thing done here, it should feel like a real writing
   surface, not a cramped comment field. */
.note-edit {
  flex: 1;
  min-height: 0;
  display: flex;
}

.note-edit textarea {
  flex: 1;
  min-height: 160px;
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 2px solid var(--pc-ember);
  border-radius: var(--radius-sm);
  background: var(--pc-bg);
  color: var(--pc-ink);
  font-size: 15px;
  line-height: 1.5;
  font-family: var(--font-body);
  resize: none;
}

.note-edit textarea:focus {
  outline: none;
}
</style>

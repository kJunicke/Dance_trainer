<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import type { Card } from '@/stores/boardStore'
import { useBoardStore } from '@/stores/boardStore'
import MarkdownNote from './MarkdownNote.vue'
import LabelBar from './LabelBar.vue'
import { dueStatus, dueLabel } from '@/lib/dates'

const props = withDefaults(
  defineProps<{
    card: Card
    // Where the card's identity (status, title, history) is drawn.
    //  inline — in flow, scrolls away with the note. The board-like default.
    //  sticky — pinned to the top of the scroller, so the title survives a long
    //           note. The live practice surface uses this.
    //  none   — not drawn at all, because the host already shows it. Session
    //           Review lifts the identity into its own fixed header.
    head?: 'inline' | 'sticky' | 'none'
  }>(),
  { head: 'inline' },
)

const emit = defineEmits<{
  'update:editing': [boolean]
}>()

const store = useBoardStore()

const status = computed(() => dueStatus(props.card.due_date))
const dueText = computed(() => dueLabel(props.card.due_date))
// "Wöchentlich · practiced 8d ago". This component is what Session Review shows
// above the bucket buttons, so this line is the evidence for the choice being
// made there — "it was weekly and it went well, move it up a rung".
const historyText = computed(() => store.cardHistoryLabel(props.card))
// Names are stored leaf-only, so mid-session "Posture" alone doesn't say which
// drill this is — Hammers › Posture and Drops › Posture render identically.
// This is the surface where getting it wrong means practising the wrong thing.
const ancestors = computed(() => store.ancestorNamesForCard(props.card.id))

const noteEl = ref<{ flush: () => void } | null>(null)

// The parent keys this component by card.id (PracticeView.vue's focus-swap
// transition), so a card change unmounts this instance rather than patching
// its props — a mid-edit note would otherwise be silently dropped when that
// happens. Flush it to the card it belonged to before teardown: the update
// handler below still closes over the outgoing card while we're unmounting.
onBeforeUnmount(() => noteEl.value?.flush())
</script>

<template>
  <div class="focus-card">
    <!-- Meta (status + due) sits on its own line above the title so a long,
         wrapping title never has to share a row with it — the two fighting
         for space on one line is what produced the awkward "due text floats
         next to only the first line" layout. -->
    <div v-if="head !== 'none'" class="focus-head" :class="{ sticky: head === 'sticky' }">
      <LabelBar class="focus-labels" :card-id="card.id" />
      <div v-if="status || dueText" class="focus-meta">
        <span v-if="status" class="status-dot" :class="`status-${status}`" />
        <span v-if="dueText" class="due-text" :class="{ overdue: status === 'overdue' }">{{ dueText }}</span>
      </div>
      <p v-if="ancestors.length" class="focus-lineage">{{ ancestors.join(' › ') }} ›</p>
      <h2 class="focus-title">{{ card.name }}</h2>
      <p v-if="historyText" class="focus-history">{{ historyText }}</p>
    </div>

    <div class="note-field">
      <MarkdownNote
        ref="noteEl"
        :source="card.description ?? ''"
        placeholder="Tap to add notes or a reference link…"
        @update:source="(v: string) => store.updateCardDescription(card.id, v)"
        @update:editing="(v: boolean) => emit('update:editing', v)"
      />
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

.focus-head {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Labels go above the status line, not below the title: mid-session they answer
   "is this the warm-up or the performance set" before the due date is worth
   reading. The dark palette for the picker it opens comes from the --lp-* block
   on .practice-view in tokens.css, not from here. */
.focus-labels {
  flex-shrink: 0;
}

/* Pinned so the card's identity survives a long note. Without this the title
   and the "practiced 8d ago" line — the two things you actually need while
   deciding — scroll off the top and you're reading an anonymous note. Opaque
   background because the note scrolls underneath it. */
.focus-head.sticky {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--pc-bg);
  padding-bottom: 8px;
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

/* The display face and 600 weight are what make this read as the title's first
   line rather than as a third caption stacked under the due row. The negative
   margin cancels most of .focus-head's 6px gap for this pair only: at the full
   gap the lineage sat equidistant from the meta line above and the title below,
   which is exactly how you make two lines look unrelated. Trailing `›` in the
   template, not here, so it can't be selected out of a copied name. */
.focus-lineage {
  flex-shrink: 0;
  margin: 0 0 -4px;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--pc-ink-dim);
  overflow-wrap: anywhere;
}

/* 22px, matching the card modal's title. It was 20px until the note heading
   ramp widened h1 to 21px at this surface's 14px base — which put an in-note
   `# Heading` *above* the name of the card it belongs to. The card title has to
   stay the largest thing on the card (see pages/Card Notes.md); this is the
   surface with the most room to satisfy that, so it pays rather than the note. */
.focus-title {
  flex-shrink: 0;
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 22px;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--pc-ink);
  overflow-wrap: anywhere;
}

.focus-history {
  flex-shrink: 0;
  /* No margin — .focus-head's gap owns the spacing now. */
  margin: 0;
  color: var(--pc-ink-dim);
  font-family: var(--font-mono);
  font-size: 12px;
}

/* Deliberately NOT flex:1 — a long note should push whatever comes after it
   (Session Review's bucket buttons) further down the page, not have those
   buttons overlap the overflow. Natural block sizing plus the page's own
   scroll (practice-body / review) handles long content correctly; flex:1
   here caused exactly that overlap. The editor doesn't need the leftover room
   any more either: editing is per-block now and the textarea autosizes to its
   raw source rather than filling the card.

   MarkdownNote ships the markdown typography; what stays here is the dark
   --pc-* palette it themes off. --note-ink is full ink with the dim tone kept
   for the placeholder / + add row. It was the other way round once — base dim,
   with p/ul/ol overridden back — which left headings, blockquotes, tables and
   bare text nodes inheriting the dim colour, so a markdown heading rendered
   quieter than the body under it. Exceptions are opted into, never out of.

   Chip colours stay on --pc-*, which already clears the text floor
   (--pc-ember-light is 7.84:1 on the 18% tinted pill) — this palette never had
   the modal's contrast problem. The head truncation that made six identical
   share links tell each other apart travels with the chip rule into
   MarkdownNote.vue; this is the surface where it mattered most, since those
   links filled 60% of the focus card with the same clipped host. */
.note-field {
  --note-font-size: 14px;
  --note-ink: var(--pc-ink);
  --note-ink-dim: var(--pc-ink-dim);
  --note-accent: var(--pc-ember-light);
  --note-accent-bg: color-mix(in srgb, var(--pc-ember) 18%, transparent);
  --note-hover-bg: var(--pc-surface);
  --note-editor-bg: var(--pc-bg);
  --note-editor-border: var(--pc-ember);
  --note-chip-max: 40vw;
  min-height: 44px;
  padding: 4px 0;
  line-height: 1.5;
}
</style>

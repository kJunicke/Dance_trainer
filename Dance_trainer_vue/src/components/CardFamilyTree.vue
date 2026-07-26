<script lang="ts">
/**
 * One node of a card family. Assembled by the caller (see `lib/cardTree.ts`)
 * and handed in whole — this component never touches the store or the DB.
 * `name` is the leaf name only ("Prep"), never the composed ancestor chain;
 * the tree structure itself is what shows where the card sits.
 */
export interface FamilyNode {
  id: number
  name: string
  columnName: string
  dueDate: string | null
  labels: { id: number; name: string; color: string }[]
  children: FamilyNode[]
}
</script>

<script setup lang="ts">
/**
 * Purely presentational family tree of mini cards, rendered under a card's note
 * in the detail modal as a navigation aid: tap a node, open that card.
 *
 * Recurses on itself (a `<script setup>` component can reference its own
 * filename), so `root` is whatever subtree this instance renders — at the top
 * level that is the *family* root, which is usually not the card the modal is
 * showing. `currentId` marks which node that is.
 */
import { computed } from 'vue'
import { LABEL_COLORS, LABEL_TEXT_COLORS } from '@/lib/labelColors'
import { dueStatus } from '@/lib/dates'

const props = defineProps<{
  root: FamilyNode
  currentId: number
}>()

const emit = defineEmits<{
  open: [cardId: number]
}>()

const isCurrent = computed(() => props.root.id === props.currentId)
const status = computed(() => dueStatus(props.root.dueDate))

function onActivate() {
  if (!isCurrent.value) emit('open', props.root.id)
}
</script>

<template>
  <!-- Deep families overflow sideways on desktop; the scroll has to live here so
       the modal body never gains a horizontal scrollbar. Nested instances reset
       it (see the descendant rule in the styles) so only the outermost scrolls. -->
  <div class="family-tree">
    <div class="branch">
      <!-- The current card is still a peer chip, just not a link to itself. -->
      <component
        :is="isCurrent ? 'div' : 'button'"
        class="chip"
        :class="{ current: isCurrent }"
        :type="isCurrent ? undefined : 'button'"
        :aria-current="isCurrent ? 'true' : undefined"
        @click="onActivate"
      >
        <span v-if="root.labels.length" class="chip-labels">
          <span
            v-for="label in root.labels"
            :key="label.id"
            class="label-chip"
            :style="{
              background: LABEL_COLORS[label.color] ?? '#ccc',
              color: LABEL_TEXT_COLORS[label.color] ?? '#2a2420',
            }"
            >{{ label.name }}</span
          >
        </span>
        <span class="chip-head">
          <span class="due-dot" :class="status ? `status-${status}` : ''" />
          <span class="chip-title">{{ root.name }}</span>
          <span v-if="isCurrent" class="you-tag">you</span>
        </span>
        <span class="chip-column">{{ root.columnName }}</span>
      </component>

      <div v-if="root.children.length" class="kids">
        <CardFamilyTree
          v-for="child in root.children"
          :key="child.id"
          :root="child"
          :current-id="currentId"
          @open="emit('open', $event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Base = desktop, mirroring the app's existing max-width breakpoints. */
.family-tree {
  overflow-x: auto;
  /* The scroller clips, and the current chip's ring is drawn *outside* its
     border box — without this the ring loses its top edge whenever the current
     card is in the first row, and its right edge at the end of a wide tree. */
  padding: 3px;
}

/* Only the outermost instance scrolls — nested ones would each clip their own
   subtree and produce a stack of little scrollbars. */
.family-tree .family-tree {
  overflow-x: visible;
  padding: 0;
}

/* The whole orientation flip is this one property.
   Desktop: chip beside its children, so *generations* run left to right.
   Mobile:  chip above its children, so generations run top to bottom.
   `.kids` stays a column either way — siblings always stack vertically. */
.branch {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
  /* Intrinsic width so a deep family overflows the scroller instead of
     squeezing every generation narrower. */
  width: max-content;
}

/* The rail: on desktop it reads as the vertical link between a parent column and
   its children column; on mobile the exact same border becomes the indent rail
   under the parent. One rule, both orientations — which is why the connectors
   are simplified to a single line rather than per-child elbows. */
.kids {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding-left: 12px;
  border-left: 1px solid var(--color-border);
}

/* Deliberately dense: this is an overview under the note, not a second board. */
.chip {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 0 0 auto;
  width: 150px;
  margin: 0;
  padding: 5px 8px;
  text-align: left;
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font: inherit;
}

button.chip:hover {
  border-color: color-mix(in srgb, var(--color-ember) 45%, var(--color-border));
}

/* You-are-here: an ember ring plus a "you" tag. The ring alone can be missed on
   a busy tree and the tag alone is easy to skim past, so both. Ember as ink is
   --color-ember-text (plain ember fails contrast as text); the ring is a border
   so plain ember is correct there. */
.chip.current {
  cursor: default;
  border-color: var(--color-ember);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-ember) 30%, transparent);
}

.chip-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

/* Same chip language as TaskCard, one step smaller for the dense tree. */
.label-chip {
  border-radius: var(--radius-sm);
  padding: 1px 5px;
  font-size: 10px;
  line-height: 1.4;
}

.chip-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

/* Same dot vocabulary as TaskCard's meta strip: dim ink when undated, otherwise
   the traffic-light color for the due status. */
.due-dot {
  flex-shrink: 0;
  align-self: center;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-ink-dim);
}

.due-dot.status-scheduled {
  background: var(--color-good);
}

.due-dot.status-due {
  background: var(--color-due);
}

.due-dot.status-overdue {
  background: var(--color-overdue);
}

.chip-title {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--color-ink);
  overflow-wrap: anywhere;
}

.you-tag {
  margin-left: auto;
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 9px;
  line-height: 1.4;
  letter-spacing: 0.04em;
  color: var(--color-ember-text);
}

.chip-column {
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1.3;
  color: var(--color-ink-dim);
  overflow-wrap: anywhere;
}

@media (max-width: 760px) {
  .branch {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    width: auto;
  }

  .kids {
    align-items: stretch;
    padding-left: 14px;
  }

  .chip {
    width: auto;
  }
}
</style>

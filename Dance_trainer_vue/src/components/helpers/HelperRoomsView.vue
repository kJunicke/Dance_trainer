<script setup lang="ts">
import { computed } from 'vue'
import { cellOverLimit, HELPER_LIMITS, type HelperRow } from '@/lib/helperPlan'
import { buildRooms, moveRoom, relocateRef, type RoomItem } from '@/lib/helperBoards'
import { useDragMove } from '@/lib/useDragMove'
import { useHelperPlanStore } from '@/stores/helperPlanStore'
import { useToastStore } from '@/stores/toastStore'
import HelperBoardCard from './HelperBoardCard.vue'
import HelperDragGhost from './HelperDragGhost.vue'

// Room names are trimmed, so none can be a bare line break.
const NO_ROOM = '\n'

const props = defineProps<{
  rows: HelperRow[]
  scroller: HTMLElement | null
  // Rooms not yet on any task, held by the view so they outlive this one.
  extraRooms: string[]
}>()

const emit = defineEmits<{ edit: [rowId: number]; 'add-room': [] }>()

const store = useHelperPlanStore()
const toast = useToastStore()

const board = computed(() => buildRooms(props.rows, [...store.knownRooms, ...props.extraRooms]))

function originKey(item: RoomItem, roomName: string | null): string {
  return item.refIndex === null || roomName === null ? NO_ROOM : roomName
}

const drag = useDragMove<RoomItem>({
  scroller: () => props.scroller,
  onDrop: (item, key) => void drop(item, key),
})

// Worked out from the store, not the card: someone may have edited the cell since
// the finger went down.
async function drop(item: RoomItem, key: string) {
  const to = key === NO_ROOM ? null : key
  if (to === null && item.refIndex === null) return
  const row = store.rowById(item.row.id)
  const from = row ? relocateRef(item.row.where, item.refIndex, row.where) : undefined
  if (!row || from === undefined) {
    toast.show('This task just changed. Check it and move it again.')
    return
  }
  const next = moveRoom(row.where, from, to)
  if (next === row.where) return
  if (cellOverLimit('where', next)) {
    toast.show(`The Where cell would be over its ${HELPER_LIMITS.where} characters. Shorten it first.`)
    return
  }
  if (await store.setCell(row.id, 'where', next)) {
    toast.success(to ? `Moved to ${to}` : 'Room removed')
  }
}

function people(count: number): string {
  return `${count} task${count === 1 ? '' : 's'}`
}
</script>

<template>
  <div class="rooms" :class="{ dragging: drag.dragging.value }">
    <p class="hint hp-hint">Tap a task to change its room, or drag ⠿ to another room.</p>

    <div class="board">
      <section
        v-for="room in board.rooms"
        :key="room.name"
        class="room"
        :class="{ over: drag.overKey.value === room.name }"
        :data-drop="room.name"
      >
        <h3 class="room-title"><span class="plate">{{ room.name }}</span> <span class="count">{{ people(room.items.length) }}</span></h3>
        <div class="cards">
          <HelperBoardCard
            v-for="item in room.items"
            :key="`${item.row.id}-${item.refIndex}`"
            :row="item.row"
            :detail="item.time.replace(/\n/g, ' ')"
            move-label="Change room of"
            @open="emit('edit', item.row.id)"
            @grab="drag.start($event, item, item.row.task, originKey(item, room.name))"
          />
        </div>
      </section>

      <section class="room unplaced" :class="{ over: drag.overKey.value === NO_ROOM }" :data-drop="NO_ROOM">
        <h3 class="room-title"><span class="plate">No room yet</span> <span class="count">{{ people(board.unplaced.length) }}</span></h3>
        <div class="cards">
          <HelperBoardCard
            v-for="item in board.unplaced"
            :key="item.row.id"
            :row="item.row"
            :detail="item.time.replace(/\n/g, ' ')"
            move-label="Choose a room for"
            @open="emit('edit', item.row.id)"
            @grab="drag.start($event, item, item.row.task, NO_ROOM)"
          />
        </div>
      </section>
    </div>

    <button class="add-room hp-tap" type="button" @click="emit('add-room')"><span class="hp-chip hp-chip--open">+ Add a room</span></button>

    <HelperDragGhost v-if="drag.dragging.value" :x="drag.ghost.value.x" :y="drag.ghost.value.y" :label="drag.ghost.value.label" />
  </div>
</template>

<style scoped>
.hint {
  margin-bottom: var(--hp-2);
}

.board {
  display: grid;
  gap: var(--hp-3);
  align-items: start;
}

/* A room is a place on the plan: a door plate on a square-ruled floor. */
.room {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--hp-r-l);
  background-color: var(--color-surface);
  background-image:
    linear-gradient(rgba(42, 36, 32, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(42, 36, 32, 0.045) 1px, transparent 1px);
  background-size: 16px 16px;
  transition:
    background-color var(--hp-fast) var(--hp-ease),
    box-shadow var(--hp-fast) var(--hp-ease),
    transform var(--hp-fast) var(--hp-ease);
}

.room.unplaced {
  border: 1.5px dashed var(--color-ink-dim);
  background-image: none;
}

.room.over {
  background-color: var(--hp-amber);
  box-shadow: inset 0 0 0 2px var(--color-ink);
  transform: scale(1.01);
}

.room-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hp-2);
  min-height: var(--hp-tap);
  padding: var(--hp-1) var(--hp-3);
  background: var(--color-ink);
  color: var(--hp-amber-soft);
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.room.unplaced .room-title {
  background: transparent;
  color: var(--color-ink);
}

.room.over .room-title {
  background: var(--color-ink);
  color: var(--hp-amber);
}

.plate {
  min-width: 0;
  overflow-wrap: anywhere;
}

.count {
  flex: none;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}

.cards {
  display: grid;
  gap: 6px;
  padding: var(--hp-2);
}

.cards:empty {
  display: none;
}

.dragging .cards,
.dragging .hint,
.dragging .add-room {
  display: none;
}

/* During a drag the rooms fold to a grid of plates, in reach of one thumb. */
.dragging .board {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--hp-2);
}

.dragging .room-title {
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
  min-height: 64px;
}

.dragging .plate {
  overflow-wrap: break-word;
  max-width: 100%;
}

.add-room {
  margin-top: var(--hp-2);
}

.add-room .hp-chip {
  font-weight: 600;
}

@media (min-width: 760px) {
  .board {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }

  .dragging .board {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
}
</style>

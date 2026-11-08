import { nextTick, ref, type InjectionKey } from 'vue'
import { reorderDelta } from './helperPlan'
import { useDragMove } from './useDragMove'

const END = 'end'
const LINE_OFFSET = 2
const LINE_HEIGHT = 4

export interface ReorderLine {
  top: number
  left: number
  width: number
}

function scrollParent(element: HTMLElement | null): HTMLElement | null {
  for (let node = element; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node
  }
  return null
}

// Reorders a list whose items carry data-reorder-id="<id>". `ids` is the full
// order: what's on screen can be a filtered part of it, and the delta the server
// wants counts places in the full list.
export function useDragReorder(options: {
  list: () => HTMLElement | null
  ids: () => number[]
  move: (id: number, delta: number) => Promise<boolean>
}) {
  const line = ref<ReorderLine | null>(null)
  const busy = ref(false)
  let scroller: HTMLElement | null = null

  const drag = useDragMove<number>({
    scroller: () => scroller,
    resolve: insertionAt,
    onDrop: (id, key) => void commit(id, key, false),
  })

  function items(): HTMLElement[] {
    return Array.from(options.list()?.querySelectorAll<HTMLElement>('[data-reorder-id]') ?? [])
  }

  function deltaFor(id: number, key: string): number {
    const shown = items().map((node) => Number(node.dataset.reorderId))
    return reorderDelta(options.ids(), shown, id, key === END ? null : Number(key))
  }

  function insertionAt(_x: number, y: number): string | null {
    const nodes = items()
    const id = drag.dragging.value
    if (!nodes.length || id === null) {
      line.value = null
      return null
    }
    const before = nodes.find((node) => {
      const { top, height } = node.getBoundingClientRect()
      return y < top + height / 2
    })
    const key = before?.dataset.reorderId ?? END
    const box = (before ?? nodes[nodes.length - 1]!).getBoundingClientRect()
    const { clientWidth, clientHeight } = document.documentElement
    const left = Math.max(0, box.left)
    const top = before ? box.top - LINE_OFFSET : box.bottom + LINE_OFFSET
    line.value =
      deltaFor(id, key) === 0
        ? null
        : { top: Math.max(0, Math.min(top, clientHeight - LINE_HEIGHT)), left, width: Math.min(box.right, clientWidth) - left }
    return key
  }

  async function commit(id: number, key: string, refocus: boolean) {
    line.value = null
    const delta = deltaFor(id, key)
    if (delta === 0 || busy.value) return
    busy.value = true
    await options.move(id, delta)
    busy.value = false
    if (!refocus) return
    // The row may have been moved in the DOM, which drops focus from its handle.
    await nextTick()
    options.list()?.querySelector<HTMLElement>(`[data-reorder-handle="${id}"]`)?.focus()
  }

  function grab(event: PointerEvent, id: number, label: string) {
    if (busy.value || !event.isPrimary || event.button !== 0) return
    scroller = scrollParent(options.list())
    drag.start(event, id, label)
  }

  function onKeydown(event: KeyboardEvent, id: number) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const shown = items().map((node) => node.dataset.reorderId ?? '')
    const index = shown.indexOf(String(id))
    if (index < 0) return
    if (event.key === 'ArrowUp') {
      if (index > 0) void commit(id, shown[index - 1]!, true)
    } else if (index < shown.length - 1) {
      void commit(id, shown[index + 2] ?? END, true)
    }
  }

  return { draggingId: drag.dragging, ghost: drag.ghost, line, busy, grab, onKeydown }
}

export type DragReorder = ReturnType<typeof useDragReorder>

export const ROW_REORDER: InjectionKey<DragReorder> = Symbol('helper-row-reorder')

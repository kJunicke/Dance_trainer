import { nextTick, onUnmounted, ref, shallowRef } from 'vue'

const EDGE = 64
const MAX_SCROLL = 14
const TAP_TOLERANCE = 6
// A finger that rests on the handle means a drag; one already moving was a scroll.
const TOUCH_HOLD_MS = 150

// Started from a handle with touch-action: none, so a finger on the card still
// scrolls and only the handle drags. Drop targets carry data-drop="<key>", unless
// `resolve` names the target from the pointer position instead.
export function useDragMove<T>(options: {
  scroller: () => HTMLElement | null
  onDrop: (item: T, key: string) => void
  resolve?: (x: number, y: number) => string | null
}) {
  const dragging = shallowRef<T | null>(null)
  const overKey = ref<string | null>(null)
  const ghost = ref({ x: 0, y: 0, label: '' })

  let startX = 0
  let startY = 0
  let pending: { item: T; label: string; originKey?: string } | null = null
  let pointerId: number | null = null
  let armed = false
  let holdTimer: ReturnType<typeof setTimeout> | undefined
  let restoreTop: number | null = null
  let frame = 0

  function targetAt(x: number, y: number): string | null {
    if (options.resolve) return options.resolve(x, y)
    return document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]')?.dataset.drop ?? null
  }

  function autoScroll() {
    const box = options.scroller()
    if (box && dragging.value) {
      const { top, bottom } = box.getBoundingClientRect()
      const fromTop = ghost.value.y - top
      const fromBottom = bottom - ghost.value.y
      if (fromTop < EDGE) box.scrollTop -= MAX_SCROLL * (1 - Math.max(0, fromTop) / EDGE)
      else if (fromBottom < EDGE) box.scrollTop += MAX_SCROLL * (1 - Math.max(0, fromBottom) / EDGE)
      overKey.value = targetAt(ghost.value.x, ghost.value.y)
    }
    frame = requestAnimationFrame(autoScroll)
  }

  function onMove(event: PointerEvent) {
    if (!pending || event.pointerId !== pointerId) return
    const moved = Math.hypot(event.clientX - startX, event.clientY - startY) >= TAP_TOLERANCE
    if (!armed) {
      if (moved) finish(event, true)
      return
    }
    ghost.value = { x: event.clientX, y: event.clientY, label: pending.label }
    if (!dragging.value) {
      if (!moved) return
      dragging.value = pending.item
      const origin = pending.originKey
      frame = requestAnimationFrame(autoScroll)
      // The lists fold away during a drag; keep the place it came from on screen.
      if (origin !== undefined) {
        restoreTop = options.scroller()?.scrollTop ?? null
        void nextTick(() =>
          options.scroller()?.querySelector(`[data-drop="${CSS.escape(origin)}"]`)?.scrollIntoView({ block: 'center' }),
        )
      }
    }
    overKey.value = targetAt(event.clientX, event.clientY)
  }

  // A mouse released away from the handle still clicks what both have in common,
  // which can be a sheet's backdrop.
  function swallowNextClick() {
    const stop = (event: Event) => event.stopPropagation()
    window.addEventListener('click', stop, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', stop, true), 0)
  }

  function finish(event: PointerEvent, cancelled: boolean) {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    cancelAnimationFrame(frame)
    clearTimeout(holdTimer)
    const item = pending?.item ?? null
    const wasDragging = dragging.value !== null
    const key = wasDragging && !cancelled ? targetAt(event.clientX, event.clientY) : null
    if (wasDragging) swallowNextClick()
    dragging.value = null
    overKey.value = null
    pending = null
    pointerId = null
    if (restoreTop !== null) {
      const top = restoreTop
      restoreTop = null
      void nextTick(() => {
        const box = options.scroller()
        if (box) box.scrollTop = top
      })
    }
    if (item !== null && wasDragging && key !== null) options.onDrop(item, key)
  }

  // A second finger's up or cancel says nothing about the drag.
  const onUp = (event: PointerEvent) => {
    if (event.pointerId === pointerId) finish(event, false)
  }
  const onCancel = (event: PointerEvent) => {
    if (event.pointerId === pointerId) finish(event, true)
  }

  function start(event: PointerEvent, item: T, label: string, originKey?: string) {
    if (pending || !event.isPrimary || event.button !== 0) return
    startX = event.clientX
    startY = event.clientY
    pending = { item, label, originKey }
    pointerId = event.pointerId
    armed = event.pointerType === 'mouse'
    if (!armed) holdTimer = setTimeout(() => (armed = true), TOUCH_HOLD_MS)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  onUnmounted(() => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    cancelAnimationFrame(frame)
    clearTimeout(holdTimer)
  })

  return { dragging, overKey, ghost, start }
}

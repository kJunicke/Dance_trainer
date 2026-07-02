import { onMounted, onUnmounted } from 'vue'

// Make the phone/browser "back" gesture close an overlay instead of navigating
// away. On mount we push a throwaway history entry; a back gesture pops it and
// fires `popstate`, which we turn into a close. If the overlay is closed some
// other way (X button, backdrop, Escape), we pop our own entry on unmount so it
// doesn't linger and swallow the user's next back.
export function useBackButtonClose(close: () => void) {
  let ourEntry = false

  function onPopState() {
    // The browser already popped our entry to get here.
    ourEntry = false
    close()
  }

  onMounted(() => {
    history.pushState({ ...history.state, modal: true }, '')
    ourEntry = true
    window.addEventListener('popstate', onPopState)
  })

  onUnmounted(() => {
    window.removeEventListener('popstate', onPopState)
    // Closed without a back gesture — remove the entry we added. Listener is
    // already gone, so the resulting popstate won't loop back into us.
    if (ourEntry) {
      ourEntry = false
      history.back()
    }
  })
}

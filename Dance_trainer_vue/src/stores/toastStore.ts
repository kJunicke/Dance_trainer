import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: number
  variant: 'error' | 'success'
  message: string
  detail?: string
}

let nextId = 0

// A success confirms something you were already expecting, so it can be brief.
// An error you blinked past is an error you never saw — it stays up long enough
// to read twice, and can be dismissed by hand the moment it has been read.
const SUCCESS_MS = 4000
const ERROR_MS = 10000

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function push(toast: Omit<Toast, 'id'>, ms: number) {
    const id = nextId++
    toasts.value.push({ id, ...toast })
    setTimeout(() => dismiss(id), ms)
  }

  // Every caller passes a raw failure string — Supabase's `err.message` or a
  // caught Error's. That text names what the API thinks broke, not what the
  // user just lost, so it is demoted to `detail`: still there when the failure
  // needs diagnosing, but never the sentence the user has to decode first.
  function show(detail: string) {
    push({ variant: 'error', message: "That didn't go through", detail }, ERROR_MS)
  }

  function success(message: string) {
    push({ variant: 'success', message }, SUCCESS_MS)
  }

  return { toasts, show, success, dismiss }
})

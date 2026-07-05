import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Today's practice session: an ephemeral, per-board, per-device working set of
// cards. Not synced server-side and not kept as history — only persisted to
// localStorage so a reload/PWA background-kill mid-practice doesn't lose it.
export interface SessionEntry {
  cardId: number
  done: boolean
}

const STORAGE_PREFIX = 'practice-session:'

export const usePracticeSessionStore = defineStore('practiceSession', () => {
  const boardId = ref<number | null>(null)
  const entries = ref<SessionEntry[]>([])

  function persist() {
    if (boardId.value === null) return
    localStorage.setItem(STORAGE_PREFIX + boardId.value, JSON.stringify(entries.value))
  }

  function load(id: number) {
    boardId.value = id
    const raw = localStorage.getItem(STORAGE_PREFIX + id)
    try {
      entries.value = raw ? (JSON.parse(raw) as SessionEntry[]) : []
    } catch {
      entries.value = []
    }
  }

  const cardIdSet = computed(() => new Set(entries.value.map((e) => e.cardId)))
  const pendingIds = computed(() => entries.value.filter((e) => !e.done).map((e) => e.cardId))
  const doneIds = computed(() => entries.value.filter((e) => e.done).map((e) => e.cardId))

  function isInSession(cardId: number) {
    return cardIdSet.value.has(cardId)
  }

  function addCard(cardId: number) {
    if (cardIdSet.value.has(cardId)) return
    entries.value.push({ cardId, done: false })
    persist()
  }

  function removeCard(cardId: number) {
    entries.value = entries.value.filter((e) => e.cardId !== cardId)
    persist()
  }

  function toggleCard(cardId: number) {
    if (cardIdSet.value.has(cardId)) removeCard(cardId)
    else addCard(cardId)
  }

  function markDone(cardId: number) {
    const entry = entries.value.find((e) => e.cardId === cardId)
    if (entry) {
      entry.done = true
      persist()
    }
  }

  function markPending(cardId: number) {
    const entry = entries.value.find((e) => e.cardId === cardId)
    if (entry) {
      entry.done = false
      persist()
    }
  }

  // Reorders the pending group only; done entries stay appended after in
  // their existing relative order, so the pending/done split stays stable.
  function reorderPending(newOrder: number[]) {
    const doneEntries = entries.value.filter((e) => e.done)
    entries.value = [...newOrder.map((cardId) => ({ cardId, done: false })), ...doneEntries]
    persist()
  }

  // Session Review has finished deciding this card's fate (moved or kept) —
  // it's fully handled now, so it leaves the session entirely.
  function resolveCard(cardId: number) {
    removeCard(cardId)
  }

  return {
    entries,
    pendingIds,
    doneIds,
    load,
    isInSession,
    addCard,
    removeCard,
    toggleCard,
    markDone,
    markPending,
    reorderPending,
    resolveCard,
  }
})

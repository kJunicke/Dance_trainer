import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  assembleRows,
  cleanName,
  type CellField,
  type HelperMeta,
  type HelperPage,
  type HelperRow,
  type HelperRowRecord,
  type HelperSignupRecord,
  type ImportRow,
  type RowType,
} from '@/lib/helperPlan'
import { useToastStore } from './toastStore'

const GUEST_NAME_KEY = 'helper-guest-name'
const ADMIN_PIN_KEY = 'helper-admin-pin'
const LIVE_TABLES = ['helper_plan', 'helper_pages', 'helper_rows', 'helper_signups']
const REFETCH_DEBOUNCE_MS = 300
const FALLBACK_REFRESH_MS = 60_000

// Storage throws in some private-browsing modes; the plan still has to work,
// the name just won't be remembered.
function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(storage: Storage, key: string, value: string | null) {
  try {
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, value)
  } catch {
    // See readStorage.
  }
}

export const useHelperPlanStore = defineStore('helperPlan', () => {
  const meta = ref<HelperMeta>({ title: 'Helper plan', info: '' })
  const pages = ref<HelperPage[]>([])
  const rowsByPage = ref<Record<number, HelperRow[]>>({})
  const loading = ref(false)
  // The last fetch failed, so what's on screen (if anything) may be out of date.
  const loadFailed = ref(false)
  const guestName = ref(readStorage(localStorage, GUEST_NAME_KEY) ?? '')
  // Starts false even with a stored PIN: admin controls appear once the server
  // has accepted it, not on the strength of what's in sessionStorage.
  const isAdmin = ref(false)

  const toast = useToastStore()
  let adminPin = readStorage(sessionStorage, ADMIN_PIN_KEY)
  let adminVerified = false
  let hasData = false
  let latestFetch = 0
  let channel: RealtimeChannel | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let fallbackTimer: ReturnType<typeof setInterval> | null = null

  async function fetchPlan(quiet: boolean) {
    const fetchId = ++latestFetch
    if (!hasData) loading.value = true
    const [planResult, pagesResult, rowsResult, signupsResult] = await Promise.all([
      supabase.from('helper_plan').select('title, info').maybeSingle(),
      supabase.from('helper_pages').select('*').order('position').order('id'),
      supabase.from('helper_rows').select('*').order('position').order('id'),
      supabase
        .from('helper_signups')
        .select('row_id, name')
        .order('created_at')
        .order('id'),
    ])
    // Overlapping fetches can land out of order; only the newest may paint.
    if (fetchId !== latestFetch) return
    loading.value = false

    const error =
      planResult.error ?? pagesResult.error ?? rowsResult.error ?? signupsResult.error
    if (error) {
      loadFailed.value = true
      // Realtime and the timer retry on their own. A toast every minute for as
      // long as a phone is in a dead spot would bury the page.
      if (!quiet) toast.show(error.message)
      return
    }

    const nextPages = (pagesResult.data ?? []) as HelperPage[]
    if (planResult.data) meta.value = planResult.data as HelperMeta
    rowsByPage.value = assembleRows(
      nextPages,
      (rowsResult.data ?? []) as HelperRowRecord[],
      (signupsResult.data ?? []) as HelperSignupRecord[],
    )
    pages.value = nextPages
    hasData = true
    loadFailed.value = false
  }

  async function verifyStoredPin() {
    if (!adminPin || adminVerified) return
    const { data, error } = await supabase.rpc('helper_admin_check', { _pin: adminPin })
    // A network failure says nothing about the PIN: keep it and try on the next load.
    if (error) return
    if (data === true) {
      adminVerified = true
      isAdmin.value = true
    } else {
      adminLogout()
    }
  }

  async function load() {
    void verifyStoredPin()
    await fetchPlan(false)
  }

  function scheduleRefetch() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void fetchPlan(true)
    }, REFETCH_DEBOUNCE_MS)
  }

  function startLive() {
    if (channel) return
    channel = supabase.channel('helper-plan')
    for (const table of LIVE_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefetch)
    }
    // Refetch on every (re)subscribe: changes made before the socket was up, or
    // while a phone had it dropped, never arrive as events.
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') scheduleRefetch()
    })
    fallbackTimer = setInterval(() => void fetchPlan(true), FALLBACK_REFRESH_MS)
  }

  function stopLive() {
    if (channel) void supabase.removeChannel(channel)
    channel = null
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = null
    if (fallbackTimer) clearInterval(fallbackTimer)
    fallbackTimer = null
  }

  function setGuestName(name: string) {
    guestName.value = cleanName(name)
    writeStorage(localStorage, GUEST_NAME_KEY, guestName.value || null)
  }

  // Awaits the refetch so that a caller resuming after `await` sees the new data.
  async function write(fn: string, args: Record<string, unknown>): Promise<boolean> {
    const { error } = await supabase.rpc(fn, args)
    if (error) {
      toast.show(error.message)
      // The usual refusal is "someone got there first": show what they did.
      void fetchPlan(true)
      return false
    }
    await load()
    return true
  }

  async function adminCall(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ ok: boolean; data?: unknown }> {
    const { data, error } = await supabase.rpc(fn, { _pin: adminPin ?? '', ...args })
    if (error) {
      toast.show(error.message)
      if (error.message.includes('Wrong admin PIN')) adminLogout()
      return { ok: false }
    }
    await load()
    return { ok: true, data }
  }

  const adminWrite = async (fn: string, args: Record<string, unknown>) =>
    (await adminCall(fn, args)).ok

  const signUp = (rowId: number, name: string) =>
    write('helper_signup', { _row_id: rowId, _name: name })
  const removeName = (rowId: number, name: string) =>
    write('helper_unsign', { _row_id: rowId, _name: name })
  const setCell = (rowId: number, field: CellField, value: string) =>
    write('helper_set_cell', { _row_id: rowId, _field: field, _value: value })

  async function adminLogin(pin: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('helper_admin_check', { _pin: pin })
    if (error) {
      toast.show(error.message)
      return false
    }
    if (data !== true) {
      toast.show('Wrong admin PIN.')
      return false
    }
    adminPin = pin
    adminVerified = true
    isAdmin.value = true
    writeStorage(sessionStorage, ADMIN_PIN_KEY, pin)
    return true
  }

  function adminLogout() {
    adminPin = null
    adminVerified = false
    isAdmin.value = false
    writeStorage(sessionStorage, ADMIN_PIN_KEY, null)
  }

  const setMeta = (title: string, info: string) =>
    adminWrite('helper_admin_set_plan', { _title: title, _info: info })
  // The new tab's id, for an import that goes on to fill it; null if it failed.
  async function addPage(name: string): Promise<number | null> {
    const { ok, data } = await adminCall('helper_admin_add_page', { _name: name })
    return ok ? Number(data) : null
  }
  const renamePage = (id: number, name: string) =>
    adminWrite('helper_admin_rename_page', { _page_id: id, _name: name })
  const deletePage = (id: number) => adminWrite('helper_admin_delete_page', { _page_id: id })
  const movePage = (id: number, delta: number) =>
    adminWrite('helper_admin_move_page', { _page_id: id, _delta: delta })

  const addRow = (
    pageId: number,
    row: {
      type: RowType
      task: string
      when: string
      where: string
      needed: number
      comment: string
    },
  ) =>
    adminWrite('helper_admin_add_row', {
      _page_id: pageId,
      _type: row.type,
      _task: row.task,
      _when: row.when,
      _where: row.where,
      _needed: row.needed,
      _comment: row.comment,
    })
  const deleteRow = (id: number) => adminWrite('helper_admin_delete_row', { _row_id: id })
  const moveRow = (id: number, delta: number) =>
    adminWrite('helper_admin_move_row', { _row_id: id, _delta: delta })
  const importRows = (pageId: number, rows: ImportRow[], replace: boolean) =>
    adminWrite('helper_admin_import_rows', { _page_id: pageId, _rows: rows, _replace: replace })

  return {
    meta,
    pages,
    rowsByPage,
    loading,
    loadFailed,
    guestName,
    isAdmin,
    load,
    startLive,
    stopLive,
    setGuestName,
    signUp,
    removeName,
    setCell,
    adminLogin,
    adminLogout,
    setMeta,
    addPage,
    renamePage,
    deletePage,
    movePage,
    addRow,
    deleteRow,
    moveRow,
    importRows,
  }
})

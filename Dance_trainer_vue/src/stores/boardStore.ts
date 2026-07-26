import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './authStore'
import { useToastStore } from './toastStore'
import type { ParsedBoard } from '@/lib/trelloFormat'
import { parseBoardFile, buildBoardExport } from '@/lib/boardFormat'
import { localToday, addDays, isDue, daysBetween } from '@/lib/dates'
import { wouldCycle } from '@/lib/cardTree'

export interface Board {
  id: number
  name: string
  invite_code: string
}

export interface Column {
  id: number
  board_id: number
  name: string
  position: number
  due_offset_days: number | null
  is_due_column: boolean
  due_clear_on_enter: boolean
  is_quick_target: boolean
  is_inbox_column: boolean
}

export interface Card {
  id: number
  column_id: number
  name: string
  description: string | null
  position: number
  due_date: string | null
  // Which column's on-enter rule last set this card's due date, and when.
  // See the 20260721000000 migration for why these are stored, not derived.
  last_scheduled_column_id: number | null
  last_practiced_on: string | null
  // "Part of" another card — see the 20260726102400 migration and
  // lib/cardTree.ts. `name` stays the leaf only; the ancestor chain is derived.
  parent_id: number | null
}

export interface Label {
  id: number
  board_id: number
  name: string
  color: string
}

export const useBoardStore = defineStore('board', () => {
  const boards = ref<Board[]>([])
  const board = ref<Board | null>(null)
  const columns = ref<Column[]>([])
  const cards = ref<Card[]>([])
  const labels = ref<Label[]>([])
  const cardLabels = ref<{ card_id: number; label_id: number }[]>([])
  const loading = ref(false)

  // Serializes writes for a given card so overlapping calls (fast double-drag,
  // rapid label toggles) can't have their DB updates land out of order.
  const cardWriteQueues = new Map<number, Promise<unknown>>()
  function queueCardWrite(cardId: number, task: () => Promise<unknown>) {
    const prior = cardWriteQueues.get(cardId) ?? Promise.resolve()
    const next = prior.then(task, task)
    cardWriteQueues.set(cardId, next)
    return next
  }

  const cardsByColumn = computed(() => (columnId: number) =>
    cards.value
      .filter((c) => c.column_id === columnId)
      .sort((a, b) => a.position - b.position),
  )

  const labelsByCardId = computed(() => {
    const labelsById = new Map(labels.value.map((l) => [l.id, l]))
    const map = new Map<number, Label[]>()
    for (const cl of cardLabels.value) {
      const label = labelsById.get(cl.label_id)
      if (!label) continue
      const list = map.get(cl.card_id)
      if (list) list.push(label)
      else map.set(cl.card_id, [label])
    }
    return map
  })

  const labelsForCard = computed(() => (cardId: number) => labelsByCardId.value.get(cardId) ?? [])

  // Columns offered as one-tap "quick move" targets in the card modal.
  const quickTargetColumns = computed(() =>
    columns.value.filter((c) => c.is_quick_target).sort((a, b) => a.position - b.position),
  )

  // Where the practice view's quick-add drops a newly named skill. Unset by
  // default and deliberately not defaulted to any column: a card landing
  // somewhere unasked would enter (or dodge) the schedule silently.
  const inboxColumn = computed<Column | null>(
    () => columns.value.find((c) => c.is_inbox_column) ?? null,
  )

  // Flagged due column, else the leftmost column collects due cards.
  const dueColumn = computed<Column | null>(() => {
    if (columns.value.length === 0) return null
    return (
      columns.value.find((c) => c.is_due_column) ??
      columns.value.reduce((a, b) => (b.position < a.position ? b : a))
    )
  })

  async function loadBoards() {
    const auth = useAuthStore()
    if (!auth.user) return
    loading.value = true
    const { data, error: err } = await supabase
      .from('boards')
      .select('id, name, invite_code, board_members!inner(user_id)')
      .eq('board_members.user_id', auth.user.id)
      .order('id')
    if (err) useToastStore().show(err.message)
    else boards.value = (data ?? []).map((b) => ({ id: b.id, name: b.name, invite_code: b.invite_code }))
    loading.value = false
  }

  async function joinBoard(code: string) {
    const { data, error: err } = await supabase.rpc('join_board', { _invite_code: code })
    if (err) { useToastStore().show(err.message); return null }
    await loadBoards()
    return data as number
  }

  async function insertBoardWithMembership(name: string, userId: string) {
    const { data, error: boardErr } = await supabase
      .from('boards')
      .insert({ name })
      .select()
      .single()
    if (boardErr) return { data: null, error: boardErr }

    const { error: memberErr } = await supabase
      .from('board_members')
      .insert({ board_id: data.id, user_id: userId })
    if (memberErr) return { data: null, error: memberErr }

    return { data, error: null }
  }

  async function createBoard(name: string) {
    const auth = useAuthStore()
    if (!auth.user) return
    const { data, error: err } = await insertBoardWithMembership(name, auth.user.id)
    if (err) { useToastStore().show(err.message); return }
    boards.value.push(data)
  }

  async function deleteBoard(id: number) {
    const { error: err } = await supabase.from('boards').delete().eq('id', id)
    if (err) { useToastStore().show(err.message); return }
    boards.value = boards.value.filter((b) => b.id !== id)
  }

  // Inserts a parsed export's columns/cards/labels into an existing
  // (already-created, already-emptied-if-needed) board. Shared by a fresh
  // import and an overwrite-in-place import.
  async function insertParsedContent(boardId: number, parsed: ParsedBoard) {
    const columnIdByLocalId = new Map<string, number>()
    const labelIdByLocalId = new Map<string, number>()

    const [columnsResult, labelsResult] = await Promise.all([
      parsed.columns.length > 0
        ? supabase
            .from('columns')
            .insert(parsed.columns.map((c) => ({
              board_id: boardId,
              name: c.name,
              position: c.position,
              is_due_column: c.isDueColumn,
              due_offset_days: c.dueOffsetDays,
              due_clear_on_enter: c.dueClearOnEnter,
              is_quick_target: c.isQuickTarget,
              is_inbox_column: c.isInboxColumn,
            })))
            .select()
        : { data: [] as Column[], error: null },
      parsed.labels.length > 0
        ? supabase
            .from('labels')
            .insert(parsed.labels.map((l) => ({ board_id: boardId, name: l.name, color: l.color })))
            .select()
        : { data: [] as Label[], error: null },
    ])
    if (columnsResult.error) throw columnsResult.error
    if (labelsResult.error) throw labelsResult.error
    parsed.columns.forEach((c, i) => columnIdByLocalId.set(c.localId, columnsResult.data![i].id))
    parsed.labels.forEach((l, i) => labelIdByLocalId.set(l.localId, labelsResult.data![i].id))

    const cardIdByLocalId = new Map<string, number>()
    if (parsed.cards.length > 0) {
      const { data: cardRows, error: cardErr } = await supabase
        .from('cards')
        .insert(parsed.cards.map((c) => ({
          column_id: columnIdByLocalId.get(c.columnRef)!,
          name: c.name,
          description: c.description,
          due_date: c.dueDate,
          position: c.position,
          // Resolves through the same map as columnRef. Falls back to null if
          // the referenced column isn't in the file — a hand-edited export, or
          // a column deleted after the history was written.
          last_scheduled_column_id:
            (c.lastScheduledColumnRef && columnIdByLocalId.get(c.lastScheduledColumnRef)) || null,
          last_practiced_on: c.lastPracticedOn,
        })))
        .select()
      if (cardErr) throw cardErr
      parsed.cards.forEach((c, i) => cardIdByLocalId.set(c.localId, cardRows[i].id))

      // Family links are a second pass: a card's parent may sit anywhere in the
      // file, including after it, so the real ids only all exist once every row
      // is inserted. A parentRef that doesn't resolve is dropped rather than
      // failing the import — a hand-edited export, or a Trello file, which has
      // no relations at all.
      const parented = parsed.cards.filter(
        (c) => c.parentRef && cardIdByLocalId.has(c.parentRef),
      )
      for (const c of parented) {
        const { error: pErr } = await supabase
          .from('cards')
          .update({ parent_id: cardIdByLocalId.get(c.parentRef!)! })
          .eq('id', cardIdByLocalId.get(c.localId)!)
        if (pErr) throw pErr
      }
    }

    if (parsed.cardLabels.length > 0) {
      const { error: clErr } = await supabase.from('card_labels').insert(
        parsed.cardLabels.map((cl) => ({
          card_id: cardIdByLocalId.get(cl.cardRef)!,
          label_id: labelIdByLocalId.get(cl.labelRef)!,
        })),
      )
      if (clErr) throw clErr
    }
  }

  async function importTrelloBoard(file: File): Promise<number | null> {
    const auth = useAuthStore()
    if (!auth.user) return null
    loading.value = true
    try {
      const parsed = parseBoardFile(JSON.parse(await file.text()))

      const { data: boardData, error: boardErr } = await insertBoardWithMembership(parsed.boardName, auth.user.id)
      if (boardErr) throw boardErr

      await insertParsedContent(boardData.id, parsed)

      boards.value.push({ id: boardData.id, name: boardData.name, invite_code: boardData.invite_code })
      return boardData.id as number
    } catch (e: unknown) {
      useToastStore().show(e instanceof Error ? e.message : 'Failed to import board')
      return null
    } finally {
      loading.value = false
    }
  }

  // Replaces an existing board's columns/cards/labels with an export file's
  // content, in place — keeps the board's id/invite_code (and thus sharing)
  // intact, for "update my board" rather than "start a new one". A Trello
  // export has no column automation settings, so in that case the existing
  // columns' settings are preserved by name match rather than reset to
  // defaults; our own export already carries real settings, which are trusted
  // as-is (a deliberate restore).
  async function importTrelloIntoBoard(boardId: number, file: File): Promise<boolean> {
    loading.value = true
    try {
      const parsed = parseBoardFile(JSON.parse(await file.text()))

      if (!parsed.hasColumnSettings) {
        const settingsByName = new Map(
          columns.value.map((c) => [c.name, {
            isDueColumn: c.is_due_column,
            dueOffsetDays: c.due_offset_days,
            dueClearOnEnter: c.due_clear_on_enter,
            isQuickTarget: c.is_quick_target,
            isInboxColumn: c.is_inbox_column,
          }]),
        )
        parsed.columns = parsed.columns.map((c) => {
          const prev = settingsByName.get(c.name)
          return prev ? { ...c, ...prev } : c
        })
      }

      // Deleting columns cascades to their cards (and those cards' card_labels);
      // deleting labels cascades any remaining card_labels.
      const { error: delColumnsErr } = await supabase.from('columns').delete().eq('board_id', boardId)
      if (delColumnsErr) throw delColumnsErr
      const { error: delLabelsErr } = await supabase.from('labels').delete().eq('board_id', boardId)
      if (delLabelsErr) throw delLabelsErr

      await insertParsedContent(boardId, parsed)
      await loadBoard(boardId)
      useToastStore().success('Board replaced with the imported file')
      return true
    } catch (e: unknown) {
      useToastStore().show(e instanceof Error ? e.message : 'Failed to import board')
      return false
    } finally {
      loading.value = false
    }
  }

  function exportBoard() {
    if (!board.value) return
    const data = buildBoardExport(board.value, columns.value, cards.value, labels.value, cardLabels.value)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${board.value.name}.json`
    a.click()
    URL.revokeObjectURL(url)
    useToastStore().success(`Exported ${a.download}`)
  }

  async function loadBoard(id: number) {
    loading.value = true
    try {
      const { data: boardData, error: boardErr } = await supabase
        .from('boards')
        .select('*')
        .eq('id', id)
        .single()
      if (boardErr) throw boardErr
      board.value = boardData
      columns.value = []
      cards.value = []
      labels.value = []
      cardLabels.value = []

      const [
        { data: columnData, error: columnErr },
        { data: labelData, error: labelErr },
      ] = await Promise.all([
        supabase.from('columns').select('*').eq('board_id', boardData.id).order('position'),
        supabase.from('labels').select('*').eq('board_id', boardData.id),
      ])
      if (columnErr) throw columnErr
      if (labelErr) throw labelErr
      columns.value = columnData
      labels.value = labelData

      const columnIds = columnData.map((c: Column) => c.id)
      if (columnIds.length > 0) {
        const { data: cardData, error: cardErr } = await supabase
          .from('cards')
          .select('*')
          .in('column_id', columnIds)
          .order('position')
        if (cardErr) throw cardErr
        cards.value = cardData

        const cardIds = cardData.map((c: Card) => c.id)
        if (cardIds.length > 0) {
          const { data: cardLabelData, error: cardLabelErr } = await supabase
            .from('card_labels')
            .select('card_id, label_id')
            .in('card_id', cardIds)
          if (cardLabelErr) throw cardLabelErr
          cardLabels.value = cardLabelData
        }
      }
    } catch (e: unknown) {
      useToastStore().show(e instanceof Error ? e.message : 'Failed to load board')
    } finally {
      loading.value = false
    }
  }

  async function addColumn() {
    if (!board.value) return
    const position = columns.value.length
    const { data, error: err } = await supabase
      .from('columns')
      .insert({ board_id: board.value.id, name: 'New Column', position })
      .select()
      .single()
    if (err) { useToastStore().show(err.message); return }
    columns.value.push(data)
  }

  async function renameColumn(columnId: number, name: string) {
    const col = columns.value.find((c) => c.id === columnId)
    if (!col) return
    const oldName = col.name
    col.name = name
    const { error: err } = await supabase.from('columns').update({ name }).eq('id', columnId)
    if (err) { useToastStore().show(err.message); col.name = oldName }
  }

  async function updateColumnSettings(
    columnId: number,
    settings: { due_offset_days: number | null; is_due_column: boolean; due_clear_on_enter: boolean },
  ) {
    const col = columns.value.find((c) => c.id === columnId)
    if (!col) return
    // A due column has no on-enter rule (also a DB check constraint).
    const next = settings.is_due_column
      ? { ...settings, due_offset_days: null, due_clear_on_enter: false }
      : { ...settings }
    const prev = {
      due_offset_days: col.due_offset_days,
      is_due_column: col.is_due_column,
      due_clear_on_enter: col.due_clear_on_enter,
    }
    const prevDue = next.is_due_column
      ? columns.value.find((c) => c.is_due_column && c.id !== columnId)
      : undefined

    if (prevDue) prevDue.is_due_column = false
    Object.assign(col, next)

    // Unset the old due column first — a partial unique index forbids two at once.
    if (prevDue) {
      const { error: err } = await supabase
        .from('columns')
        .update({ is_due_column: false })
        .eq('id', prevDue.id)
      if (err) {
        useToastStore().show(err.message)
        prevDue.is_due_column = true
        Object.assign(col, prev)
        return
      }
    }
    const { error: err } = await supabase.from('columns').update(next).eq('id', columnId)
    if (err) {
      useToastStore().show(err.message)
      Object.assign(col, prev)
      if (prevDue) {
        prevDue.is_due_column = true
        await supabase.from('columns').update({ is_due_column: true }).eq('id', prevDue.id)
      }
    }
  }

  async function setColumnQuickTarget(columnId: number, value: boolean) {
    const col = columns.value.find((c) => c.id === columnId)
    if (!col) return
    const prev = col.is_quick_target
    col.is_quick_target = value
    const { error: err } = await supabase
      .from('columns')
      .update({ is_quick_target: value })
      .eq('id', columnId)
    if (err) { useToastStore().show(err.message); col.is_quick_target = prev }
  }

  // One inbox per board: marking a column unmarks whichever held it. No unique
  // index behind this (unlike is_due_column) — nothing breaks if two are set,
  // inboxColumn just takes the first.
  async function setColumnInbox(columnId: number, value: boolean) {
    const col = columns.value.find((c) => c.id === columnId)
    if (!col) return
    const prevInbox = value ? columns.value.find((c) => c.is_inbox_column && c.id !== columnId) : undefined
    const prev = col.is_inbox_column
    if (prevInbox) prevInbox.is_inbox_column = false
    col.is_inbox_column = value

    if (prevInbox) {
      const { error: prevErr } = await supabase
        .from('columns')
        .update({ is_inbox_column: false })
        .eq('id', prevInbox.id)
      if (prevErr) {
        useToastStore().show(prevErr.message)
        prevInbox.is_inbox_column = true
        col.is_inbox_column = prev
        return
      }
    }
    const { error: err } = await supabase
      .from('columns')
      .update({ is_inbox_column: value })
      .eq('id', columnId)
    if (err) { useToastStore().show(err.message); col.is_inbox_column = prev }
  }

  async function deleteColumn(columnId: number) {
    const { error: err } = await supabase.from('columns').delete().eq('id', columnId)
    if (err) { useToastStore().show(err.message); return }
    columns.value = columns.value.filter((c) => c.id !== columnId)
    cards.value = cards.value.filter((c) => c.column_id !== columnId)
  }

  /** Move a column one step left (-1) or right (+1). */
  async function moveColumn(columnId: number, delta: -1 | 1) {
    const sorted = [...columns.value].sort((a, b) => a.position - b.position)
    const index = sorted.findIndex((c) => c.id === columnId)
    const neighbor = sorted[index + delta]
    if (index === -1 || !neighbor) return
    const col = sorted[index]!

    const prev = { colPos: col.position, neighborPos: neighbor.position }
    ;[col.position, neighbor.position] = [neighbor.position, col.position]
    columns.value.sort((a, b) => a.position - b.position)

    const results = await Promise.all([
      supabase.from('columns').update({ position: col.position }).eq('id', col.id),
      supabase.from('columns').update({ position: neighbor.position }).eq('id', neighbor.id),
    ])
    const err = results.find((r) => r.error)?.error
    if (err) {
      useToastStore().show(err.message)
      col.position = prev.colPos
      neighbor.position = prev.neighborPos
      columns.value.sort((a, b) => a.position - b.position)
    }
  }

  /** Move a column to an arbitrary position (drag-and-drop reorder). */
  async function moveColumnTo(columnId: number, targetPosition: number) {
    const sorted = [...columns.value].sort((a, b) => a.position - b.position)
    const col = sorted.find((c) => c.id === columnId)
    if (!col) return
    const rest = sorted.filter((c) => c.id !== columnId)
    const clamped = Math.max(0, Math.min(targetPosition, rest.length))
    rest.splice(clamped, 0, col)

    const prevPositions = new Map(columns.value.map((c) => [c.id, c.position]))
    rest.forEach((c, i) => { c.position = i })
    columns.value.sort((a, b) => a.position - b.position)

    const results = await Promise.all(
      rest.map((c) => supabase.from('columns').update({ position: c.position }).eq('id', c.id)),
    )
    const err = results.find((r) => r.error)?.error
    if (err) {
      useToastStore().show(err.message)
      columns.value.forEach((c) => { c.position = prevPositions.get(c.id)! })
      columns.value.sort((a, b) => a.position - b.position)
    }
  }

  // Returns the inserted card (null on failure) — the practice view's quick-add
  // needs the real row id to put it straight into the session, and the temp id
  // it renders optimistically would be persisted to localStorage.
  async function addCard(columnId: number, name = 'New Card'): Promise<Card | null> {
    const columnCards = cardsByColumn.value(columnId)
    const position = columnCards.length
    const tempId = -Date.now()
    cards.value.push({
      id: tempId,
      column_id: columnId,
      name,
      description: null,
      position,
      due_date: null,
      last_scheduled_column_id: null,
      last_practiced_on: null,
      parent_id: null,
    })
    const { data, error: err } = await supabase
      .from('cards')
      .insert({ column_id: columnId, name, position, description: null })
      .select()
      .single()
    if (err) {
      useToastStore().show(err.message)
      cards.value = cards.value.filter((c) => c.id !== tempId)
      return null
    }
    const idx = cards.value.findIndex((c) => c.id === tempId)
    if (idx !== -1) cards.value[idx] = data
    return data as Card
  }

  async function updateCardField<K extends 'name' | 'description' | 'due_date' | 'parent_id'>(
    cardId: number,
    field: K,
    value: Card[K],
  ) {
    const card = cards.value.find((c) => c.id === cardId)
    if (!card) return
    const old = card[field]
    card[field] = value
    const { error: err } = await supabase.from('cards').update({ [field]: value }).eq('id', cardId)
    if (err) { useToastStore().show(err.message); card[field] = old }
  }

  function renameCard(cardId: number, name: string) {
    return updateCardField(cardId, 'name', name)
  }

  function updateCardDescription(cardId: number, description: string) {
    return updateCardField(cardId, 'description', description)
  }

  function updateCardDueDate(cardId: number, dueDate: string | null) {
    return updateCardField(cardId, 'due_date', dueDate)
  }

  // Session Review's "Keep in place": the card was practiced but stays where it
  // is, so no move happens and no column rule can fire. Without this its due
  // date is never touched and its lateness climbs forever, which is why a
  // practiced-and-kept card reads as "14d late" — measuring how long ago it
  // first came due rather than how long since it was last worked on.
  //
  // Applies the card's *own* column's on-enter offset rather than always
  // stamping today. Keeping a card in the due column (offset null) means "due
  // again now", but keeping one in Wöchentlich has to mean "due again in a
  // week" — stamping today there would make the column's own interval a lie
  // and bounce the card straight back out on the next sweep.
  //
  // An undated card in a column with no rule stays undated. Those are the
  // parking columns — Library und Backlog, Ziele — and a card sitting there
  // is deliberately outside spaced repetition. Stamping it today would enrol
  // it without being asked and sweep it into the due column tomorrow. The
  // practice date is still recorded: that happened, whatever the schedule says.
  async function recordPracticeInPlace(cardId: number) {
    const card = cards.value.find((c) => c.id === cardId)
    if (!card) return
    const old = {
      due_date: card.due_date,
      last_scheduled_column_id: card.last_scheduled_column_id,
      last_practiced_on: card.last_practiced_on,
    }
    const today = localToday()
    const offset = columns.value.find((c) => c.id === card.column_id)?.due_offset_days ?? null
    if (offset !== null) card.due_date = addDays(today, offset)
    else if (card.due_date !== null) card.due_date = today
    card.last_scheduled_column_id = card.column_id
    card.last_practiced_on = today
    const { error: err } = await supabase
      .from('cards')
      .update({
        due_date: card.due_date,
        last_scheduled_column_id: card.last_scheduled_column_id,
        last_practiced_on: card.last_practiced_on,
      })
      .eq('id', cardId)
    if (err) {
      useToastStore().show(err.message)
      Object.assign(card, old)
    }
  }

  // "Wöchentlich · practiced 8d ago" — the line that lets you reason "this was
  // weekly and it went well, move it up a rung". Null until the card has been
  // scheduled at least once since the history fields were added.
  function cardHistoryLabel(card: Card): string | null {
    if (!card.last_practiced_on) return null
    const days = daysBetween(card.last_practiced_on, localToday())
    const when =
      days <= 0 ? 'practiced today' : days === 1 ? 'practiced yesterday' : `practiced ${days}d ago`
    const columnName = columns.value.find((c) => c.id === card.last_scheduled_column_id)?.name
    return columnName ? `${columnName} · ${when}` : when
  }

  async function createLabel(boardId: number, name: string, color: string): Promise<Label | null> {
    const tempId = -Date.now()
    labels.value.push({ id: tempId, board_id: boardId, name, color })
    const { data, error: err } = await supabase
      .from('labels')
      .insert({ board_id: boardId, name, color })
      .select()
      .single()
    if (err) {
      useToastStore().show(err.message)
      labels.value = labels.value.filter((l) => l.id !== tempId)
      return null
    }
    const idx = labels.value.findIndex((l) => l.id === tempId)
    if (idx !== -1) labels.value[idx] = data
    return data
  }

  async function deleteLabel(labelId: number) {
    const { error: err } = await supabase.from('labels').delete().eq('id', labelId)
    if (err) { useToastStore().show(err.message); return }
    labels.value = labels.value.filter((l) => l.id !== labelId)
    cardLabels.value = cardLabels.value.filter((cl) => cl.label_id !== labelId)
  }

  async function toggleCardLabel(cardId: number, labelId: number) {
    const isAssigned = cardLabels.value.some(
      (cl) => cl.card_id === cardId && cl.label_id === labelId,
    )
    if (isAssigned) {
      cardLabels.value = cardLabels.value.filter(
        (cl) => !(cl.card_id === cardId && cl.label_id === labelId),
      )
      await queueCardWrite(cardId, async () => {
        const { error: err } = await supabase
          .from('card_labels')
          .delete()
          .eq('card_id', cardId)
          .eq('label_id', labelId)
        if (err) {
          useToastStore().show(err.message)
          cardLabels.value.push({ card_id: cardId, label_id: labelId })
        }
      })
    } else {
      cardLabels.value.push({ card_id: cardId, label_id: labelId })
      await queueCardWrite(cardId, async () => {
        const { error: err } = await supabase
          .from('card_labels')
          .insert({ card_id: cardId, label_id: labelId })
        if (err) {
          useToastStore().show(err.message)
          cardLabels.value = cardLabels.value.filter(
            (cl) => !(cl.card_id === cardId && cl.label_id === labelId),
          )
        }
      })
    }
  }

  // Deleting a card never takes its parts with it: children move up to the
  // grandparent (top-level when there wasn't one), keeping their own notes,
  // columns, due dates and history. Merge follows the same rule, so a part
  // surviving its parent is one story rather than two.
  //
  // Reparented *after* the delete, deliberately. The FK is `on delete set
  // null`, so by this point the DB has already detached the children; a failed
  // reparent then leaves them top-level, which is a coherent state the user can
  // see and fix. Reparenting first would point them at a row that may still be
  // there if the delete fails.
  async function deleteCard(cardId: number) {
    const grandparentId = cards.value.find((c) => c.id === cardId)?.parent_id ?? null
    const childIds = cards.value.filter((c) => c.parent_id === cardId).map((c) => c.id)
    const { error: err } = await supabase.from('cards').delete().eq('id', cardId)
    if (err) { useToastStore().show(err.message); return }
    cards.value = cards.value.filter((c) => c.id !== cardId)
    if (childIds.length === 0) return
    for (const c of cards.value) {
      if (childIds.includes(c.id)) c.parent_id = grandparentId
    }
    if (grandparentId === null) return // the FK already wrote exactly this
    const { error: reErr } = await supabase
      .from('cards')
      .update({ parent_id: grandparentId })
      .in('id', childIds)
    if (reErr) {
      useToastStore().show(reErr.message)
      // Fall back to what the database actually holds rather than showing a
      // family link that isn't there.
      for (const c of cards.value) {
        if (childIds.includes(c.id)) c.parent_id = null
      }
    }
  }

  // Make `cardId` a part of `parentId`, or detach it with null. Pickers already
  // filter out the card's own descendants, but a parent can also arrive from an
  // import or a future drag, so the cycle check is repeated here — a cycle would
  // hang nothing (every walk in cardTree.ts is guarded) but it would render a
  // family that can't be navigated out of.
  async function setCardParent(cardId: number, parentId: number | null) {
    if (parentId !== null) {
      // `cards` only ever holds the open board, so an unknown id means a
      // cross-board or stale target. Relations are same-board only.
      if (!cards.value.some((c) => c.id === parentId)) return
      if (wouldCycle(cards.value, cardId, parentId)) {
        useToastStore().show("A card can't be part of one of its own parts")
        return
      }
    }
    return updateCardField(cardId, 'parent_id', parentId)
  }

  // Split: a section of a card's note becomes a child card. Ordered so note text
  // can never be lost — the child that holds the extracted section is created
  // *and its note confirmed written* before that section is removed from the
  // parent. Anything failing before the last step leaves the parent untouched,
  // so the text still exists somewhere and the user can retry.
  //
  // The confirmations are read-backs, not return values: `updateCardField`
  // reports failure by toasting and rolling the local value back, so the only
  // way to know a write landed is to look at what the store now holds. Merge
  // guards its own note write the same way.
  async function splitCardFromNote(
    parentId: number,
    title: string,
    extracted: string,
    remaining: string,
    // The parent's note as it was when the section offsets were computed. The
    // split takes several round trips and the modal stays open on the parent
    // throughout, so a note edit committed meanwhile would otherwise be
    // clobbered by a `remaining` derived from text that is no longer there.
    sourceAtSplit: string,
  ): Promise<Card | null> {
    const parent = cards.value.find((c) => c.id === parentId)
    if (!parent) return null
    // A new part goes to the inbox: naming it is the moment it exists, and where
    // it belongs in the ladder is a separate judgement the user makes in Session
    // Review. It also stops a split quietly enrolling a raw part at the parent's
    // interval — a part just cut out is exactly the thing not yet worth
    // reviewing monthly because its parent is.
    //
    // With no inbox column set it stays in the parent's column. Never silently
    // pick one: that's the same rule quick-add follows, and the reason
    // inboxColumn has no fallback.
    const target =
      inboxColumn.value ?? columns.value.find((c) => c.id === parent.column_id) ?? null
    const targetId = target?.id ?? parent.column_id
    // A bare `#` is a legal heading with no text, and an explicit '' would slip
    // past addCard's default and make a nameless card.
    const child = await addCard(targetId, title.trim() || 'Untitled part')
    if (!child) return null
    await updateCardField(child.id, 'description', extracted)
    if (cards.value.find((c) => c.id === child.id)?.description !== extracted) {
      useToastStore().show("The part was created but its notes didn't save — nothing was removed")
      return null
    }
    await updateCardField(child.id, 'parent_id', parentId)
    // A split is just a card arriving in a column, so that column's ordinary
    // on-enter rule stamps its due date. `addCard` fires no rule (nothing
    // entered from anywhere) and `moveCard` won't either within one column, so
    // apply it here rather than inventing a scheduling path only splits use.
    // An inbox with no offset therefore leaves the part undated — outside
    // spaced repetition until it's triaged, which is what an inbox is for.
    if (target?.due_offset_days != null) {
      await updateCardField(child.id, 'due_date', addDays(localToday(), target.due_offset_days))
    }
    // Only worth placing when it stayed in the parent's column — in the inbox it
    // just goes on the end, where triage picks it up. Lands one slot lower than
    // asked: the new card is last in `cards.value`, and moveCard's same-column
    // branch assigns the position then re-sorts, so it ties with the incumbent
    // and the stable sort puts the incumbent first. That's the pre-existing
    // tie-break in moveCard already logged in Open Work.
    if (targetId === parent.column_id) {
      await moveCard(child.id, parent.column_id, parent.position + 1, false)
    }
    // Only now touch the parent, and only if it still says what it said when
    // the section was picked. If it changed under us the part is already safe
    // on its own card — leaving the duplicate text behind beats deleting an
    // edit the user just made.
    if (cards.value.find((c) => c.id === parentId)?.description !== sourceAtSplit) {
      useToastStore().show('The note changed while splitting — the section was kept in both cards')
      return child
    }
    await updateCardField(parentId, 'description', remaining)
    return child
  }

  // Merge: fold a child back into its parent. The caller has already built the
  // combined note (see mergeNote in lib/markdown.ts). The parent is written
  // first — if that fails nothing is deleted and the user can simply retry,
  // whereas deleting first could drop the child's text on the floor.
  // deleteCard then moves any grandchildren up to this same parent.
  async function mergeCardIntoParent(childId: number, mergedParentNote: string) {
    const child = cards.value.find((c) => c.id === childId)
    if (!child || child.parent_id === null) return
    const parentId = child.parent_id
    await updateCardField(parentId, 'description', mergedParentNote)
    // updateCardField rolls the note back itself on failure, so the note not
    // reading as what we just wrote means the write didn't land — stop rather
    // than delete a card whose text never reached the parent.
    if (cards.value.find((c) => c.id === parentId)?.description !== mergedParentNote) return
    await deleteCard(childId)
  }

  async function moveCard(
    cardId: number,
    targetColumnId: number,
    targetPosition: number,
    applyEnterRule = true,
  ) {
    const card = cards.value.find((c) => c.id === cardId)
    if (!card) return
    const oldColumnId = card.column_id

    // Snapshot every card in the source/target columns before mutating, so a
    // failed persist can be rolled back to exactly this state.
    const affectedColumnIds = new Set([oldColumnId, targetColumnId])
    const snapshot = cards.value
      .filter((c) => affectedColumnIds.has(c.column_id))
      .map((c) => ({
        id: c.id,
        column_id: c.column_id,
        position: c.position,
        due_date: c.due_date,
        last_scheduled_column_id: c.last_scheduled_column_id,
        last_practiced_on: c.last_practiced_on,
      }))

    // Entering a column with an on-enter rule stamps the due date (overwrites).
    // Same-column reorders and sweep moves never fire the rule.
    let ruleFired = false
    if (applyEnterRule && oldColumnId !== targetColumnId) {
      const target = columns.value.find((c) => c.id === targetColumnId)
      if (target && target.due_offset_days !== null) {
        card.due_date = addDays(localToday(), target.due_offset_days)
        ruleFired = true
        // This is the moment the interval was chosen — the card was practiced
        // and is being filed into a bucket. Recorded only for the offset rule:
        // due_clear_on_enter means "no longer scheduled", which is the opposite
        // of a scheduling event and would otherwise write a misleading history.
        card.last_scheduled_column_id = targetColumnId
        card.last_practiced_on = localToday()
      } else if (target?.due_clear_on_enter && card.due_date !== null) {
        card.due_date = null
        ruleFired = true
      }
    }

    // Remove card from source, insert at target
    card.column_id = targetColumnId

    // Reindex source column (card is now gone from it)
    if (oldColumnId !== targetColumnId) {
      cardsByColumn.value(oldColumnId).forEach((c, i) => { c.position = i })
    }

    // Insert card at target position, then reindex target column
    card.position = targetPosition
    cardsByColumn.value(targetColumnId).forEach((c, i) => { c.position = i })

    // Persist all affected cards, serialized per-card so a rapid second move
    // of the same card can't have its write land before this one's.
    const allAffected = cards.value.filter((c) => affectedColumnIds.has(c.column_id))
    await queueCardWrite(cardId, async () => {
      for (const c of allAffected) {
        const payload =
          c.id === cardId && ruleFired
            ? {
                column_id: c.column_id,
                position: c.position,
                due_date: c.due_date,
                last_scheduled_column_id: c.last_scheduled_column_id,
                last_practiced_on: c.last_practiced_on,
              }
            : { column_id: c.column_id, position: c.position }
        const { error: err } = await supabase.from('cards').update(payload).eq('id', c.id)
        if (err) {
          for (const snap of snapshot) {
            const liveCard = cards.value.find((cc) => cc.id === snap.id)
            if (liveCard) {
              liveCard.column_id = snap.column_id
              liveCard.position = snap.position
              liveCard.due_date = snap.due_date
              liveCard.last_scheduled_column_id = snap.last_scheduled_column_id
              liveCard.last_practiced_on = snap.last_practiced_on
            }
          }
          useToastStore().show(err.message)
          return
        }
      }
    })
  }

  // Move every card whose due date has arrived into the due column.
  // Keeps due dates untouched and never applies on-enter rules; idempotent.
  async function sweepDueCards() {
    const target = dueColumn.value
    if (!target || loading.value) return
    const today = localToday()
    const swept = cards.value
      .filter((c) => c.column_id !== target.id && isDue(c.due_date, today))
      .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
    if (swept.length === 0) return

    const affectedColumnIds = new Set<number>([target.id])
    for (const c of swept) affectedColumnIds.add(c.column_id)

    const snapshot = cards.value
      .filter((c) => affectedColumnIds.has(c.column_id))
      .map((c) => ({ id: c.id, column_id: c.column_id, position: c.position }))

    // Swept cards land on top of the due column, most overdue first.
    const existing = cardsByColumn.value(target.id)
    swept.forEach((c) => { c.column_id = target.id })
    ;[...swept, ...existing].forEach((c, i) => { c.position = i })
    for (const colId of affectedColumnIds) {
      if (colId !== target.id) cardsByColumn.value(colId).forEach((c, i) => { c.position = i })
    }

    const allAffected = cards.value.filter((c) => affectedColumnIds.has(c.column_id))
    for (const c of allAffected) {
      const { error: err } = await supabase
        .from('cards')
        .update({ column_id: c.column_id, position: c.position })
        .eq('id', c.id)
      if (err) {
        for (const snap of snapshot) {
          const liveCard = cards.value.find((cc) => cc.id === snap.id)
          if (liveCard) {
            liveCard.column_id = snap.column_id
            liveCard.position = snap.position
          }
        }
        useToastStore().show(err.message)
        return
      }
    }
  }

  return {
    boards, board, columns, cards, labels, cardLabels, loading,
    cardsByColumn, labelsForCard, dueColumn, quickTargetColumns, inboxColumn,
    loadBoards, createBoard, deleteBoard, joinBoard,
    importTrelloBoard, importTrelloIntoBoard, exportBoard,
    loadBoard,
    addColumn, renameColumn, updateColumnSettings, setColumnQuickTarget, setColumnInbox, deleteColumn, moveColumn, moveColumnTo,
    addCard, renameCard, deleteCard,
    setCardParent, splitCardFromNote, mergeCardIntoParent,
    updateCardDescription, updateCardDueDate, recordPracticeInPlace, cardHistoryLabel,
    createLabel, deleteLabel, toggleCardLabel,
    moveCard, sweepDueCards,
  }
})

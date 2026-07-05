import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './authStore'
import { useToastStore } from './toastStore'
import type { ParsedBoard } from '@/lib/trelloFormat'
import { parseBoardFile, buildBoardExport } from '@/lib/boardFormat'
import { localToday, addDays, isDue } from '@/lib/dates'

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
}

export interface Card {
  id: number
  column_id: number
  name: string
  description: string | null
  position: number
  due_date: string | null
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
        })))
        .select()
      if (cardErr) throw cardErr
      parsed.cards.forEach((c, i) => cardIdByLocalId.set(c.localId, cardRows[i].id))
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

  async function addCard(columnId: number, name = 'New Card') {
    const columnCards = cardsByColumn.value(columnId)
    const position = columnCards.length
    const tempId = -Date.now()
    cards.value.push({ id: tempId, column_id: columnId, name, description: null, position, due_date: null })
    const { data, error: err } = await supabase
      .from('cards')
      .insert({ column_id: columnId, name, position, description: null })
      .select()
      .single()
    if (err) {
      useToastStore().show(err.message)
      cards.value = cards.value.filter((c) => c.id !== tempId)
      return
    }
    const idx = cards.value.findIndex((c) => c.id === tempId)
    if (idx !== -1) cards.value[idx] = data
  }

  async function updateCardField<K extends 'name' | 'description' | 'due_date'>(
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

  async function deleteCard(cardId: number) {
    const { error: err } = await supabase.from('cards').delete().eq('id', cardId)
    if (err) { useToastStore().show(err.message); return }
    cards.value = cards.value.filter((c) => c.id !== cardId)
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
      .map((c) => ({ id: c.id, column_id: c.column_id, position: c.position, due_date: c.due_date }))

    // Entering a column with an on-enter rule stamps the due date (overwrites).
    // Same-column reorders and sweep moves never fire the rule.
    let ruleFired = false
    if (applyEnterRule && oldColumnId !== targetColumnId) {
      const target = columns.value.find((c) => c.id === targetColumnId)
      if (target && target.due_offset_days !== null) {
        card.due_date = addDays(localToday(), target.due_offset_days)
        ruleFired = true
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
            ? { column_id: c.column_id, position: c.position, due_date: c.due_date }
            : { column_id: c.column_id, position: c.position }
        const { error: err } = await supabase.from('cards').update(payload).eq('id', c.id)
        if (err) {
          for (const snap of snapshot) {
            const liveCard = cards.value.find((cc) => cc.id === snap.id)
            if (liveCard) {
              liveCard.column_id = snap.column_id
              liveCard.position = snap.position
              liveCard.due_date = snap.due_date
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
    cardsByColumn, labelsForCard, dueColumn, quickTargetColumns,
    loadBoards, createBoard, deleteBoard, joinBoard,
    importTrelloBoard, importTrelloIntoBoard, exportBoard,
    loadBoard,
    addColumn, renameColumn, updateColumnSettings, setColumnQuickTarget, deleteColumn, moveColumn, moveColumnTo,
    addCard, renameCard, deleteCard,
    updateCardDescription, updateCardDueDate,
    createLabel, deleteLabel, toggleCardLabel,
    moveCard, sweepDueCards,
  }
})

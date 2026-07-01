import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './authStore'
import { parseTrelloExport, buildTrelloExport } from '@/lib/trelloFormat'

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
  const error = ref<string | null>(null)

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

  async function loadBoards() {
    const auth = useAuthStore()
    if (!auth.user) return
    loading.value = true
    error.value = null
    const { data, error: err } = await supabase
      .from('boards')
      .select('id, name, invite_code, board_members!inner(user_id)')
      .eq('board_members.user_id', auth.user.id)
      .order('id')
    if (err) error.value = err.message
    else boards.value = (data ?? []).map((b) => ({ id: b.id, name: b.name, invite_code: b.invite_code }))
    loading.value = false
  }

  async function joinBoard(code: string) {
    error.value = null
    const { data, error: err } = await supabase.rpc('join_board', { _invite_code: code })
    if (err) { error.value = err.message; return null }
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
    if (err) { error.value = err.message; return }
    boards.value.push(data)
  }

  async function deleteBoard(id: number) {
    const { error: err } = await supabase.from('boards').delete().eq('id', id)
    if (err) { error.value = err.message; return }
    boards.value = boards.value.filter((b) => b.id !== id)
  }

  async function importTrelloBoard(file: File): Promise<number | null> {
    const auth = useAuthStore()
    if (!auth.user) return null
    loading.value = true
    error.value = null
    try {
      const parsed = parseTrelloExport(JSON.parse(await file.text()))

      const { data: boardData, error: boardErr } = await insertBoardWithMembership(parsed.boardName, auth.user.id)
      if (boardErr) throw boardErr

      const columnIdByTrelloId = new Map<string, number>()
      const labelIdByTrelloId = new Map<string, number>()

      const [columnsResult, labelsResult] = await Promise.all([
        parsed.columns.length > 0
          ? supabase
              .from('columns')
              .insert(parsed.columns.map((c) => ({ board_id: boardData.id, name: c.name, position: c.position })))
              .select()
          : { data: [] as Column[], error: null },
        parsed.labels.length > 0
          ? supabase
              .from('labels')
              .insert(parsed.labels.map((l) => ({ board_id: boardData.id, name: l.name, color: l.color })))
              .select()
          : { data: [] as Label[], error: null },
      ])
      if (columnsResult.error) throw columnsResult.error
      if (labelsResult.error) throw labelsResult.error
      parsed.columns.forEach((c, i) => columnIdByTrelloId.set(c.trelloId, columnsResult.data![i].id))
      parsed.labels.forEach((l, i) => labelIdByTrelloId.set(l.trelloId, labelsResult.data![i].id))

      const cardIdByTrelloId = new Map<string, number>()
      if (parsed.cards.length > 0) {
        const { data: cardRows, error: cardErr } = await supabase
          .from('cards')
          .insert(parsed.cards.map((c) => ({
            column_id: columnIdByTrelloId.get(c.trelloColumnId)!,
            name: c.name,
            description: c.description,
            due_date: c.dueDate,
            position: c.position,
          })))
          .select()
        if (cardErr) throw cardErr
        parsed.cards.forEach((c, i) => cardIdByTrelloId.set(c.trelloId, cardRows[i].id))
      }

      if (parsed.cardLabels.length > 0) {
        const { error: clErr } = await supabase.from('card_labels').insert(
          parsed.cardLabels.map((cl) => ({
            card_id: cardIdByTrelloId.get(cl.trelloCardId)!,
            label_id: labelIdByTrelloId.get(cl.trelloLabelId)!,
          })),
        )
        if (clErr) throw clErr
      }

      boards.value.push({ id: boardData.id, name: boardData.name, invite_code: boardData.invite_code })
      return boardData.id as number
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to import board'
      return null
    } finally {
      loading.value = false
    }
  }

  function exportBoard() {
    if (!board.value) return
    const data = buildTrelloExport(board.value, columns.value, cards.value, labels.value, cardLabels.value)
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
    error.value = null
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
      error.value = e instanceof Error ? e.message : 'Failed to load board'
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
    if (err) { error.value = err.message; return }
    columns.value.push(data)
  }

  async function renameColumn(columnId: number, name: string) {
    const col = columns.value.find((c) => c.id === columnId)
    if (!col) return
    const oldName = col.name
    col.name = name
    const { error: err } = await supabase.from('columns').update({ name }).eq('id', columnId)
    if (err) { error.value = err.message; col.name = oldName }
  }

  async function deleteColumn(columnId: number) {
    const { error: err } = await supabase.from('columns').delete().eq('id', columnId)
    if (err) { error.value = err.message; return }
    columns.value = columns.value.filter((c) => c.id !== columnId)
    cards.value = cards.value.filter((c) => c.column_id !== columnId)
  }

  async function addCard(columnId: number) {
    const columnCards = cardsByColumn.value(columnId)
    const position = columnCards.length
    const { data, error: err } = await supabase
      .from('cards')
      .insert({ column_id: columnId, name: 'New Card', position, description: null })
      .select()
      .single()
    if (err) { error.value = err.message; return }
    cards.value.push(data)
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
    if (err) { error.value = err.message; card[field] = old }
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

  async function createLabel(boardId: number, name: string, color: string) {
    const tempId = -Date.now()
    labels.value.push({ id: tempId, board_id: boardId, name, color })
    const { data, error: err } = await supabase
      .from('labels')
      .insert({ board_id: boardId, name, color })
      .select()
      .single()
    if (err) {
      error.value = err.message
      labels.value = labels.value.filter((l) => l.id !== tempId)
      return
    }
    const idx = labels.value.findIndex((l) => l.id === tempId)
    if (idx !== -1) labels.value[idx] = data
  }

  async function deleteLabel(labelId: number) {
    const { error: err } = await supabase.from('labels').delete().eq('id', labelId)
    if (err) { error.value = err.message; return }
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
      const { error: err } = await supabase
        .from('card_labels')
        .delete()
        .eq('card_id', cardId)
        .eq('label_id', labelId)
      if (err) { error.value = err.message; cardLabels.value.push({ card_id: cardId, label_id: labelId }) }
    } else {
      cardLabels.value.push({ card_id: cardId, label_id: labelId })
      const { error: err } = await supabase
        .from('card_labels')
        .insert({ card_id: cardId, label_id: labelId })
      if (err) {
        error.value = err.message
        cardLabels.value = cardLabels.value.filter(
          (cl) => !(cl.card_id === cardId && cl.label_id === labelId),
        )
      }
    }
  }

  async function deleteCard(cardId: number) {
    const { error: err } = await supabase.from('cards').delete().eq('id', cardId)
    if (err) { error.value = err.message; return }
    cards.value = cards.value.filter((c) => c.id !== cardId)
  }

  async function moveCard(
    cardId: number,
    targetColumnId: number,
    targetPosition: number,
  ) {
    const card = cards.value.find((c) => c.id === cardId)
    if (!card) return
    const oldColumnId = card.column_id

    // Remove card from source, insert at target
    card.column_id = targetColumnId

    // Reindex source column (card is now gone from it)
    if (oldColumnId !== targetColumnId) {
      cardsByColumn.value(oldColumnId).forEach((c, i) => { c.position = i })
    }

    // Insert card at target position, then reindex target column
    card.position = targetPosition
    cardsByColumn.value(targetColumnId).forEach((c, i) => { c.position = i })

    // Persist all affected cards
    const affectedColumnIds = new Set([oldColumnId, targetColumnId])
    const allAffected = cards.value.filter((c) => affectedColumnIds.has(c.column_id))
    for (const c of allAffected) {
      await supabase
        .from('cards')
        .update({ column_id: c.column_id, position: c.position })
        .eq('id', c.id)
    }
  }

  return {
    boards, board, columns, cards, labels, cardLabels, loading, error,
    cardsByColumn, labelsForCard,
    loadBoards, createBoard, deleteBoard, joinBoard,
    importTrelloBoard, exportBoard,
    loadBoard,
    addColumn, renameColumn, deleteColumn,
    addCard, renameCard, deleteCard,
    updateCardDescription, updateCardDueDate,
    createLabel, deleteLabel, toggleCardLabel,
    moveCard,
  }
})

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './authStore'

export interface Board {
  id: number
  name: string
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
}

export const useBoardStore = defineStore('board', () => {
  const boards = ref<Board[]>([])
  const board = ref<Board | null>(null)
  const columns = ref<Column[]>([])
  const cards = ref<Card[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const cardsByColumn = computed(() => (columnId: number) =>
    cards.value
      .filter((c) => c.column_id === columnId)
      .sort((a, b) => a.position - b.position),
  )

  async function loadBoards() {
    const auth = useAuthStore()
    if (!auth.user) return
    loading.value = true
    error.value = null
    const { data, error: err } = await supabase
      .from('boards')
      .select('id, name, board_members!inner(user_id)')
      .eq('board_members.user_id', auth.user.id)
      .order('id')
    if (err) error.value = err.message
    else boards.value = (data ?? []).map((b) => ({ id: b.id, name: b.name }))
    loading.value = false
  }

  async function createBoard(name: string) {
    const auth = useAuthStore()
    if (!auth.user) return
    const { data, error: boardErr } = await supabase
      .from('boards')
      .insert({ name })
      .select()
      .single()
    if (boardErr) { error.value = boardErr.message; return }

    const { error: memberErr } = await supabase
      .from('board_members')
      .insert({ board_id: data.id, user_id: auth.user.id })
    if (memberErr) { error.value = memberErr.message; return }

    boards.value.push(data)
  }

  async function deleteBoard(id: number) {
    const { error: err } = await supabase.from('boards').delete().eq('id', id)
    if (err) { error.value = err.message; return }
    boards.value = boards.value.filter((b) => b.id !== id)
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

      const { data: columnData, error: columnErr } = await supabase
        .from('columns')
        .select('*')
        .eq('board_id', boardData.id)
        .order('position')
      if (columnErr) throw columnErr
      columns.value = columnData

      const columnIds = columnData.map((c: Column) => c.id)
      if (columnIds.length > 0) {
        const { data: cardData, error: cardErr } = await supabase
          .from('cards')
          .select('*')
          .in('column_id', columnIds)
          .order('position')
        if (cardErr) throw cardErr
        cards.value = cardData
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

  async function renameCard(cardId: number, name: string) {
    const card = cards.value.find((c) => c.id === cardId)
    if (!card) return
    const oldName = card.name
    card.name = name
    const { error: err } = await supabase.from('cards').update({ name }).eq('id', cardId)
    if (err) { error.value = err.message; card.name = oldName }
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
    boards, board, columns, cards, loading, error,
    cardsByColumn,
    loadBoards, createBoard, deleteBoard,
    loadBoard,
    addColumn, renameColumn, deleteColumn,
    addCard, renameCard, deleteCard,
    moveCard,
  }
})

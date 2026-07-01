import { LABEL_COLORS } from './labelColors'

// Trello's palette has more variants than ours; map onto the nearest app
// color. If a value is already one of our own color names (e.g. from a file
// this app exported), it passes through unchanged so import/export round-trips.
const TRELLO_COLOR_MAP: Record<string, string> = {
  green: 'sage',
  lime: 'sage',
  yellow: 'ochre',
  orange: 'brass',
  red: 'rose',
  pink: 'rose',
  purple: 'plum',
  blue: 'denim',
  sky: 'denim',
  black: 'plum',
}
const DEFAULT_COLOR = 'brass'

function mapColor(color: string | null | undefined): string {
  if (!color) return DEFAULT_COLOR
  if (color in LABEL_COLORS) return color
  const base = color.replace(/_(light|dark)$/, '')
  if (base in LABEL_COLORS) return base
  return TRELLO_COLOR_MAP[base] ?? DEFAULT_COLOR
}

interface TrelloList {
  id: string
  name: string
  closed?: boolean
  pos: number
}

interface TrelloLabel {
  id: string
  name: string
  color: string | null
}

interface TrelloCard {
  id: string
  name: string
  desc?: string | null
  due?: string | null
  closed?: boolean
  idList: string
  idLabels?: string[]
  pos: number
}

interface TrelloExport {
  name: string
  lists: TrelloList[]
  cards: TrelloCard[]
  labels?: TrelloLabel[]
}

export interface ParsedColumn {
  trelloId: string
  name: string
  position: number
}

export interface ParsedCard {
  trelloId: string
  trelloColumnId: string
  name: string
  description: string | null
  dueDate: string | null
  position: number
}

export interface ParsedLabel {
  trelloId: string
  name: string
  color: string
}

export interface ParsedCardLabel {
  trelloCardId: string
  trelloLabelId: string
}

export interface ParsedBoard {
  boardName: string
  columns: ParsedColumn[]
  cards: ParsedCard[]
  labels: ParsedLabel[]
  cardLabels: ParsedCardLabel[]
}

export function parseTrelloExport(raw: unknown): ParsedBoard {
  const data = raw as TrelloExport
  if (!data || typeof data !== 'object' || !Array.isArray(data.lists) || !Array.isArray(data.cards)) {
    throw new Error('Not a valid Trello board export')
  }

  const openLists = data.lists.filter((l) => !l.closed).sort((a, b) => a.pos - b.pos)
  const openListIds = new Set(openLists.map((l) => l.id))
  const columns: ParsedColumn[] = openLists.map((l, i) => ({ trelloId: l.id, name: l.name, position: i }))

  const labels: ParsedLabel[] = (data.labels ?? []).map((l) => ({
    trelloId: l.id,
    name: l.name || '',
    color: mapColor(l.color),
  }))
  const labelIds = new Set(labels.map((l) => l.trelloId))

  const openCards = data.cards
    .filter((c) => !c.closed && openListIds.has(c.idList))
    .sort((a, b) => a.pos - b.pos)

  const nextPositionByList = new Map<string, number>()
  const cards: ParsedCard[] = openCards.map((c) => {
    const position = nextPositionByList.get(c.idList) ?? 0
    nextPositionByList.set(c.idList, position + 1)
    return {
      trelloId: c.id,
      trelloColumnId: c.idList,
      name: c.name,
      description: c.desc || null,
      dueDate: c.due ? c.due.slice(0, 10) : null,
      position,
    }
  })

  const cardLabels: ParsedCardLabel[] = openCards.flatMap((c) =>
    (c.idLabels ?? [])
      .filter((id) => labelIds.has(id))
      .map((id) => ({ trelloCardId: c.id, trelloLabelId: id })),
  )

  return { boardName: data.name || 'Imported board', columns, cards, labels, cardLabels }
}

export function buildTrelloExport(
  board: { name: string },
  columns: { id: number; name: string; position: number }[],
  cards: {
    id: number
    column_id: number
    name: string
    description: string | null
    due_date: string | null
    position: number
  }[],
  labels: { id: number; name: string; color: string }[],
  cardLabels: { card_id: number; label_id: number }[],
) {
  return {
    name: board.name,
    lists: [...columns]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ id: String(c.id), name: c.name, closed: false, pos: c.position })),
    labels: labels.map((l) => ({ id: String(l.id), name: l.name, color: l.color })),
    cards: [...cards]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: String(c.id),
        idList: String(c.column_id),
        name: c.name,
        desc: c.description ?? '',
        due: c.due_date ? `${c.due_date}T23:59:59.000Z` : null,
        closed: false,
        idLabels: cardLabels.filter((cl) => cl.card_id === c.id).map((cl) => String(cl.label_id)),
        pos: c.position,
      })),
  }
}

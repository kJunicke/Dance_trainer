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

// Intermediate shape both this Trello parser and lib/boardFormat.ts's native
// parser produce, consumed by boardStore's insertParsedContent. localId/
// columnRef/cardRef/labelRef are per-file cross-reference ids (Trello's own
// ids for a Trello export, our row ids as strings for a native export).
export interface ParsedColumn {
  localId: string
  name: string
  position: number
  isDueColumn: boolean
  dueOffsetDays: number | null
  dueClearOnEnter: boolean
  isQuickTarget: boolean
}

export interface ParsedCard {
  localId: string
  columnRef: string
  name: string
  description: string | null
  dueDate: string | null
  position: number
}

export interface ParsedLabel {
  localId: string
  name: string
  color: string
}

export interface ParsedCardLabel {
  cardRef: string
  labelRef: string
}

export interface ParsedBoard {
  boardName: string
  columns: ParsedColumn[]
  cards: ParsedCard[]
  labels: ParsedLabel[]
  cardLabels: ParsedCardLabel[]
  // True when the source file itself carries column automation settings (our
  // native export). Trello exports have no such concept, so their columns
  // above are stamped with schema defaults — an importer overwriting an
  // existing board can use this to decide whether to preserve the existing
  // columns' settings instead of resetting them.
  hasColumnSettings: boolean
}

export function parseTrelloExport(raw: unknown): ParsedBoard {
  const data = raw as TrelloExport
  if (!data || typeof data !== 'object' || !Array.isArray(data.lists) || !Array.isArray(data.cards)) {
    throw new Error('Not a valid Trello board export')
  }

  const openLists = data.lists.filter((l) => !l.closed).sort((a, b) => a.pos - b.pos)
  const openListIds = new Set(openLists.map((l) => l.id))
  const columns: ParsedColumn[] = openLists.map((l, i) => ({
    localId: l.id,
    name: l.name,
    position: i,
    isDueColumn: false,
    dueOffsetDays: null,
    dueClearOnEnter: false,
    isQuickTarget: false,
  }))

  const labels: ParsedLabel[] = (data.labels ?? []).map((l) => ({
    localId: l.id,
    name: l.name || '',
    color: mapColor(l.color),
  }))
  const labelIds = new Set(labels.map((l) => l.localId))

  const openCards = data.cards
    .filter((c) => !c.closed && openListIds.has(c.idList))
    .sort((a, b) => a.pos - b.pos)

  const nextPositionByList = new Map<string, number>()
  const cards: ParsedCard[] = openCards.map((c) => {
    const position = nextPositionByList.get(c.idList) ?? 0
    nextPositionByList.set(c.idList, position + 1)
    return {
      localId: c.id,
      columnRef: c.idList,
      name: c.name,
      description: c.desc || null,
      dueDate: c.due ? c.due.slice(0, 10) : null,
      position,
    }
  })

  const cardLabels: ParsedCardLabel[] = openCards.flatMap((c) =>
    (c.idLabels ?? [])
      .filter((id) => labelIds.has(id))
      .map((id) => ({ cardRef: c.id, labelRef: id })),
  )

  return { boardName: data.name || 'Imported board', columns, cards, labels, cardLabels, hasColumnSettings: false }
}

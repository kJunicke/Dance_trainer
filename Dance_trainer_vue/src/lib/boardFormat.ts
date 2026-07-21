import { LABEL_COLORS } from './labelColors'
import { parseTrelloExport, type ParsedBoard } from './trelloFormat'

// This app's own board export format — full fidelity (column automation
// settings, quick-move flags, our own label colors), unlike a Trello export,
// which has no room for any of that. Used for both backup/restore and
// duplicating a board (create a new board from the file).
const FORMAT = 'dance-trainer-board'
const VERSION = 1

interface NativeColumn {
  id: string
  name: string
  position: number
  isDueColumn: boolean
  dueOffsetDays: number | null
  dueClearOnEnter: boolean
  isQuickTarget: boolean
}

interface NativeLabel {
  id: string
  name: string
  color: string
}

interface NativeCard {
  id: string
  columnId: string
  name: string
  description: string | null
  dueDate: string | null
  position: number
  labelIds: string[]
  lastScheduledColumnId: string | null
  lastPracticedOn: string | null
}

interface NativeBoardExport {
  format: typeof FORMAT
  version: number
  name: string
  columns: NativeColumn[]
  labels: NativeLabel[]
  cards: NativeCard[]
}

export function isNativeBoardExport(raw: unknown): raw is NativeBoardExport {
  return !!raw && typeof raw === 'object' && (raw as { format?: unknown }).format === FORMAT
}

export function buildBoardExport(
  board: { name: string },
  columns: {
    id: number
    name: string
    position: number
    is_due_column: boolean
    due_offset_days: number | null
    due_clear_on_enter: boolean
    is_quick_target: boolean
  }[],
  cards: {
    id: number
    column_id: number
    name: string
    description: string | null
    due_date: string | null
    position: number
    last_scheduled_column_id: number | null
    last_practiced_on: string | null
  }[],
  labels: { id: number; name: string; color: string }[],
  cardLabels: { card_id: number; label_id: number }[],
): NativeBoardExport {
  return {
    format: FORMAT,
    version: VERSION,
    name: board.name,
    columns: [...columns]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: String(c.id),
        name: c.name,
        position: c.position,
        isDueColumn: c.is_due_column,
        dueOffsetDays: c.due_offset_days,
        dueClearOnEnter: c.due_clear_on_enter,
        isQuickTarget: c.is_quick_target,
      })),
    labels: labels.map((l) => ({ id: String(l.id), name: l.name, color: l.color })),
    cards: [...cards]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: String(c.id),
        columnId: String(c.column_id),
        name: c.name,
        description: c.description,
        dueDate: c.due_date,
        position: c.position,
        labelIds: cardLabels.filter((cl) => cl.card_id === c.id).map((cl) => String(cl.label_id)),
        lastScheduledColumnId:
          c.last_scheduled_column_id === null ? null : String(c.last_scheduled_column_id),
        lastPracticedOn: c.last_practiced_on,
      })),
  }
}

export function parseBoardExport(raw: unknown): ParsedBoard {
  const data = raw as NativeBoardExport
  if (!isNativeBoardExport(data) || !Array.isArray(data.columns) || !Array.isArray(data.cards)) {
    throw new Error('Not a valid board export')
  }

  const columns: ParsedBoard['columns'] = data.columns.map((c) => ({
    localId: c.id,
    name: c.name,
    position: c.position,
    isDueColumn: !!c.isDueColumn,
    dueOffsetDays: c.dueOffsetDays ?? null,
    dueClearOnEnter: !!c.dueClearOnEnter,
    isQuickTarget: !!c.isQuickTarget,
  }))

  const labels: ParsedBoard['labels'] = (data.labels ?? []).map((l) => ({
    localId: l.id,
    name: l.name || '',
    color: l.color in LABEL_COLORS ? l.color : (Object.keys(LABEL_COLORS)[0] ?? 'rose'),
  }))

  const cards: ParsedBoard['cards'] = data.cards.map((c) => ({
    localId: c.id,
    columnRef: c.columnId,
    name: c.name,
    description: c.description ?? null,
    dueDate: c.dueDate ?? null,
    lastScheduledColumnRef: c.lastScheduledColumnId ?? null,
    lastPracticedOn: c.lastPracticedOn ?? null,
    position: c.position,
  }))

  const cardLabels: ParsedBoard['cardLabels'] = data.cards.flatMap((c) =>
    (c.labelIds ?? []).map((labelId) => ({ cardRef: c.id, labelRef: labelId })),
  )

  return { boardName: data.name || 'Imported board', columns, cards, labels, cardLabels, hasColumnSettings: true }
}

/** Detects and parses either this app's own export or a Trello board export. */
export function parseBoardFile(raw: unknown): ParsedBoard {
  return isNativeBoardExport(raw) ? parseBoardExport(raw) : parseTrelloExport(raw)
}

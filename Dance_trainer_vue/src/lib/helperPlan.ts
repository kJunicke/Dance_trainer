// The helper plan's data shapes and every rule that needs no server: what counts
// as open, what "only open" keeps, and the spreadsheet formats in and out.

export type RowType = 'task' | 'section'
export type CellField = 'task' | 'when' | 'where' | 'needed' | 'comment'

export interface HelperMeta {
  title: string
  info: string
}

export interface HelperPage {
  id: number
  name: string
  position: number
}

export interface HelperRow {
  id: number
  page_id: number
  position: number
  type: RowType
  task: string
  when: string
  where: string
  needed: number
  comment: string
  who: string[]
}

export interface ImportRow {
  type: RowType
  task: string
  when: string
  where: string
  who: string[]
  needed: number
  comment: string
}

export type HelperRowRecord = Omit<HelperRow, 'who'>

export interface HelperSignupRecord {
  row_id: number
  name: string
}

// Mirrors of the limits the server enforces, so a field stops at the same length
// the database would cut it to.
export const HELPER_LIMITS = {
  name: 40,
  task: 500,
  when: 100,
  where: 200,
  comment: 1000,
  neededMin: 1,
  neededMax: 50,
  page: 40,
  importRowsPerTab: 500,
} as const

export function cleanName(name: string): string {
  return name.split(/\s+/).filter(Boolean).join(' ').slice(0, HELPER_LIMITS.name)
}

// The database's unique index is on lower(name), so "anna" and "Anna" are one person.
export function sameName(a: string, b: string): boolean {
  return cleanName(a).toLowerCase() === cleanName(b).toLowerCase()
}

export function openPlaces(row: HelperRow): number {
  return row.type === 'task' ? Math.max(0, row.needed - row.who.length) : 0
}

export function countOpen(rows: HelperRow[]): number {
  return rows.reduce((sum, row) => sum + openPlaces(row), 0)
}

// With "only open", a section heading survives only if an open task follows it
// before the next heading; a heading over nothing would read as an open slot.
export function visibleRows(rows: HelperRow[], onlyOpen: boolean): HelperRow[] {
  if (!onlyOpen) return rows
  const out: HelperRow[] = []
  let pendingSection: HelperRow | null = null
  for (const row of rows) {
    if (row.type === 'section') {
      pendingSection = row
      continue
    }
    if (openPlaces(row) === 0) continue
    if (pendingSection) {
      out.push(pendingSection)
      pendingSection = null
    }
    out.push(row)
  }
  return out
}

// Expects pages, rows and signups already in display order (the queries sort
// them), and keeps it. Every page gets an entry, so an empty tab is an empty list.
export function assembleRows(
  pages: HelperPage[],
  rows: HelperRowRecord[],
  signups: HelperSignupRecord[],
): Record<number, HelperRow[]> {
  const namesByRow = new Map<number, string[]>()
  for (const signup of signups) {
    const names = namesByRow.get(signup.row_id)
    if (names) names.push(signup.name)
    else namesByRow.set(signup.row_id, [signup.name])
  }
  const byPage: Record<number, HelperRow[]> = {}
  for (const page of pages) byPage[page.id] = []
  for (const row of rows) {
    byPage[row.page_id]?.push({ ...row, who: namesByRow.get(row.id) ?? [] })
  }
  return byPage
}

// Clipboard text from Numbers/LibreOffice is tab-separated; a cell containing a
// line break arrives quoted, with inner quotes doubled. CSV files share the same
// quoting and differ only in the delimiter.
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch !== '"') cell += ch
      else if (text[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = false
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

export function parseTSV(text: string): string[][] {
  return parseDelimited(text, '\t')
}

const IMPORT_COLUMNS = ['task', 'when', 'where', 'who', 'comment', 'needed', 'type', 'tab'] as const
type ImportColumn = (typeof IMPORT_COLUMNS)[number]
type ColumnMap = Partial<Record<ImportColumn, number>>

const POSITIONAL_COLUMNS: ColumnMap = { task: 0, when: 1, where: 2, who: 3, comment: 4 }
const HEADER_SEARCH_ROWS = 5

function isImportColumn(name: string): name is ImportColumn {
  return (IMPORT_COLUMNS as readonly string[]).includes(name)
}

// Cells match a column name exactly, so a real task called "Task list" stays a
// task. A lone "Task" only counts in the very first cell (the pasted-header case
// this always handled); anywhere else it needs a second column name beside it,
// because the rows above a header are free text.
export function findHeader(table: string[][]): { index: number; columns: ColumnMap } | null {
  for (let index = 0; index < Math.min(HEADER_SEARCH_ROWS, table.length); index++) {
    const columns: ColumnMap = {}
    ;(table[index] ?? []).forEach((cell, position) => {
      const name = cell.trim().toLowerCase()
      if (isImportColumn(name) && columns[name] === undefined) columns[name] = position
    })
    if (columns.task === undefined) continue
    if (Object.keys(columns).length >= 2 || (index === 0 && columns.task === 0)) return { index, columns }
  }
  return null
}

// A name can hold a comma ("Smith, Anna") but never a line break, so an export
// writes such a list one name per line. Only a file carrying the export's Type
// column is read that way; anywhere else commas still separate names.
function splitNames(cell: string, exported: boolean): string[] {
  const separator = exported && cell.includes('\n') ? /\n+/ : /[,\n]+/
  const byPerson = new Map<string, string>()
  for (const part of cell.split(separator)) {
    const name = part.trim()
    const person = cleanName(name).toLowerCase()
    // The first spelling wins, as it does on the server. Counted once here, or
    // "Anna, anna" would open a place nobody is missing.
    if (person && !byPerson.has(person)) byPerson.set(person, name)
  }
  return [...byPerson.values()]
}

export function namesToCell(names: string[]): string {
  if (!names.some((name) => name.includes(','))) return names.join(', ')
  return names.length === 1 ? `${names[0]}\n` : names.join('\n')
}

interface ParsedRow extends ImportRow {
  tab: string
}

function parseTable(
  table: string[][],
  opts: { sectionsFromEmpty: boolean },
): { rows: ParsedRow[]; hasTabColumn: boolean } {
  const header = findHeader(table)
  const columns = header?.columns ?? POSITIONAL_COLUMNS
  const body = header ? table.slice(header.index + 1) : table
  const hasType = columns.type !== undefined
  const read = (cells: string[], column: ImportColumn) => {
    const position = columns[column]
    return position === undefined ? '' : (cells[position] ?? '')
  }

  const rows: ParsedRow[] = []
  for (const cells of body) {
    const task = read(cells, 'task')
    if (!task.trim()) continue
    const where = read(cells, 'where')
    const who = splitNames(read(cells, 'who'), hasType)
    const section = hasType
      ? /^\s*(section|heading)\s*$/i.test(read(cells, 'type'))
      : opts.sectionsFromEmpty && !where.trim() && who.length === 0
    const asked = Number.parseInt(read(cells, 'needed'), 10)
    rows.push({
      type: section ? 'section' : 'task',
      task,
      when: read(cells, 'when'),
      where,
      who: section ? [] : who,
      needed: Math.max(
        1,
        Math.min(HELPER_LIMITS.neededMax, Number.isNaN(asked) ? 1 : asked),
        section ? 1 : who.length,
      ),
      comment: read(cells, 'comment'),
      tab: read(cells, 'tab').trim(),
    })
  }
  return { rows, hasTabColumn: columns.tab !== undefined }
}

function withoutTab({ tab: _tab, ...row }: ParsedRow): ImportRow {
  return row
}

export function tsvToImportRows(text: string, opts: { sectionsFromEmpty: boolean }): ImportRow[] {
  return parseTable(parseTSV(text), opts).rows.map(withoutTab)
}

export function cleanTabName(name: string): string {
  return name.split(/\s+/).filter(Boolean).join(' ').slice(0, HELPER_LIMITS.page)
}

// The exact name first, so "Alpha" and "ALPHA" stay two tabs when both exist.
export function findTabPage(name: string, pages: HelperPage[]): HelperPage | null {
  const wanted = cleanTabName(name)
  return (
    pages.find((page) => cleanTabName(page.name) === wanted) ??
    pages.find((page) => cleanTabName(page.name).toLowerCase() === wanted.toLowerCase()) ??
    null
  )
}

function cleanLine(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(' ')
}

function cleanMultiline(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
}

function isOverLimit(text: string, limit: number): boolean {
  // Postgres counts characters; UTF-16 length only ever overstates that.
  return text.length > limit && Array.from(text).length > limit
}

// Measured after the same whitespace cleanup the server does before it cuts.
export function countOverLimitCells(rows: ImportRow[]): number {
  let count = 0
  for (const row of rows) {
    if (isOverLimit(cleanMultiline(row.task), HELPER_LIMITS.task)) count++
    if (isOverLimit(cleanLine(row.when), HELPER_LIMITS.when)) count++
    if (isOverLimit(cleanMultiline(row.where), HELPER_LIMITS.where)) count++
    if (isOverLimit(cleanMultiline(row.comment), HELPER_LIMITS.comment)) count++
    for (const name of row.who) if (isOverLimit(cleanLine(name), HELPER_LIMITS.name)) count++
  }
  return count
}

export interface TabImport {
  name: string
  rows: ImportRow[]
}

// One entry per distinct tab name, in file order. A Tab column wins over the
// sheet a row sits on, which is what makes a flat CSV behave like a workbook. A
// row with a blank Tab falls back to `blankTab`, or else to its sheet's name.
export function sheetsToTabImports(
  sheets: { name: string; rows: string[][] }[],
  opts: { sectionsFromEmpty: boolean; blankTab?: string },
): { tabs: TabImport[]; usedTabColumn: boolean } {
  const byName = new Map<string, TabImport>()
  let usedTabColumn = false
  for (const sheet of sheets) {
    const { rows, hasTabColumn } = parseTable(sheet.rows, opts)
    usedTabColumn ||= hasTabColumn
    for (const row of rows) {
      const name = cleanTabName(row.tab || opts.blankTab || sheet.name)
      let tab = byName.get(name)
      if (!tab) {
        tab = { name, rows: [] }
        byName.set(name, tab)
      }
      tab.rows.push(withoutTab(row))
    }
  }
  return { tabs: [...byName.values()], usedTabColumn }
}

export const EXPORT_COLUMNS = ['Task', 'When', 'Where', 'Who', 'Comment', 'Needed', 'Type'] as const

export function rowToExportCells(row: HelperRow): (string | number)[] {
  return [
    row.task,
    row.when,
    row.where,
    namesToCell(row.who),
    row.comment,
    row.type === 'task' ? row.needed : '',
    row.type,
  ]
}

// Anyone with the link can write these cells and an admin opens the export in a
// spreadsheet, so a leading = + - @ must not be evaluated as a formula. A value
// already starting with the guard gets a second one, so that stripping exactly
// one on the way back in is lossless.
const FORMULA_START = /^'*[=+\-@\t\r]/

export function stripFormulaGuard(cell: string): string {
  return cell.startsWith("'") && FORMULA_START.test(cell) ? cell.slice(1) : cell
}

function delimitedCell(value: string | number, delimiter: string): string {
  let text = String(value)
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`
  const mustQuote = text.includes('"') || text.includes(delimiter) || /[\r\n]/.test(text)
  return mustQuote ? `"${text.replace(/"/g, '""')}"` : text
}

export function plansToDelimited(
  pages: HelperPage[],
  rowsByPage: Record<number, HelperRow[]>,
  delimiter: ',' | '\t',
): string {
  const lines = [['Tab', ...EXPORT_COLUMNS].join(delimiter)]
  for (const page of pages) {
    for (const row of rowsByPage[page.id] ?? []) {
      lines.push(
        [page.name, ...rowToExportCells(row)].map((cell) => delimitedCell(cell, delimiter)).join(delimiter),
      )
    }
  }
  return lines.join('\r\n') + '\r\n'
}

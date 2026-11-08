// The helper plan's data shapes and every rule that needs no server: what counts
// as open, what "only open" keeps, and the spreadsheet formats in and out.

export type RowType = 'task' | 'section'
export type CellField = 'task' | 'when' | 'where' | 'needed' | 'comment'
export type ExtraField = `extra:${string}`
export type EditField = CellField | ExtraField
export type ToggleColumn = 'when' | 'where' | 'done' | 'comment'

export interface HelperMeta {
  title: string
  info: string
}

export interface CustomColumn {
  id: string
  name: string
}

export interface HelperPage {
  id: number
  name: string
  position: number
  show_when: boolean
  show_where: boolean
  show_done: boolean
  show_comment: boolean
  custom_columns: CustomColumn[]
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
  // Counts only while the tab shows Done; what's stored is kept for when it's shown again.
  done: boolean
  storedDone: boolean
  who: string[]
  extra: Record<string, string>
}

export interface ImportRow {
  type: RowType
  task: string
  when: string
  where: string
  who: string[]
  needed: number
  comment: string
  done: boolean
  // Values of the columns the file has beyond the built-in ones, by file heading.
  custom: Map<string, string>
}

export type ImportPayloadRow = Omit<ImportRow, 'custom'> & { extra: Record<string, string> }

export type HelperRowRecord = Omit<HelperRow, 'who' | 'storedDone'>

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
  columnName: 40,
  customColumns: 10,
  extra: 1000,
  importRowsPerTab: 500,
} as const

export function cleanName(name: string): string {
  return name.split(/\s+/).filter(Boolean).join(' ').slice(0, HELPER_LIMITS.name)
}

// The database's unique index is on lower(name), so "anna" and "Anna" are one person.
export function sameName(a: string, b: string): boolean {
  return cleanName(a).toLowerCase() === cleanName(b).toLowerCase()
}

export function extraField(columnId: string): ExtraField {
  return `extra:${columnId}`
}

export function isExtraField(field: string): field is ExtraField {
  return field.startsWith('extra:')
}

export function extraColumnId(field: ExtraField): string {
  return field.slice('extra:'.length)
}

// Task and Who are always there.
export function pageColumnCount(page: HelperPage): number {
  const toggled = [page.show_when, page.show_where, page.show_done, page.show_comment].filter(Boolean).length
  return 2 + toggled + page.custom_columns.length
}

export function openPlaces(row: HelperRow): number {
  if (row.done) return 0
  return row.type === 'task' ? Math.max(0, row.needed - row.who.length) : 0
}

export function countOpen(rows: HelperRow[]): number {
  return rows.reduce((sum, row) => sum + openPlaces(row), 0)
}

// How many places a drop moves `id` in the full order. `before` is the shown item
// it lands above, null past the last one; `shown` can be a filtered part of `all`.
export function reorderDelta(all: number[], shown: number[], id: number, before: number | null): number {
  const from = all.indexOf(id)
  const shownAt = shown.indexOf(id)
  // Landing on the next shown item is where it already appears.
  if (from === -1 || (before !== null && shownAt !== -1 && shown[shownAt + 1] === before)) return 0
  const insertAt = before === null ? all.indexOf(shown.at(-1) ?? -1) + 1 : all.indexOf(before)
  if (insertAt === -1 || (before === null && insertAt === 0)) return 0
  return (insertAt > from ? insertAt - 1 : insertAt) - from
}

// With "only open", a section heading survives only if an open task follows it
// before the next heading; a heading over nothing would read as an open slot.
export function visibleRows(rows: HelperRow[], onlyOpen: boolean): HelperRow[] {
  return onlyOpen ? keepWithHeadings(rows, (row) => openPlaces(row) > 0) : rows
}

export interface PrintSheet {
  page: HelperPage
  rows: HelperRow[]
}

// "All tabs" leaves out a tab with nothing to show rather than printing an empty
// page, so with every task covered there may be no sheets at all. A single chosen
// tab always prints, saying it is empty.
export function printSheets(
  pages: HelperPage[],
  rowsByPage: Record<number, HelperRow[]>,
  activePage: HelperPage | null,
  choice: { allTabs: boolean; onlyOpen: boolean },
): PrintSheet[] {
  const sheetFor = (page: HelperPage) => ({ page, rows: visibleRows(rowsByPage[page.id] ?? [], choice.onlyOpen) })
  if (choice.allTabs) return pages.map(sheetFor).filter((sheet) => sheet.rows.length > 0)
  return activePage ? [sheetFor(activePage)] : []
}

export function myRows(rows: HelperRow[], me: string): HelperRow[] {
  return keepWithHeadings(rows, (row) => row.who.some((name) => sameName(name, me)))
}

// Everyone on the plan, one spelling each, the first one seen.
export function knownNames(rowsByPage: Record<number, HelperRow[]>): string[] {
  const byPerson = new Map<string, string>()
  for (const rows of Object.values(rowsByPage)) {
    for (const row of rows) {
      for (const name of row.who) {
        const person = cleanName(name).toLowerCase()
        if (!byPerson.has(person)) byPerson.set(person, name)
      }
    }
  }
  return [...byPerson.values()].sort((a, b) => a.localeCompare(b))
}

// Names starting with what was typed come before names merely containing it.
export function suggestNames(names: string[], typed: string, limit = 6): string[] {
  const query = cleanName(typed).toLowerCase()
  const starts = names.filter((name) => name.toLowerCase().startsWith(query))
  const contains = names.filter((name) => !name.toLowerCase().startsWith(query) && name.toLowerCase().includes(query))
  return [...starts, ...contains].slice(0, limit)
}

function keepWithHeadings(rows: HelperRow[], keep: (row: HelperRow) => boolean): HelperRow[] {
  const out: HelperRow[] = []
  let pendingSection: HelperRow | null = null
  for (const row of rows) {
    if (row.type === 'section') {
      pendingSection = row
      continue
    }
    if (!keep(row)) continue
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
  const showsDone = new Set<number>()
  for (const page of pages) {
    byPage[page.id] = []
    if (page.show_done) showsDone.add(page.id)
  }
  for (const row of rows) {
    byPage[row.page_id]?.push({
      ...row,
      done: row.done && showsDone.has(row.page_id),
      storedDone: row.done,
      who: namesByRow.get(row.id) ?? [],
    })
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

const IMPORT_COLUMNS = ['task', 'when', 'where', 'who', 'done', 'comment', 'needed', 'type', 'tab'] as const
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
export function findHeader(
  table: string[][],
): { index: number; columns: ColumnMap; custom: { name: string; position: number }[] } | null {
  for (let index = 0; index < Math.min(HEADER_SEARCH_ROWS, table.length); index++) {
    const columns: ColumnMap = {}
    const custom: { name: string; position: number }[] = []
    ;(table[index] ?? []).forEach((cell, position) => {
      const name = cell.trim().toLowerCase()
      if (isImportColumn(name)) {
        if (columns[name] === undefined) columns[name] = position
      } else if (name) custom.push({ name: cell.trim(), position })
    })
    if (columns.task === undefined) continue
    if (Object.keys(columns).length >= 2 || (index === 0 && columns.task === 0)) return { index, columns, custom }
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

// What a ticked Done cell looks like: our own export, or a sheet's checkbox.
const DONE_CELL = /^\s*(x|✓|✔|yes|ja|true|wahr|1|done)\s*$/i

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
    const custom = new Map<string, string>()
    for (const { name, position } of header?.custom ?? []) {
      const value = cells[position] ?? ''
      if (value.trim() && !custom.has(name)) custom.set(name, value)
    }
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
      done: !section && DONE_CELL.test(read(cells, 'done')),
      custom,
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

// A write the server would cut short, measured the way countOverLimitCells does.
export function cellOverLimit(field: 'when' | 'where', text: string): boolean {
  return field === 'when'
    ? isOverLimit(cleanLine(text), HELPER_LIMITS.when)
    : isOverLimit(cleanMultiline(text), HELPER_LIMITS.where)
}

// Measured after the same whitespace cleanup the server does before it cuts.
export function countOverLimitCells(rows: ImportPayloadRow[]): number {
  let count = 0
  for (const row of rows) {
    if (isOverLimit(cleanMultiline(row.task), HELPER_LIMITS.task)) count++
    if (isOverLimit(cleanLine(row.when), HELPER_LIMITS.when)) count++
    if (isOverLimit(cleanMultiline(row.where), HELPER_LIMITS.where)) count++
    if (isOverLimit(cleanMultiline(row.comment), HELPER_LIMITS.comment)) count++
    for (const name of row.who) if (isOverLimit(cleanLine(name), HELPER_LIMITS.name)) count++
    for (const value of Object.values(row.extra)) if (isOverLimit(cleanMultiline(value), HELPER_LIMITS.extra)) count++
  }
  return count
}

function columnKey(name: string): string {
  return cleanLine(name).toLowerCase()
}

// A file's extra columns land in the tab's custom columns of the same name; the
// rest are left out, listed by unmatchedColumns.
export function withColumnIds(rows: ImportRow[], page: HelperPage | null): ImportPayloadRow[] {
  const idByName = new Map((page?.custom_columns ?? []).map((column) => [columnKey(column.name), column.id]))
  return rows.map(({ custom, ...row }) => {
    const extra: Record<string, string> = {}
    for (const [name, value] of custom) {
      const id = idByName.get(columnKey(name))
      if (id && extra[id] === undefined) extra[id] = value
    }
    return { ...row, extra }
  })
}

export function unmatchedColumns(rows: ImportRow[], page: HelperPage | null): string[] {
  const known = new Set((page?.custom_columns ?? []).map((column) => columnKey(column.name)))
  const missing = new Set<string>()
  for (const row of rows) for (const name of row.custom.keys()) if (!known.has(columnKey(name))) missing.add(name)
  return [...missing]
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

export const EXPORT_COLUMNS = ['Task', 'When', 'Where', 'Who', 'Done', 'Comment', 'Needed', 'Type'] as const
type BuiltInExportColumn = (typeof EXPORT_COLUMNS)[number]
export type ExportColumn = BuiltInExportColumn | CustomColumn

const HIDEABLE_COLUMNS: Partial<Record<BuiltInExportColumn, keyof HelperPage>> = {
  When: 'show_when',
  Where: 'show_where',
  Done: 'show_done',
  Comment: 'show_comment',
}

// A sheet per tab carries that tab's columns; the flat CSV/TSV needs them all. A
// hidden column still goes in while it holds anything, or a Replace import of the
// file would delete what hiding promised to keep.
export function pageExportColumns(page: HelperPage, rows: HelperRow[]): ExportColumn[] {
  const builtIn = EXPORT_COLUMNS.filter((column) => {
    const flag = HIDEABLE_COLUMNS[column]
    return !flag || page[flag] || rows.some((row) => String(rowToExportCells(row, [column])[0]).trim() !== '')
  })
  return [...builtIn, ...page.custom_columns]
}

export function exportHeader(column: ExportColumn): string {
  return typeof column === 'string' ? column : column.name
}

export function rowToExportCells(
  row: HelperRow,
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): (string | number)[] {
  const cells: Record<BuiltInExportColumn, string | number> = {
    Task: row.task,
    When: row.when,
    Where: row.where,
    Who: namesToCell(row.who),
    Done: row.storedDone ? 'x' : '',
    Comment: row.comment,
    Needed: row.type === 'task' ? row.needed : '',
    Type: row.type,
  }
  return columns.map((column) => (typeof column === 'string' ? cells[column] : (row.extra[column.id] ?? '')))
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
  // Tabs that share a custom column's name share its column in the flat file.
  const customHeaders = new Map<string, string>()
  for (const page of pages) {
    for (const column of page.custom_columns) {
      if (!customHeaders.has(columnKey(column.name))) customHeaders.set(columnKey(column.name), column.name)
    }
  }
  const header = ['Tab', ...EXPORT_COLUMNS, ...customHeaders.values()]
  const lines = [header.map((cell) => delimitedCell(cell, delimiter)).join(delimiter)]
  for (const page of pages) {
    const idByName = new Map(page.custom_columns.map((column) => [columnKey(column.name), column.id]))
    for (const row of rowsByPage[page.id] ?? []) {
      const custom = [...customHeaders.keys()].map((key) => row.extra[idByName.get(key) ?? ''] ?? '')
      lines.push(
        [page.name, ...rowToExportCells(row), ...custom].map((cell) => delimitedCell(cell, delimiter)).join(delimiter),
      )
    }
  }
  return lines.join('\r\n') + '\r\n'
}

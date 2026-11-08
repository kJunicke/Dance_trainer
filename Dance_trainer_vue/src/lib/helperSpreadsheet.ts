// Reading and writing the spreadsheet files the helper plan trades in, with no
// third-party parser: .xlsx and .ods are ZIP + XML, and the browser can inflate
// ZIP entries and parse XML itself. Loaded with import() so that guests who
// never touch a file don't pay for it.
//
// Files come from outside, so every size that could be inflated by a crafted
// file is capped: the upload, the inflated bytes (counted while streaming), and
// the sheets, rows and columns the parsers will materialise.

import {
  EXPORT_COLUMNS,
  exportHeader,
  findHeader,
  parseDelimited,
  plansToDelimited,
  pageExportColumns,
  rowToExportCells,
  stripFormulaGuard,
  type HelperPage,
  type HelperRow,
} from './helperPlan'

export const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_UNZIPPED_BYTES = 50 * 1024 * 1024
const MAX_ZIP_ENTRIES = 5000
const MAX_SHEETS = 50
const MAX_ROWS_PER_SHEET = 20_000
// Cells further right are ignored rather than refused: nothing the plan reads
// lives out there, only stray formatting.
const MAX_COLUMNS = 100

/** Carries a sentence meant for the person who picked the file. */
export class SpreadsheetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SpreadsheetError'
  }
}

export interface WorkbookSheet {
  name: string
  rows: string[][]
}

type WorkbookReader = (bytes: Uint8Array, fileName: string) => Promise<WorkbookSheet[]>

// The seam: a reader for another format plugs in here and nothing else changes.
const READERS: Record<string, WorkbookReader> = {
  xlsx: readXlsx,
  ods: readOds,
  csv: readDelimited,
  tsv: readDelimited,
  txt: readDelimited,
}

const NOT_READABLE: Record<string, string> = {
  xls: 'Old .xls files can’t be read here. Export it as .xlsx or .csv from Excel, then import that.',
  numbers: '.numbers files can’t be read here. Export it as .xlsx or .csv from Numbers, then import that.',
}

function extensionOf(fileName: string): string {
  return /\.([^./\\]+)$/.exec(fileName)?.[1]?.toLowerCase() ?? ''
}

export async function readWorkbook(file: File): Promise<WorkbookSheet[]> {
  const extension = extensionOf(file.name)
  const refusal = NOT_READABLE[extension]
  if (refusal) throw new SpreadsheetError(refusal)
  const reader = READERS[extension]
  if (!reader) throw new SpreadsheetError('Choose an .xlsx, .ods, .csv or .tsv file.')
  if (file.size > MAX_FILE_BYTES) {
    throw new SpreadsheetError('That file is larger than 5 MB, which is too big to import.')
  }
  if (file.size === 0) throw new SpreadsheetError('That file is empty.')
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    return await reader(bytes, file.name)
  } catch (error) {
    if (error instanceof SpreadsheetError) throw error
    throw new SpreadsheetError(damagedMessage(file.name))
  }
}

function damagedMessage(fileName: string): string {
  return `“${fileName}” couldn’t be read. The file may be damaged; try saving it again.`
}

// ---------------------------------------------------------------- ZIP reading

interface ZipEntry {
  method: number
  compressedSize: number
  localOffset: number
}

interface Zip {
  bytes: Uint8Array
  view: DataView
  entries: Map<string, ZipEntry>
  inflated: number
}

const textDecoder = new TextDecoder()

function openZip(bytes: Uint8Array, fileName: string): Zip {
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) {
    throw new SpreadsheetError(
      'That file is password-protected or in an old format. Save it as a plain .xlsx or .csv, then import that.',
    )
  }
  const damaged = new SpreadsheetError(damagedMessage(fileName))
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0) throw damaged
  const count = view.getUint16(end + 10, true)
  let position = view.getUint32(end + 16, true)
  if (count > MAX_ZIP_ENTRIES) throw damaged

  const entries = new Map<string, ZipEntry>()
  for (let i = 0; i < count; i++) {
    if (position + 46 > bytes.length || view.getUint32(position, true) !== 0x02014b50) throw damaged
    const flags = view.getUint16(position + 8, true)
    if (flags & 1) {
      throw new SpreadsheetError('That file is password-protected. Remove the password, then import it.')
    }
    const nameLength = view.getUint16(position + 28, true)
    const extraLength = view.getUint16(position + 30, true)
    const commentLength = view.getUint16(position + 32, true)
    const name = textDecoder.decode(bytes.subarray(position + 46, position + 46 + nameLength))
    entries.set(name, {
      method: view.getUint16(position + 10, true),
      compressedSize: view.getUint32(position + 20, true),
      localOffset: view.getUint32(position + 42, true),
    })
    position += 46 + nameLength + extraLength + commentLength
  }
  return { bytes, view, entries, inflated: 0 }
}

const TOO_BIG_INSIDE = 'That file unpacks to more than 50 MB, which is too big to import.'

async function readEntry(zip: Zip, name: string): Promise<Uint8Array | null> {
  const entry = zip.entries.get(name)
  if (!entry) return null
  const { localOffset, compressedSize, method } = entry
  if (localOffset + 30 > zip.bytes.length || zip.view.getUint32(localOffset, true) !== 0x04034b50) {
    throw new Error('bad local header')
  }
  const start =
    localOffset + 30 + zip.view.getUint16(localOffset + 26, true) + zip.view.getUint16(localOffset + 28, true)
  if (start + compressedSize > zip.bytes.length) throw new Error('entry past end of file')
  const stored = zip.bytes.subarray(start, start + compressedSize)

  if (method === 0) {
    zip.inflated += stored.length
    if (zip.inflated > MAX_UNZIPPED_BYTES) throw new SpreadsheetError(TOO_BIG_INSIDE)
    return stored
  }
  if (method !== 8) throw new Error('unsupported compression')

  // The sizes a ZIP declares are the attacker's to choose, so the count that
  // matters is the one taken as the bytes actually come out.
  const reader = new Blob([stored as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw') as ReadableWritablePair<Uint8Array, Uint8Array>)
    .getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    zip.inflated += value.length
    if (zip.inflated > MAX_UNZIPPED_BYTES) {
      void reader.cancel().catch(() => {})
      throw new SpreadsheetError(TOO_BIG_INSIDE)
    }
    chunks.push(value)
    length += value.length
  }
  const out = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

// ---------------------------------------------------------------- XML helpers

function parseXml(bytes: Uint8Array): Document {
  const text = decodeXmlBytes(bytes)
  // Neither format uses a DTD; refusing one rules out entity-expansion bombs.
  if (/<!DOCTYPE/i.test(text.slice(0, 4096))) throw new Error('DTD in XML')
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('malformed XML')
  return doc
}

function decodeXmlBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  // Readable as ASCII here by definition; every encoding this can name is
  // ASCII-compatible except UTF-16, which without a BOM above would be a lie.
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 256))
  const declared = /^\s*<\?xml\b[^?]*?\bencoding\s*=\s*["']([^"']+)["']/i.exec(head)?.[1]
  if (!declared) return textDecoder.decode(bytes)
  // Throws RangeError on an encoding the browser doesn't know, which surfaces
  // as "may be damaged" rather than as garbled text.
  const decoder = new TextDecoder(declared)
  if (decoder.encoding.startsWith('utf-16')) throw new Error('UTF-16 declared without a BOM')
  return decoder.decode(bytes)
}

async function readXml(zip: Zip, name: string): Promise<Document | null> {
  const bytes = await readEntry(zip, name)
  return bytes ? parseXml(bytes) : null
}

function childrenNamed(element: Element, localName: string): Element[] {
  return Array.from(element.children).filter((child) => child.localName === localName)
}

function firstChild(element: Element | null | undefined, localName: string): Element | null {
  if (!element) return null
  for (const child of Array.from(element.children)) {
    if (child.localName === localName) return child
  }
  return null
}

function byLocalName(root: Document | Element, localName: string): Element[] {
  return Array.from(root.getElementsByTagNameNS('*', localName))
}

// Attribute prefixes vary between writers (r:id, ns1:id), so match the local part.
function attribute(element: Element, localName: string): string | null {
  for (const attr of Array.from(element.attributes)) {
    if (attr.localName === localName) return attr.value
  }
  return null
}

function tooManyRows(sheet: string): SpreadsheetError {
  return new SpreadsheetError(
    `The sheet “${sheet}” has more than ${MAX_ROWS_PER_SHEET.toLocaleString('en-GB')} rows, which is too many to import.`,
  )
}

function tooManySheets(): SpreadsheetError {
  return new SpreadsheetError(`That file has more than ${MAX_SHEETS} sheets, which is too many to import.`)
}

function hasText(cells: string[]): boolean {
  return cells.some((cell) => cell.trim() !== '')
}

// ------------------------------------------------------------- merged cells

interface NumberedRow {
  number: number
  cells: string[]
}

interface MergedRange {
  column: number
  lastColumn: number
  firstRow: number
  lastRow: number
}

// Merge ranges cost nothing to declare, so the work they can cause is capped.
const MAX_MERGE_STEPS = MAX_ROWS_PER_SHEET * 20

function firstRowAtOrAfter(rows: NumberedRow[], number: number): number {
  let low = 0
  let high = rows.length
  while (low < high) {
    const middle = (low + high) >> 1
    if ((rows[middle] as NumberedRow).number < number) low = middle + 1
    else high = middle
  }
  return low
}

// Only the top-left cell of a merge holds a value. Down the anchor's own column
// the value repeats, because a merged Where means every row has that Where. It
// never spreads sideways: a heading merged across the columns has to stay a row
// with nothing in Where or Who. Text a program left under the merge isn't on
// screen, so it goes. Rows with nothing else in them stay empty, or a heading
// merged over two rows would come in twice.
function applyMerges(numbered: NumberedRow[], merges: MergedRange[]): string[][] {
  const rows = numbered.slice().sort((a, b) => a.number - b.number)
  let steps = MAX_MERGE_STEPS
  for (const { column, lastColumn, firstRow, lastRow } of merges) {
    if (column >= MAX_COLUMNS) continue
    let index = firstRowAtOrAfter(rows, firstRow)
    const anchor = rows[index]?.number === firstRow ? (rows[index]?.cells[column] ?? '') : ''
    for (; index < rows.length && (rows[index] as NumberedRow).number <= lastRow && steps > 0; index++, steps--) {
      const { number, cells } = rows[index] as NumberedRow
      const anchorRow = number === firstRow
      for (let c = column; c <= lastColumn && c < cells.length; c++) {
        if (c !== column || !anchorRow) cells[c] = ''
      }
      if (!anchorRow && anchor && hasText(cells)) {
        while (cells.length < column) cells.push('')
        cells[column] = anchor
      }
    }
  }
  return rows.filter((row) => hasText(row.cells)).map((row) => row.cells)
}

// --------------------------------------------------------------- XLSX reading

function resolvePath(baseDir: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = baseDir ? baseDir.split('/') : []
  for (const segment of target.split('/')) {
    if (segment === '..') parts.pop()
    else if (segment && segment !== '.') parts.push(segment)
  }
  return parts.join('/')
}

function splitPath(path: string): { dir: string; file: string } {
  const slash = path.lastIndexOf('/')
  return { dir: slash < 0 ? '' : path.slice(0, slash), file: path.slice(slash + 1) }
}

interface Relationship {
  type: string
  path: string
}

async function readRelationships(zip: Zip, owner: string): Promise<Map<string, Relationship>> {
  const { dir, file } = splitPath(owner)
  const relsPath = `${dir ? `${dir}/` : ''}_rels/${file}.rels`
  const doc = await readXml(zip, relsPath)
  const out = new Map<string, Relationship>()
  if (!doc) return out
  for (const rel of byLocalName(doc, 'Relationship')) {
    out.set(rel.getAttribute('Id') ?? '', {
      type: rel.getAttribute('Type') ?? '',
      path: resolvePath(dir, rel.getAttribute('Target') ?? ''),
    })
  }
  return out
}

function findRelationship(rels: Map<string, Relationship>, typeSuffix: string): string | null {
  for (const rel of rels.values()) if (rel.type.endsWith(typeSuffix)) return rel.path
  return null
}

// Excel escapes characters XML can't carry as _xHHHH_ (a real "_x000D_" in text
// is written _x005F_x000D_).
function decodeXlsxEscapes(text: string): string {
  if (!text.includes('_x')) return text
  return text.replace(/_x([0-9a-fA-F]{4})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
}

// Plain <t> or rich-text <r><t> runs. <rPh> is furigana, not part of the text.
function stringItemText(item: Element): string {
  let out = ''
  for (const child of Array.from(item.children)) {
    if (child.localName === 't') out += child.textContent ?? ''
    else if (child.localName === 'r') out += firstChild(child, 't')?.textContent ?? ''
  }
  return decodeXlsxEscapes(out)
}

type DateKind = 'date' | 'time' | 'datetime' | 'duration'

const BUILT_IN_DATE_FORMATS = new Map<number, DateKind>([
  ...[14, 15, 16, 17, 27, 28, 29, 30, 31, 36, 50, 51, 52, 53, 54, 57, 58].map((id) => [id, 'date'] as const),
  ...[18, 19, 20, 21, 32, 33, 34, 35, 45, 47, 55, 56].map((id) => [id, 'time'] as const),
  [22, 'datetime'],
  [46, 'duration'],
])

function dateKindOfFormat(code: string): DateKind | null {
  const firstSection = code.split(';')[0] ?? ''
  const plain = firstSection
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/\[(?![hms]+\])[^\]]*\]/gi, '')
    .toLowerCase()
  if (/\[[hms]+\]/.test(plain)) return 'duration'
  const hasTime = /[hs]/.test(plain)
  const hasDate = /[yd]/.test(plain) || (/m/.test(plain) && !hasTime)
  if (hasDate && hasTime) return 'datetime'
  if (hasDate) return 'date'
  return hasTime ? 'time' : null
}

function readDateStyles(doc: Document | null): (DateKind | null)[] {
  if (!doc) return []
  const custom = new Map<number, string>()
  for (const format of byLocalName(doc, 'numFmt')) {
    custom.set(Number(format.getAttribute('numFmtId')), format.getAttribute('formatCode') ?? '')
  }
  const cellXfs = byLocalName(doc, 'cellXfs')[0]
  if (!cellXfs) return []
  return childrenNamed(cellXfs, 'xf').map((xf) => {
    const id = Number(xf.getAttribute('numFmtId') ?? 0)
    const code = custom.get(id)
    return code !== undefined ? dateKindOfFormat(code) : (BUILT_IN_DATE_FORMATS.get(id) ?? null)
  })
}

const pad = (n: number) => String(n).padStart(2, '0')

function formatSerial(serial: number, kind: DateKind, date1904: boolean): string | null {
  if (!Number.isFinite(serial) || serial < 0 || serial > 2958465) return null
  const totalSeconds = Math.round(serial * 86400)
  const days = Math.floor(totalSeconds / 86400)
  const secondsOfDay = totalSeconds - days * 86400
  const clockSeconds = secondsOfDay % 60
  const suffix = clockSeconds ? `:${pad(clockSeconds)}` : ''
  const clock = `${pad(Math.floor(secondsOfDay / 3600))}:${pad(Math.floor(secondsOfDay / 60) % 60)}${suffix}`
  if (kind === 'time') return clock
  if (kind === 'duration') {
    return `${Math.floor(totalSeconds / 3600)}:${pad(Math.floor(totalSeconds / 60) % 60)}${suffix}`
  }
  // Excel's 1900 calendar counts a 29 February that never was, so serials before
  // it sit one day later than the plain offset from 1899-12-30.
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, days < 60 ? 31 : 30)
  const date = new Date(epoch + days * 86400000)
  const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
  return kind === 'date' ? day : `${day} ${clock}`
}

function formatNumber(raw: string): string {
  const value = Number(raw)
  // 15 significant digits is what a spreadsheet displays; this drops binary
  // noise such as 0.30000000000000004.
  return Number.isFinite(value) ? String(Number.parseFloat(value.toPrecision(15))) : raw
}

function columnIndex(reference: string | null): number | null {
  if (!reference) return null
  const letters = /^[A-Za-z]+/.exec(reference)?.[0]
  if (!letters) return null
  let index = 0
  for (const ch of letters.toUpperCase()) index = index * 26 + ch.charCodeAt(0) - 64
  return index - 1
}

interface XlsxContext {
  shared: string[]
  dateStyles: (DateKind | null)[]
  date1904: boolean
}

function xlsxCellText(cell: Element, context: XlsxContext): string {
  const type = cell.getAttribute('t')
  if (type === 'inlineStr') {
    const inline = firstChild(cell, 'is')
    return inline ? stringItemText(inline) : ''
  }
  const raw = firstChild(cell, 'v')?.textContent ?? ''
  if (raw === '') return ''
  switch (type) {
    case 's':
      return context.shared[Number(raw)] ?? ''
    case 'str':
      return decodeXlsxEscapes(raw)
    case 'b':
      return raw === '1' ? 'TRUE' : 'FALSE'
    case 'e':
      return ''
    case 'd':
      return raw.replace('T', ' ').replace(/(:00)?(\.\d+)?Z?$/, '')
    default: {
      const kind = context.dateStyles[Number(cell.getAttribute('s') ?? 0)]
      return (kind ? formatSerial(Number(raw), kind, context.date1904) : null) ?? formatNumber(raw)
    }
  }
}

function readXlsxMerges(doc: Document): MergedRange[] {
  const merges: MergedRange[] = []
  for (const merge of byLocalName(doc, 'mergeCell')) {
    const [start, end] = (merge.getAttribute('ref') ?? '').split(':')
    const column = columnIndex(start ?? null)
    const lastColumn = columnIndex(end ?? null)
    const firstRow = Number.parseInt(start?.replace(/^[A-Za-z]+/, '') ?? '', 10)
    const lastRow = Number.parseInt(end?.replace(/^[A-Za-z]+/, '') ?? '', 10)
    if (column === null || lastColumn === null || Number.isNaN(firstRow) || Number.isNaN(lastRow)) continue
    merges.push({ column, lastColumn, firstRow, lastRow })
  }
  return merges
}

function readXlsxSheet(doc: Document, name: string, context: XlsxContext): string[][] {
  const rows: NumberedRow[] = []
  const data = byLocalName(doc, 'sheetData')[0]
  if (!data) return []
  let previous = 0
  for (const row of childrenNamed(data, 'row')) {
    const number = Number.parseInt(row.getAttribute('r') ?? '', 10) || previous + 1
    previous = number
    const cells: string[] = []
    let next = 0
    for (const cell of childrenNamed(row, 'c')) {
      const column = columnIndex(cell.getAttribute('r')) ?? next
      next = column + 1
      if (column >= MAX_COLUMNS) continue
      const text = xlsxCellText(cell, context)
      if (text === '') continue
      while (cells.length < column) cells.push('')
      cells[column] = text
    }
    if (!hasText(cells)) continue
    if (rows.length >= MAX_ROWS_PER_SHEET) throw tooManyRows(name)
    rows.push({ number, cells })
  }
  return applyMerges(rows, readXlsxMerges(doc))
}

async function readXlsx(bytes: Uint8Array, fileName: string): Promise<WorkbookSheet[]> {
  const zip = openZip(bytes, fileName)
  const rootRels = await readRelationships(zip, '')
  const workbookPath = findRelationship(rootRels, '/officeDocument') ?? 'xl/workbook.xml'
  const workbook = await readXml(zip, workbookPath)
  if (!workbook) throw new Error('no workbook part')
  const rels = await readRelationships(zip, workbookPath)

  const properties = byLocalName(workbook, 'workbookPr')[0]
  const date1904Flag = properties?.getAttribute('date1904')
  const sharedPath = findRelationship(rels, '/sharedStrings')
  const stylesPath = findRelationship(rels, '/styles')
  const sharedDoc = sharedPath ? await readXml(zip, sharedPath) : null
  const stylesDoc = stylesPath ? await readXml(zip, stylesPath) : null
  const context: XlsxContext = {
    shared: sharedDoc?.documentElement ? childrenNamed(sharedDoc.documentElement, 'si').map(stringItemText) : [],
    dateStyles: readDateStyles(stylesDoc),
    date1904: date1904Flag === '1' || date1904Flag === 'true',
  }

  const entries = byLocalName(workbook, 'sheet').filter((sheet) => {
    const state = sheet.getAttribute('state')
    return !state || state === 'visible'
  })
  if (entries.length > MAX_SHEETS) throw tooManySheets()

  const sheets: WorkbookSheet[] = []
  for (const entry of entries) {
    const rel = rels.get(attribute(entry, 'id') ?? '')
    if (!rel || !rel.type.endsWith('/worksheet')) continue
    const doc = await readXml(zip, rel.path)
    if (!doc) continue
    const name = entry.getAttribute('name') ?? `Sheet ${sheets.length + 1}`
    sheets.push({ name, rows: readXlsxSheet(doc, name, context) })
  }
  return sheets
}

// ---------------------------------------------------------------- ODS reading

function repeatCount(element: Element, localName: string): number {
  const value = Number.parseInt(attribute(element, localName) ?? '1', 10)
  return Number.isNaN(value) || value < 1 ? 1 : value
}

const MAX_SPACE_RUN = 1000

// The text a cell displays, kept as written: the spreadsheet already formatted
// dates and numbers into it.
function odsInlineText(node: Node): string {
  let out = ''
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) out += child.nodeValue ?? ''
    else if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as Element
      switch (element.localName) {
        case 's':
          out += ' '.repeat(Math.min(MAX_SPACE_RUN, repeatCount(element, 'c')))
          break
        case 'tab':
          out += '\t'
          break
        case 'line-break':
          out += '\n'
          break
        case 'note':
        case 'annotation':
        case 'ruby-text':
          break
        default:
          out += odsInlineText(element)
      }
    }
  }
  return out
}

function odsCellText(cell: Element): string {
  return childrenNamed(cell, 'p').map(odsInlineText).join('\n')
}

interface OdsSheetState {
  name: string
  rows: NumberedRow[]
  merges: MergedRange[]
  nextRow: number
}

// Repeats are the trap: a sheet routinely ends in one empty cell repeated a
// thousand times, in a row repeated a million times. Empty repeats only move
// the position; only cells with content are ever written out.
function readOdsRow(row: Element, rowNumber: number): { cells: string[]; merges: MergedRange[] } {
  const cells: string[] = []
  const merges: MergedRange[] = []
  let column = 0
  for (const cell of Array.from(row.children)) {
    const covered = cell.localName === 'covered-table-cell'
    if (cell.localName !== 'table-cell' && !covered) continue
    const repeat = repeatCount(cell, 'number-columns-repeated')
    // A covered cell isn't on screen, even when it still holds old text.
    const text = covered ? '' : odsCellText(cell)
    if (text.trim() !== '') {
      const last = Math.min(column + repeat, MAX_COLUMNS)
      while (cells.length < column && cells.length < MAX_COLUMNS) cells.push('')
      for (let i = column; i < last; i++) cells[i] = text
      const rowsSpanned = repeatCount(cell, 'number-rows-spanned')
      if (rowsSpanned > 1) {
        merges.push({
          column,
          lastColumn: column + repeatCount(cell, 'number-columns-spanned') - 1,
          firstRow: rowNumber,
          lastRow: rowNumber + rowsSpanned - 1,
        })
      }
    }
    column += repeat
  }
  return { cells, merges }
}

function collectOdsRows(parent: Element, sheet: OdsSheetState) {
  for (const child of Array.from(parent.children)) {
    if (child.localName === 'table-row') {
      const repeat = repeatCount(child, 'number-rows-repeated')
      const number = sheet.nextRow
      sheet.nextRow += repeat
      const { cells, merges } = readOdsRow(child, number)
      if (!hasText(cells)) continue
      if (sheet.rows.length + repeat > MAX_ROWS_PER_SHEET) throw tooManyRows(sheet.name)
      sheet.merges.push(...merges)
      // Copies: filling a merge down must not write through to the other repeats.
      for (let i = 0; i < repeat; i++) sheet.rows.push({ number: number + i, cells: cells.slice() })
    } else if (['table-header-rows', 'table-rows', 'table-row-group'].includes(child.localName)) {
      collectOdsRows(child, sheet)
    }
  }
}

function hiddenOdsTableStyles(doc: Document): Set<string> {
  const hidden = new Set<string>()
  for (const style of byLocalName(doc, 'style')) {
    if (attribute(style, 'family') !== 'table') continue
    const properties = firstChild(style, 'table-properties')
    const name = attribute(style, 'name')
    if (name && properties && attribute(properties, 'display') === 'false') hidden.add(name)
  }
  return hidden
}

async function readOds(bytes: Uint8Array, fileName: string): Promise<WorkbookSheet[]> {
  const zip = openZip(bytes, fileName)
  const content = await readXml(zip, 'content.xml')
  if (!content) throw new Error('no content part')
  const spreadsheet = byLocalName(content, 'spreadsheet')[0]
  if (!spreadsheet) throw new Error('not a spreadsheet')
  const hidden = hiddenOdsTableStyles(content)
  const tables = childrenNamed(spreadsheet, 'table').filter(
    (table) => !hidden.has(attribute(table, 'style-name') ?? ''),
  )
  if (tables.length > MAX_SHEETS) throw tooManySheets()
  return tables.map((table, index) => {
    const name = attribute(table, 'name') ?? `Sheet ${index + 1}`
    const sheet: OdsSheetState = { name, rows: [], merges: [], nextRow: 1 }
    collectOdsRows(table, sheet)
    return { name, rows: applyMerges(sheet.rows, sheet.merges) }
  })
}

// ------------------------------------------------------------ CSV/TSV reading

function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

const DELIMITERS = ['\t', ',', ';']

// A file with a recognisable header settles it. Otherwise the best delimiter is
// the one that cuts the most rows into the same number of columns: a German
// semicolon file with commas in its text splits evenly only on the semicolon.
function detectDelimiter(text: string, preferred: string): string {
  const sample = text.slice(0, 65536)
  const candidates = [preferred, ...DELIMITERS.filter((d) => d !== preferred)]
  let best = preferred
  let bestScore = 0
  for (const delimiter of candidates) {
    const table = parseDelimited(sample, delimiter).slice(0, 30)
    const header = findHeader(table)
    if (header && Object.keys(header.columns).length >= 2) return delimiter
    const frequency = new Map<number, number>()
    for (const row of table) {
      if (row.length > 1) frequency.set(row.length, (frequency.get(row.length) ?? 0) + 1)
    }
    for (const [width, count] of frequency) {
      if (count * width > bestScore) {
        bestScore = count * width
        best = delimiter
      }
    }
  }
  return best
}

async function readDelimited(bytes: Uint8Array, fileName: string): Promise<WorkbookSheet[]> {
  let text = decodeText(bytes)
  if (text.includes('\0')) {
    throw new SpreadsheetError(`“${fileName}” doesn’t look like a text file. Save it as .csv or .xlsx and try again.`)
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  // Excel's own hint line, when it is there.
  const hint = /^sep=(.)\r?\n/i.exec(text)
  let delimiter = hint?.[1]
  if (hint) text = text.slice(hint[0].length)
  delimiter ??= detectDelimiter(text, extensionOf(fileName) === 'csv' ? ',' : '\t')

  const table = parseDelimited(text, delimiter)
  const stem = fileName.replace(/\.[^.]*$/, '')
  if (table.length > MAX_ROWS_PER_SHEET) throw tooManyRows(stem)
  return [{ name: stem, rows: table.map((row) => row.slice(0, MAX_COLUMNS).map(stripFormulaGuard)) }]
}

// ---------------------------------------------------------------- ZIP writing

let crcTable: Uint32Array | null = null

function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (const byte of bytes) crc = (crcTable[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

// Stored, not deflated: these files are small, and it spares a compressor.
function zipStored(files: { name: string; content: string }[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const now = new Date()
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  const parts = files.map((file) => {
    const name = encoder.encode(file.name)
    const data = encoder.encode(file.content)
    return { name, data, crc: crc32(data), offset: 0 }
  })

  const size =
    parts.reduce((sum, p) => sum + 30 + p.name.length + p.data.length + 46 + p.name.length, 0) + 22
  const out = new Uint8Array(size)
  const view = new DataView(out.buffer)
  const FLAG_UTF8 = 0x0800

  const writeCommon = (at: number, part: (typeof parts)[number]) => {
    view.setUint16(at, FLAG_UTF8, true)
    view.setUint16(at + 2, 0, true) // method: stored
    view.setUint16(at + 4, dosTime, true)
    view.setUint16(at + 6, dosDate, true)
    view.setUint32(at + 8, part.crc, true)
    view.setUint32(at + 12, part.data.length, true)
    view.setUint32(at + 16, part.data.length, true)
    view.setUint16(at + 20, part.name.length, true)
  }

  let position = 0
  for (const part of parts) {
    part.offset = position
    view.setUint32(position, 0x04034b50, true)
    view.setUint16(position + 4, 20, true)
    writeCommon(position + 6, part)
    out.set(part.name, position + 30)
    out.set(part.data, position + 30 + part.name.length)
    position += 30 + part.name.length + part.data.length
  }

  const directory = position
  for (const part of parts) {
    view.setUint32(position, 0x02014b50, true)
    view.setUint16(position + 4, 20, true)
    view.setUint16(position + 6, 20, true)
    writeCommon(position + 8, part)
    view.setUint32(position + 42, part.offset, true)
    out.set(part.name, position + 46)
    position += 46 + part.name.length
  }

  view.setUint32(position, 0x06054b50, true)
  view.setUint16(position + 8, parts.length, true)
  view.setUint16(position + 10, parts.length, true)
  view.setUint32(position + 12, position - directory, true)
  view.setUint32(position + 16, directory, true)
  return out
}

// ---------------------------------------------------------- spreadsheet model

interface ExportSheet {
  name: string
  header: string[]
  rows: (string | number)[][]
}

const EXCEL_SHEET_NAME_LIMIT = 31
const COLUMN_WIDTHS = new Map([
  ['Task', 48],
  ['When', 14],
  ['Where', 20],
  ['Who', 26],
  ['Done', 8],
  ['Comment', 32],
  ['Needed', 9],
  ['Type', 9],
  ['Tab', 20],
])
const CUSTOM_COLUMN_WIDTH = 24

function columnWidth(header: string): number {
  return COLUMN_WIDTHS.get(header) ?? CUSTOM_COLUMN_WIDTH
}

// Sheet names can't carry every tab name (31 characters, no []:*?/\). When one
// had to change, the real name travels in a Tab column, which import prefers.
function safeSheetName(tab: string, used: Set<string>): string {
  const base =
    tab
      .replace(/[[\]:*?/\\]/g, ' ')
      .replace(/^'+|'+$/g, '')
      .trim() || 'Sheet'
  // Excel's limit counts UTF-16 units, and it refuses a name ending in an
  // apostrophe, which a cut can expose.
  const fit = (text: string, room: number) => {
    let cut = text.slice(0, room)
    if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1)
    return cut.replace(/[\s']+$/, '')
  }
  let name = fit(base, EXCEL_SHEET_NAME_LIMIT)
  if (name.toLowerCase() === 'history') name = 'History tab'
  for (let n = 2; used.has(name.toLowerCase()); n++) {
    const suffix = ` (${n})`
    name = fit(base, EXCEL_SHEET_NAME_LIMIT - suffix.length) + suffix
  }
  used.add(name.toLowerCase())
  return name
}

function exportSheets(pages: HelperPage[], rowsByPage: Record<number, HelperRow[]>): ExportSheet[] {
  const used = new Set<string>()
  const sheets = pages.map((page): ExportSheet => {
    const name = safeSheetName(page.name, used)
    const withTab = name !== page.name
    const rows = rowsByPage[page.id] ?? []
    const columns = pageExportColumns(page, rows)
    return {
      name,
      header: withTab ? [...columns.map(exportHeader), 'Tab'] : columns.map(exportHeader),
      rows: rows.map((row) => {
        const cells = rowToExportCells(row, columns)
        return withTab ? [...cells, page.name] : cells
      }),
    }
  })
  return sheets.length ? sheets : [{ name: 'Plan', header: [...EXPORT_COLUMNS], rows: [] }]
}

// Everything XML 1.0 can't carry goes, unpaired surrogates included.
const XML_ILLEGAL = /[^\t\n\r\x20-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu

function xml(text: string): string {
  return text
    .replace(XML_ILLEGAL, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

// --------------------------------------------------------------- XLSX writing

function columnLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

// A literal "_x000D_" in a cell must not come back as a carriage return.
function escapeXlsxText(text: string): string {
  return text.replace(/_x(?=[0-9a-fA-F]{4}_)/g, '_x005F_x')
}

const XLSX_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const XLSX_DOC_RELS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const STYLE_HEADER = 1
const STYLE_BODY = 2

const XLSX_STYLES =
  `${XML_DECLARATION}<styleSheet xmlns="${XLSX_MAIN}">` +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>'

function buildXlsx(sheets: ExportSheet[]): Uint8Array<ArrayBuffer> {
  const strings = new Map<string, number>()
  let stringCount = 0
  const stringIndex = (text: string) => {
    stringCount++
    let index = strings.get(text)
    if (index === undefined) {
      index = strings.size
      strings.set(text, index)
    }
    return index
  }

  const cellXml = (value: string | number, column: number, row: number, style: number) => {
    const ref = `${columnLetter(column)}${row}`
    if (typeof value === 'number') return `<c r="${ref}" s="${style}"><v>${value}</v></c>`
    return value === '' ? '' : `<c r="${ref}" s="${style}" t="s"><v>${stringIndex(value)}</v></c>`
  }

  const worksheets = sheets.map((sheet) => {
    const cols = sheet.header
      .map((h, i) => `<col min="${i + 1}" max="${i + 1}" width="${columnWidth(h)}" customWidth="1"/>`)
      .join('')
    const headerRow = `<row r="1">${sheet.header.map((h, i) => cellXml(h, i, 1, STYLE_HEADER)).join('')}</row>`
    const bodyRows = sheet.rows
      .map((cells, r) => `<row r="${r + 2}">${cells.map((c, i) => cellXml(c, i, r + 2, STYLE_BODY)).join('')}</row>`)
      .join('')
    return (
      `${XML_DECLARATION}<worksheet xmlns="${XLSX_MAIN}">` +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${headerRow}${bodyRows}</sheetData></worksheet>`
    )
  })

  const sharedItems = [...strings.keys()]
    .map((text) => `<si><t xml:space="preserve">${xml(escapeXlsxText(text))}</t></si>`)
    .join('')
  const worksheetRel = (i: number) =>
    `<Relationship Id="rId${i + 1}" Type="${XLSX_DOC_RELS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  const n = sheets.length

  return zipStored([
    {
      name: '[Content_Types].xml',
      content:
        `${XML_DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      content:
        `${XML_DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${XLSX_DOC_RELS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      content:
        `${XML_DECLARATION}<workbook xmlns="${XLSX_MAIN}" xmlns:r="${XLSX_DOC_RELS}"><sheets>` +
        sheets.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content:
        `${XML_DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheets.map((_, i) => worksheetRel(i)).join('') +
        `<Relationship Id="rId${n + 1}" Type="${XLSX_DOC_RELS}/styles" Target="styles.xml"/>` +
        `<Relationship Id="rId${n + 2}" Type="${XLSX_DOC_RELS}/sharedStrings" Target="sharedStrings.xml"/>` +
        '</Relationships>',
    },
    { name: 'xl/styles.xml', content: XLSX_STYLES },
    {
      name: 'xl/sharedStrings.xml',
      content: `${XML_DECLARATION}<sst xmlns="${XLSX_MAIN}" count="${stringCount}" uniqueCount="${strings.size}">${sharedItems}</sst>`,
    },
    ...worksheets.map((content, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, content })),
  ])
}

// ---------------------------------------------------------------- ODS writing

const ODS_MIME = 'application/vnd.oasis.opendocument.spreadsheet'
const ODS_NAMESPACES =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" ' +
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" ' +
  'office:version="1.2"'

// ODF collapses runs of spaces unless they're written as <text:s/>.
function odsParagraphs(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const body = xml(line).replace(/ {2,}/g, (run) => ` <text:s text:c="${run.length - 1}"/>`)
      return body ? `<text:p>${body}</text:p>` : '<text:p/>'
    })
    .join('')
}

function buildOds(sheets: ExportSheet[]): Uint8Array<ArrayBuffer> {
  const widths = new Set(sheets.flatMap((sheet) => sheet.header.map(columnWidth)))
  const columnStyles = [...widths]
    .map(
      (width) =>
        `<style:style style:name="co${width}" style:family="table-column"><style:table-column-properties style:column-width="${(width * 0.19).toFixed(2)}cm"/></style:style>`,
    )
    .join('')
  const cellStyles =
    '<style:style style:name="ceh" style:family="table-cell"><style:text-properties fo:font-weight="bold"/></style:style>' +
    '<style:style style:name="ceb" style:family="table-cell"><style:table-cell-properties fo:wrap-option="wrap" style:vertical-align="top"/></style:style>'

  const cellXml = (value: string | number, style: string) => {
    if (typeof value === 'number') {
      return `<table:table-cell table:style-name="${style}" office:value-type="float" office:value="${value}"><text:p>${value}</text:p></table:table-cell>`
    }
    if (value === '') return `<table:table-cell table:style-name="${style}"/>`
    return `<table:table-cell table:style-name="${style}" office:value-type="string">${odsParagraphs(value)}</table:table-cell>`
  }

  const tables = sheets
    .map((sheet) => {
      const columns = sheet.header.map((h) => `<table:table-column table:style-name="co${columnWidth(h)}"/>`).join('')
      const headerRow = `<table:table-row>${sheet.header.map((h) => cellXml(h, 'ceh')).join('')}</table:table-row>`
      const bodyRows = sheet.rows
        .map((cells) => `<table:table-row>${cells.map((c) => cellXml(c, 'ceb')).join('')}</table:table-row>`)
        .join('')
      return `<table:table table:name="${xml(sheet.name)}">${columns}${headerRow}${bodyRows}</table:table>`
    })
    .join('')

  return zipStored([
    // Must be the first entry and stored: it is how the format identifies itself.
    { name: 'mimetype', content: ODS_MIME },
    {
      name: 'META-INF/manifest.xml',
      content:
        `${XML_DECLARATION}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">` +
        `<manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="${ODS_MIME}"/>` +
        '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
        '</manifest:manifest>',
    },
    {
      name: 'content.xml',
      content:
        `${XML_DECLARATION}<office:document-content ${ODS_NAMESPACES}>` +
        `<office:automatic-styles>${columnStyles}${cellStyles}</office:automatic-styles>` +
        `<office:body><office:spreadsheet>${tables}</office:spreadsheet></office:body></office:document-content>`,
    },
  ])
}

// ------------------------------------------------------------------ the export

export type ExportFormat = 'xlsx' | 'ods' | 'csv' | 'tsv'

export function buildExport(
  format: ExportFormat,
  pages: HelperPage[],
  rowsByPage: Record<number, HelperRow[]>,
): Blob {
  switch (format) {
    case 'xlsx':
      return new Blob([buildXlsx(exportSheets(pages, rowsByPage))], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    case 'ods':
      return new Blob([buildOds(exportSheets(pages, rowsByPage))], { type: ODS_MIME })
    case 'csv':
      // Excel reads a CSV as UTF-8 only when it starts with a BOM.
      return new Blob([`\uFEFF${plansToDelimited(pages, rowsByPage, ',')}`], { type: 'text/csv;charset=utf-8' })
    case 'tsv':
      return new Blob([plansToDelimited(pages, rowsByPage, '\t')], {
        type: 'text/tab-separated-values;charset=utf-8',
      })
  }
}

// Reads the free-text When and Where cells as times and rooms, for the timeline
// and room views. Moving a task only ever rewrites those two cells.
import type { HelperRow } from './helperPlan'

const DAY = 1440
const STEP = 30
// A night's events run past midnight: 00:30 belongs after 23:30, not before 8:00.
const NEXT_DAY_BEFORE = 5 * 60
// Past this, a span built from bare numbers is more likely not a span at all.
const LONGEST_GUESSED_SPAN = 12 * 60
const LONGEST_SHIFT = 16 * 60

export interface WhenSlot {
  start: number
  end: number | null
  index: number
  length: number
}

function onDay(hour: number, minute: number): number {
  const time = hour * 60 + minute
  return time < NEXT_DAY_BEFORE ? time + DAY : time
}

interface Clock {
  hour: number
  minute: number
  marker: 'am' | 'pm' | 'uhr' | 'h' | null
  hasMinutes: boolean
  stop: number
}

const DIGITS = /(\d{1,2})(?:([:.])(\d{2}))?(?!\d)/y
const MARKER = /\s*(uhr|h|a\.?m\.?|p\.?m\.?)(?![\p{L}\d])/iuy
const RANGE_JOIN = /\s*(?:-|–|—|to|bis)\s*/iy
const FOLLOWED_BY_NUMBER = /[.\-–—:/]?\d/y

// One clock time starting exactly at `at`. A bare number comes back too, because
// only its neighbours can say whether it is a time.
function readClock(text: string, at: number): Clock | null {
  if (/\d/.test(text[at - 1] ?? '')) return null
  DIGITS.lastIndex = at
  const digits = DIGITS.exec(text)
  if (!digits) return null
  const hour = Number(digits[1])
  const minute = Number(digits[3] ?? 0)
  const separator = digits[2]
  let stop = DIGITS.lastIndex
  if (hour > 24 || minute > 59) return null
  // 12.11. and 12.10.2026 are dates; so is the tail of 1.12.10.
  if (separator !== ':' && /\d\.$/.test(text.slice(Math.max(0, at - 2), at))) return null
  if (separator === '.' && (minute % 5 !== 0 || text[stop] === '.')) return null

  let marker: Clock['marker'] = null
  MARKER.lastIndex = stop
  const found = MARKER.exec(text)
  if (found) {
    const word = found[1]!.toLowerCase()
    const named = word === 'uhr' ? 'uhr' : word === 'h' ? 'h' : word.startsWith('a') ? 'am' : 'pm'
    const twelveHour = named === 'am' || named === 'pm'
    // "2h" and "1,5h" are how long something takes, not when.
    const duration = named === 'h' && !separator && (hour < NEXT_DAY_BEFORE / 60 || /\d[.,]$/.test(text.slice(Math.max(0, at - 2), at)))
    if (!duration && (!twelveHour || (hour >= 1 && hour <= 12))) {
      marker = named
      stop = MARKER.lastIndex
    }
  }
  const hour24 = marker === 'am' ? hour % 12 : marker === 'pm' ? (hour % 12) + 12 : hour
  return { hour: hour24, minute, marker, hasMinutes: separator !== undefined, stop }
}

function isBare(clock: Clock): boolean {
  return !clock.hasMinutes && !clock.marker
}

function isTwelveHour(clock: Clock): boolean {
  return clock.marker === 'am' || clock.marker === 'pm'
}

function clockMinutes(clock: Clock): number {
  return clock.hour * 60 + clock.minute
}

function forwardSpan(from: number, to: number): number {
  return (to - from + DAY) % DAY || DAY
}

// "11-1 pm" is 11:00 to 13:00, "3pm-5" is 15:00 to 17:00: of the two readings of
// the side without am/pm, the one giving the shorter span is the meant one.
function shareTwelveHour(first: Clock, second: Clock) {
  const firstOpen = isTwelveHour(second) && !first.marker && first.hour <= 12
  const secondOpen = isTwelveHour(first) && !second.marker && second.hour <= 12
  if (!firstOpen && !secondOpen) return
  const open = firstOpen ? first : second
  const span = (hour: number) => {
    const minutes = hour * 60 + open.minute
    return firstOpen ? forwardSpan(minutes, clockMinutes(second)) : forwardSpan(clockMinutes(first), minutes)
  }
  const morning = open.hour % 12
  open.hour = span(morning) <= span(morning + 12) ? morning : morning + 12
}

function readRangeEnd(text: string, first: Clock, at: number): Clock | null {
  RANGE_JOIN.lastIndex = first.stop
  const join = RANGE_JOIN.exec(text)
  if (!join) return null
  const second = readClock(text, RANGE_JOIN.lastIndex)
  if (!second) return null

  if (isBare(first)) {
    // Part of a date or list such as 2026-11-08.
    if (/[-–—:]/.test(text[at - 1] ?? '')) return null
    // "Room 3 - 14:00" names a room before a time; "9-12:30" is a range.
    if (second.hasMinutes && !second.marker && /\s/.test(join[0])) return null
  }
  if (isBare(second)) {
    FOLLOWED_BY_NUMBER.lastIndex = second.stop
    if (FOLLOWED_BY_NUMBER.test(text)) return null
  }
  return second
}

function readSlot(text: string, at: number): WhenSlot | null {
  const first = readClock(text, at)
  if (!first) return null

  const second = readRangeEnd(text, first, at)
  if (second) {
    shareTwelveHour(first, second)
    const start = onDay(first.hour, first.minute)
    let end = onDay(second.hour, second.minute)
    if (end <= start) end += DAY
    const unmarked = !first.marker && !second.marker
    const plausible = !unmarked || (!isBare(first) && !isBare(second)) || end - start <= LONGEST_GUESSED_SPAN
    if (plausible) return { start, end, index: at, length: second.stop - at }
  }

  if (isBare(first)) return null
  return { start: onDay(first.hour, first.minute), end: null, index: at, length: first.stop - at }
}

export function parseWhen(text: string): WhenSlot[] {
  const slots: WhenSlot[] = []
  for (let at = 0; at < text.length; at++) {
    if (!/\d/.test(text[at]!)) continue
    const slot = readSlot(text, at)
    if (!slot) continue
    slots.push(slot)
    at = slot.index + slot.length - 1
  }
  return slots
}

export function formatClock(time: number): string {
  const wrapped = ((time % DAY) + DAY) % DAY
  return `${Math.floor(wrapped / 60)}:${String(wrapped % 60).padStart(2, '0')}`
}

export function formatRange(start: number, end: number | null): string {
  return end === null ? formatClock(start) : `${formatClock(start)}–${formatClock(end)}`
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return [hours ? `${hours}h` : '', rest ? `${rest}m` : ''].filter(Boolean).join(' ')
}

export function bucketOf(time: number): number {
  return Math.floor(time / STEP) * STEP
}

// Puts a time into the cell; whatever else is written there stays.
export function writeWhen(text: string, slot: WhenSlot | null, value: string): string {
  if (slot) return text.slice(0, slot.index) + value + text.slice(slot.index + slot.length)
  const words = text.trim()
  if (!words) return value
  return `${value} ${/^\(.*\)$/s.test(words) ? words : `(${words})`}`
}

// Keeps the task's length, and any other time in the same cell.
export function moveWhen(text: string, slot: WhenSlot | null, to: number): string {
  return writeWhen(text, slot, slot ? formatRange(to, slot.end === null ? null : to + slot.end - slot.start) : formatClock(to))
}

const SEPARATORS = String.raw`(?:[\s,;&/+]|\b(?:und|and)\b)`
const ONLY_SEPARATORS = new RegExp(`^${SEPARATORS}+$`, 'i')
const LEADING_SEPARATORS = new RegExp(`^${SEPARATORS}*`, 'i')
const TRAILING_SEPARATORS = new RegExp(`${SEPARATORS}*$`, 'i')

// Goes right after the cell's last time, joined the way its other times are.
export function addWhen(text: string, value: string): string {
  const slots = parseWhen(text)
  const last = slots[slots.length - 1]
  if (!last) return writeWhen(text, null, value)
  const previous = slots[slots.length - 2]
  const between = previous ? text.slice(previous.index + previous.length, last.index) : ''
  const join = ONLY_SEPARATORS.test(between) ? between : ' & '
  const after = last.index + last.length
  return text.slice(0, after) + join + value + text.slice(after)
}

// The time a card was drawn for, found again in the cell as it stands now. Null: a
// card without a time whose cell still has none. Undefined: it is no longer there.
export function relocateSlot(slot: WhenSlot | null, now: string): WhenSlot | null | undefined {
  const slots = parseWhen(now)
  if (!slot) return slots.length ? undefined : null
  const same = (other: WhenSlot) => other.start === slot.start && other.end === slot.end
  return slots.find((other) => same(other) && other.index === slot.index) ?? slots.find(same)
}

export function clearWhen(text: string, slot: WhenSlot): string {
  const before = text.slice(0, slot.index).replace(TRAILING_SEPARATORS, '')
  const rest = text.slice(slot.index + slot.length)
  const separator = LEADING_SEPARATORS.exec(rest)?.[0] ?? ''
  const after = rest.slice(separator.length)
  if (!before || !after) return (before + after).trim()
  // Only a time on both sides still needs its "&"; "by 14:30 & 16:00" becomes "by 16:00".
  const joinsTimes = separator.trim() !== '' && parseWhen(before).some((s) => s.index + s.length === before.length)
  return `${before}${joinsTimes ? separator : separator.includes('\n') ? '\n' : ' '}${after}`.trim()
}

interface Section {
  heading: HelperRow | null
  tasks: HelperRow[]
}

function sectionsOf(rows: HelperRow[]): Section[] {
  const sections: Section[] = [{ heading: null, tasks: [] }]
  for (const row of rows) {
    if (row.type === 'section') sections.push({ heading: row, tasks: [] })
    else sections[sections.length - 1]!.tasks.push(row)
  }
  return sections
}

// The heading a row sits under; null for a heading itself or a row above the first.
export function headingOf(rows: HelperRow[], id: number): HelperRow | null {
  return sectionsOf(rows).find(({ tasks }) => tasks.some((task) => task.id === id))?.heading ?? null
}

export type TimelineItem =
  | { kind: 'task'; row: HelperRow; slot: WhenSlot | null; heading: string }
  | { kind: 'group'; row: HelperRow; slot: WhenSlot; tasks: HelperRow[] }

export interface TimelineBucket {
  minute: number
  items: TimelineItem[]
  // What started earlier and hasn't ended yet. Only filled on the hour.
  running: string[]
}

export function buildTimeline(rows: HelperRow[]): { buckets: TimelineBucket[]; untimed: TimelineItem[] } {
  const timed: (TimelineItem & { slot: WhenSlot })[] = []
  const untimed: TimelineItem[] = []

  for (const { heading, tasks } of sectionsOf(rows)) {
    const headingSlots = heading ? parseWhen(heading.when) : []
    const inherits = tasks.filter((task) => !task.when.trim())
    if (heading && headingSlots.length && inherits.length) {
      for (const slot of headingSlots) timed.push({ kind: 'group', row: heading, slot, tasks: inherits })
    }
    for (const task of tasks) {
      const slots = parseWhen(task.when)
      for (const slot of slots) timed.push({ kind: 'task', row: task, slot, heading: heading?.task ?? '' })
      if (!slots.length && !(task.when.trim() === '' && headingSlots.length)) {
        untimed.push({ kind: 'task', row: task, slot: null, heading: heading?.task ?? '' })
      }
    }
  }

  timed.sort((a, b) => a.slot.start - b.slot.start)
  const first = timed.length ? bucketOf(timed[0]!.slot.start) : 9 * 60
  let last = timed.length ? bucketOf(timed[timed.length - 1]!.slot.start) + STEP : 22 * 60
  // The rail reaches the end of the longest span, or the night's last hours would
  // have no row to say what is still on. A 23-hour "span" is a typo, not a shift.
  for (const { slot } of timed) {
    if (slot.end !== null && slot.end - slot.start <= LONGEST_SHIFT) last = Math.max(last, bucketOf(slot.end - 1))
  }
  const buckets: TimelineBucket[] = []
  for (let minute = first; minute <= last; minute += STEP) {
    const running = minute % 60 === 0
      ? timed.filter(({ slot }) => slot.end !== null && slot.start < minute && minute < slot.end).map((item) => item.row.task)
      : []
    buckets.push({ minute, items: timed.filter((item) => bucketOf(item.slot.start) === minute), running })
  }
  return { buckets, untimed }
}

export interface RoomRef {
  raw: string
  name: string
}

function closingBracket(text: string, open: number): number {
  let depth = 0
  for (let at = open; at < text.length; at++) {
    if (text[at] === '(') depth++
    else if (text[at] === ')' && --depth === 0) return at
  }
  return -1
}

// An unclosed bracket is a typo, not a note: it must not swallow the rooms after it.
function roomSeparators(where: string): number[] {
  const found: number[] = []
  for (let at = 0; at < where.length; at++) {
    const char = where[at]
    if (char === '(') {
      const close = closingBracket(where, at)
      if (close !== -1) at = close
    } else if (char === ',' || char === '\n') found.push(at)
  }
  return found
}

function roomParts(where: string): string[] {
  const cuts = [-1, ...roomSeparators(where), where.length]
  return cuts.slice(1).map((cut, i) => where.slice(cuts[i]! + 1, cut).trim())
}

function roomName(part: string): string {
  return part.replace(/\s*\(.*$/s, '').trim() || part
}

function sameRoom(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

// "church-PM,\nkitchen (freezer)" is two rooms; a bracket on the next line is a
// note about the room before it, and isn't part of the room's name.
export function splitRooms(where: string): RoomRef[] {
  const refs: RoomRef[] = []
  for (const part of roomParts(where).filter(Boolean)) {
    const last = refs[refs.length - 1]
    if (part.startsWith('(') && last) last.raw += ` ${part}`
    else refs.push({ raw: part, name: roomName(part) })
  }
  return refs
}

// Whether a typed name would come back from a cell as exactly this one room. A
// lone bracket would read as a note on the room before it.
export function isRoomName(name: string): boolean {
  const refs = splitRooms(name)
  return refs.length === 1 && refs[0]!.name === name && !name.startsWith('(')
}

// The other rooms in the cell stay; `to` null takes the task out of this one. A
// note said where in the old room, so it stays behind; one already on `to` is kept.
export function moveRoom(where: string, from: number | null, to: string | null): string {
  if (from === null) return to ?? ''
  const refs = splitRooms(where)
  const moving = refs[from]
  if (!moving || (to !== null && sameRoom(moving.name, to))) return where
  const landsOnOther = to !== null && refs.some((ref) => ref !== moving && sameRoom(ref.name, to))
  const seen = new Set<string>()
  return refs
    .flatMap((ref) => (ref !== moving ? [ref.raw] : to === null || landsOnOther ? [] : [to]))
    .filter((raw) => {
      const key = raw.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .join(', ')
}

// The room a card was drawn for, found again in the cell as it stands now. Null: a
// card without a room whose cell is still empty. Undefined: it is no longer there.
export function relocateRef(before: string, refIndex: number | null, now: string): number | null | undefined {
  const refs = splitRooms(now)
  if (refIndex === null) return refs.length ? undefined : null
  const wanted = splitRooms(before)[refIndex]
  if (!wanted) return undefined
  if (refs[refIndex] && sameRoom(refs[refIndex].name, wanted.name)) return refIndex
  const at = refs.findIndex((ref) => sameRoom(ref.name, wanted.name))
  return at === -1 ? undefined : at
}

function withoutRoom(refs: RoomRef[], room: string): RoomRef[] {
  return refs.filter((ref) => !sameRoom(ref.name, room))
}

export function toggleRoom(where: string, room: string): string {
  const refs = splitRooms(where)
  const rest = withoutRoom(refs, room)
  return (rest.length < refs.length ? rest.map((ref) => ref.raw) : [...refs.map((ref) => ref.raw), room]).join(', ')
}

// The unfinished name after the last comma or line break, or '' when the cell's
// last room is already a known one or a note about it.
export function typedRoom(where: string, rooms: string[]): string {
  const part = roomParts(where).at(-1) ?? ''
  if (!part || part.startsWith('(')) return ''
  return rooms.some((room) => sameRoom(room, roomName(part))) ? '' : part
}

export function completeRoom(where: string, room: string): string {
  const cut = roomSeparators(where).at(-1) ?? -1
  return [...withoutRoom(splitRooms(where.slice(0, cut + 1)), room).map((ref) => ref.raw), room].join(', ')
}

export function knownRooms(rowsByPage: Record<number, HelperRow[]>): string[] {
  const byRoom = new Map<string, string>()
  for (const rows of Object.values(rowsByPage)) {
    for (const row of rows) {
      for (const { name } of splitRooms(row.where)) {
        if (!byRoom.has(name.toLowerCase())) byRoom.set(name.toLowerCase(), name)
      }
    }
  }
  return [...byRoom.values()].sort((a, b) => a.localeCompare(b))
}

// The times this plan uses most, offered as one-tap choices.
export function commonTimes(rowsByPage: Record<number, HelperRow[]>, limit = 4): string[] {
  const uses = new Map<string, number>()
  for (const rows of Object.values(rowsByPage)) {
    for (const row of rows) {
      for (const slot of parseWhen(row.when)) {
        const label = formatRange(slot.start, slot.end)
        uses.set(label, (uses.get(label) ?? 0) + 1)
      }
    }
  }
  return [...uses.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label]) => label)
}

export interface RoomItem {
  row: HelperRow
  refIndex: number | null
  time: string
  sort: number
}

export interface Room {
  name: string
  items: RoomItem[]
}

// Every known room is listed even when empty, so it can be dropped on.
export function buildRooms(rows: HelperRow[], rooms: string[]): { rooms: Room[]; unplaced: RoomItem[] } {
  const byRoom = new Map<string, Room>()
  for (const name of rooms) byRoom.set(name.toLowerCase(), { name, items: [] })
  const unplaced: RoomItem[] = []

  for (const { heading, tasks } of sectionsOf(rows)) {
    for (const row of tasks) {
      const timeText = row.when.trim() ? row.when : (heading?.when ?? '')
      const sort = parseWhen(timeText)[0]?.start ?? Number.MAX_SAFE_INTEGER
      const refs = splitRooms(row.where)
      refs.forEach((ref, refIndex) => {
        const key = ref.name.toLowerCase()
        let room = byRoom.get(key)
        if (!room) {
          room = { name: ref.name, items: [] }
          byRoom.set(key, room)
        }
        room.items.push({ row, refIndex, time: timeText, sort })
      })
      if (!refs.length) unplaced.push({ row, refIndex: null, time: timeText, sort })
    }
  }

  const list = [...byRoom.values()].sort((a, b) => a.name.localeCompare(b.name))
  for (const room of list) room.items.sort((a, b) => a.sort - b.sort)
  unplaced.sort((a, b) => a.sort - b.sort)
  return { rooms: list, unplaced }
}

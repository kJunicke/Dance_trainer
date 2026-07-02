// Due dates are plain YYYY-MM-DD strings end to end (Postgres `date`,
// <input type="date">). Never use toISOString() here — it yields the UTC
// date, which is off by one around local midnight.

function toIsoDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** Today's date in the user's local timezone, as YYYY-MM-DD. */
export function localToday(): string {
  return toIsoDate(new Date())
}

/** isoDate + n calendar days (local). Noon anchor avoids DST-midnight edge cases. */
export function addDays(isoDate: string, days: number): string {
  const [y = 0, m = 1, d = 1] = isoDate.split('-').map(Number)
  return toIsoDate(new Date(y, m - 1, d + days, 12))
}

/** True when the date has arrived: isoDate <= local today. */
export function isDue(isoDate: string | null | undefined, today = localToday()): boolean {
  return !!isoDate && isoDate <= today
}

/** Signed calendar-day gap from -> to (negative = `to` is in the past). Noon anchor dodges DST. */
export function daysBetween(fromIso: string, toIso: string): number {
  const [fy = 0, fm = 1, fd = 1] = fromIso.split('-').map(Number)
  const [ty = 0, tm = 1, td = 1] = toIso.split('-').map(Number)
  const from = new Date(fy, fm - 1, fd, 12).getTime()
  const to = new Date(ty, tm - 1, td, 12).getTime()
  return Math.round((to - from) / 86400000)
}

/**
 * Traffic-light status for a due date, driving the card's left-edge color.
 * `overdue` past, `due` today, `scheduled` future, null when there's no date.
 */
export type DueStatus = 'overdue' | 'due' | 'scheduled'
export function dueStatus(
  isoDate: string | null | undefined,
  today = localToday(),
): DueStatus | null {
  if (!isoDate) return null
  if (isoDate < today) return 'overdue'
  if (isoDate === today) return 'due'
  return 'scheduled'
}

/**
 * Compact, scannable due label for a card: "today", "3d late", "in 4d", and a
 * short "Jul 5" once a scheduled date is more than a week out.
 */
export function dueLabel(
  isoDate: string | null | undefined,
  today = localToday(),
): string | null {
  if (!isoDate) return null
  const delta = daysBetween(today, isoDate)
  if (delta < 0) return `${-delta}d late`
  if (delta === 0) return 'today'
  if (delta <= 7) return `in ${delta}d`
  const [y = 0, m = 1, d = 1] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

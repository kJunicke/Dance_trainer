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

import { localDate } from '@/features/checklists'

/** A month in view. `month` is 1-12, the way people say it. */
export type MonthCursor = { year: number; month: number }

// Everything goes through Date.UTC, which normalises out-of-range days and
// months for free: Date.UTC(2026, 11, 32) is 1 January 2027. That is what
// removes every rollover branch below.
const utcDay = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day))

const isoDate = (at: Date) => localDate('UTC', at)

export function currentMonth(at: Date = new Date()): MonthCursor {
  return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1 }
}

/** `YYYY-MM` from the URL, or this month when it is absent or malformed. */
export function parseMonth(value: string | null, at: Date = new Date()): MonthCursor {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '')
  if (!match) return currentMonth(at)

  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return currentMonth(at)

  return { year, month }
}

export function formatMonth({ year, month }: MonthCursor): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function shiftMonth({ year, month }: MonthCursor, delta: number): MonthCursor {
  const at = utcDay(year, month + delta, 1)
  return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1 }
}

/** The first and last day of the month, for the overlap query. */
export function monthWindow({ year, month }: MonthCursor): { from: string; to: string } {
  return {
    from: isoDate(utcDay(year, month, 1)),
    to: isoDate(utcDay(year, month + 1, 0)),
  }
}

/**
 * The grid's cells as ISO dates, Monday first, padded with the neighbouring
 * months' days. A February that starts on a Monday is 28 cells, not a dead
 * sixth row.
 */
export function monthGridDays({ year, month }: MonthCursor): string[] {
  const first = utcDay(year, month, 1)
  // getUTCDay is Sunday-0; Monday-first wants Sunday last.
  const leading = (first.getUTCDay() + 6) % 7
  const days = utcDay(year, month + 1, 0).getUTCDate()
  const cells = Math.ceil((leading + days) / 7) * 7

  return Array.from({ length: cells }, (_, index) =>
    isoDate(utcDay(year, month, index + 1 - leading)),
  )
}

export function monthLabel({ year, month }: MonthCursor, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(utcDay(year, month, 1))
}

/** Today as an ISO date in the device's own zone — events are wall-clock. */
export function todayIso(at: Date = new Date()): string {
  return localDate(Intl.DateTimeFormat().resolvedOptions().timeZone, at)
}

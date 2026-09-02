/** ISO weekdays, Monday first — the order `checklist_templates.weekdays` uses. */
export const isoWeekdays = [1, 2, 3, 4, 5, 6, 7] as const

// 2024-01-01 was a Monday, so day n of that week is ISO weekday n.
const isoWeekdayDate = (weekday: number) => new Date(Date.UTC(2024, 0, weekday))

/** Localised weekday names, Monday first, from the browser's own calendar data. */
export function weekdayNames(locale: string, weekday: 'short' | 'long' = 'short') {
  const format = new Intl.DateTimeFormat(locale, { weekday, timeZone: 'UTC' })
  return isoWeekdays.map((day) => format.format(isoWeekdayDate(day)))
}

/**
 * The schedule as one line: the weekday names in ISO order, or null when a
 * template runs every day — the caller has a translated word for that.
 */
export function summariseWeekdays(weekdays: number[], locale: string): string | null {
  if (weekdays.length >= isoWeekdays.length) return null

  const names = weekdayNames(locale)
  return isoWeekdays
    .filter((day) => weekdays.includes(day))
    .map((day) => names[day - 1])
    .join(', ')
}

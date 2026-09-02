import type { GymEvent } from './queries'

type EventDates = Pick<GymEvent, 'starts_on' | 'start_time' | 'ends_on' | 'end_time'>

// Dates are wall-clock, so they are parsed and formatted in UTC: anything else
// slips a day for half the world.
const asUtc = (iso: string) => new Date(`${iso}T00:00:00Z`)

function formatDay(iso: string, locale: string, withYear: boolean) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: withYear ? 'numeric' : undefined,
    timeZone: 'UTC',
  }).format(asUtc(iso))
}

/** `19:00` from `19:00:00`; the seconds are never meaningful here. */
export const formatTime = (time: string) => time.slice(0, 5)

/**
 * When the event is, as one line: "2 Sep 2026", "2 Sep, 19:00–21:00",
 * "2–5 Sep 2026". The year is dropped from the start of a range that ends in
 * the same year, which is the half of the string that carries it.
 */
export function formatEventWhen(event: EventDates, locale: string): string {
  const { starts_on, start_time, ends_on, end_time } = event
  const sameYear = ends_on?.slice(0, 4) === starts_on.slice(0, 4)
  const start = formatDay(starts_on, locale, !ends_on || !sameYear)

  const times = [start_time, end_time]
    .filter((value): value is string => Boolean(value))
    .map(formatTime)
    .join('–')

  if (!ends_on || ends_on === starts_on) {
    return times ? `${start}, ${times}` : start
  }

  const end = formatDay(ends_on, locale, true)
  return times ? `${start} – ${end}, ${times}` : `${start} – ${end}`
}

/**
 * Whether the event covers this ISO date, so the grid can place its chip.
 * `last_on` is generated, which the client types as nullable; the database
 * never leaves it null.
 */
export function coversDay(event: Pick<GymEvent, 'starts_on' | 'last_on'>, day: string) {
  return event.starts_on <= day && day <= (event.last_on ?? event.starts_on)
}

/** The events of each day in the grid, keyed by ISO date. */
export function eventsByDay(events: GymEvent[], days: string[]) {
  const byDay = new Map<string, GymEvent[]>()

  for (const day of days) {
    byDay.set(
      day,
      events.filter((event) => coversDay(event, day)),
    )
  }

  return byDay
}

/**
 * The hostname, so a long campaign URL does not blow out a card. The link
 * constraint makes a parse failure impossible, but a throw here would take out
 * the whole list, so it falls back to the raw string.
 */
export function linkLabel(link: string): string {
  try {
    return new URL(link).hostname
  } catch {
    return link
  }
}

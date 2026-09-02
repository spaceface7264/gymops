/**
 * The calendar date in a gym's own time zone. Runs are dated by the gym's
 * clock (P4-02), so "today" on the run screen has to be asked of the gym, not
 * of the device — a phone in another zone would otherwise show yesterday.
 */
export function localDate(timeZone: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at)

  const part = (type: 'year' | 'month' | 'day') =>
    parts.find((candidate) => candidate.type === type)?.value ?? ''

  return `${part('year')}-${part('month')}-${part('day')}`
}

const dayMs = 24 * 60 * 60 * 1000

/**
 * The dates that can be "today" somewhere: no time zone is more than a day
 * away from UTC, so the query asks for three and the gym's own clock picks.
 */
export function possibleLocalDates(at: Date = new Date()): [string, string] {
  return [
    localDate('UTC', new Date(at.getTime() - dayMs)),
    localDate('UTC', new Date(at.getTime() + dayMs)),
  ]
}

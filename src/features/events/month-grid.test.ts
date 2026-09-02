import { describe, expect, it } from 'vitest'
import {
  formatMonth,
  monthGridDays,
  monthWindow,
  parseMonth,
  shiftMonth,
} from './month-grid'

const at = new Date('2026-09-02T10:00:00Z')

describe('the month in the URL', () => {
  it('reads YYYY-MM, and falls back to this month for anything else', () => {
    expect(parseMonth('2026-03', at)).toEqual({ year: 2026, month: 3 })
    expect(parseMonth(null, at)).toEqual({ year: 2026, month: 9 })
    expect(parseMonth('March', at)).toEqual({ year: 2026, month: 9 })
    expect(parseMonth('2026-13', at)).toEqual({ year: 2026, month: 9 })
  })

  it('pads the month back out', () => {
    expect(formatMonth({ year: 2026, month: 3 })).toBe('2026-03')
  })

  it('rolls over the year in both directions', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
  })
})

describe('the month window', () => {
  it('spans the first to the last day, leap February included', () => {
    expect(monthWindow({ year: 2026, month: 9 })).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    })
    expect(monthWindow({ year: 2028, month: 2 })).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    })
  })
})

describe('the grid', () => {
  it('starts on the Monday before the first, and ends on a Sunday', () => {
    // 1 September 2026 is a Tuesday, so the grid opens on 31 August.
    const days = monthGridDays({ year: 2026, month: 9 })

    expect(days[0]).toBe('2026-08-31')
    expect(days).toContain('2026-09-30')
    expect(days.length % 7).toBe(0)
  })

  it('gives a February that starts on a Monday four rows, not five', () => {
    // 1 February 2027 is a Monday and the month is 28 days.
    expect(monthGridDays({ year: 2027, month: 2 })).toHaveLength(28)
  })

  it('needs six rows for a 31-day month that starts on a Sunday', () => {
    // 1 August 2027 is a Sunday, so six leading blanks plus 31 days.
    expect(monthGridDays({ year: 2027, month: 8 })).toHaveLength(42)
  })

  it('runs January over into the previous year without a gap', () => {
    const days = monthGridDays({ year: 2027, month: 1 })

    expect(days[0]).toBe('2026-12-28')
    expect(days).toContain('2027-01-01')
  })
})

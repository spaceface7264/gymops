import { describe, expect, it } from 'vitest'
import { resources, supportedLocales } from '@/lib/i18n'

/**
 * The missing-key gate (PROJECT_SPEC.md §5): every namespace must carry the
 * same keys in every locale. Runs in `npm test`, so CI fails on a missing
 * translation instead of shipping an English string to a Danish user.
 */
function flatten(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]

  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  )
}

const namespaces = Object.keys(resources.en) as (keyof typeof resources.en)[]

describe('locales', () => {
  it('defines the same namespaces in every locale', () => {
    for (const locale of supportedLocales) {
      expect(Object.keys(resources[locale]).sort()).toEqual([...namespaces].sort())
    }
  })

  it.each(namespaces)('defines the same keys in every locale for "%s"', (namespace) => {
    const expected = flatten(resources.en[namespace]).sort()

    for (const locale of supportedLocales) {
      expect(flatten(resources[locale][namespace]).sort(), `locale "${locale}"`).toEqual(
        expected,
      )
    }
  })

  it.each(namespaces)('has no empty string in "%s"', (namespace) => {
    for (const locale of supportedLocales) {
      const values = JSON.stringify(resources[locale][namespace])
      expect(values, `locale "${locale}"`).not.toContain('""')
    }
  })
})

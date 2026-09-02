import type { DailyLogEntry } from './queries'

/** Long enough for a sentence, short enough to read in the incident list. */
const titleLength = 80

/**
 * The incident an "issue" entry becomes (spec §2.2). The first line is the
 * title, the entry itself is the description, and the tags come along because
 * they are usually where the entry says *where* — `#wall4`, `#sauna`.
 *
 * Nothing is filed here: this only fills the report form, so the person
 * converting still picks the kind and the severity and can rewrite both fields.
 */
export function incidentDraft(entry: Pick<DailyLogEntry, 'body' | 'tags'>): {
  title: string
  body: string
} {
  const [firstLine = ''] = entry.body.trim().split('\n')
  const title =
    firstLine.length > titleLength
      ? `${firstLine.slice(0, titleLength).trimEnd()}…`
      : firstLine

  const tags = entry.tags.map((tag) => `#${tag}`).join(' ')

  return {
    title,
    body: tags === '' ? entry.body.trim() : `${entry.body.trim()}\n\n${tags}`,
  }
}

/** The `/incidents/new` link that opens the form on that draft. */
export function incidentDraftPath(entry: Pick<DailyLogEntry, 'body' | 'tags'>): string {
  const draft = incidentDraft(entry)
  const query = new URLSearchParams({ title: draft.title, body: draft.body })
  return `/incidents/new?${query.toString()}`
}

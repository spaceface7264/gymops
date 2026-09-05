import type { TFunction } from 'i18next'

/** Somebody with a name to show, falling back to their email. */
export type Named = { full_name: string | null; email: string } | null | undefined

export const personName = (person: Named, t: TFunction) =>
  person?.full_name?.trim() || person?.email || t('chat.someone')

/**
 * Who a line is from, as the stream says it: the assistant, "You" for the
 * viewer's own, else the author's name.
 */
export function speakerName(
  line: { from_assistant: boolean; created_by: string | null; author: Named },
  viewerId: string | undefined,
  t: TFunction,
): string {
  if (line.from_assistant) return t('chat.assistant')
  if (line.created_by !== null && line.created_by === viewerId) return t('chat.you')
  return personName(line.author, t)
}

/** The first line of a body, for a quote or a strip. */
export const firstLine = (body: string) => body.split('\n')[0] ?? ''

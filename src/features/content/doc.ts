import type { JSONContent } from '@tiptap/react'
import type { Json } from '@/lib/database.types'

/** What an empty `posts.body` / `guides.body` looks like, matching the column default. */
export const emptyDoc: JSONContent = { type: 'doc', content: [] }

/**
 * `body` is `Json` in the generated types because Postgres only promises us
 * jsonb. Tiptap is the only thing that writes it, so a document that is not a
 * doc node is treated as an empty one rather than crashing the page.
 */
export function toDoc(body: Json | null | undefined): JSONContent {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return emptyDoc
  const doc = body as JSONContent
  return doc.type === 'doc' ? doc : emptyDoc
}

/** The plain text of a document — the client-side twin of SQL `tiptap_text()`. */
export function docText(doc: JSONContent): string {
  const parts: string[] = []

  const walk = (node: JSONContent) => {
    if (typeof node.text === 'string') parts.push(node.text)
    node.content?.forEach(walk)
  }
  walk(doc)

  return parts.join(' ')
}

export function isEmptyDoc(doc: JSONContent): boolean {
  return docText(doc).trim() === '' && !hasImage(doc)
}

function hasImage(node: JSONContent): boolean {
  return node.type === 'image' || (node.content?.some(hasImage) ?? false)
}

/** A one-line preview for the news feed and search results. */
export function excerpt(doc: JSONContent, maxLength = 180): string {
  const text = docText(doc).replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text
}

/**
 * Where an uploaded image lives in the `content` bucket. The first segment is
 * the scope the storage policies read (`content_object_gym`), so an image
 * inherits the permissions of the post or guide it sits in.
 */
export function contentImagePath(gymId: string | null, fileName: string): string {
  const extension = fileName.includes('.')
    ? fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
    : 'png'
  return `${gymId ?? 'company'}/${crypto.randomUUID()}.${extension}`
}

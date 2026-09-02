import type { NewsPost } from './queries'

/** A published post is dated by its publication; a draft by its last edit. */
export function postDate(
  post: Pick<NewsPost, 'status' | 'published_at' | 'updated_at'>,
  language: string,
): string {
  const stamp = post.status === 'published' ? post.published_at : post.updated_at
  return new Date(stamp ?? post.updated_at).toLocaleString(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

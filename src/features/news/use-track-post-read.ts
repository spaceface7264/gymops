import { useEffect, useRef } from 'react'
import { useAuth } from '@/features/auth'
import { useMarkPostRead, type NewsPost } from './queries'

/**
 * Records that this person opened a published post, once per mount. Drafts do
 * not count: the only people who can see one are its editors.
 */
export function useTrackPostRead(post: Pick<NewsPost, 'id' | 'status'> | undefined) {
  const { user } = useAuth()
  const markRead = useMarkPostRead()
  const marked = useRef<string | null>(null)

  const postId = post?.status === 'published' ? post.id : undefined
  const userId = user?.id
  const mark = markRead.mutate

  useEffect(() => {
    if (!postId || !userId || marked.current === postId) return
    marked.current = postId
    mark({ postId, userId })
  }, [postId, userId, mark])
}

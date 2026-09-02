import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/react'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

type PostRow = Database['public']['Tables']['posts']['Row']

/** The feed and the detail view read the same columns; `body` drives the excerpt. */
const postColumns =
  'id, gym_id, title, body, status, published_at, pinned, requires_ack, created_at, updated_at, gyms(id, name)'

export type NewsPost = Pick<
  PostRow,
  | 'id'
  | 'gym_id'
  | 'title'
  | 'body'
  | 'status'
  | 'published_at'
  | 'pinned'
  | 'requires_ack'
  | 'created_at'
  | 'updated_at'
> & { gyms: { id: string; name: string } | null }

export type PostInput = {
  gymId: string | null
  title: string
  body: JSONContent
  requiresAck: boolean
  status: Database['public']['Enums']['content_status']
}

export const newsKeys = {
  all: ['news'] as const,
  list: (gymId: string | null) => ['news', 'list', gymId] as const,
  detail: (postId: string) => ['news', 'detail', postId] as const,
}

/**
 * The feed for the gym in the switcher: that gym's posts plus the company-wide
 * ones, or everything the viewer may see when the scope is "all gyms". Drafts
 * come back only for the people `posts_select` lets edit them, and are labelled
 * as drafts rather than hidden — an editor needs to find their own unfinished
 * post.
 */
export function useNewsFeed(gymId: string | null) {
  return useQuery({
    queryKey: newsKeys.list(gymId),
    queryFn: async () => {
      let query = supabase
        .from('posts')
        .select(postColumns)
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false, nullsFirst: true })
        .order('created_at', { ascending: false })

      if (gymId) query = query.or(`gym_id.eq.${gymId},gym_id.is.null`)

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useNewsPost(postId: string | undefined) {
  return useQuery({
    queryKey: newsKeys.detail(postId ?? ''),
    enabled: Boolean(postId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(postColumns)
        .eq('id', postId ?? '')
        .single()

      if (error) throw error
      return data
    },
  })
}

/** Every write invalidates the whole `news` tree: a post moves between feeds. */
function useNewsWrite<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: newsKeys.all }),
  })
}

const toRow = (input: PostInput) => ({
  gym_id: input.gymId,
  title: input.title.trim(),
  body: input.body as unknown as Database['public']['Tables']['posts']['Insert']['body'],
  requires_ack: input.requiresAck,
  status: input.status,
})

export function useCreatePost() {
  return useNewsWrite(async (input: PostInput) => {
    const { data, error } = await supabase
      .from('posts')
      .insert(toRow(input))
      .select('id')
      .single()

    if (error) throw error
    return data.id
  })
}

export function useUpdatePost() {
  return useNewsWrite(async ({ id, ...input }: PostInput & { id: string }) => {
    const { error } = await supabase.from('posts').update(toRow(input)).eq('id', id)
    if (error) throw error
    return id
  })
}

/** Pinning is a one-field update, so it works straight from the feed. */
export function useSetPostPinned() {
  return useNewsWrite(async ({ id, pinned }: { id: string; pinned: boolean }) => {
    const { error } = await supabase.from('posts').update({ pinned }).eq('id', id)
    if (error) throw error
  })
}

/**
 * Publishing and unpublishing. `published_at` is stamped and cleared by the
 * database trigger, so the two never disagree.
 */
export function useSetPostStatus() {
  return useNewsWrite(
    async ({
      id,
      status,
    }: {
      id: string
      status: Database['public']['Enums']['content_status']
    }) => {
      const { error } = await supabase.from('posts').update({ status }).eq('id', id)
      if (error) throw error
    },
  )
}

/** Soft delete (spec §2.5): no client may remove the row itself. */
export function useDeletePost() {
  return useNewsWrite(async (id: string) => {
    const { error } = await supabase
      .from('posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  })
}

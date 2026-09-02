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
  myRead: (postId: string, userId: string) => ['news', 'read', postId, userId] as const,
  unread: (gymId: string | null, userId: string) =>
    ['news', 'unread', gymId, userId] as const,
  ackReport: (postId: string, gymId: string | null) =>
    ['news', 'ack-report', postId, gymId] as const,
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
        // Deleted posts stay readable to the people who may publish there, so
        // that deleting them is possible at all (20260902171000). Every list
        // and detail query leaves them out.
        .is('deleted_at', null)
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
        .is('deleted_at', null)
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

/**
 * Opening a post records that this person has seen it. `ignoreDuplicates` keeps
 * the first read rather than the latest, and leaves an acknowledgement that is
 * already there alone.
 */
export function useMarkPostRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ postId, userId }: { postId: string; userId: string }) => {
      const { error } = await supabase
        .from('post_reads')
        .upsert({ post_id: postId, user_id: userId }, { ignoreDuplicates: true })

      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: newsKeys.all }),
  })
}

/**
 * The acknowledgement button (P3-04): "I have read this". The timestamp sent
 * here only says *that* this is a confirmation — `post_reads_guard` replaces it
 * with the database's own clock, so the record cannot be backdated.
 */
export function useAcknowledgePost() {
  return useNewsWrite(async ({ postId, userId }: { postId: string; userId: string }) => {
    const { error } = await supabase.from('post_reads').upsert(
      {
        post_id: postId,
        user_id: userId,
        acknowledged_at: new Date().toISOString(),
      },
      { onConflict: 'post_id,user_id' },
    )

    if (error) throw error
  })
}

/** Whether the signed-in person has read and acknowledged one post. */
export function useMyPostRead(postId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: newsKeys.myRead(postId ?? '', userId ?? ''),
    enabled: Boolean(postId && userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_reads')
        .select('read_at, acknowledged_at')
        .eq('post_id', postId ?? '')
        .eq('user_id', userId ?? '')
        .maybeSingle()

      if (error) throw error
      return data
    },
  })
}

export type AckReportRow = {
  userId: string
  name: string
  /** Null for an admin, who belongs to the company rather than to a gym. */
  gymName: string | null
  acknowledgedAt: string | null
}

/**
 * Who still has to confirm a post (spec §2.2). The audience is the gym's
 * members for a gym post, and everyone the viewer may report on for a
 * company-wide one — which `gym_memberships` RLS already narrows to their own
 * gyms for a manager, so the report is per gym without asking for a gym.
 *
 * Admins and superadmins hold no membership anywhere, so a company-wide post
 * has to ask `profiles` for them too; without that they were quietly missing
 * from a report that claims to cover everyone. A manager cannot read those
 * profiles, which is right: their report is their own gyms.
 */
export function useAckReport(
  postId: string | undefined,
  gymId: string | null | undefined,
  requiresAck: boolean,
) {
  return useQuery({
    queryKey: newsKeys.ackReport(postId ?? '', gymId ?? null),
    enabled: Boolean(postId && requiresAck),
    queryFn: async (): Promise<AckReportRow[]> => {
      let audience = supabase
        .from('gym_memberships')
        .select('user_id, gyms(name), profiles(id, full_name, email, active)')
      if (gymId) audience = audience.eq('gym_id', gymId)

      const [members, reads] = await Promise.all([
        audience,
        supabase
          .from('post_reads')
          .select('user_id, acknowledged_at')
          .eq('post_id', postId ?? ''),
      ])

      if (members.error) throw members.error
      if (reads.error) throw reads.error

      // Only for a company-wide post, and only an admin can read these rows.
      const admins = gymId
        ? null
        : await supabase
            .from('profiles')
            .select('id, full_name, email, active')
            .or('is_admin.eq.true,is_superadmin.eq.true')

      if (admins?.error) throw admins.error

      const acknowledged = new Map(
        reads.data.map((read) => [read.user_id, read.acknowledged_at]),
      )

      const rows = new Map<string, AckReportRow>()

      for (const member of members.data) {
        if (!member.profiles?.active) continue
        rows.set(member.user_id, {
          userId: member.user_id,
          name: member.profiles.full_name ?? member.profiles.email,
          gymName: member.gyms?.name ?? null,
          acknowledgedAt: acknowledged.get(member.user_id) ?? null,
        })
      }

      for (const admin of admins?.data ?? []) {
        // No gym name: an admin belongs to the company, not to a gym.
        if (!admin.active || rows.has(admin.id)) continue
        rows.set(admin.id, {
          userId: admin.id,
          name: admin.full_name ?? admin.email,
          gymName: null,
          acknowledgedAt: acknowledged.get(admin.id) ?? null,
        })
      }

      return [...rows.values()].sort(
        (a, b) =>
          Number(Boolean(a.acknowledgedAt)) - Number(Boolean(b.acknowledgedAt)) ||
          (a.gymName ?? '').localeCompare(b.gymName ?? '') ||
          a.name.localeCompare(b.name),
      )
    },
  })
}

export type HomePost = NewsPost & {
  post_reads: { read_at: string; acknowledged_at: string | null }[]
}

/**
 * The published posts this person still has to deal with: the ones they have
 * not opened, and the ones they have opened but not acknowledged. The read row
 * is embedded and filtered to the signed-in user, so one query answers it —
 * `post_reads` RLS would hide everyone else's rows anyway.
 */
export function useUnreadNews(gymId: string | null, userId: string | undefined) {
  return useQuery({
    queryKey: newsKeys.unread(gymId, userId ?? ''),
    enabled: Boolean(userId),
    queryFn: async () => {
      let query = supabase
        .from('posts')
        .select(`${postColumns}, post_reads!left(read_at, acknowledged_at)`)
        .is('deleted_at', null)
        .eq('status', 'published')
        .eq('post_reads.user_id', userId ?? '')
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false })

      if (gymId) query = query.or(`gym_id.eq.${gymId},gym_id.is.null`)

      const { data, error } = await query
      if (error) throw error

      return (data as HomePost[]).filter((post) => {
        const read = post.post_reads[0]
        return !read || (post.requires_ack && !read.acknowledged_at)
      })
    },
  })
}
